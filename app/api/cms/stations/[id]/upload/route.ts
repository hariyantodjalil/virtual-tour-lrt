import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateS3Key, uploadToS3 } from "@/lib/s3";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const station = await prisma.station.findUnique({ where: { id } });
  if (!station) return NextResponse.json({ error: "Stasiun tidak ditemukan" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "File wajib diisi" }, { status: 400 });

  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Format file tidak didukung" }, { status: 400 });
  }

  const s3Key = generateS3Key("stations", file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadToS3(buffer, s3Key, file.type);
  const imageUrl = `/${s3Key}`;

  const updated = await prisma.station.update({
    where: { id },
    data: { imageUrl },
  });

  return NextResponse.json({ message: "Upload berhasil", station: updated, imageUrl });
}
