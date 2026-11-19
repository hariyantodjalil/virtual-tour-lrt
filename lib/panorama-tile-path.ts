/**
 * F5 VIP prod (`virtualtour-lrtjabodebek.kai.id`) menolak URL s3-proxy bila key tile
 * ≥ 88 karakter (probe 2026-11-20). Karena itu tile selalu diminta lewat alias pendek
 * `/api/t/{id}`; server memetakan id ke basePath asli di S3.
 * Modul ini aman di-import client (tanpa node:crypto).
 */
export const WAF_MAX_S3_KEY_LENGTH = 86;
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

/** URL dasar tile untuk Pannellum. */
export function panoramaTileUrlBase(basePath: string): string {
  if (/^(https?:|data:)/.test(basePath) || basePath.startsWith("/api/")) return basePath.replace(/\/$/, "");
  return `${TILE_ALIAS_ROUTE}/${tileAliasId(basePath)}`;
}
