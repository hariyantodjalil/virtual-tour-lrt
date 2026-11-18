/**
 * Setelah bake blur CMS (Hemat), generate tile HD dari originalPanoramaUrl
 * dengan region blur yang sama — tanpa deteksi ulang dari piksel display.
 *
 * Dipakai lewat next/server `after()` agar respons CMS tetap cepat (Hemat sync),
 * sementara HD di-publish atomik lewat panoramaHdProfileUpdateQuery.
 */
import sharp from "sharp";
import { prisma } from "./prisma";
import { downloadFromS3, extractS3KeyFromUrl } from "./s3";
import { uploadHdPanoramaTiles } from "./panorama-tile-upload";
import {
  isPanoramaMultiResProfilesHd,
  type PanoramaMultiResProfilesHd,
} from "./panorama-profile";
import { panoramaHdProfileUpdateQuery } from "./panorama-backfill";
import {
  bakePrivacyBlursIntoPanoramaBuffer,
} from "./panorama-privacy-blur-bake";
import { encodeBakedPanoramaFromSource } from "./image-processor";
import { isAiPatchApplied } from "./ai-patch-normalize";
import type { PrivacyBlur } from "./privacy-blur-types";
import type { ViewerBakeContext } from "./panorama-privacy-blur-geometry";
import { defaultViewerBakeContext } from "./panorama-privacy-blur-geometry";

export type CmsHdAfterBakeDecision =
  | { status: "queued" }
  | { status: "skipped"; reason: string };

export type CmsHdAfterBakeJob = {
  kind: "station" | "train";
  sceneRowId: string;
  ownerSlug: string;
  sceneId: string;
  panoramaUrl: string;
  originalPanoramaUrl: string | null;
  privacyBlurLastBakedAt: string | null;
  aiPatchLastBakedAt: string | null;
  privacyBlurs: PrivacyBlur[];
  /** Lebar master display yang dipakai bake Hemat (untuk skala sigma). */
  displayWidth: number;
  viewer: Partial<ViewerBakeContext>;
  canvasDataForGuards: unknown;
};

const MIN_NATIVE_WIDTH = 6401;

export function decideCmsHdAfterBake(job: Pick<
  CmsHdAfterBakeJob,
  "originalPanoramaUrl" | "privacyBlurs" | "canvasDataForGuards" | "displayWidth"
>): CmsHdAfterBakeDecision {
  if (isAiPatchApplied(job.canvasDataForGuards)) {
    return {
      status: "skipped",
      reason: "AI patch aktif — master native tidak membawa patch; HD tetap lewat backfill khusus",
    };
  }
  if (!job.originalPanoramaUrl) {
    return { status: "skipped", reason: "originalPanoramaUrl kosong — tidak ada sumber native" };
  }
  if (!job.privacyBlurs.length) {
    return { status: "skipped", reason: "tidak ada region blur" };
  }
  if (!(job.displayWidth > 0)) {
    return { status: "skipped", reason: "lebar display bake tidak valid" };
  }
  return { status: "queued" };
}

/**
 * Bake blur yang sama ke original native, split tile HD, publish metadata.
 * Aman dipanggil dari `after()` — error hanya di-log, tidak melempar ke client.
 */
export type CmsHdAfterBakeProgress = (percent: number, label: string) => void | Promise<void>;

export async function runCmsHdAfterBake(
  job: CmsHdAfterBakeJob,
  opts?: { onProgress?: CmsHdAfterBakeProgress }
): Promise<
  | { ok: true; detail: string }
  | { ok: false; reason: string }
