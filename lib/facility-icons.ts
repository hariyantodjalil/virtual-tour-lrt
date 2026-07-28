/** Pin fasilitas stasiun — aset dari Figma Symbol (node 129:307). */

export const FACILITY_ICON_IDS = [
  "toilet",
  "mushola",
  "escalator",
  "lift",
  "gate",
] as const;

export type FacilityIconId = (typeof FACILITY_ICON_IDS)[number];

export type FacilityIconDef = {
  id: FacilityIconId;
  label: string;
  /** Warna disk (referensi Figma) */
  color: string;
  src: string;
};

export const FACILITY_ICONS: FacilityIconDef[] = [
  {
    id: "toilet",
    label: "Toilet",
    color: "#283D9E",
    src: "/brand/tour-pins/toilet.png",
  },
  {
    id: "mushola",
    label: "Mushola",
    color: "#0C623C",
    src: "/brand/tour-pins/mushola.png",
  },
  {
    id: "escalator",
    label: "Eskalator",
    color: "#8B3DFF",
    src: "/brand/tour-pins/escalator.png",
  },
  {
    id: "lift",
    label: "Lift",
    color: "#D32F2F",
    src: "/brand/tour-pins/lift.png",
  },
  {
    id: "gate",
    label: "Gate",
    color: "#FF9800",
    src: "/brand/tour-pins/gate.png",
  },
];

export const DEFAULT_FACILITY_ICON: FacilityIconId = "toilet";

export function isFacilityIconId(raw: unknown): raw is FacilityIconId {
  return typeof raw === "string" && (FACILITY_ICON_IDS as readonly string[]).includes(raw);
}

export function getFacilityIcon(id: FacilityIconId | undefined): FacilityIconDef | undefined {
  if (!id) return undefined;
  return FACILITY_ICONS.find((icon) => icon.id === id);
}

export function facilityIconSrc(id: FacilityIconId): string {
  return getFacilityIcon(id)?.src ?? FACILITY_ICONS[0].src;
}
