// Root-level folder yang disimpan di S3 (new structure + legacy backward compat)
const S3_ROOT_FOLDERS = [
  // Struktur baru (terorganisir per kategori)
  "/virtual-tour/",
  "/stations/",
  "/spaces/",
  "/misc/",
  // Legacy paths (backward compat untuk data lama)
  "/panoramas/",
  "/floorplans/",
  "/thumbnails/",
];

export function getS3ProxyUrl(s3Url: string): string {
  if (!s3Url) return s3Url;
  if (s3Url.startsWith("data:")) return s3Url;
  if (s3Url.includes("/api/s3-proxy/")) return s3Url;
  if (s3Url.startsWith("http://") || s3Url.startsWith("https://")) return s3Url;

  if (S3_ROOT_FOLDERS.some((prefix) => s3Url.startsWith(prefix))) {
    return `/api/s3-proxy${s3Url}`;
  }

  return s3Url;
}

export function resolvePublicAssetUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("/brand/") || url.startsWith("/images/")) return url;
  return getS3ProxyUrl(url);
}

export function shouldUnoptimizeImage(url: string): boolean {
  return url.startsWith("/api/") || url.startsWith("http://") || url.startsWith("https://");
}

export function getImageUrl(s3Url: string): string {
  return getS3ProxyUrl(s3Url);
}

export function toS3Path(key: string): string {
  return key.startsWith("/") ? key : `/${key}`;
}
