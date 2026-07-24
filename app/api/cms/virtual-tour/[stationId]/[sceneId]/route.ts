import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateS3Key, uploadToS3 } from "@/lib/s3";
import { processPanorama, generatePanoramaThumbnail, formatBytes } from "@/lib/image-processor";
import { resetPrivacyBlurForNewPanorama } from "@/lib/privacy-blur-normalize";
import { Prisma } from "@prisma/client";
import { MAX_PANORAMA_UPLOAD_BYTES, readValidatedImageUpload } from "@/lib/upload-validation";
import { parseJsonRequest } from "@/lib/api-validation";
import { sceneUpdateSchema } from "@/lib/api-schemas";

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
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId, sceneId } = await params;
  const parsed = await parseJsonRequest(request, sceneUpdateSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  // Hanya update panoramaUrl jika eksplisit dikirim (hindari overwrite saat save hotspot)
  const updateData: Prisma.VirtualTourSceneUncheckedUpdateInput = {};
  if (body.title !== undefined) updateData.title = body.title;
  if (body.level !== undefined) updateData.level = body.level;
  if (body.order !== undefined) updateData.order = body.order;
  if (body.hotspots !== undefined) updateData.hotspots = body.hotspots as Prisma.InputJsonValue;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;
  if (body.areaId !== undefined) {
    if (body.areaId === null) {
      updateData.areaId = null;
    } else {
      const area = await prisma.virtualTourArea.findFirst({
        where: { id: body.areaId, stationId },
        include: { level: { select: { id: true, slug: true } } },
      });
      if (!area) {
        return NextResponse.json({ error: "Area tidak ditemukan di stasiun ini" }, { status: 400 });
      }
      if (body.levelId && body.levelId !== area.levelId) {
        return NextResponse.json({ error: "Area tidak berada pada level yang dipilih" }, { status: 400 });
      }
      updateData.areaId = area.id;
      updateData.levelId = area.levelId;
      updateData.level = area.level.slug;
    }
  }

  if (body.areaId === undefined || body.areaId === null) {
    if (body.levelId !== undefined) {
      if (body.levelId) {
        const level = await prisma.virtualTourLevel.findFirst({
          where: { id: body.levelId, stationId },
          select: { id: true, slug: true },
        });
        if (!level) {
          return NextResponse.json({ error: "Level tidak ditemukan di stasiun ini" }, { status: 400 });
        }
        updateData.levelId = level.id;
        updateData.level = level.slug;
      } else {
        updateData.levelId = null;
      }
    }
  }
  if (body.panoramaUrl !== undefined) updateData.panoramaUrl = body.panoramaUrl;
  if (body.originalPanoramaUrl !== undefined) updateData.originalPanoramaUrl = body.originalPanoramaUrl;
  if (body.thumbnailUrl !== undefined) updateData.thumbnailUrl = body.thumbnailUrl;
  if (body.canvasData !== undefined) updateData.canvasData = body.canvasData as Prisma.InputJsonValue;

  const scene = await prisma.virtualTourScene.update({
    where: { stationId_sceneId: { stationId, sceneId } },
    data: updateData,
    select: sceneSelect,
  });

  return NextResponse.json(scene);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId, sceneId } = await params;
  await prisma.virtualTourScene.delete({
    where: { stationId_sceneId: { stationId, sceneId } },
  });
  return NextResponse.json({ message: "Scene dihapus" });
}

// POST — upload panorama, auto-convert ke WebP + generate thumbnail
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId, sceneId } = await params;
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "File wajib diisi" }, { status: 400 });

  // Ambil slug stasiun
  const station = await prisma.station.findUnique({
    where: { id: stationId },
    select: { slug: true },
  });
  const stationSlug = station?.slug ?? stationId;

  // Baca buffer original
  const upload = await readValidatedImageUpload(file, MAX_PANORAMA_UPLOAD_BYTES);
  if ("error" in upload) return NextResponse.json({ error: upload.error }, { status: 400 });
  const originalBuffer = upload.buffer;
  const originalSize = originalBuffer.length;

  // ── Konversi panorama ke WebP (resize max 6000×3000, q82) ─────────────────
  const extension = panoramaExtension(file);
  const contentType = normalizedImageContentType(file);
  const panoramaResult = await processPanorama(originalBuffer);

  const originalKey = generateS3Key("originals", `${sceneId}.${extension}`, { stationSlug });
  await uploadToS3(originalBuffer, originalKey, contentType, {
    "station-id": stationId,
    "scene-id": sceneId,
    "station-slug": stationSlug,
    "original-size": String(originalSize),
    "stored-size": String(originalSize),
    "storage-mode": "master-original",
  });

  const panoramaKey = generateS3Key("panoramas", `${sceneId}.webp`, { stationSlug });
  await uploadToS3(panoramaResult.buffer, panoramaKey, panoramaResult.contentType, {
    "station-id": stationId,
    "scene-id": sceneId,
    "station-slug": stationSlug,
    "original-size": String(originalSize),
    "display-size": String(panoramaResult.sizeBytes),
    "display-format": "webp",
    "display-quality": "82",
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
