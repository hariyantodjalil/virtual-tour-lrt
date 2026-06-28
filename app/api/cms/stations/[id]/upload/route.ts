import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateS3Key, uploadToS3 } from "@/lib/s3";
import { processStationCover, formatBytes } from "@/lib/image-processor";

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

  const originalBuffer = Buffer.from(await file.arrayBuffer());
  const originalSize = originalBuffer.length;

  // Konversi ke WebP, resize max 1600px wide
  const result = await processStationCover(originalBuffer);

  const s3Key = generateS3Key("stations", `${station.slug}.webp`, { stationSlug: station.slug });
  await uploadToS3(result.buffer, s3Key, "image/webp", {
    "station-id": id,
    "station-slug": station.slug,
    "original-size": String(originalSize),
    "optimized-size": String(result.sizeBytes),
  });
  const imageUrl = `/${s3Key}`;

  const updated = await prisma.station.update({
    where: { id },
    data: { imageUrl },
  });

  return NextResponse.json({
    message: "Upload berhasil",
    station: updated,
    imageUrl,
    optimization: {
      original: formatBytes(originalSize),
      result: formatBytes(result.sizeBytes),
      saved: `${Math.round(((originalSize - result.sizeBytes) / originalSize) * 100)}%`,
    },
  });
}
