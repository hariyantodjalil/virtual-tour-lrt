import type { SceneInitialView } from "./tour-types";
import { PANNELLUM_HFOV } from "./pannellum-viewer-defaults";

export function extractInitialViewFromCanvasData(canvasData: unknown): SceneInitialView | undefined {
  if (!canvasData || typeof canvasData !== "object") return undefined;
  const data = canvasData as Record<string, unknown>;
  const view = data.initialView;
  if (!view || typeof view !== "object") return undefined;
  const v = view as Record<string, unknown>;
  const yaw = Number(v.yaw);
  const pitch = Number(v.pitch);
  if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) return undefined;
  const hfovRaw = Number(v.hfov);
  return {
    yaw,
    pitch,
    hfov: Number.isFinite(hfovRaw) ? hfovRaw : PANNELLUM_HFOV.hfov,
  };
}

export function mergeInitialViewIntoCanvasData(
  canvasData: unknown,
  initialView: SceneInitialView
): Record<string, unknown> {
  const base =
    canvasData && typeof canvasData === "object" && !Array.isArray(canvasData)
      ? { ...(canvasData as Record<string, unknown>) }
      : {};
  return {
    ...base,
    initialView: {
      yaw: initialView.yaw,
      pitch: initialView.pitch,
      hfov: initialView.hfov ?? PANNELLUM_HFOV.hfov,
    },
  };
}