> {
  const decision = decideCmsHdAfterBake(job);
  if (decision.status === "skipped") {
    return { ok: false, reason: decision.reason };
  }

  const originalKey = extractS3KeyFromUrl(job.originalPanoramaUrl!);
  if (!originalKey) {
    return { ok: false, reason: "URL original panorama tidak valid" };
  }

  const progress = opts?.onProgress;
  try {
    await progress?.(15, "Mengunduh original native…");
    const nativeBuffer = await downloadFromS3(originalKey);
    const meta = await sharp(nativeBuffer, { limitInputPixels: false }).metadata();
    const nativeW = meta.width ?? 0;
    const nativeH = meta.height ?? 0;
    if (nativeW < MIN_NATIVE_WIDTH) {
      return {
        ok: false,
        reason: `sumber native ${nativeW}px ≤6400 — tidak ada keuntungan HD`,
      };
    }

    const defaults = defaultViewerBakeContext();
    const viewer = {
      ...defaults,
      viewerWidth: job.viewer.viewerWidth ?? defaults.viewerWidth,
      viewerHeight: job.viewer.viewerHeight ?? defaults.viewerHeight,
      hfov: job.viewer.hfov ?? defaults.hfov,
    };
    const sigmaHardCapScale = nativeW / job.displayWidth;

    await progress?.(25, `Membake ${job.privacyBlurs.length} region ke HD…`);
    const { buffer: bakedRaw, width: bakedW, height: bakedH } =
      await bakePrivacyBlursIntoPanoramaBuffer(nativeBuffer, job.privacyBlurs, viewer, {
        sigmaHardCapScale,
        onProgress: async (done, total) => {
          const t = total <= 0 ? 1 : Math.min(1, Math.max(0, done / total));
          await progress?.(25 + Math.round(t * 40), `Blur HD ${done}/${total}…`);
        },
      });

    if (bakedW !== nativeW || bakedH !== nativeH) {
      return {
        ok: false,
        reason: `resolusi bake native berubah (${nativeW}×${nativeH} → ${bakedW}×${bakedH})`,
      };
    }

    await progress?.(70, "Encode + generate tile HD…");
    const encoded = await encodeBakedPanoramaFromSource(bakedRaw, nativeBuffer);
    const profiles = await uploadHdPanoramaTiles(encoded.buffer, job.ownerSlug, job.sceneId);
    const cubeResolution = nativeW > 6400 ? 4096 : 2048;

    const hd: PanoramaMultiResProfilesHd = {
      version: "jpeg85-v1",
      desktop: profiles.desktop,
      mobile: profiles.mobile,
      privacyVerified: true,
      sourcePanoramaUrl: job.panoramaUrl,
      ...(job.privacyBlurLastBakedAt
        ? { privacyBlurLastBakedAt: job.privacyBlurLastBakedAt }
        : {}),
      ...(job.aiPatchLastBakedAt ? { aiPatchLastBakedAt: job.aiPatchLastBakedAt } : {}),
      provenance: {
        source: "original-reblur",
        sourceKey: job.originalPanoramaUrl!,
        sourceDimensions: `${nativeW}x${nativeH}`,
        generator: {
          jpegQuality: 85,
          cubeResolution,
          tileResolutions: { mobile: 512, desktop: 1024 },
        },
        privacy: {
          blurRegions: job.privacyBlurs.length,
          reBakedAtNative: true,
          viewerContext: {
            viewerWidth: viewer.viewerWidth,
            viewerHeight: viewer.viewerHeight,
            hfov: viewer.hfov,
          },
          verifiedAgainstKey: job.panoramaUrl,
        },
        createdAt: new Date().toISOString(),
      },
    };

    if (!isPanoramaMultiResProfilesHd(hd)) {
      return { ok: false, reason: "metadata HD tidak lolos validator kontrak" };
    }

    await progress?.(90, "Mempublikasi metadata HD…");
    const published = await prisma.$executeRaw(
      panoramaHdProfileUpdateQuery({
        kind: job.kind,
        id: job.sceneRowId,
        panoramaUrl: job.panoramaUrl,
        privacyBlurLastBakedAt: job.privacyBlurLastBakedAt,
        aiPatchLastBakedAt: job.aiPatchLastBakedAt,
        privacyBlurs: job.privacyBlurs,
        previousHd: null,
        hd,
      })
    );

    if (published === 0) {
      return {
        ok: false,
        reason:
          "scene berubah selama generate HD — tile terunggah tapi metadata tidak dipublikasi",
      };
    }

    return {
      ok: true,
      detail: `HD ${nativeW}x${nativeH} cube=${cubeResolution} regions=${job.privacyBlurs.length}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cms-hd-after-bake]", job.kind, job.sceneId, message);
    return { ok: false, reason: message };
  }
}
