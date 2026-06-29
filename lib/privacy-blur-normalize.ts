import type { PrivacyBlur } from "./privacy-blur-types";
import {
  BLUR_HEIGHT_DEFAULT,
  BLUR_INTENSITY_DEFAULT,
  BLUR_WIDTH_DEFAULT,
  clampBlurIntensity,
  clampBlurScale,
  clampBlurSize,
} from "./privacy-blur-types";

export function normalizePrivacyBlurs(raw: unknown): PrivacyBlur[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((item) => {
    const b = item as Record<string, unknown>;
    return {
      pitch: Number(b.pitch ?? 0),
      yaw: Number(b.yaw ?? 0),
      width: clampBlurSize(b.width, BLUR_WIDTH_DEFAULT),
      height: clampBlurSize(b.height, BLUR_HEIGHT_DEFAULT),
      intensity: clampBlurIntensity(b.intensity),
      scale: clampBlurScale(b.scale),
    };
  });
}

export function extractPrivacyBlursFromCanvasData(canvasData: unknown): PrivacyBlur[] {
  if (!canvasData || typeof canvasData !== "object") return [];
  const data = canvasData as Record<string, unknown>;
  return normalizePrivacyBlurs(data.privacyBlurs);
}

export function mergePrivacyBlursIntoCanvasData(
  canvasData: unknown,
  blurs: Omit<PrivacyBlur, never>[]
): Record<string, unknown> {
  const base =
    canvasData && typeof canvasData === "object" && !Array.isArray(canvasData)
      ? { ...(canvasData as Record<string, unknown>) }
      : {};
  return {
    ...base,
    privacyBlurs: blurs.map(({ pitch, yaw, width, height, intensity, scale }) => ({
      pitch,
      yaw,
      width,
      height,
      intensity,
      scale,
    })),
  };
}
