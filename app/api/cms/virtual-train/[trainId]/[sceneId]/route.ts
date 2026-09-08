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

  const { trainId, sceneId } = await params;
  const parsed = await parseJsonRequest(request, sceneUpdateSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  const updateData: Prisma.TrainTourSceneUncheckedUpdateInput = {};
  if (body.title !== undefined) updateData.title = body.title;
  if (body.level !== undefined) updateData.car = body.level;
  if (body.order !== undefined) updateData.order = body.order;
  if (body.hotspots !== undefined) updateData.hotspots = body.hotspots as Prisma.InputJsonValue;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;

  if (body.areaId !== undefined) {
    if (body.areaId === null) {
      updateData.zoneId = null;
    } else {
      const zone = await prisma.trainTourZone.findFirst({
        where: { id: body.areaId, trainId },
        include: { car: { select: { id: true, slug: true } } },
      });
      if (!zone) {
        return NextResponse.json({ error: "Zona tidak ditemukan di kereta ini" }, { status: 400 });
      }
      if (body.levelId && body.levelId !== zone.carId) {
        return NextResponse.json({ error: "Zona tidak berada pada gerbong yang dipilih" }, { status: 400 });
      }
      updateData.zoneId = zone.id;
      updateData.carId = zone.carId;
      updateData.car = zone.car.slug;
    }
  }

  if (body.areaId === undefined || body.areaId === null) {
    if (body.levelId !== undefined) {
      if (body.levelId) {
        const car = await prisma.trainTourCar.findFirst({
          where: { id: body.levelId, trainId },
          select: { id: true, slug: true },
        });
        if (!car) {
          return NextResponse.json({ error: "Gerbong tidak ditemukan di kereta ini" }, { status: 400 });
        }
        updateData.carId = car.id;
        updateData.car = car.slug;
      } else {
        updateData.carId = null;
      }
    }
  }

  if (body.panoramaUrl !== undefined) updateData.panoramaUrl = body.panoramaUrl;
  if (body.originalPanoramaUrl !== undefined) updateData.originalPanoramaUrl = body.originalPanoramaUrl;
  if (body.thumbnailUrl !== undefined) updateData.thumbnailUrl = body.thumbnailUrl;
  if (body.canvasData !== undefined) updateData.canvasData = body.canvasData as Prisma.InputJsonValue;

  const scene = await prisma.trainTourScene.update({
    where: { trainId_sceneId: { trainId, sceneId } },
    data: updateData,
    select: sceneSelect,
  });

  return NextResponse.json(scene);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { trainId, sceneId } = await params;
  await prisma.trainTourScene.delete({
    where: { trainId_sceneId: { trainId, sceneId } },
  });
  return NextResponse.json({ message: "Scene dihapus" });
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { trainId, sceneId } = await params;
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "File wajib diisi" }, { status: 400 });

  const train = await prisma.train.findUnique({
    where: { id: trainId },
    select: { slug: true },
  });
  const trainSlug = `train-${train?.slug ?? trainId}`;

  const upload = await readValidatedImageUpload(file, MAX_PANORAMA_UPLOAD_BYTES);
  if ("error" in upload) return NextResponse.json({ error: upload.error }, { status: 400 });
  const originalBuffer = upload.buffer;
  const originalSize = originalBuffer.length;

  const extension = panoramaExtension(file);
  const contentType = normalizedImageContentType(file);
  const panoramaResult = await processPanorama(originalBuffer);

  const originalKey = generateS3Key("originals", `${sceneId}.${extension}`, { stationSlug: trainSlug });
  await uploadToS3(originalBuffer, originalKey, contentType, {
    "train-id": trainId,
    "scene-id": sceneId,
    "train-slug": trainSlug,
  });

  const panoramaKey = generateS3Key("panoramas", `${sceneId}.webp`, { stationSlug: trainSlug });
  await uploadToS3(panoramaResult.buffer, panoramaKey, panoramaResult.contentType, {
    "train-id": trainId,
    "scene-id": sceneId,
    "train-slug": trainSlug,
  });

  const thumbResult = await generatePanoramaThumbnail(originalBuffer);
  const thumbKey = generateS3Key("thumbnails", `${sceneId}.webp`, { stationSlug: trainSlug });
  await uploadToS3(thumbResult.buffer, thumbKey, "image/webp", {
    "train-id": trainId,
    "scene-id": sceneId,
    "type": "thumbnail",
  });

  const panoramaUrl = `/${panoramaKey}`;
  const originalPanoramaUrl = `/${originalKey}`;
  const thumbnailUrl = `/${thumbKey}`;

  const existing = await prisma.trainTourScene.findUnique({
    where: { trainId_sceneId: { trainId, sceneId } },
    select: { canvasData: true },
  });
  const canvasData = resetPrivacyBlurForNewPanorama(
    existing?.canvasData,
    panoramaUrl
  ) as Prisma.InputJsonValue;

  const scene = await prisma.trainTourScene.update({
    where: { trainId_sceneId: { trainId, sceneId } },
    data: { panoramaUrl, originalPanoramaUrl, thumbnailUrl, canvasData },
    select: sceneSelect,
  });

  const displayDelta = originalSize - panoramaResult.sizeBytes;

  return NextResponse.json({
    message: "Panorama kereta disimpan",
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
