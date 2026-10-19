/**
 * Client-side image compressor.
 *
 * Mengompresi file gambar sebelum dikirim ke server / API:
 * - Menghindari batas payload WAF (Web Application Firewall / F5 BIG-IP).
 * - Menghindari pemblokiran WAF pada double extension (misal .jpg.jpeg / .jpg.webp) dan mime-type.
 * - Menggunakan format JPEG standar (.jpg) berkualitas tinggi yang 100% diizinkan oleh semua WAF.
 * - Mempercepat waktu upload hingga 10x lebih cepat.
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
 * - Format JPEG quality 0.85 (menghasilkan file ~1–2 MB dari 15–30 MB)
 * - Single extension .jpg bersih tanpa karakter aneh
 */
export async function compressPanoramaClient(file: File): Promise<File> {
  return compressImageClient(file, {
    maxWidth: 6000,
    maxHeight: 3000,
    quality: 0.85,
    mimeType: "image/jpeg",
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
    mimeType = "image/jpeg",
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

    // Export ke Blob JPEG standar
    const targetMime = mimeType === "image/webp" ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), targetMime, quality);
    });

    if (!blob) {
      return file;
    }

    // Buat nama file tunggal bersih (buang semua double extension seperti .jpg.jpeg atau .jpg.webp)
    const cleanBaseName = file.name
      .replace(/\.[a-zA-Z0-9._-]+$/g, "") // buang ekstensi dari titik pertama
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .substring(0, 50);

    const ext = targetMime === "image/webp" ? "webp" : "jpg";
    const finalFileName = `${cleanBaseName || "image"}.${ext}`;

    const compressedFile = new File([blob], finalFileName, {
      type: targetMime,
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
