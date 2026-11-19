/**
 * F5 VIP prod (`virtualtour-lrtjabodebek.kai.id`) menolak path S3-proxy bila
 * key ≥ 88 karakter (probe 2026-11-20). Margin aman: sample face ≤ 86.
 * Pyramid lama yang lebih panjang dilayani lewat alias `/api/t/{id}` tanpa memindah objek S3.
 * Modul ini aman di-import client (tanpa node:crypto).
 */
export const WAF_MAX_S3_KEY_LENGTH = 86;
export const WAF_TILE_FACE_SUFFIX = "/1/f0_0.jpg";
export const SHORT_TILE_ROOT = "virtual-tour/pt";

export type TileProfileFolder = "m" | "d" | "hm" | "hd";

export function profileFolder(kind: "economy" | "hd", profile: "mobile" | "desktop"): TileProfileFolder {
  if (kind === "hd") return profile === "mobile" ? "hm" : "hd";
  return profile === "mobile" ? "m" : "d";
}

/** Panjang key S3 untuk satu face tile sample (tanpa leading slash). */
export function sampleTileKeyLength(basePath: string): number {
  const normalized = basePath.replace(/^\//, "").replace(/\/$/, "");
  return `${normalized}${WAF_TILE_FACE_SUFFIX}`.length;
}

export function isProdWafSafeTileBasePath(basePath: string | undefined): boolean {
  if (!basePath) return false;
  return sampleTileKeyLength(basePath) <= WAF_MAX_S3_KEY_LENGTH;
}

/** Route alias untuk pyramid lama ber-path panjang: `/api/t/{id}/{level}/{face}.jpg`. */
export const TILE_ALIAS_ROUTE = "/api/t";
export const TILE_ALIAS_ID_PATTERN = /^[0-9a-f]{16}$/;

export function normalizeTileBasePath(basePath: string): string {
  return `/${basePath.replace(/^\/+|\/+$/g, "")}`;
}

function fnv1a32(text: string, seed: number): string {
  let hash = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Id alias deterministik dari basePath — sama di browser dan server. */
export function tileAliasId(basePath: string): string {
  const normalized = normalizeTileBasePath(basePath);
  return `${fnv1a32(normalized, 0x811c9dc5)}${fnv1a32(normalized, 0x9e3779b9)}`;
}

/** URL dasar tile untuk Pannellum: path pendek langsung lewat s3-proxy, path panjang lewat alias. */
export function panoramaTileUrlBase(basePath: string): string {
  if (/^(https?:|data:)/.test(basePath) || basePath.startsWith("/api/")) return basePath.replace(/\/$/, "");
  const normalized = normalizeTileBasePath(basePath);
  if (isProdWafSafeTileBasePath(normalized)) return `/api/s3-proxy${normalized}`;
  return `${TILE_ALIAS_ROUTE}/${tileAliasId(normalized)}`;
}

export function assertProdWafSafeTileBasePath(basePath: string): void {
  if (!isProdWafSafeTileBasePath(basePath)) {
    throw new Error(
      `tile basePath too long for prod WAF (${sampleTileKeyLength(basePath)} > ${WAF_MAX_S3_KEY_LENGTH}): ${basePath}`,
    );
  }
}
