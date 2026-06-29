import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateS3Key, uploadToS3 } from "@/lib/s3";
import { processSpacePhoto } from "@/lib/image-processor";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();
  const space = await prisma.commercialSpace.update({ where: { id }, data: body });
  return NextResponse.json(space);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  await prisma.commercialSpace.delete({ where: { id } });
  return NextResponse.json({ message: "Unit dihapus" });
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "File wajib diisi" }, { status: 400 });

  const originalBuffer = Buffer.from(await file.arrayBuffer());
  const result = await processSpacePhoto(originalBuffer);

  const s3Key = generateS3Key("spaces", `${id}.webp`);
  await uploadToS3(result.buffer, s3Key, "image/webp");
  const panoramaUrl = `/${s3Key}`;

  const space = await prisma.commercialSpace.update({
    where: { id },
    data: { panoramaUrl },
  });

  return NextResponse.json({ message: "Upload berhasil", space });
}
