import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateS3Key, uploadToS3 } from "@/lib/s3";
import { processPanorama, generatePanoramaThumbnail, formatBytes } from "@/lib/image-processor";
import { resetPrivacyBlurForNewPanorama } from "@/lib/privacy-blur-normalize";
import { Prisma } from "@prisma/client";

type Params = { params: Promise<{ stationId: string; sceneId: string }> };

const sceneSelect = {
  id: true,
  stationId: true,
  sceneId: true,
  title: true,
  level: true,
  levelId: true,
  areaId: true,
  panoramaUrl: true,
  originalPanoramaUrl: true,
  thumbnailUrl: true,
  order: true,
  hotspots: true,
  canvasData: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

function panoramaExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function normalizedImageContentType(file: File) {
  return file.type === "image/jpg" ? "image/jpeg" : file.type;
}

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId, sceneId } = await params;
  const body = await request.json();

  // Hanya update panoramaUrl jika eksplisit dikirim (hindari overwrite saat save hotspot)
  const updateData: Record<string, unknown> = {
    title: body.title,
    level: body.level,
    order: body.order,
    hotspots: body.hotspots,
    isActive: body.isActive,
  };
  if (body.levelId !== undefined) updateData.levelId = body.levelId;
  if (body.areaId !== undefined) updateData.areaId = body.areaId;
  if (body.panoramaUrl !== undefined) updateData.panoramaUrl = body.panoramaUrl;
  if (body.originalPanoramaUrl !== undefined) updateData.originalPanoramaUrl = body.originalPanoramaUrl;
  if (body.thumbnailUrl !== undefined) updateData.thumbnailUrl = body.thumbnailUrl;
  if (body.canvasData !== undefined) updateData.canvasData = body.canvasData;

  const scene = await prisma.virtualTourScene.update({
    where: { stationId_sceneId: { stationId, sceneId } },
    data: updateData,
    select: sceneSelect,
  });

  return NextResponse.json(scene);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId, sceneId } = await params;
  await prisma.virtualTourScene.delete({
    where: { stationId_sceneId: { stationId, sceneId } },
  });
  return NextResponse.json({ message: "Scene dihapus" });
}

// POST — upload panorama, auto-convert ke WebP + generate thumbnail
export async function POST(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId, sceneId } = await params;
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "File wajib diisi" }, { status: 400 });

  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json(
      { error: "Panorama harus JPEG/PNG/WebP equirectangular" },
      { status: 400 }
    );
  }

  // Ambil slug stasiun
  const station = await prisma.station.findUnique({
    where: { id: stationId },
    select: { slug: true },
  });
  const stationSlug = station?.slug ?? stationId;

  // Baca buffer original
  const originalBuffer = Buffer.from(await file.arrayBuffer());
  const originalSize = originalBuffer.length;

  // ── Konversi panorama ke WebP (resize max 6000×3000, q82) ─────────────────
  const extension = panoramaExtension(file);
  const contentType = normalizedImageContentType(file);

  const originalKey = generateS3Key("originals", `${sceneId}.${extension}`, { stationSlug });
  await uploadToS3(originalBuffer, originalKey, contentType, {
    "station-id": stationId,
    "scene-id": sceneId,
    "station-slug": stationSlug,
    "original-size": String(originalSize),
    "stored-size": String(originalSize),
    "storage-mode": "master-original",
  });

  const panoramaResult = await processPanorama(originalBuffer);

  const panoramaKey = generateS3Key("panoramas", `${sceneId}.webp`, { stationSlug });
  await uploadToS3(panoramaResult.buffer, panoramaKey, panoramaResult.contentType, {
    "station-id": stationId,
    "scene-id": sceneId,
    "station-slug": stationSlug,
    "original-size": String(originalSize),
    "display-size": String(panoramaResult.sizeBytes),
    "display-format": "webp",
    "display-quality": "92",
    "dimensions": `${panoramaResult.width}x${panoramaResult.height}`,
  });

  // ── Generate thumbnail (900×450, q78) ─────────────────────────────────────
  const thumbResult = await generatePanoramaThumbnail(originalBuffer);

  const thumbKey = generateS3Key("thumbnails", `${sceneId}.webp`, { stationSlug });
  await uploadToS3(thumbResult.buffer, thumbKey, "image/webp", {
    "station-id": stationId,
    "scene-id": sceneId,
    "station-slug": stationSlug,
    "type": "thumbnail",
  });

  const panoramaUrl = `/${panoramaKey}`;
  const originalPanoramaUrl = `/${originalKey}`;
  const thumbnailUrl = `/${thumbKey}`;

  const existing = await prisma.virtualTourScene.findUnique({
    where: { stationId_sceneId: { stationId, sceneId } },
    select: { canvasData: true },
  });
  const canvasData = resetPrivacyBlurForNewPanorama(
    existing?.canvasData,
    panoramaUrl
  ) as Prisma.InputJsonValue;

  const scene = await prisma.virtualTourScene.update({
    where: { stationId_sceneId: { stationId, sceneId } },
    data: { panoramaUrl, originalPanoramaUrl, thumbnailUrl, canvasData },
    select: sceneSelect,
  });
  const displayDelta = originalSize - panoramaResult.sizeBytes;

  return NextResponse.json({
    message: "Panorama original disimpan dan display WebP full-res dibuat",
    scene,
    panoramaUrl,
    originalPanoramaUrl,
    thumbnailUrl,
    optimization: {
      original: formatBytes(originalSize),
      panorama: formatBytes(panoramaResult.sizeBytes),
      thumbnail: formatBytes(thumbResult.sizeBytes),
      saved:
        displayDelta >= 0
          ? `${formatBytes(displayDelta)} lebih kecil dari original`
          : `${formatBytes(Math.abs(displayDelta))} lebih besar dari original`,
      format: "WEBP",
      dimensions: `${panoramaResult.width}x${panoramaResult.height}`,
    },
  });
}
