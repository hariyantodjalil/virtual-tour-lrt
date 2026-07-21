export type PrivacyBlur = {
  pitch: number;
  yaw: number;
  /** Lebar area blur (px) */
  width?: number;
  /** Tinggi area blur (px) */
  height?: number;
  /** Intensitas blur CSS (px) */
  intensity?: number;
  /** Radius sudut bentuk blur (px) — 0 = kotak; ≥½ sisi terpendek = lingkaran/pill */
  radius?: number;
  /** Skala visual 0.1 – 2.0 */
  scale?: number;
};

export type PrivacyBlurItem = PrivacyBlur & {
  _id: string;
};

export const BLUR_WIDTH_DEFAULT = 100;
export const BLUR_HEIGHT_DEFAULT = 72;
export const BLUR_INTENSITY_DEFAULT = 14;
export const BLUR_RADIUS_DEFAULT = 10;
export const BLUR_RADIUS_MIN = 0;
export const BLUR_RADIUS_MAX = 160;
export const BLUR_SCALE_MIN = 0.1;
export const BLUR_SCALE_MAX = 2;
export const BLUR_SCALE_DEFAULT = 1;
export const BLUR_INTENSITY_MIN = 4;
export const BLUR_INTENSITY_MAX = 32;

export function clampBlurScale(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return BLUR_SCALE_DEFAULT;
  return Math.round(Math.min(BLUR_SCALE_MAX, Math.max(BLUR_SCALE_MIN, n)) * 100) / 100;
}

export function clampBlurIntensity(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return BLUR_INTENSITY_DEFAULT;
  return Math.round(Math.min(BLUR_INTENSITY_MAX, Math.max(BLUR_INTENSITY_MIN, n)));
}

export function clampBlurRadius(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return BLUR_RADIUS_DEFAULT;
  return Math.round(Math.min(BLUR_RADIUS_MAX, Math.max(BLUR_RADIUS_MIN, n)));
}

export function clampBlurSize(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.min(320, Math.max(24, n)));
}
