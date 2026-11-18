import { NextRequest, NextResponse, after } from "next/server";
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
import {
  bakePrivacyBlursIntoPanoramaBuffer,
  finalizeBakedPanorama,
} from "@/lib/panorama-privacy-blur-bake";
import {
  normalizePrivacyBlurs,
  markPrivacyBlurBaked,
  mergePrivacyBlursIntoCanvasData,
  getPrivacyBlurSourcePanoramaUrl,
} from "@/lib/privacy-blur-normalize";
import { parseJsonRequest } from "@/lib/api-validation";
import { privacyBlurBakeSchema } from "@/lib/api-schemas";
import {
  decideCmsHdAfterBake,
  runCmsHdAfterBake,
} from "@/lib/panorama-cms-hd-after-bake";
import {
  bakeRegionPercent,
  clampBakePercent,
  type BakeStreamEvent,
} from "@/lib/cms-bake-progress";

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
  originalPanoramaUrl: true,
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

/**
 * POST — bake blur privasi.
 * Body.target: both | hemat | hd (default both).
 * Respons NDJSON stream: progress {percent,label} lalu done/error.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId, sceneId } = await params;
  const parsed = await parseJsonRequest(request, privacyBlurBakeSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;
  const target = body.target ?? "both";

  const blurs = normalizePrivacyBlurs(body.privacyBlurs);
  if (blurs.length === 0) {
    return NextResponse.json({ error: "Tidak ada area blur untuk dibake" }, { status: 400 });
  }

  const viewerWidth = Number(body.viewerWidth);
  const viewerHeight = Number(body.viewerHeight);
  const hfov = Number(body.hfov);
  const viewer = {
    viewerWidth: Number.isFinite(viewerWidth) && viewerWidth > 0 ? viewerWidth : undefined,
    viewerHeight: Number.isFinite(viewerHeight) && viewerHeight > 0 ? viewerHeight : undefined,
    hfov: Number.isFinite(hfov) && hfov > 0 ? hfov : undefined,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: BakeStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      const progress = (percent: number, label: string) => {
        send({ type: "progress", percent: clampBakePercent(percent), label });
      };

      try {
        progress(5, "Menyiapkan scene…");
        const scene = await prisma.virtualTourScene.findUnique({
          where: { stationId_sceneId: { stationId, sceneId } },
          select: { id: true, panoramaUrl: true, originalPanoramaUrl: true, canvasData: true },
        });

        if (!scene?.panoramaUrl) {
          send({ type: "error", error: "Scene belum punya panorama" });
          return;
        }

        const station = await prisma.station.findUnique({
          where: { id: stationId },
          select: { slug: true },
        });
        const stationSlug = station?.slug ?? stationId;

        const sourcePanoramaUrl =
          getPrivacyBlurSourcePanoramaUrl(scene.canvasData) ?? scene.panoramaUrl;

        // ─── HD saja: metadata blur + generate tile HD sync ───
        if (target === "hd") {
          const displayKey = extractS3KeyFromUrl(scene.panoramaUrl);
          if (!displayKey) {
            send({ type: "error", error: "URL panorama display tidak valid" });
            return;
          }

          progress(10, "Membaca lebar display…");
          const displayBuffer = await downloadFromS3(displayKey);
          const displayMeta = await sharp(displayBuffer, { limitInputPixels: false }).metadata();
          const displayWidth = displayMeta.width ?? 0;
          if (!(displayWidth > 0)) {
            send({ type: "error", error: "Lebar panorama display tidak valid" });
            return;
          }

          // HD saja: simpan region blur + invalidate HD lama, tanpa menandai Hemat ter-bake.
          const mergedCanvas = mergePrivacyBlursIntoCanvasData(scene.canvasData, blurs);
          const canvasData = withoutHdPanoramaProfiles(mergedCanvas) as Prisma.InputJsonValue;
          const privacyBlurLastBakedAt =
            typeof mergedCanvas.privacyBlurLastBakedAt === "string"
              ? mergedCanvas.privacyBlurLastBakedAt
              : null;
          const aiPatchLastBakedAt =
            typeof mergedCanvas.aiPatchLastBakedAt === "string"
              ? mergedCanvas.aiPatchLastBakedAt
              : null;

          const hdDecision = decideCmsHdAfterBake({
            originalPanoramaUrl: scene.originalPanoramaUrl,
            privacyBlurs: blurs,
            canvasDataForGuards: mergedCanvas,
            displayWidth,
          });
          if (hdDecision.status === "skipped") {
            send({ type: "error", error: `HD dilewati: ${hdDecision.reason}` });
            return;
          }

          progress(18, "Menyimpan metadata blur…");
          await prisma.virtualTourScene.update({
            where: { stationId_sceneId: { stationId, sceneId } },
            data: { canvasData },
          });

          const hdResult = await runCmsHdAfterBake(
            {
              kind: "station",
              sceneRowId: scene.id,
              ownerSlug: stationSlug,
              sceneId,
              panoramaUrl: scene.panoramaUrl,
              originalPanoramaUrl: scene.originalPanoramaUrl,
              privacyBlurLastBakedAt,
              aiPatchLastBakedAt,
              privacyBlurs: blurs,
              displayWidth,
              viewer,
              canvasDataForGuards: mergedCanvas,
            },
            { onProgress: progress }
          );

          if (!hdResult.ok) {
            send({ type: "error", error: hdResult.reason });
            return;
          }

          const updated = await prisma.virtualTourScene.findUnique({
            where: { stationId_sceneId: { stationId, sceneId } },
            select: sceneSelect,
          });

          progress(100, "Selesai");
          send({
            type: "done",
            message: `Tile HD dibake (${hdResult.detail})`,
            scene: updated,
            panoramaUrl: scene.panoramaUrl,
            hd: { status: "done" },
          });
          return;
        }

        // ─── Hemat atau both ───
        const sourceKey = extractS3KeyFromUrl(sourcePanoramaUrl);
        if (!sourceKey) {
          send({ type: "error", error: "URL master panorama tidak valid" });
          return;
        }

        progress(12, "Mengunduh master panorama…");
        const originalBuffer = await downloadFromS3(sourceKey);
        const originalSize = originalBuffer.length;

        const originalMeta = await sharp(originalBuffer, { limitInputPixels: false }).metadata();
        const sourceW = originalMeta.width ?? 0;
        const sourceH = originalMeta.height ?? 0;

        progress(20, `Membake ${blurs.length} region blur…`);
        const { buffer: bakedRaw, width: bakedW, height: bakedH } =
          await bakePrivacyBlursIntoPanoramaBuffer(originalBuffer, blurs, viewer, {
            onProgress: async (done, total) => {
              progress(bakeRegionPercent(done, total), `Blur ${done}/${total}…`);
            },
          });

        progress(58, "Encode panorama + thumbnail…");
        const { panoramaBuffer, thumbnailBuffer, width, height, contentType } =
          await finalizeBakedPanorama(bakedRaw, bakedW, bakedH, originalBuffer);

        if (width !== sourceW || height !== sourceH) {
          send({
            type: "error",
            error: `Resolusi output (${width}×${height}) ≠ master (${sourceW}×${sourceH})`,
          });
          return;
        }

        const ext =
          contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";

        progress(68, "Upload panorama…");
        const panoramaKey = generateS3Key("panoramas", `${sceneId}.${ext}`, { stationSlug });
        await uploadToS3(panoramaBuffer, panoramaKey, contentType, {
          "station-id": stationId,
          "scene-id": sceneId,
          "station-slug": stationSlug,
          "privacy-blur-baked": "true",
          dimensions: `${width}x${height}`,
        });

        const thumbKey = generateS3Key("thumbnails", `${sceneId}.webp`, { stationSlug });
        await uploadToS3(thumbnailBuffer, thumbKey, "image/webp", {
          "station-id": stationId,
          "scene-id": sceneId,
          "station-slug": stationSlug,
          type: "thumbnail",
        });

        const panoramaUrl = `/${panoramaKey}`;
        const thumbnailUrl = `/${thumbKey}`;

        progress(78, "Generate tile Hemat…");
        const multiResProfiles = await uploadAdaptivePanoramaTiles(
          panoramaBuffer,
          stationSlug,
          sceneId
        );
        const markedCanvas = markPrivacyBlurBaked(scene.canvasData, blurs, sourcePanoramaUrl);
        const canvasData = withoutHdPanoramaProfiles({
          ...markedCanvas,
          multiRes: multiResProfiles.mobile,
          multiResProfiles,
        }) as Prisma.InputJsonValue;

        const privacyBlurLastBakedAt =
          typeof markedCanvas.privacyBlurLastBakedAt === "string"
            ? markedCanvas.privacyBlurLastBakedAt
            : null;
        const aiPatchLastBakedAt =
          typeof markedCanvas.aiPatchLastBakedAt === "string"
            ? markedCanvas.aiPatchLastBakedAt
            : null;

        const wantHd = target === "both";
        const hdDecision = wantHd
          ? decideCmsHdAfterBake({
              originalPanoramaUrl: scene.originalPanoramaUrl,
              privacyBlurs: blurs,
              canvasDataForGuards: markedCanvas,
              displayWidth: sourceW,
            })
          : { status: "skipped" as const, reason: "target hemat saja" };

        progress(92, "Menyimpan metadata…");
        const updated = await prisma.virtualTourScene.update({
          where: { stationId_sceneId: { stationId, sceneId } },
          data: { panoramaUrl, thumbnailUrl, canvasData },
          select: sceneSelect,
        });

        if (hdDecision.status === "queued") {
          after(() => {
            void runCmsHdAfterBake({
              kind: "station",
              sceneRowId: scene.id,
              ownerSlug: stationSlug,
              sceneId,
              panoramaUrl,
              originalPanoramaUrl: scene.originalPanoramaUrl,
              privacyBlurLastBakedAt,
              aiPatchLastBakedAt,
              privacyBlurs: blurs,
              displayWidth: sourceW,
              viewer,
              canvasDataForGuards: markedCanvas,
            }).then((result) => {
              if (result.ok) {
                console.info("[cms-hd-after-bake] station", sceneId, result.detail);
              } else {
                console.warn("[cms-hd-after-bake] station", sceneId, result.reason);
              }
            });
          });
        }

        progress(100, "Selesai");
        send({
          type: "done",
          message:
            hdDecision.status === "queued"
              ? "Blur dibake ke panorama Hemat; tile HD digenerate di background"
              : "Blur dibake ke panorama Hemat",
          scene: updated,
          panoramaUrl,
          thumbnailUrl,
          hd: hdDecision,
          optimization: {
            original: formatBytes(originalSize),
            panorama: formatBytes(panoramaBuffer.length),
            thumbnail: formatBytes(thumbnailBuffer.length),
            dimensions: `${width}×${height}`,
            sourceDimensions: `${sourceW}×${sourceH}`,
            resolutionPreserved: width === sourceW && height === sourceH,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Gagal bake blur";
        send({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
