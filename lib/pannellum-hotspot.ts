import type { HotspotType } from "./hotspot-types";
import type { SpaceAvailabilityStatus } from "./space-availability";
import { spaceStatusPinClass } from "./space-availability";
import { clampHotspotScale, hotspotColor } from "./hotspot-types";

/** Ikon SVG per tipe (space & info) — scene memakai floor ring. */
export function hotspotIconSvg(type: HotspotType): string {
  if (type === "scene") return "";
  if (type === "space") {
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true"><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="8" fill="none" stroke="white" stroke-width="2.8"/></svg>';
  }
  return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 10.5v5.5M12 7.5h.01" stroke-width="3.5"/></svg>';
}

export type HotspotVisualOptions = {
  type: HotspotType;
  selected?: boolean;
  scale?: number;
  onClick?: () => void;
  /** Warna pin unit — dari status retail */
  spaceStatus?: SpaceAvailabilityStatus;
};

export const FLOOR_RING_DISC_CLASS = "lrt-floor-ring__disc";
export const PIN_MARKER_DISC_CLASS = "lrt-pin-marker__disc";

function hotspotTypeClass(type: HotspotType) {
  return `lrt-hotspot--${type}`;
}

export function applyHotspotScale(div: HTMLDivElement, scale?: number) {
  div.style.setProperty("--lrt-hotspot-scale", String(clampHotspotScale(scale)));
}

/** Shell luar transparan — sama untuk scene, unit, dan info (Pannellum pakai matrix3d di sini). */
function applyHotspotOuterShell(div: HTMLDivElement, opts: HotspotVisualOptions) {
  const scale = clampHotspotScale(opts.scale);

  Object.assign(div.style, {
    width: "88px",
    height: "88px",
    minWidth: "88px",
    minHeight: "88px",
    background: "transparent",
    border: "none",
    borderRadius: "0",
    cursor: opts.onClick ? "pointer" : "default",
    boxShadow: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    boxSizing: "border-box",
    backgroundImage: "none",
  });
  applyHotspotScale(div, scale);
}

function buildSceneFloorRingHtml(selected: boolean): string {
  const sel = selected ? " is-selected" : "";
  return `<div class="lrt-floor-ring"><div class="lrt-floor-ring__pulse" aria-hidden="true"></div><div class="${FLOOR_RING_DISC_CLASS}${sel}"></div></div>`;
}

function buildPinMarkerHtml(
  type: HotspotType,
  selected: boolean,
  spaceStatus?: SpaceAvailabilityStatus
): string {
  const sel = selected ? " is-selected" : "";
  if (type === "space") {
    const variant = spaceStatusPinClass(spaceStatus);
    return `<div class="lrt-pin-marker lrt-pin-marker--space ${variant}"><div class="lrt-pin-marker__pulse" aria-hidden="true"></div><div class="${PIN_MARKER_DISC_CLASS}${sel}">${hotspotIconSvg(type)}</div></div>`;
  }
  return `<div class="lrt-pin-marker lrt-pin-marker--info"><div class="lrt-pin-marker__pulse" aria-hidden="true"></div><div class="${PIN_MARKER_DISC_CLASS}${sel}">${hotspotIconSvg(type)}</div></div>`;
}

function applySceneHotspotStyle(div: HTMLDivElement, opts: HotspotVisualOptions) {
  applyHotspotOuterShell(div, opts);
  div.innerHTML = buildSceneFloorRingHtml(opts.selected ?? false);
}

function applyPinHotspotStyle(div: HTMLDivElement, opts: HotspotVisualOptions) {
  applyHotspotOuterShell(div, opts);
  div.innerHTML = buildPinMarkerHtml(opts.type, opts.selected ?? false, opts.spaceStatus);
}

/** Style dasar hotspot Pannellum — pola seragam: shell transparan + marker di child. */
export function applyHotspotBaseStyle(div: HTMLDivElement, opts: HotspotVisualOptions) {
  div.classList.remove("lrt-hotspot--scene", "lrt-hotspot--space", "lrt-hotspot--info");
  div.classList.add(hotspotTypeClass(opts.type));

  if (opts.type === "scene") {
    applySceneHotspotStyle(div, opts);
    return;
  }
  applyPinHotspotStyle(div, opts);
}

/** Pasang hotspot visual + handler klik langsung di elemen. */
export function setupHotspotElement(div: HTMLDivElement, opts: HotspotVisualOptions) {
  applyHotspotBaseStyle(div, opts);

  if (opts.onClick) {
    div.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      opts.onClick?.();
    });
  }
}

export function setHotspotSelected(div: HTMLDivElement, type: HotspotType, selected: boolean) {
  div.dataset.lrtSelected = selected ? "1" : "0";

  const discClass = type === "scene" ? FLOOR_RING_DISC_CLASS : PIN_MARKER_DISC_CLASS;
  const disc = div.querySelector(`.${discClass}`);
  disc?.classList.toggle("is-selected", selected);
}

/** Update ukuran tanpa re-mount hotspot (slider CMS). */
export function setHotspotScale(div: HTMLDivElement, scale?: number) {
  applyHotspotScale(div, scale);
}

export { hotspotColor };
