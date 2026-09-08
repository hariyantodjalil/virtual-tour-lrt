import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateS3Key, uploadToS3 } from "@/lib/s3";
import { processStationCover, formatBytes } from "@/lib/image-processor";
import { MAX_STANDARD_IMAGE_UPLOAD_BYTES, readValidatedImageUpload } from "@/lib/upload-validation";

type Params = { params: Promise<{ trainId: string }> };

/** Upload aset kreatif hotspot iklan kereta ke S3. */
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { trainId } = await params;
  const train = await prisma.train.findUnique({ where: { id: trainId } });
  if (!train) return NextResponse.json({ error: "Kereta tidak ditemukan" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "File wajib diisi" }, { status: 400 });

  const upload = await readValidatedImageUpload(file, MAX_STANDARD_IMAGE_UPLOAD_BYTES);
  if ("error" in upload) return NextResponse.json({ error: upload.error }, { status: 400 });
  const originalBuffer = upload.buffer;
  const originalSize = originalBuffer.length;
  const result = await processStationCover(originalBuffer);

  const trainSlug = `train-${train.slug}`;
  const s3Key = generateS3Key(
    "ad-creatives",
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`,
    { stationSlug: trainSlug }
  );
  await uploadToS3(result.buffer, s3Key, "image/webp", {
    "train-id": trainId,
    "train-slug": trainSlug,
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
