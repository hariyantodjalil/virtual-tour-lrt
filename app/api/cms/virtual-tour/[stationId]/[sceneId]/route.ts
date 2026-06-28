import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateS3Key, uploadToS3 } from "@/lib/s3";

type Params = { params: Promise<{ stationId: string; sceneId: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId, sceneId } = await params;
  const body = await request.json();

  const scene = await prisma.virtualTourScene.update({
    where: { stationId_sceneId: { stationId, sceneId } },
    data: {
      title: body.title,
      order: body.order,
      hotspots: body.hotspots,
      isActive: body.isActive,
      panoramaUrl: body.panoramaUrl,
    },
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

export async function POST(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId, sceneId } = await params;
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "File wajib diisi" }, { status: 400 });

  const allowed = ["image/jpeg", "image/jpg", "image/png"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Panorama harus JPEG/PNG equirectangular" }, { status: 400 });
  }

  const s3Key = generateS3Key("panoramas", file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadToS3(buffer, s3Key, file.type);
  const panoramaUrl = `/${s3Key}`;

  const scene = await prisma.virtualTourScene.update({
    where: { stationId_sceneId: { stationId, sceneId } },
    data: { panoramaUrl },
  });

  return NextResponse.json({ message: "Panorama diupload", scene, panoramaUrl });
}
