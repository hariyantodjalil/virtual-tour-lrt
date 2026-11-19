import { isProdWafSafeTileBasePath } from "./panorama-tile-path";

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

/** Path tile yang lolos WAF VIP prod: panjang sample face key ≤ 86. */
export function isWafSafePanoramaBasePath(basePath: string | undefined): boolean {
  return isProdWafSafeTileBasePath(basePath);
}

export function selectSceneMultiRes(
  scene: { multiRes?: PannellumMultiRes; multiResProfiles?: PanoramaMultiResProfiles },
  viewportWidth: number,
): PannellumMultiRes | undefined {
  const profile = scene.multiResProfiles?.[viewportWidth >= 1024 ? "desktop" : "mobile"];
  // Semua env pakai tile. Hanya terima basePath pendek (skema virtual-tour/pt/...).
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
