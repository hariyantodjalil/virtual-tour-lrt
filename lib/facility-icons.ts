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
    color: "#1e3a8a",
    src: "/brand/tour-pins/toilet.png",
  },
  {
    id: "mushola",
    label: "Mushola",
    color: "#166534",
    src: "/brand/tour-pins/mushola.png",
  },
  {
    id: "escalator",
    label: "Eskalator",
    color: "#6b21a8",
    src: "/brand/tour-pins/escalator.png",
  },
  {
    id: "lift",
    label: "Lift",
    color: "#b91c1c",
    src: "/brand/tour-pins/lift.png",
  },
  {
    id: "gate",
    label: "Gate",
    color: "#c2410c",
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
