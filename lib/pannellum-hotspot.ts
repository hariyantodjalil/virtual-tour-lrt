import type { HotspotType } from "./hotspot-types";
import { hotspotColor } from "./hotspot-types";

/** Ikon SVG per tipe — jangan set div.style.transform (dipakai Pannellum matrix3d). */
export function hotspotIconSvg(type: HotspotType): string {
  if (type === "scene") {
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
  }
  if (type === "space") {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="8.5" fill="none" stroke="white" stroke-width="2"/></svg>';
  }
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>';
}

export type HotspotVisualOptions = {
  type: HotspotType;
  label: string;
  selected?: boolean;
  pulse?: boolean;
};

/** Style dasar hotspot Pannellum — aman untuk matrix3d positioning. */
export function applyHotspotBaseStyle(div: HTMLDivElement, opts: HotspotVisualOptions) {
  const color = hotspotColor(opts.type);
  const selected = opts.selected ?? false;
  const pulse = opts.pulse ?? !selected;

  Object.assign(div.style, {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    border: `3px solid ${selected ? "#fff" : "rgba(255,255,255,0.85)"}`,
    backgroundColor: color,
    cursor: "pointer",
    boxShadow: selected
      ? `0 0 0 4px ${color}55, 0 4px 16px rgba(0,0,0,0.6)`
      : "0 3px 14px rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    transition: "scale 0.12s ease, box-shadow 0.12s ease",
    animation: pulse ? "lrt-hotspot-pulse 2.8s ease-in-out infinite" : "none",
  });
  div.style.setProperty("scale", selected ? "1.15" : "1");
  div.innerHTML = hotspotIconSvg(opts.type);
}

export function attachHotspotTooltip(div: HTMLDivElement, label: string) {
  const existing = div.querySelector("[data-lrt-tooltip]");
  if (existing) existing.remove();

  const tooltip = document.createElement("div");
  tooltip.dataset.lrtTooltip = "1";
  tooltip.textContent = label;
  Object.assign(tooltip.style, {
    position: "absolute",
    bottom: "calc(100% + 10px)",
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(15,23,42,0.95)",
    color: "#f1f5f9",
    padding: "5px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "600",
    whiteSpace: "nowrap",
    pointerEvents: "none",
    display: "none",
    border: "1px solid rgba(255,255,255,0.15)",
    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
    zIndex: "10",
  });
  div.appendChild(tooltip);

  div.addEventListener("mouseenter", () => {
    tooltip.style.display = "block";
    div.style.setProperty("scale", "1.2");
    div.style.animationPlayState = "paused";
  });
  div.addEventListener("mouseleave", () => {
    tooltip.style.display = "none";
    const selected = div.dataset.lrtSelected === "1";
    div.style.setProperty("scale", selected ? "1.15" : "1");
    div.style.animationPlayState = selected ? "paused" : "running";
  });
}

export function setHotspotSelected(div: HTMLDivElement, type: HotspotType, selected: boolean) {
  div.dataset.lrtSelected = selected ? "1" : "0";
  applyHotspotBaseStyle(div, { type, label: "", selected, pulse: !selected });
}
