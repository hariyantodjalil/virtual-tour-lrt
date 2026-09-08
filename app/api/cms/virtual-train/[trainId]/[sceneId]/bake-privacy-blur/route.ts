import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  downloadFromS3,
  extractS3KeyFromUrl,
  generateS3Key,
  uploadToS3,
} from "@/lib/s3";
import { formatBytes } from "@/lib/image-processor";
import sharp from "sharp";
import {
  bakePrivacyBlursIntoPanoramaBuffer,
  finalizeBakedPanorama,
} from "@/lib/panorama-privacy-blur-bake";
import {
  normalizePrivacyBlurs,
  markPrivacyBlurBaked,
  getPrivacyBlurSourcePanoramaUrl,
} from "@/lib/privacy-blur-normalize";
import { parseJsonRequest } from "@/lib/api-validation";
import { privacyBlurBakeSchema } from "@/lib/api-schemas";

type Params = { params: Promise<{ trainId: string; sceneId: string }> };

const sceneSelect = {
  id: true,
  trainId: true,
  sceneId: true,
  title: true,
  car: true,
  carId: true,
  zoneId: true,
  panoramaUrl: true,
  thumbnailUrl: true,
  order: true,
  hotspots: true,
  canvasData: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

/** POST — bake blur privasi ke piksel panorama kereta, upload ulang. */
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { trainId, sceneId } = await params;
  const parsed = await parseJsonRequest(request, privacyBlurBakeSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  const blurs = normalizePrivacyBlurs(body.privacyBlurs);
  if (blurs.length === 0) {
    return NextResponse.json({ error: "Tidak ada area blur untuk dibake" }, { status: 400 });
  }

  const viewerWidth = Number(body.viewerWidth);
  const viewerHeight = Number(body.viewerHeight);
  const hfov = Number(body.hfov);

  const scene = await prisma.trainTourScene.findUnique({
    where: { trainId_sceneId: { trainId, sceneId } },
    select: { panoramaUrl: true, canvasData: true },
  });

  if (!scene?.panoramaUrl) {
    return NextResponse.json({ error: "Scene belum punya panorama" }, { status: 400 });
  }

  const sourcePanoramaUrl =
    getPrivacyBlurSourcePanoramaUrl(scene.canvasData) ?? scene.panoramaUrl;
  const sourceKey = extractS3KeyFromUrl(sourcePanoramaUrl);
  if (!sourceKey) {
    return NextResponse.json({ error: "URL master panorama tidak valid" }, { status: 400 });
  }

  const originalBuffer = await downloadFromS3(sourceKey);
  const originalSize = originalBuffer.length;

  const originalMeta = await sharp(originalBuffer, { limitInputPixels: false }).metadata();
  const sourceW = originalMeta.width ?? 0;
  const sourceH = originalMeta.height ?? 0;

  const { buffer: bakedRaw, width: bakedW, height: bakedH } =
    await bakePrivacyBlursIntoPanoramaBuffer(originalBuffer, blurs, {
      viewerWidth: Number.isFinite(viewerWidth) && viewerWidth > 0 ? viewerWidth : undefined,
      viewerHeight: Number.isFinite(viewerHeight) && viewerHeight > 0 ? viewerHeight : undefined,
      hfov: Number.isFinite(hfov) && hfov > 0 ? hfov : undefined,
    });

  const train = await prisma.train.findUnique({
    where: { id: trainId },
    select: { slug: true },
  });
  const trainSlug = `train-${train?.slug ?? trainId}`;

  const { panoramaBuffer, thumbnailBuffer, width, height, contentType } =
    await finalizeBakedPanorama(bakedRaw, bakedW, bakedH, originalBuffer);

  if (width !== sourceW || height !== sourceH) {
    return NextResponse.json(
      { error: `Resolusi output (${width}×${height}) ≠ master (${sourceW}×${sourceH})` },
      { status: 500 }
    );
  }

  const ext =
    contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";

  const panoramaKey = generateS3Key("panoramas", `${sceneId}.${ext}`, { stationSlug: trainSlug });
  await uploadToS3(panoramaBuffer, panoramaKey, contentType, {
    "train-id": trainId,
    "scene-id": sceneId,
    "train-slug": trainSlug,
    "privacy-blur-baked": "true",
    dimensions: `${width}x${height}`,
  });

  const thumbKey = generateS3Key("thumbnails", `${sceneId}.webp`, { stationSlug: trainSlug });
  await uploadToS3(thumbnailBuffer, thumbKey, "image/webp", {
    "train-id": trainId,
    "scene-id": sceneId,
    "train-slug": trainSlug,
    type: "thumbnail",
  });

  const panoramaUrl = `/${panoramaKey}`;
  const thumbnailUrl = `/${thumbKey}`;
  const canvasData = markPrivacyBlurBaked(scene.canvasData, blurs, sourcePanoramaUrl) as Prisma.InputJsonValue;

  const updated = await prisma.trainTourScene.update({
    where: { trainId_sceneId: { trainId, sceneId } },
    data: { panoramaUrl, thumbnailUrl, canvasData },
    select: sceneSelect,
  });

  return NextResponse.json({
    message: "Blur dibake ke panorama dan diupload",
    scene: updated,
    panoramaUrl,
    thumbnailUrl,
    optimization: {
      original: formatBytes(originalSize),
      panorama: formatBytes(panoramaBuffer.length),
      thumbnail: formatBytes(thumbnailBuffer.length),
      dimensions: `${width}×${height}`,
      sourceDimensions: `${sourceW}×${sourceH}`,
      resolutionPreserved: width === sourceW && height === sourceH,
    },
  });
}
