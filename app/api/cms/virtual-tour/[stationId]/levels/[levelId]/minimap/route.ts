import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateS3Key, uploadToS3 } from "@/lib/s3";
import { processFloorPlan } from "@/lib/image-processor";
import { MAX_STANDARD_IMAGE_UPLOAD_BYTES, readValidatedImageUpload } from "@/lib/upload-validation";
import { parseJsonRequest } from "@/lib/api-validation";
import { parseLevelMinimap } from "@/lib/minimap";
import { setLevelMinimap } from "@/lib/level-minimap-store";

type Params = { params: Promise<{ stationId: string; levelId: string }> };

const coordinate = z.number().finite().min(-100_000).max(100_000);
const point = z.object({ x: coordinate, y: coordinate }).strict();
const pin = z
  .object({
    x: coordinate,
    y: coordinate,
    yawRef: z.number().finite().min(-3600).max(3600).optional(),
    angleRef: z.number().finite().min(-100).max(100).optional(),
  })
  .strict();

const minimapBodySchema = z
  .object({
    minimap: z
      .object({
        imageUrl: z.string().trim().min(1).max(1024),
        width: z.number().int().min(1).max(20_000),
        height: z.number().int().min(1).max(20_000),
        corners: z.tuple([point, point, point]).optional(),
        pins: z.record(z.string().trim().min(1).max(128), pin),
      })
      .strict()
      .nullable(),
  })
  .strict();

async function findLevel(stationId: string, levelId: string) {
  return prisma.virtualTourLevel.findFirst({
    where: { id: levelId, stationId },
    include: { station: { select: { slug: true } } },
  });
}

/** Unggah gambar denah untuk level; mengembalikan URL dan ukuran gambar hasil proses. */
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId, levelId } = await params;
  const level = await findLevel(stationId, levelId);
  if (!level) return NextResponse.json({ error: "Level tidak ditemukan" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "File wajib diisi" }, { status: 400 });

  const upload = await readValidatedImageUpload(file, MAX_STANDARD_IMAGE_UPLOAD_BYTES);
  if ("error" in upload) return NextResponse.json({ error: upload.error }, { status: 400 });

  const result = await processFloorPlan(upload.buffer);
  const s3Key = generateS3Key("floorplans", "denah.webp", { stationSlug: level.station.slug });
  await uploadToS3(result.buffer, s3Key, "image/webp", {
    "station-id": stationId,
    "level-id": levelId,
  });

  return NextResponse.json({ imageUrl: `/${s3Key}`, width: result.width, height: result.height });
}

/** Simpan konfigurasi minimap level (gambar, kalibrasi sudut, pin scene). null = hapus minimap. */
export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId, levelId } = await params;
  const parsed = await parseJsonRequest(request, minimapBodySchema);
  if (!parsed.success) return parsed.response;

  const level = await findLevel(stationId, levelId);
  if (!level) return NextResponse.json({ error: "Level tidak ditemukan" }, { status: 404 });

  const minimap = parsed.data.minimap ? parseLevelMinimap(parsed.data.minimap) : null;
  if (parsed.data.minimap && !minimap) {
    return NextResponse.json({ error: "Data minimap tidak valid" }, { status: 400 });
  }

  const ok = await setLevelMinimap(stationId, levelId, minimap);
  if (!ok) return NextResponse.json({ error: "Level tidak ditemukan" }, { status: 404 });

  return NextResponse.json({ id: levelId, minimap });
}
