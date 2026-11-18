import { extractMultiResProfilesHdFromCanvasData, type PanoramaMultiResProfiles } from "./panorama-profile";

/** Additive contract with the HD backfill. Never repurpose the economy field. */
export function extractHdMultiResProfilesFromCanvasData(value: unknown, panoramaUrl: string): PanoramaMultiResProfiles | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const canvas = value as Record<string, unknown>;
  const hd = extractMultiResProfilesHdFromCanvasData(canvas);
  if (!hd) return;
  // An upload / privacy rebake / AI patch invalidates HD until safely regenerated.
  if (hd.sourcePanoramaUrl !== panoramaUrl ||
      (hd.privacyBlurLastBakedAt ?? null) !== (canvas.privacyBlurLastBakedAt ?? null) ||
      (hd.aiPatchLastBakedAt ?? null) !== (canvas.aiPatchLastBakedAt ?? null)) return;
  return hd;
}
