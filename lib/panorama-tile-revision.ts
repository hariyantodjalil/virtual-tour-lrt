import { createHash, randomBytes } from "node:crypto";
import {
  SHORT_TILE_ROOT,
  assertProdWafSafeTileBasePath,
  profileFolder,
} from "./panorama-tile-path";

/**
 * Segment revisi di S3 untuk pyramid tile — server-only (jangan import dari client).
 * Pendek + tanpa UUID agar path penuh lolos batas panjang WAF prod (≤86).
 */
export function newPanoramaTileRevisionId(
  kind: "economy" | "hd" = "economy",
  now = Date.now(),
  entropy: Uint8Array = randomBytes(4),
): string {
  const hex = Buffer.from(entropy).toString("hex");
  const body = `t${now.toString(36).slice(-6)}${hex}`;
  const id = kind === "hd" ? `h${body}` : body;
  if (!/^[a-z0-9]+$/i.test(id) || id.length > 16) {
    throw new Error("generated panorama tile revision id is invalid");
  }
  return id;
}

export function sceneTileContentId(ownerSlug: string, sceneId: string): string {
  return createHash("sha256")
    .update(`vt-pt:v1:${ownerSlug}\0${sceneId}`)
    .digest("hex")
    .slice(0, 12);
}

export function shortTilePrefix(ownerSlug: string, sceneId: string, revisionId: string): string {
  return `${SHORT_TILE_ROOT}/${sceneTileContentId(ownerSlug, sceneId)}/${revisionId}`;
}

export function shortTileBasePath(
  ownerSlug: string,
  sceneId: string,
  revisionId: string,
  kind: "economy" | "hd",
  profile: "mobile" | "desktop",
): string {
  const basePath = `/${shortTilePrefix(ownerSlug, sceneId, revisionId)}/${profileFolder(kind, profile)}`;
  assertProdWafSafeTileBasePath(basePath);
  return basePath;
}
