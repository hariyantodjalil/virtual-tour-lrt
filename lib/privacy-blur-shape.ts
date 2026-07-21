import type { PrivacyBlur } from "./privacy-blur-types";
import {
  BLUR_HEIGHT_DEFAULT,
  BLUR_WIDTH_DEFAULT,
  clampBlurRadius,
  clampBlurScale,
  clampBlurSize,
} from "./privacy-blur-types";

/** Ukuran kotak blur di layar (px), setelah skala. */
export function blurScreenBoxPx(blur: PrivacyBlur) {
  const scale = clampBlurScale(blur.scale);
  return {
    w: clampBlurSize(blur.width, BLUR_WIDTH_DEFAULT) * scale,
    h: clampBlurSize(blur.height, BLUR_HEIGHT_DEFAULT) * scale,
    scale,
  };
}

/** Radius sudut di layar (px), dibatasi setengah sisi terpendek → bisa jadi lingkaran/pill. */
export function blurCornerRadiusScreenPx(blur: PrivacyBlur): number {
  const { w, h, scale } = blurScreenBoxPx(blur);
  const r = clampBlurRadius(blur.radius) * scale;
  return Math.min(r, w / 2, h / 2);
}

/** Skala radius sudut ke ukuran patch di piksel panorama. */
export function blurCornerRadiusPatchPx(
  patchW: number,
  patchH: number,
  blur: PrivacyBlur
): number {
  const { w: screenW, h: screenH } = blurScreenBoxPx(blur);
  const rScreen = blurCornerRadiusScreenPx(blur);
  if (rScreen <= 0) return 0;
  const scaleX = patchW / Math.max(1, screenW);
  const scaleY = patchH / Math.max(1, screenH);
  const rPatch = rScreen * Math.min(scaleX, scaleY);
  return Math.min(Math.round(rPatch), Math.floor(patchW / 2), Math.floor(patchH / 2));
}

/** SVG mask putih (alpha) untuk rounded rect / lingkaran / kapsul. */
export function roundedBlurMaskSvg(width: number, height: number, radius: number): string {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const r = Math.min(Math.max(0, radius), w / 2, h / 2);

  if (r <= 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="white"/></svg>`;
  }

  const isCircle =
    Math.abs(w - h) <= 2 && r >= Math.min(w, h) / 2 - 1;
  if (isCircle) {
    const cx = w / 2;
    const cy = h / 2;
    const rad = Math.min(w, h) / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><circle cx="${cx}" cy="${cy}" r="${rad}" fill="white"/></svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="white"/></svg>`;
}
