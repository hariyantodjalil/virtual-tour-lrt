import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  downloadFromS3,
  extractS3KeyFromUrl,
  generateS3Key,
  uploadToS3,
} from "@/lib/s3";
import { uploadAdaptivePanoramaTiles } from "@/lib/panorama-tile-upload";
import { withoutHdPanoramaProfiles } from "@/lib/panorama-profile";
import { formatBytes } from "@/lib/image-processor";
import sharp from "sharp";
import { finalizeBakedPanorama } from "@/lib/panorama-privacy-blur-bake";
import { bakeAiPatchIntoPanoramaBuffer } from "@/lib/panorama-ai-patch-bake";
import {
  canRestoreAiPatch,
  getAiPatchSourcePanoramaUrl,
  markAiPatchBaked,
  markAiPatchRestored,
} from "@/lib/ai-patch-normalize";
import { FalConfigError, isFalConfigured } from "@/lib/fal-client";
import { aiPatchBakeSchema, aiPatchRestoreSchema } from "@/lib/api-schemas";

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
  thumbnailUrl: true,
  order: true,
  hotspots: true,
  canvasData: true,
  spatialEntities: true,
  spatialRevision: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

async function persistPanoramaVersion(opts: {
  stationId: string;
  sceneId: string;
  stationSlug: string;
  expectedPanoramaUrl: string;
  expectedUpdatedAt: Date;
  panoramaBuffer: Buffer;
  thumbnailBuffer: Buffer;
  width: number;
  height: number;
  contentType: "image/webp" | "image/jpeg" | "image/png";
  canvasData: Record<string, unknown>;
  meta: Record<string, string>;
}) {
  const ext =
    opts.contentType === "image/jpeg"
      ? "jpg"
      : opts.contentType === "image/png"
        ? "png"
        : "webp";

  const panoramaKey = generateS3Key("panoramas", `${opts.sceneId}.${ext}`, {
    stationSlug: opts.stationSlug,
  });
  await uploadToS3(opts.panoramaBuffer, panoramaKey, opts.contentType, {
    "station-id": opts.stationId,
    "scene-id": opts.sceneId,
    "station-slug": opts.stationSlug,
    dimensions: `${opts.width}x${opts.height}`,
    ...opts.meta,
  });

  const thumbKey = generateS3Key("thumbnails", `${opts.sceneId}.webp`, {
    stationSlug: opts.stationSlug,
  });
  await uploadToS3(opts.thumbnailBuffer, thumbKey, "image/webp", {
    "station-id": opts.stationId,
    "scene-id": opts.sceneId,
    "station-slug": opts.stationSlug,
    type: "thumbnail",
  });

  const panoramaUrl = `/${panoramaKey}`;
  const thumbnailUrl = `/${thumbKey}`;
  const multiResProfiles = await uploadAdaptivePanoramaTiles(
    opts.panoramaBuffer,
    opts.stationSlug,
    opts.sceneId
  );

  const canvasData = withoutHdPanoramaProfiles({
    ...opts.canvasData,
    multiRes: multiResProfiles.mobile,
    multiResProfiles,
  }) as Prisma.InputJsonValue;

  const updated = await prisma.virtualTourScene.update({
    where: {
      stationId_sceneId: { stationId: opts.stationId, sceneId: opts.sceneId },
      panoramaUrl: opts.expectedPanoramaUrl,
      updatedAt: opts.expectedUpdatedAt,
    },
    data: { panoramaUrl, thumbnailUrl, canvasData },
    select: sceneSelect,
  }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return null;
    throw error;
  });
  if (!updated) return null;

  return { updated, panoramaUrl, thumbnailUrl };
}

