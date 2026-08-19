/**
 * Client-side image compressor.
 *
 * Mengompresi file gambar sebelum dikirim ke server / API:
 * - Menghindari batas payload WAF (Web Application Firewall / F5 BIG-IP).
 * - Mempercepat waktu upload hingga 10x lebih cepat.
 * - Mengubah file 15-25 MB menjadi ~2-3 MB WebP kualitas tinggi (6000x3000).
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: string;
}

/**
 * Kompresi khusus gambar panorama equirectangular 360°.
 * - Max resolusi 6000×3000 px
 * - Format WebP quality 0.85 (biasanya menghasilkan file 2–3.5 MB dari file 15–30 MB)
 */
export async function compressPanoramaClient(file: File): Promise<File> {
  // Jika file sudah kecil (< 3.5 MB) dan sudah WebP, tidak perlu kompres ulang
  if (file.size <= 3.5 * 1024 * 1024 && file.type === "image/webp") {
    return file;
  }

  return compressImageClient(file, {
    maxWidth: 6000,
    maxHeight: 3000,
    quality: 0.85,
    mimeType: "image/webp",
  });
}

/**
 * Kompresi umum untuk foto cover, unit komersial, atau materi iklan.
 */
export async function compressImageClient(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const {
    maxWidth = 2048,
    maxHeight = 2048,
    quality = 0.85,
    mimeType = "image/webp",
  } = options;

  // Lewati file SVG atau format non-raster
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    return file;
  }

  try {
    let imgWidth = 0;
    let imgHeight = 0;
    let imageSource: ImageBitmap | HTMLImageElement;

    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file);
      imgWidth = bitmap.width;
      imgHeight = bitmap.height;
      imageSource = bitmap;
    } else {
      const img = await loadImageElement(file);
      imgWidth = img.naturalWidth || img.width;
      imgHeight = img.naturalHeight || img.height;
      imageSource = img;
    }

    if (!imgWidth || !imgHeight) {
      return file;
    }

    // Hitung dimensi tujuan proporsional
    let targetWidth = imgWidth;
    let targetHeight = imgHeight;

    if (targetWidth > maxWidth || targetHeight > maxHeight) {
      const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
      targetWidth = Math.round(targetWidth * ratio);
      targetHeight = Math.round(targetHeight * ratio);
    }

    // Render ke Canvas
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return file;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(imageSource, 0, 0, targetWidth, targetHeight);

    // Bersihkan bitmap jika ada
    if ("close" in imageSource && typeof imageSource.close === "function") {
      imageSource.close();
    }

    // Export ke Blob
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), mimeType, quality);
    });

    if (!blob) {
      return file;
    }

    // Jika hasil kompresi ternyata lebih besar dari file asli (jarang terjadi), gunakan file asli
    if (blob.size >= file.size && file.type === mimeType) {
      return file;
    }

    const baseName = file.name.replace(/\.[^/.]+$/, "");
    const ext = mimeType === "image/webp" ? "webp" : "jpg";
    const compressedFile = new File([blob], `${baseName}.${ext}`, {
      type: mimeType,
      lastModified: Date.now(),
    });

    console.info(
      `[ClientCompress] ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB) -> ` +
        `${compressedFile.name} (${(compressedFile.size / 1024 / 1024).toFixed(2)} MB, ` +
        `${targetWidth}x${targetHeight})`
    );

    return compressedFile;
  } catch (err) {
    console.warn("[ClientCompress] Gagal kompresi di client, fallback ke file asli:", err);
    return file;
  }
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
