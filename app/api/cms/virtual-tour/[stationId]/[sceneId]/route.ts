import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateS3Key, uploadToS3 } from "@/lib/s3";
import { processPanorama, generatePanoramaThumbnail, formatBytes } from "@/lib/image-processor";

type Params = { params: Promise<{ stationId: string; sceneId: string }> };

const sceneSelect = {
  id: true,
  stationId: true,
  sceneId: true,
  title: true,
  level: true,
  panoramaUrl: true,
  thumbnailUrl: true,
  order: true,
  hotspots: true,
  canvasData: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

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
  if (body.panoramaUrl !== undefined) updateData.panoramaUrl = body.panoramaUrl;
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
  const panoramaResult = await processPanorama(originalBuffer);

  const panoramaKey = generateS3Key("panoramas", `${sceneId}.webp`, { stationSlug });
  await uploadToS3(panoramaResult.buffer, panoramaKey, "image/webp", {
    "station-id": stationId,
    "scene-id": sceneId,
    "station-slug": stationSlug,
    "original-size": String(originalSize),
    "optimized-size": String(panoramaResult.sizeBytes),
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
  const thumbnailUrl = `/${thumbKey}`;

  const scene = await prisma.virtualTourScene.update({
    where: { stationId_sceneId: { stationId, sceneId } },
    data: { panoramaUrl, thumbnailUrl },
    select: sceneSelect,
  });

  const savedBytes = originalSize - panoramaResult.sizeBytes;
  const savedPercent = Math.round((savedBytes / originalSize) * 100);

  return NextResponse.json({
    message: "Panorama diupload & dioptimasi",
    scene,
    panoramaUrl,
    thumbnailUrl,
    optimization: {
      original: formatBytes(originalSize),
      panorama: formatBytes(panoramaResult.sizeBytes),
      thumbnail: formatBytes(thumbResult.sizeBytes),
      saved: `${formatBytes(savedBytes)} (${savedPercent}%)`,
      dimensions: `${panoramaResult.width}×${panoramaResult.height}`,
    },
  });
}
