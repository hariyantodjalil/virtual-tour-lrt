/**
 * F5 VIP prod (`virtualtour-lrtjabodebek.kai.id`) menolak path S3-proxy bila
 * key ≥ 88 karakter (probe 2026-11-20). Margin aman: sample face ≤ 86.
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

export function assertProdWafSafeTileBasePath(basePath: string): void {
  if (!isProdWafSafeTileBasePath(basePath)) {
    throw new Error(
      `tile basePath too long for prod WAF (${sampleTileKeyLength(basePath)} > ${WAF_MAX_S3_KEY_LENGTH}): ${basePath}`,
    );
  }
}
