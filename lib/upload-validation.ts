export const MAX_PANORAMA_UPLOAD_BYTES = 32 * 1024 * 1024;
export const MAX_STANDARD_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function hasSupportedImageSignature(buffer: Buffer): boolean {
  const isJpeg =
    buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";

  return isJpeg || isPng || isWebp;
}

export async function readValidatedImageUpload(
  file: File,
  maxBytes: number
): Promise<{ buffer: Buffer } | { error: string }> {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return { error: "Format file harus JPEG, PNG, atau WebP" };
  }
  if (file.size <= 0) return { error: "File gambar kosong" };
  if (file.size > maxBytes) {
    return { error: `Ukuran file melebihi batas ${Math.floor(maxBytes / 1024 / 1024)} MB` };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!hasSupportedImageSignature(buffer)) {
    return { error: "Isi file tidak cocok dengan format gambar yang didukung" };
  }
  return { buffer };
}
