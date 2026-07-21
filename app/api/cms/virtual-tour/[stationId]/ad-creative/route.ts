import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateS3Key, uploadToS3 } from "@/lib/s3";
import { processStationCover, formatBytes } from "@/lib/image-processor";

type Params = { params: Promise<{ stationId: string }> };

/** Upload aset kreatif hotspot iklan ke S3. */
export async function POST(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId } = await params;
  const station = await prisma.station.findUnique({ where: { id: stationId } });
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
  const result = await processStationCover(originalBuffer);

  const s3Key = generateS3Key(
    "ad-creatives",
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`,
    { stationSlug: station.slug }
  );
  await uploadToS3(result.buffer, s3Key, "image/webp", {
    "station-id": stationId,
    "station-slug": station.slug,
  });

  const creativeUrl = `/${s3Key}`;

  return NextResponse.json({
    message: "Upload kreatif berhasil",
    creativeUrl,
    optimization: {
      original: formatBytes(originalSize),
      result: formatBytes(result.sizeBytes),
    },
  });
}
