import { z } from "zod";
import type { Hotspot, SceneInitialView } from "./tour-types";
import { PANNELLUM_HFOV, PANNELLUM_PITCH_LIMITS } from "./pannellum-viewer-defaults";

/** Camera coordinates belong to the destination panorama, not the source marker. */
export const sceneEntryViewSchema = z.object({
  yaw: z.number().finite().min(-180).max(180),
  pitch: z.number().finite().min(PANNELLUM_PITCH_LIMITS.minPitch).max(PANNELLUM_PITCH_LIMITS.maxPitch),
  hfov: z.number().finite().min(PANNELLUM_HFOV.minHfov).max(PANNELLUM_HFOV.maxHfov).optional(),
}).strict();

export function resolveSceneEntryView(
  hotspot: Pick<Hotspot, "pitch" | "yaw" | "targetView">,
  destinationView?: SceneInitialView,
): SceneInitialView {
  const view = hotspot.targetView ?? destinationView;
  if (view) return { ...view, hfov: view.hfov ?? PANNELLUM_HFOV.hfov };
  // Preserve the previous transition for connections that have never been configured.
  return {
    yaw: hotspot.yaw,
    pitch: Math.max(-8, Math.min(8, hotspot.pitch * 0.12)),
    hfov: PANNELLUM_HFOV.hfov,
  };
}
