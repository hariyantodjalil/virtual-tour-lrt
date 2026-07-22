import sharp from "sharp";
import type { PrivacyBlur } from "./privacy-blur-types";
import { normalizePrivacyBlurs } from "./privacy-blur-normalize";
import {
  blurRegionRects,
  blurSigmaForRegion,
  clampEquirectRect,
  defaultViewerBakeContext,
  type EquirectRect,
  type ViewerBakeContext,
} from "./panorama-privacy-blur-geometry";
import {
  encodeBakedPanoramaFromSource,
  generatePanoramaThumbnail,
} from "./image-processor";
import {
  blurCornerRadiusPatchPx,
  roundedBlurMaskSvg,
} from "./privacy-blur-shape";

function cappedBlurSigma(sigma: number, width: number, height: number): number {
  const minDim = Math.min(width, height);
  const maxSigma = Math.max(1, Math.floor(minDim / 6));
  return Math.max(1, Math.min(Math.round(sigma), maxSigma, 120));
}

async function applyBlurRect(
  input: Buffer,
  panoW: number,
  panoH: number,
  rect: EquirectRect,
  sigma: number,
  blur: PrivacyBlur
): Promise<Buffer> {
  const region = clampEquirectRect(rect, panoW, panoH);
  if (!region) return input;

  const { left, top, width, height } = region;
  const blurSigma = cappedBlurSigma(sigma, width, height);
  const cornerR = blurCornerRadiusPatchPx(width, height, blur);

  const blurred = await sharp(input, { limitInputPixels: false })
    .extract({ left, top, width, height })
    .blur(blurSigma)
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .png()
    .toBuffer();

  const maskSvg = Buffer.from(roundedBlurMaskSvg(width, height, cornerR));
  const maskPng = await sharp(maskSvg, { limitInputPixels: false })
    .resize(width, height)
    .png()
    .toBuffer();

  const maskedBlur = await sharp(blurred, { limitInputPixels: false })
    .composite([{ input: maskPng, blend: "dest-in" }])
    .png()
    .toBuffer();

  const out = await sharp(input, { limitInputPixels: false })
    .composite([{ input: maskedBlur, left, top, blend: "over" }])
    .png()
    .toBuffer();

  const outMeta = await sharp(out).metadata();
  if (outMeta.width !== panoW || outMeta.height !== panoH) {
    throw new Error(
      `Resolusi berubah saat composite blur (${panoW}×${panoH} → ${outMeta.width}×${outMeta.height})`
    );
  }

  return Buffer.from(out);
}

/**
 * Bake area blur privasi ke piksel panorama (equirectangular).
 * Proses internal lossless (PNG) — resolusi sama persis dengan master.
 */
export async function bakePrivacyBlursIntoPanoramaBuffer(
  input: Buffer,
  rawBlurs: unknown,
  viewerContext?: Partial<ViewerBakeContext>
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const blurs = normalizePrivacyBlurs(rawBlurs);
  const sourceMeta = await sharp(input, { limitInputPixels: false }).metadata();
  const panoW = sourceMeta.width ?? 0;
  const panoH = sourceMeta.height ?? 0;
  if (!panoW || !panoH) {
    return { buffer: input, width: panoW, height: panoH };
  }

  if (blurs.length === 0) {
    return { buffer: input, width: panoW, height: panoH };
  }

  const viewer: ViewerBakeContext = {
    ...defaultViewerBakeContext(),
    ...viewerContext,
    viewerWidth: viewerContext?.viewerWidth ?? defaultViewerBakeContext().viewerWidth,
    viewerHeight: viewerContext?.viewerHeight ?? defaultViewerBakeContext().viewerHeight,
    hfov: viewerContext?.hfov ?? defaultViewerBakeContext().hfov,
  };

  let buffer: Buffer = Buffer.from(
    await sharp(input, { limitInputPixels: false }).png().toBuffer()
  );

  for (const blur of blurs) {
    const rects = blurRegionRects(blur, panoW, panoH, viewer);
    for (const rect of rects) {
      const sigma = blurSigmaForRegion(blur, rect.width, viewer);
      buffer = await applyBlurRect(buffer, panoW, panoH, rect, sigma, blur);
    }
  }

  const finalMeta = await sharp(buffer).metadata();
  if (finalMeta.width !== panoW || finalMeta.height !== panoH) {
    throw new Error(
      `Resolusi berubah setelah bake (${panoW}×${panoH} → ${finalMeta.width}×${finalMeta.height})`
    );
  }

  return { buffer, width: panoW, height: panoH };
}

export type BakedPanoramaAssets = {
  panoramaBuffer: Buffer;
  thumbnailBuffer: Buffer;
  width: number;
  height: number;
  contentType: "image/webp" | "image/jpeg" | "image/png";
};

/** Encode & thumbnail — tanpa resize panorama (hanya thumbnail yang dikecilkan). */
export async function finalizeBakedPanorama(
  bakedLossless: Buffer,
  expectedWidth: number,
  expectedHeight: number,
  sourceMasterBuffer: Buffer
): Promise<BakedPanoramaAssets> {
  const meta = await sharp(bakedLossless, { limitInputPixels: false }).metadata();
  if (meta.width !== expectedWidth || meta.height !== expectedHeight) {
    throw new Error(
      `Resolusi bake tidak sesuai master (${expectedWidth}×${expectedHeight} vs ${meta.width}×${meta.height})`
    );
  }

  const panoramaResult = await encodeBakedPanoramaFromSource(bakedLossless, sourceMasterBuffer);
  const thumbResult = await generatePanoramaThumbnail(bakedLossless);

  return {
    panoramaBuffer: panoramaResult.buffer,
    thumbnailBuffer: thumbResult.buffer,
    width: panoramaResult.width,
    height: panoramaResult.height,
    contentType: panoramaResult.contentType,
  };
}

export type { PrivacyBlur };
