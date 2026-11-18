import sharp from "sharp";
import {
  FAL_FLUX_KONTEXT_ENDPOINT,
  runFluxKontextEdit,
  uploadBufferToFalStorage,
} from "./fal-client";
import {
  extractPerspective,
  reprojectPerspectiveOntoEquirect,
  type PerspectiveView,
  type RgbaImage,
} from "./panorama-perspective";
import type { AiPatchRecord } from "./ai-patch-normalize";

export const AI_PATCH_DEFAULT_SIZE = 1024;
export const AI_PATCH_MIN_SIZE = 512;
export const AI_PATCH_MAX_SIZE = 1536;

async function bufferToRgba(input: Buffer): Promise<RgbaImage> {
  const { data, info } = await sharp(input, { limitInputPixels: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
  };
}

async function rgbaToPngBuffer(img: RgbaImage): Promise<Buffer> {
  return sharp(Buffer.from(img.data), {
    raw: { width: img.width, height: img.height, channels: 4 },
    limitInputPixels: false,
  })
    .png()
    .toBuffer();
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Gagal mengunduh hasil Fal (HTTP ${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export type AiPatchBakeInput = {
  panoramaBuffer: Buffer;
  prompt: string;
  view: PerspectiveView;
  patchWidth?: number;
  patchHeight?: number;
  enhancePrompt?: boolean;
  seed?: number;
};

export type AiPatchBakeResult = {
  /** Panorama equirectangular hasil patch (PNG lossless sementara). */
  bakedLossless: Buffer;
  width: number;
  height: number;
  patchPreviewPng: Buffer;
  record: AiPatchRecord;
  requestId: string;
};

function clampSize(n: number | undefined, fallback: number): number {
  if (!Number.isFinite(n) || n === undefined) return fallback;
  return Math.max(AI_PATCH_MIN_SIZE, Math.min(AI_PATCH_MAX_SIZE, Math.round(n)));
}

/**
 * Crop perspektif dari panorama → edit FLUX Kontext → re-inject ke equirectangular.
 */
export async function bakeAiPatchIntoPanoramaBuffer(
  input: AiPatchBakeInput
): Promise<AiPatchBakeResult> {
  const patchWidth = clampSize(input.patchWidth, AI_PATCH_DEFAULT_SIZE);
  const patchHeight = clampSize(input.patchHeight, AI_PATCH_DEFAULT_SIZE);
  const view: PerspectiveView = {
    yaw: input.view.yaw,
    pitch: input.view.pitch,
    hfov: input.view.hfov,
  };

  const base = await bufferToRgba(input.panoramaBuffer);
  if (!base.width || !base.height) {
    throw new Error("Panorama tidak punya dimensi valid");
  }

  const perspective = extractPerspective(base, view, patchWidth, patchHeight);
  const cropPng = await rgbaToPngBuffer(perspective);

  const imageUrl = await uploadBufferToFalStorage(
    cropPng,
    `ai-patch-${Date.now()}.png`,
    "image/png"
  );

  const { data, requestId } = await runFluxKontextEdit({
    prompt: input.prompt,
    imageUrl,
    enhancePrompt: input.enhancePrompt,
    seed: input.seed,
    outputFormat: "png",
  });

  const resultUrl = data.images[0].url;
  const resultBuffer = await fetchImageBuffer(resultUrl);

  // Samakan ukuran patch agar reproject stabil
  const resultResized = await sharp(resultBuffer, { limitInputPixels: false })
    .ensureAlpha()
    .resize(patchWidth, patchHeight, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const patch: RgbaImage = {
    width: patchWidth,
    height: patchHeight,
    data: new Uint8ClampedArray(
      resultResized.data.buffer,
      resultResized.data.byteOffset,
      resultResized.data.byteLength
    ),
  };

  const merged = reprojectPerspectiveOntoEquirect(base, patch, view);
  const bakedLossless = await rgbaToPngBuffer(merged);
  const patchPreviewPng = await rgbaToPngBuffer(patch);

  const record: AiPatchRecord = {
    prompt: input.prompt,
    yaw: view.yaw,
    pitch: view.pitch,
    hfov: view.hfov,
    patchWidth,
    patchHeight,
    requestId,
    model: FAL_FLUX_KONTEXT_ENDPOINT,
    createdAt: new Date().toISOString(),
  };

  return {
    bakedLossless,
    width: base.width,
    height: base.height,
    patchPreviewPng,
    record,
    requestId,
  };
}
