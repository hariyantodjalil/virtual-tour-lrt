import type { HotspotType, HotspotDirection } from "./hotspot-types";
import type { SpaceAvailabilityStatus } from "./space-availability";
import type { FacilityIconId } from "./facility-icons";
import { spaceStatusPinClass } from "./space-availability";
import { clampHotspotScale, hotspotColor, DIRECTION_ROTATE_DEG } from "./hotspot-types";
import { facilityIconSrc } from "./facility-icons";

/** Warna brand LRT Jabodebek */
export const LRT_MAROON = "#E31E2D";

/** Ikon SVG per tipe (space & ad) — info memakai aset PNG; scene memakai navigasi pin + label. */
export function hotspotIconSvg(type: HotspotType): string {
  if (type === "scene") return "";
  if (type === "space") {
    return '<svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true"><image href="/brand/tour-pins/tenant-i.png" xlink:href="/brand/tour-pins/tenant-i.png" x="1" y="1" width="24" height="24" preserveAspectRatio="xMidYMid meet"/></svg>';
  }
  if (type === "ad") {
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15V9l4 3 4-3v6"/></svg>';
  }
  // Fallback — pin info utama memakai INFO_PIN_SRC
  return "";
}

/** Aset pin informasi (lingkaran putih + huruf i). */
export const INFO_PIN_SRC = "/brand/tour-pins/info.png";
export const INFO_PIN_W = 56;
export const INFO_PIN_H = 56;

const SCENE_CHEVRON_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

const SCENE_PIN_SVG =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 22s7-7.2 7-12.2A7 7 0 1 0 5 9.8C5 14.8 12 22 12 22z" fill="#c41230"/><circle cx="12" cy="9.5" r="2.6" fill="#fff"/></svg>';

export type HotspotVisualOptions = {
  type: HotspotType;
  selected?: boolean;
  scale?: number;
  onClick?: () => void;
  /** Label pin scene — biasanya title scene tujuan */
  sceneTitle?: string;
  /** Arah chevron scene: right (default), left, up, down */
  direction?: HotspotDirection;
  /** Warna pin unit — dari status retail */
  spaceStatus?: SpaceAvailabilityStatus;
  /** Ikon fasilitas untuk hotspot info */
  facilityIcon?: FacilityIconId;
};

/** @deprecated Floor ring diganti scene nav pin — tetap diekspor untuk kompatibilitas CMS */
export const FLOOR_RING_DISC_CLASS = "lrt-scene-nav__disc";
export const SCENE_NAV_DISC_CLASS = "lrt-scene-nav__disc";
export const PIN_MARKER_DISC_CLASS = "lrt-pin-marker__disc";
export const PIN_MARKER_IMG_CLASS = "lrt-pin-marker__img";

type SceneRef = { id?: string; sceneId?: string; title: string };

