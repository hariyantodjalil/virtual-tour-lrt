import { randomBytes } from "node:crypto";

/**
 * Segment revisi di S3 untuk pyramid tile — server-only (jangan import dari client).
 * Contoh: `tk1abc2def34` atau `hdtk1abc2def34`.
 */
export function newPanoramaTileRevisionId(
  kind: "economy" | "hd" = "economy",
  now = Date.now(),
  entropy: Uint8Array = randomBytes(5),
): string {
  const hex = Buffer.from(entropy).toString("hex");
  const body = `t${now.toString(36)}${hex}`;
  const id = kind === "hd" ? `hd${body}` : body;
  if (!/^[a-z0-9]+$/i.test(id)) throw new Error("generated panorama tile revision id is invalid");
  return id;
}
