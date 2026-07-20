import type { PrivacyBlurItem } from "./privacy-blur-types";
import {
  BLUR_HEIGHT_DEFAULT,
  BLUR_INTENSITY_DEFAULT,
  BLUR_WIDTH_DEFAULT,
  clampBlurIntensity,
  clampBlurRadius,
  clampBlurScale,
  clampBlurSize,
} from "./privacy-blur-types";
import { blurCornerRadiusScreenPx } from "./privacy-blur-shape";

export type PrivacyBlurVisualOptions = {
  selected?: boolean;
  editor?: boolean;
  /** Setelah dibake: tampilkan kotak panduan saja (tanpa backdrop blur). */
  guideOnly?: boolean;
  width?: number;
  height?: number;
  intensity?: number;
  radius?: number;
  scale?: number;
};

function blurDimensions(opts: PrivacyBlurVisualOptions) {
  const scale = clampBlurScale(opts.scale);
  const width = clampBlurSize(opts.width, BLUR_WIDTH_DEFAULT) * scale;
  const height = clampBlurSize(opts.height, BLUR_HEIGHT_DEFAULT) * scale;
  const intensity = clampBlurIntensity(opts.intensity);
  return { width, height, intensity, scale };
}

export function applyPrivacyBlurStyle(div: HTMLDivElement, opts: PrivacyBlurVisualOptions) {
  const { width, height, intensity } = blurDimensions(opts);
  const guideOnly = opts.guideOnly ?? false;
  const cornerPx = blurCornerRadiusScreenPx({
    width: opts.width,
    height: opts.height,
    scale: opts.scale,
    radius: opts.radius,
    pitch: 0,
    yaw: 0,
  });

  div.classList.toggle("lrt-privacy-blur--editor", opts.editor ?? false);
  div.classList.toggle("lrt-privacy-blur--guide", guideOnly);
  div.classList.toggle("is-selected", opts.selected ?? false);
  div.style.setProperty("--lrt-blur-intensity", `${intensity}px`);

  const backdrop =
    guideOnly || !opts.editor
      ? { backdropFilter: "none", WebkitBackdropFilter: "none" }
      : {
          backdropFilter: `blur(${intensity}px)`,
          WebkitBackdropFilter: `blur(${intensity}px)`,
        };

  Object.assign(div.style, {
    width: `${width}px`,
    height: `${height}px`,
    minWidth: `${width}px`,
    minHeight: `${height}px`,
    background: guideOnly ? "rgba(168, 85, 247, 0.12)" : "rgba(255, 255, 255, 0.03)",
    borderRadius: `${cornerPx}px`,
    overflow: "hidden",
    ...backdrop,
    pointerEvents: opts.editor ? "auto" : "none",
    cursor: opts.editor ? "grab" : "default",
    boxSizing: "border-box",
    border: opts.editor
      ? opts.selected
        ? "2px solid rgba(168, 85, 247, 0.95)"
        : "2px dashed rgba(147, 51, 234, 0.55)"
      : "none",
    boxShadow: opts.selected ? "0 0 0 3px rgba(168, 85, 247, 0.25)" : "none",
  });
}

export function setupPrivacyBlurElement(div: HTMLDivElement, opts: PrivacyBlurVisualOptions) {
  div.classList.add("lrt-privacy-blur");
  applyPrivacyBlurStyle(div, opts);
}

export function setPrivacyBlurSelected(div: HTMLDivElement, selected: boolean, editor = true) {
  div.classList.toggle("is-selected", selected);
  div.style.border = editor
    ? selected
      ? "2px solid rgba(168, 85, 247, 0.95)"
      : "2px dashed rgba(147, 51, 234, 0.55)"
    : "none";
  div.style.boxShadow = selected ? "0 0 0 3px rgba(168, 85, 247, 0.25)" : "none";
}

export function setPrivacyBlurDimensions(
  div: HTMLDivElement,
  blur: PrivacyBlurItem,
  editor = true,
  guideOnly = false
) {
  applyPrivacyBlurStyle(div, {
    editor,
    guideOnly,
    selected: div.classList.contains("is-selected"),
    width: blur.width,
    height: blur.height,
    intensity: blur.intensity,
    radius: blur.radius,
    scale: blur.scale,
  });
}

/** Konfigurasi hotspot Pannellum untuk area blur (non-interaktif di publik). */
export function buildViewPrivacyBlurHotSpot(blur: PrivacyBlurItem) {
  return {
    id: blur._id,
    pitch: blur.pitch,
    yaw: blur.yaw,
    type: "custom" as const,
    cssClass: "lrt-privacy-blur-hs",
    createTooltipFunc: (div: HTMLDivElement) => {
      setupPrivacyBlurElement(div, {
        editor: false,
        width: blur.width,
        height: blur.height,
        intensity: blur.intensity,
        radius: blur.radius,
        scale: blur.scale,
      });
    },
  };
}
