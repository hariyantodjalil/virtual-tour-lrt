import type { PrivacyBlur } from "./privacy-blur-types";
import {
  BLUR_HEIGHT_DEFAULT,
  BLUR_WIDTH_DEFAULT,
  clampBlurIntensity,
  clampBlurScale,
  clampBlurSize,
} from "./privacy-blur-types";

export type EquirectRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ViewerBakeContext = {
  viewerWidth: number;
  viewerHeight: number;
  hfov: number;
};

/** Default hfov di PannellumEditor — dipakai jika konteks viewer tidak dikirim. */
export const BLUR_BAKE_REFERENCE_HFOV = 100;
export const BLUR_BAKE_REFERENCE_VIEWER_WIDTH = 1200;
export const BLUR_BAKE_REFERENCE_VIEWER_HEIGHT = 675;

export function verticalFovDeg(hfovDeg: number, viewerW: number, viewerH: number): number {
  const w = Math.max(1, viewerW);
  const h = Math.max(1, viewerH);
  const hfovRad = (hfovDeg * Math.PI) / 180;
  const vfovRad = 2 * Math.atan((h / w) * Math.tan(hfovRad / 2));
  return (vfovRad * 180) / Math.PI;
}

function blurScreenSize(blur: PrivacyBlur) {
  const scale = clampBlurScale(blur.scale);
  return {
    w: clampBlurSize(blur.width, BLUR_WIDTH_DEFAULT) * scale,
    h: clampBlurSize(blur.height, BLUR_HEIGHT_DEFAULT) * scale,
    intensity: clampBlurIntensity(blur.intensity),
  };
}

export function blurAngularHalfExtents(
  blur: PrivacyBlur,
  viewerW: number,
  viewerH: number,
  hfov: number
) {
  const { w, h, intensity } = blurScreenSize(blur);
  const vfov = verticalFovDeg(hfov, viewerW, viewerH);
  return {
    halfYaw: (w / Math.max(1, viewerW)) * hfov,
    halfPitch: (h / Math.max(1, viewerH)) * vfov,
    screenW: w,
    intensity,
  };
}

export function normYaw(yaw: number): number {
  let y = yaw;
  while (y > 180) y -= 360;
  while (y < -180) y += 360;
  return y;
}

export function equirectPoint(
  yaw: number,
  pitch: number,
  panoW: number,
  panoH: number
): { x: number; y: number } {
  const ny = normYaw(yaw);
  const x = ((ny + 180) / 360) * panoW;
  const y = ((90 - pitch) / 180) * panoH;
  return { x, y };
}

/**
 * Hitung satu atau lebih persegi panjang piksel di gambar equirectangular untuk area blur.
 * Menangani wrap horizontal di seam ±180°.
 */
export function blurRegionRects(
  blur: PrivacyBlur,
  panoW: number,
  panoH: number,
  viewer: ViewerBakeContext
): EquirectRect[] {
  const { halfYaw, halfPitch } = blurAngularHalfExtents(
    blur,
    viewer.viewerWidth,
    viewer.viewerHeight,
    viewer.hfov
  );

  const center = equirectPoint(blur.yaw, blur.pitch, panoW, panoH);
  const xs: number[] = [];
  const ys: number[] = [];
  const steps = 6;

  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const yaw = blur.yaw - halfYaw + (2 * halfYaw * i) / steps;
      const pitch = blur.pitch - halfPitch + (2 * halfPitch * j) / steps;
      const p = equirectPoint(yaw, pitch, panoW, panoH);
      let dx = p.x - center.x;
      if (dx < -panoW / 2) dx += panoW;
      if (dx > panoW / 2) dx -= panoW;
      xs.push(center.x + dx);
      ys.push(p.y);
    }
  }

  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(panoH, Math.ceil(Math.max(...ys)));
  let height = Math.max(1, maxY - minY);
  if (minY + height > panoH) height = panoH - minY;
  if (height <= 0) return [];

  const minX = Math.floor(Math.min(...xs));
  const maxX = Math.ceil(Math.max(...xs));

  const rects: EquirectRect[] = [];

  const pushClamped = (left: number, width: number) => {
    if (width < 1) return;
    const l = Math.max(0, Math.min(panoW - 1, left));
    const w = Math.min(width, panoW - l);
    if (w >= 1) rects.push({ left: l, top: minY, width: w, height });
  };

  if (minX < 0) {
    pushClamped(0, maxX);
    pushClamped(panoW + minX, -minX);
  } else if (maxX > panoW) {
    pushClamped(minX, panoW - minX);
    pushClamped(0, maxX - panoW);
  } else {
    pushClamped(minX, maxX - minX);
  }

  return rects
    .map((r) => clampEquirectRect(r, panoW, panoH))
    .filter((r): r is EquirectRect => r !== null);
}

export function clampEquirectRect(
  rect: EquirectRect,
  panoW: number,
  panoH: number
): EquirectRect | null {
  const left = Math.max(0, Math.min(panoW - 1, Math.floor(rect.left)));
  const top = Math.max(0, Math.min(panoH - 1, Math.floor(rect.top)));
  const maxW = panoW - left;
  const maxH = panoH - top;
  const width = Math.min(Math.max(1, Math.floor(rect.width)), maxW);
  const height = Math.min(Math.max(1, Math.floor(rect.height)), maxH);
  if (width < 1 || height < 1) return null;
  return { left, top, width, height };
}

/** Sigma blur Sharp — skala intensitas CSS ke ukuran patch di piksel panorama. */
export function blurSigmaForRegion(
  blur: PrivacyBlur,
  regionWidthPx: number,
  viewer: ViewerBakeContext
): number {
  const { screenW, intensity } = blurAngularHalfExtents(
    blur,
    viewer.viewerWidth,
    viewer.viewerHeight,
    viewer.hfov
  );
  const scale = regionWidthPx / Math.max(1, screenW);
  return Math.max(1, Math.round(intensity * scale));
}

export function defaultViewerBakeContext(): ViewerBakeContext {
  return {
    viewerWidth: BLUR_BAKE_REFERENCE_VIEWER_WIDTH,
    viewerHeight: BLUR_BAKE_REFERENCE_VIEWER_HEIGHT,
    hfov: BLUR_BAKE_REFERENCE_HFOV,
  };
}