/**
 * POST — generate AI patch (FLUX Kontext) dari sudut Pannellum, atau restore master pra-AI.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId, sceneId } = await params;

  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
  }

  const isRestore =
    bodyJson !== null &&
    typeof bodyJson === "object" &&
    "action" in bodyJson &&
    (bodyJson as { action?: string }).action === "restore";

  const scene = await prisma.virtualTourScene.findUnique({
    where: { stationId_sceneId: { stationId, sceneId } },
    select: { panoramaUrl: true, canvasData: true, updatedAt: true },
  });

  if (!scene?.panoramaUrl) {
    return NextResponse.json({ error: "Scene belum punya panorama" }, { status: 400 });
  }

  const station = await prisma.station.findUnique({
    where: { id: stationId },
    select: { slug: true },
  });
  const stationSlug = station?.slug ?? stationId;

  if (isRestore) {
    const parsed = aiPatchRestoreSchema.safeParse(bodyJson);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload restore tidak valid" }, { status: 400 });
    }

    if (!canRestoreAiPatch(scene.canvasData)) {
      return NextResponse.json(
        { error: "Restore diblokir: versi blur privasi master pra-AI tidak cocok atau belum dapat diverifikasi." },
        { status: 409 }
      );
    }
    const sourceUrl = getAiPatchSourcePanoramaUrl(scene.canvasData);
    if (!sourceUrl) {
      return NextResponse.json(
        { error: "Tidak ada master pra-AI untuk di-restore" },
        { status: 400 }
      );
    }
    const sourceKey = extractS3KeyFromUrl(sourceUrl);
    if (!sourceKey) {
      return NextResponse.json({ error: "URL master pra-AI tidak valid" }, { status: 400 });
    }

    const originalBuffer = await downloadFromS3(sourceKey);
    const originalSize = originalBuffer.length;
    const meta = await sharp(originalBuffer, { limitInputPixels: false }).metadata();
    const sourceW = meta.width ?? 0;
    const sourceH = meta.height ?? 0;

    const { panoramaBuffer, thumbnailBuffer, width, height, contentType } =
      await finalizeBakedPanorama(originalBuffer, sourceW, sourceH, originalBuffer);

    const persisted = await persistPanoramaVersion({
      stationId,
      sceneId,
      stationSlug,
      expectedPanoramaUrl: scene.panoramaUrl,
      expectedUpdatedAt: scene.updatedAt,
      panoramaBuffer,
      thumbnailBuffer,
      width,
      height,
      contentType,
      canvasData: markAiPatchRestored(scene.canvasData),
      meta: { "ai-patch-restored": "true" },
    });

    if (!persisted) {
      return NextResponse.json({ error: "Scene berubah selama pemrosesan. Muat ulang sebelum mencoba lagi." }, { status: 409 });
    }
    const { updated, panoramaUrl, thumbnailUrl } = persisted;
    return NextResponse.json({
      message: "Panorama dikembalikan ke master sebelum patch AI",
      scene: updated,
      panoramaUrl,
      thumbnailUrl,
      optimization: {
        original: formatBytes(originalSize),
        panorama: formatBytes(panoramaBuffer.length),
        thumbnail: formatBytes(thumbnailBuffer.length),
        dimensions: `${width}×${height}`,
      },
    });
  }

  const bakeParsed = aiPatchBakeSchema.safeParse(bodyJson);
  if (!bakeParsed.success) {
    return NextResponse.json(
      { error: "Payload generate tidak valid", details: bakeParsed.error.flatten() },
      { status: 400 }
    );
  }
  const bakeBody = bakeParsed.data;

  if (!isFalConfigured()) {
    return NextResponse.json(
      {
        error:
          "FAL_KEY belum dikonfigurasi di server. Tambahkan ke .env lalu restart, atau hubungkan Fal terlebih dahulu.",
        code: "FAL_KEY_MISSING",
      },
      { status: 503 }
    );
  }

  const workingKey = extractS3KeyFromUrl(scene.panoramaUrl);
  if (!workingKey) {
    return NextResponse.json({ error: "URL panorama tidak valid" }, { status: 400 });
  }

  const sourceForRestore =
    getAiPatchSourcePanoramaUrl(scene.canvasData) ?? scene.panoramaUrl;

  try {
    const originalBuffer = await downloadFromS3(workingKey);
    const originalSize = originalBuffer.length;
    const originalMeta = await sharp(originalBuffer, { limitInputPixels: false }).metadata();
    const sourceW = originalMeta.width ?? 0;
    const sourceH = originalMeta.height ?? 0;

    const bake = await bakeAiPatchIntoPanoramaBuffer({
      panoramaBuffer: originalBuffer,
      prompt: bakeBody.prompt,
      view: {
        yaw: bakeBody.yaw,
        pitch: bakeBody.pitch,
        hfov: bakeBody.hfov,
      },
      patchWidth: bakeBody.patchWidth,
      patchHeight: bakeBody.patchHeight,
      enhancePrompt: bakeBody.enhancePrompt,
      seed: bakeBody.seed,
    });

    if (bake.width !== sourceW || bake.height !== sourceH) {
      return NextResponse.json(
        {
          error: `Resolusi output (${bake.width}×${bake.height}) ≠ master (${sourceW}×${sourceH})`,
        },
        { status: 500 }
      );
    }

    const { panoramaBuffer, thumbnailBuffer, width, height, contentType } =
      await finalizeBakedPanorama(
        bake.bakedLossless,
        bake.width,
        bake.height,
        originalBuffer
      );

    const canvasData = markAiPatchBaked(scene.canvasData, sourceForRestore, bake.record);

    const persisted = await persistPanoramaVersion({
      stationId,
      sceneId,
      stationSlug,
      expectedPanoramaUrl: scene.panoramaUrl,
      expectedUpdatedAt: scene.updatedAt,
      panoramaBuffer,
      thumbnailBuffer,
      width,
      height,
      contentType,
      canvasData,
      meta: {
        "ai-patch-baked": "true",
        "fal-request-id": bake.requestId,
      },
    });

    if (!persisted) {
      return NextResponse.json({ error: "Scene berubah selama pemrosesan. Muat ulang sebelum mencoba lagi." }, { status: 409 });
    }
    const { updated, panoramaUrl, thumbnailUrl } = persisted;
    return NextResponse.json({
      message: "Patch AI dibake ke panorama",
      scene: updated,
      panoramaUrl,
      thumbnailUrl,
      requestId: bake.requestId,
      record: bake.record,
      optimization: {
        original: formatBytes(originalSize),
        panorama: formatBytes(panoramaBuffer.length),
        thumbnail: formatBytes(thumbnailBuffer.length),
        dimensions: `${width}×${height}`,
        sourceDimensions: `${sourceW}×${sourceH}`,
        resolutionPreserved: width === sourceW && height === sourceH,
        patch: `${bake.record.patchWidth}×${bake.record.patchHeight}`,
      },
    });
  } catch (err) {
    if (err instanceof FalConfigError) {
      return NextResponse.json(
        { error: err.message, code: "FAL_KEY_MISSING" },
        { status: 503 }
      );
    }
    const message = err instanceof Error ? err.message : "Gagal generate patch AI";
    const locked = /exhausted balance|user is locked|403/i.test(message);
    return NextResponse.json(
      {
        error: message,
        code: locked ? "FAL_BILLING" : "FAL_ERROR",
      },
      { status: locked ? 403 : 500 }
    );
  }
}

export const dynamic = "force-dynamic";
/** Generate Fal + bake panorama bisa >30s. */
export const maxDuration = 120;
