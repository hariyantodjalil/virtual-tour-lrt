import type { PrivacyBlur } from "./privacy-blur-types";
import {
  BLUR_HEIGHT_DEFAULT,
  BLUR_WIDTH_DEFAULT,
  clampBlurIntensity,
  clampBlurRadius,
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
      radius: clampBlurRadius(b.radius),
      scale: clampBlurScale(b.scale),
    };
  });
}

export function extractPrivacyBlursFromCanvasData(canvasData: unknown): PrivacyBlur[] {
  if (!canvasData || typeof canvasData !== "object") return [];
  const data = canvasData as Record<string, unknown>;
  return normalizePrivacyBlurs(data.privacyBlurs);
}

function canvasDataBase(canvasData: unknown): Record<string, unknown> {
  return canvasData && typeof canvasData === "object" && !Array.isArray(canvasData)
    ? { ...(canvasData as Record<string, unknown>) }
    : {};
}

export function mergePrivacyBlursIntoCanvasData(
  canvasData: unknown,
  blurs: Omit<PrivacyBlur, never>[]
): Record<string, unknown> {
  return {
    ...canvasDataBase(canvasData),
    privacyBlurs: blurs.map(({ pitch, yaw, width, height, intensity, radius, scale }) => ({
      pitch,
      yaw,
      width,
      height,
      intensity,
      radius,
      scale,
    })),
  };
}

/** Master panorama tanpa blur — dipakai ulang setiap bake agar pindah/resize bisa di-re-bake. */
export function getPrivacyBlurSourcePanoramaUrl(canvasData: unknown): string | null {
  const url = canvasDataBase(canvasData).privacyBlurSourcePanoramaUrl;
  return typeof url === "string" && url.length > 0 ? url : null;
}

export function markPrivacyBlurBaked(
  canvasData: unknown,
  blurs: Omit<PrivacyBlur, never>[],
  sourcePanoramaUrl: string
): Record<string, unknown> {
  return {
    ...mergePrivacyBlursIntoCanvasData(canvasData, blurs),
    privacyBlurSourcePanoramaUrl: sourcePanoramaUrl,
    privacyBlurLastBakedAt: new Date().toISOString(),
  };
}

export function isPrivacyBlurBakedInPanorama(canvasData: unknown): boolean {
  return Boolean(canvasDataBase(canvasData).privacyBlurLastBakedAt);
}

/** Setelah ganti file panorama — reset master & metadata bake. */
export function resetPrivacyBlurForNewPanorama(
  canvasData: unknown,
  newPanoramaUrl: string
): Record<string, unknown> {
  const base = canvasDataBase(canvasData);
  delete base.privacyBlurLastBakedAt;
  delete base.privacyBlurSourcePanoramaUrl;
  return {
    ...base,
    privacyBlurSourcePanoramaUrl: newPanoramaUrl,
    privacyBlurs: [],
  };
}