export function resolveSceneHotspotTitle(
  targetSceneId: string | undefined,
  scenes: SceneRef[],
  fallback = "Scene"
): string {
  if (!targetSceneId) return fallback;
  const target = scenes.find((s) => s.id === targetSceneId || s.sceneId === targetSceneId);
  const title = target?.title?.trim();
  return title || fallback;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hotspotTypeClass(type: HotspotType) {
  return `lrt-hotspot--${type}`;
}

export function applyHotspotScale(div: HTMLDivElement, scale?: number) {
  div.style.setProperty("--lrt-hotspot-scale", String(clampHotspotScale(scale)));
}

/** Shell luar transparan — unit & info (ukuran tetap). */
function applyPinHotspotOuterShell(div: HTMLDivElement, opts: HotspotVisualOptions) {
  const scale = clampHotspotScale(opts.scale);
  const isFacility = opts.type === "info" && !!opts.facilityIcon;
  const isInfoPin = opts.type === "info" && !opts.facilityIcon;
  const w = isFacility ? "75px" : isInfoPin ? `${INFO_PIN_W}px` : "88px";
  const h = isFacility ? "81px" : isInfoPin ? `${INFO_PIN_H}px` : "88px";

  Object.assign(div.style, {
    width: w,
    height: h,
    minWidth: w,
    minHeight: h,
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

/** Shell scene nav — lebar mengikuti label. */
function applySceneNavOuterShell(div: HTMLDivElement, opts: HotspotVisualOptions) {
  Object.assign(div.style, {
    width: "auto",
    height: "auto",
    minWidth: "0",
    minHeight: "0",
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
  applyHotspotScale(div, opts.scale);
}

function directionRotateCss(direction?: HotspotDirection): string {
  const deg = DIRECTION_ROTATE_DEG[direction ?? "right"] ?? 0;
  return deg === 0 ? "" : `rotate(${deg}deg)`;
}

function buildSceneNavHtml(selected: boolean, title: string, direction?: HotspotDirection): string {
  const sel = selected ? " is-selected" : "";
  const rotate = directionRotateCss(direction);
  const safeTitle = escapeHtml(title);
  const chevronStyle = rotate ? ` style="transform:${rotate}"` : "";
  return `<div class="lrt-scene-nav"><div class="lrt-scene-nav__pulse" aria-hidden="true"></div><div class="${SCENE_NAV_DISC_CLASS}${sel}"><span class="lrt-scene-nav__core"><span class="lrt-scene-nav__chevron"${chevronStyle}>${SCENE_CHEVRON_SVG}</span></span></div><div class="lrt-scene-nav__label" title="${safeTitle}"><span class="lrt-scene-nav__pin" aria-hidden="true">${SCENE_PIN_SVG}</span><span class="lrt-scene-nav__divider" aria-hidden="true"></span><span class="lrt-scene-nav__label-text">${safeTitle}</span></div></div>`;
}

function buildFacilityPinHtml(icon: FacilityIconId, selected: boolean): string {
  const sel = selected ? " is-selected" : "";
  const src = escapeHtml(facilityIconSrc(icon));
  return `<div class="lrt-pin-marker lrt-pin-marker--facility"><img class="${PIN_MARKER_IMG_CLASS}${sel}" src="${src}" alt="" width="75" height="81" draggable="false" /></div>`;
}

function buildInfoPinHtml(selected: boolean): string {
  const sel = selected ? " is-selected" : "";
  const src = escapeHtml(INFO_PIN_SRC);
  return `<div class="lrt-pin-marker lrt-pin-marker--info"><img class="${PIN_MARKER_IMG_CLASS}${sel}" src="${src}" alt="" width="${INFO_PIN_W}" height="${INFO_PIN_H}" draggable="false" /></div>`;
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
  if (type === "ad") {
    return `<div class="lrt-pin-marker lrt-pin-marker--ad"><div class="lrt-pin-marker__pulse" aria-hidden="true"></div><div class="${PIN_MARKER_DISC_CLASS}${sel}">${hotspotIconSvg(type)}</div></div>`;
  }
  return buildInfoPinHtml(selected);
}

function applySceneHotspotStyle(div: HTMLDivElement, opts: HotspotVisualOptions) {
  applySceneNavOuterShell(div, opts);
  const title = opts.sceneTitle?.trim() || "Scene";
  div.innerHTML = buildSceneNavHtml(opts.selected ?? false, title, opts.direction);
}

function applyPinHotspotStyle(div: HTMLDivElement, opts: HotspotVisualOptions) {
  applyPinHotspotOuterShell(div, opts);
  if (opts.type === "info" && opts.facilityIcon) {
    div.innerHTML = buildFacilityPinHtml(opts.facilityIcon, opts.selected ?? false);
    return;
  }
  if (opts.type === "info") {
    div.innerHTML = buildInfoPinHtml(opts.selected ?? false);
    return;
  }
  div.innerHTML = buildPinMarkerHtml(opts.type, opts.selected ?? false, opts.spaceStatus);
}

/** Style dasar hotspot Pannellum — pola seragam: shell transparan + marker di child. */
export function applyHotspotBaseStyle(div: HTMLDivElement, opts: HotspotVisualOptions) {
  div.classList.remove(
    "lrt-hotspot--scene",
    "lrt-hotspot--space",
    "lrt-hotspot--info",
    "lrt-hotspot--ad"
  );
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

  const facilityImg = div.querySelector(`.${PIN_MARKER_IMG_CLASS}`);
  if (facilityImg) {
    facilityImg.classList.toggle("is-selected", selected);
    return;
  }

  const discClass = type === "scene" ? SCENE_NAV_DISC_CLASS : PIN_MARKER_DISC_CLASS;
  const disc = div.querySelector(`.${discClass}`);
  disc?.classList.toggle("is-selected", selected);
}

/** Update label scene tanpa re-mount (editor). */
export function setSceneNavTitle(div: HTMLDivElement, title: string) {
  const safeTitle = escapeHtml(title.trim() || "Scene");
  const label = div.querySelector(".lrt-scene-nav__label");
  const text = div.querySelector(".lrt-scene-nav__label-text");
  if (label instanceof HTMLElement) label.title = safeTitle;
  if (text) text.textContent = title.trim() || "Scene";
}

/** Update arah chevron tanpa re-mount (editor). */
export function setSceneNavDirection(div: HTMLDivElement, direction?: HotspotDirection) {
  const chevron = div.querySelector(".lrt-scene-nav__chevron") as HTMLElement | null;
  if (!chevron) return;
  chevron.style.transform = directionRotateCss(direction);
}

/** Update ukuran tanpa re-mount hotspot (slider CMS). */
export function setHotspotScale(div: HTMLDivElement, scale?: number) {
  applyHotspotScale(div, scale);
}

export { hotspotColor };
