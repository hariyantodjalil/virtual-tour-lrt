/**
 * Image processor untuk panorama 360° dan aset CMS.
 *
 * Strategi: Convert on Upload
 * - Panorama: resize max 6000px wide → WebP 82% (2:1 equirectangular)
 * - Thumbnail: resize 900×450 → WebP 78% (dipakai di sidebar CMS & preview card)
 * - Cover/foto: resize max 1600px wide → WebP 85%
 *
 * Alasan WebP: ~30% lebih kecil dari JPEG kualitas setara.
 * Pannellum mendukung WebP di semua browser modern (Chrome, Firefox, Safari 14+).
 */

import sharp from "sharp";

export interface ProcessResult {
  buffer: Buffer;
  contentType: "image/webp" | "image/jpeg" | "image/png";
  width: number;
  height: number;
  sizeBytes: number;
}

// ─── Panorama 360° equirectangular ───────────────────────────────────────────
// Target: max 6000×3000px WebP q82 → biasanya 2–5 MB dari file 15–22 MB asli
export async function processPanorama(input: Buffer): Promise<ProcessResult> {
  const image = sharp(input, { limitInputPixels: false });

  const buffer = await image
    .webp({ quality: 92, effort: 5 })
    .toBuffer();

  const out = await sharp(buffer, { limitInputPixels: false }).metadata();

  return {
    buffer,
    contentType: "image/webp",
    width: out.width ?? 0,
    height: out.height ?? 0,
    sizeBytes: buffer.length,
  };
}

/**
 * Encode hasil bake: dimensi identik dengan master, tanpa resize.
 * Format & kualitas mengikuti sumber (JPEG q100 / WebP lossless).
 */
export async function encodeBakedPanoramaFromSource(
  bakedLossless: Buffer,
  sourceBuffer: Buffer
): Promise<ProcessResult> {
  const srcMeta = await sharp(sourceBuffer, { limitInputPixels: false }).metadata();
  const srcW = srcMeta.width ?? 0;
  const srcH = srcMeta.height ?? 0;
  if (!srcW || !srcH) {
    throw new Error("Metadata master panorama tidak valid");
  }

  const bakedMeta = await sharp(bakedLossless, { limitInputPixels: false }).metadata();
  if (bakedMeta.width !== srcW || bakedMeta.height !== srcH) {
    throw new Error(
      `Resolusi bake (${bakedMeta.width}×${bakedMeta.height}) ≠ master (${srcW}×${srcH})`
    );
  }

  const image = sharp(bakedLossless, { limitInputPixels: false });
  const fmt = (srcMeta.format ?? "webp").toLowerCase();

  let buffer: Buffer;
  let contentType: ProcessResult["contentType"];

  if (fmt === "jpeg" || fmt === "jpg") {
    buffer = await image
      .jpeg({ quality: 100, mozjpeg: true, chromaSubsampling: "4:4:4" })
      .toBuffer();
    contentType = "image/jpeg";
  } else if (fmt === "png") {
    buffer = await image.png({ compressionLevel: 6, adaptiveFiltering: false }).toBuffer();
    contentType = "image/png";
  } else {
    buffer = await image.webp({ lossless: true, effort: 6, smartSubsample: false }).toBuffer();
    contentType = "image/webp";
  }

  const out = await sharp(buffer, { limitInputPixels: false }).metadata();
  if (out.width !== srcW || out.height !== srcH) {
    throw new Error(
      `Resolusi berubah saat encode (${srcW}×${srcH} → ${out.width}×${out.height})`
    );
  }

  return {
    buffer,
    contentType,
    width: srcW,
    height: srcH,
    sizeBytes: buffer.length,
  };
}

/**
 * @deprecated Prefer encodeBakedPanoramaFromSource — tetap ada untuk kompatibilitas.
 */
export async function processPanoramaPreserveResolution(input: Buffer): Promise<ProcessResult> {
  return encodeBakedPanoramaFromSource(input, input);
}

// ─── Thumbnail scene (preview di sidebar CMS dan list scene) ─────────────────
// Target: 900×450px WebP q78 → ~40–120 KB
export async function generatePanoramaThumbnail(input: Buffer): Promise<ProcessResult> {
  const buffer = await sharp(input, { limitInputPixels: false })
    .resize(900, 450, {
      fit: "cover",
      position: "centre",
      kernel: sharp.kernel.lanczos3,
    })
    .webp({ quality: 78, effort: 3 })
    .toBuffer();

  return {
    buffer,
    contentType: "image/webp",
    width: 900,
    height: 450,
    sizeBytes: buffer.length,
  };
}

// ─── Cover stasiun / foto komersial ─────────────────────────────────────────
// Target: max 1600px wide WebP q85 → biasanya 100–400 KB
export async function processStationCover(input: Buffer): Promise<ProcessResult> {
  const image = sharp(input);
  const meta = await image.metadata();

  const maxWidth = 1600;
  const needsResize = meta.width && meta.width > maxWidth;

  const pipeline = needsResize
    ? image.resize(maxWidth, undefined, {
        fit: "inside",
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3,
      })
    : image;

  const buffer = await pipeline
    .webp({ quality: 85, effort: 4 })
    .toBuffer();

  const out = await sharp(buffer).metadata();

  return {
    buffer,
    contentType: "image/webp",
    width: out.width ?? 0,
    height: out.height ?? 0,
    sizeBytes: buffer.length,
  };
}

// ─── Foto unit komersial (space) ─────────────────────────────────────────────
// Target: max 1200px wide WebP q83 → biasanya 80–250 KB
export async function processSpacePhoto(input: Buffer): Promise<ProcessResult> {
  const buffer = await sharp(input)
    .resize(1200, undefined, {
      fit: "inside",
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
    .webp({ quality: 83, effort: 4 })
    .toBuffer();

  const out = await sharp(buffer).metadata();

  return {
    buffer,
    contentType: "image/webp",
    width: out.width ?? 0,
    height: out.height ?? 0,
    sizeBytes: buffer.length,
  };
}

// ─── Helper: format ukuran file ──────────────────────────────────────────────
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
