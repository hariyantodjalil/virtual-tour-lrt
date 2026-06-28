const S3_PATH_PREFIXES = [
  "/panoramas/",
  "/floorplans/",
  "/stations/",
  "/spaces/",
  "/thumbnails/",
];

export function getS3ProxyUrl(s3Url: string): string {
  if (!s3Url) return s3Url;
  if (s3Url.startsWith("data:")) return s3Url;
  if (s3Url.includes("/api/s3-proxy/")) return s3Url;
  if (s3Url.startsWith("http://") || s3Url.startsWith("https://")) return s3Url;

  if (S3_PATH_PREFIXES.some((prefix) => s3Url.startsWith(prefix))) {
    return `/api/s3-proxy${s3Url}`;
  }

  return s3Url;
}

export function getImageUrl(s3Url: string): string {
  return getS3ProxyUrl(s3Url);
}

export function toS3Path(key: string): string {
  return key.startsWith("/") ? key : `/${key}`;
}
