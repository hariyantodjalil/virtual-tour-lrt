import { randomBytes } from "node:crypto";

/** Browser-safe metadata shared by the uploader and public viewer. */
export type PannellumMultiRes = {
  basePath: string;
  path: "/%l/%s%y_%x";
  extension: "jpg";
  tileResolution: number;
  maxLevel: number;
  cubeResolution: number;
};

export type PanoramaMultiResProfiles = {
  version: "jpeg85-v1";
  desktop: PannellumMultiRes;
  mobile: PannellumMultiRes;
};

export function isPannellumMultiRes(value: unknown): value is PannellumMultiRes {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  const tile = row.tileResolution;
  const cube = row.cubeResolution;
  return typeof row.basePath === "string" && row.basePath.length > 0 &&
    row.path === "/%l/%s%y_%x" && row.extension === "jpg" &&
    (tile === 512 || tile === 1024) && (cube === 2048 || cube === 4096) &&
    row.maxLevel === Math.log2(cube / tile) + 1;
}

export function extractMultiResProfilesFromCanvasData(value: unknown): PanoramaMultiResProfiles | undefined {
  if (!value || typeof value !== "object") return;
  const profiles = (value as Record<string, unknown>).multiResProfiles;
  if (!profiles || typeof profiles !== "object") return;
  const p = profiles as Record<string, unknown>;
  if (p.version === "jpeg85-v1" && isPannellumMultiRes(p.desktop) &&
      isPannellumMultiRes(p.mobile) && p.desktop.tileResolution === 1024 && p.mobile.tileResolution === 512) {
    return p as PanoramaMultiResProfiles;
  }
}

/** F5/WAF sering menolak path tile yang berisi UUID → HTML "Request Rejected". */
const UUID_IN_PATH =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * VIP publik prod (`virtualtour-lrtjabodebek.kai.id`) menolak SELURUH pohon
 * `/api/s3-proxy/.../panorama-tiles/` (bukan hanya UUID). DEV hostname dan akses
 * IP:3000 tetap meloloskan tile. Override: NEXT_PUBLIC_PANORAMA_BLOCK_MULTIRES=1.
 */
export function isPanoramaMultiresBlockedByEdge(): boolean {
  if (process.env.NEXT_PUBLIC_PANORAMA_BLOCK_MULTIRES === "1") return true;
  if (process.env.NEXT_PUBLIC_PANORAMA_BLOCK_MULTIRES === "0") return false;
  if (typeof window !== "undefined") {
    return window.location.hostname === "virtualtour-lrtjabodebek.kai.id";
  }
  return false;
}

export function isWafSafePanoramaBasePath(basePath: string | undefined): boolean {
  if (!basePath || UUID_IN_PATH.test(basePath)) return false;
  if (isPanoramaMultiresBlockedByEdge()) return false;
  return true;
}

/**
 * Segment revisi di S3 untuk pyramid tile — dipakai lokal/DEV/prod.
 * Sengaja tanpa pola UUID bertanda hubung agar lolos WAF VIP publik prod.
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
  if (!isWafSafePanoramaBasePath(`/${id}`) || !/^[a-z0-9]+$/i.test(id)) {
    throw new Error("generated panorama tile revision id is not WAF-safe");
  }
  return id;
}

export function selectSceneMultiRes(
  scene: { multiRes?: PannellumMultiRes; multiResProfiles?: PanoramaMultiResProfiles },
  viewportWidth: number,
): PannellumMultiRes | undefined {
  const profile = scene.multiResProfiles?.[viewportWidth >= 1024 ? "desktop" : "mobile"];
  // Hanya path tanpa UUID. Path ber-UUID ditolak F5/WAF prod ("Request Rejected")
  // → viewer harus jatuh ke equirectangular WebP, bukan preload tile yang pasti gagal.
  if (scene.multiRes && isWafSafePanoramaBasePath(scene.multiRes.basePath)) {
    return scene.multiRes;
  }
  if (profile && isWafSafePanoramaBasePath(profile.basePath)) {
    return profile;
  }
  return undefined;
}

// ── Profil HD (aset asli/native) ──────────────────────────────────────────────
// Kontrak reader: lib/panorama-hd-profile.ts (Codex). `multiResProfiles` tetap
// menjadi profil Hemat dan TIDAK berubah oleh penambahan profil HD.

export type PanoramaHdProvenance = {
  /** `original` = sumber asli dipakai apa adanya; `original-reblur` = blur privasi
   *  diterapkan ulang di resolusi native lalu diverifikasi terhadap hasil existing. */
  source: "original" | "original-reblur";
  /** Kunci S3 sumber asli (identitas aset, bukan URL bertanda tangan). */
  sourceKey: string;
  sourceDimensions: string;
  generator: {
    jpegQuality: number;
    cubeResolution: number;
    tileResolutions: { mobile: number; desktop: number };
  };
  privacy?: {
    blurRegions: number;
    reBakedAtNative: boolean;
    viewerContext?: { viewerWidth: number; viewerHeight: number; hfov: number };
    verifiedAgainstKey?: string;
  };
  createdAt: string;
};

/** Bentuk HD di canvasData — kompatibel dengan reader Hemat (versi tetap jpeg85-v1),
 *  plus pengaman kesegaran yang dibaca extractHdMultiResProfilesFromCanvasData. */
export type PanoramaMultiResProfilesHd = PanoramaMultiResProfiles & {
  privacyVerified: true;
  /** panoramaUrl saat HD dibuat — jika panorama berganti, reader menyembunyikan HD. */
  sourcePanoramaUrl: string;
  privacyBlurLastBakedAt?: string;
  aiPatchLastBakedAt?: string;
  provenance: PanoramaHdProvenance;
};

export function isPanoramaMultiResProfilesHd(value: unknown): value is PanoramaMultiResProfilesHd {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (row.version !== "jpeg85-v1") return false;
  if (row.privacyVerified !== true || typeof row.sourcePanoramaUrl !== "string") return false;
  if (!row.provenance || typeof row.provenance !== "object") return false;
  const prov = row.provenance as Record<string, unknown>;
  if (prov.source !== "original" && prov.source !== "original-reblur") return false;
  if (typeof prov.sourceKey !== "string" || typeof prov.createdAt !== "string") return false;
  return isPannellumMultiRes(row.desktop) && isPannellumMultiRes(row.mobile) &&
    (row.desktop as PannellumMultiRes).tileResolution === 1024 &&
    (row.mobile as PannellumMultiRes).tileResolution === 512;
}

export function extractMultiResProfilesHdFromCanvasData(
  value: unknown
): PanoramaMultiResProfilesHd | undefined {
  if (!value || typeof value !== "object") return;
  const row = (value as Record<string, unknown>).multiResProfilesHd;
  if (isPanoramaMultiResProfilesHd(row)) return row;
}

/** Setelah panorama fisik diganti (upload/bake/patch) profil HD lama tidak valid
 *  lagi; panggil ini saat menulis canvasData baru agar tile HD basi tidak tersimpan. */
export function withoutHdPanoramaProfiles(canvasData: unknown): Record<string, unknown> {
  const base = canvasData && typeof canvasData === "object" && !Array.isArray(canvasData)
    ? { ...(canvasData as Record<string, unknown>) }
    : {};
  delete base.multiResProfilesHd;
  return base;
}
