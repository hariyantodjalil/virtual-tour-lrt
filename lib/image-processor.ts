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
  contentType: "image/webp" | "image/jpeg";
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
