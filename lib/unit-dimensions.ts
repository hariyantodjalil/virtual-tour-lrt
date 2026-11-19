export type SpaceAreaKind = "ZONE" | "ZONE_ALLOCATION" | "STANDALONE" | string;

export const SPACE_AREA_KIND_LABELS: Record<string, string> = {
  ZONE: "Zona",
  ZONE_ALLOCATION: "Alokasi zona",
  STANDALONE: "Area tetap",
};

export function formatArea(area: number | null | undefined): string {
  if (area == null || Number.isNaN(area)) return "—";
  return `${new Intl.NumberFormat("id-ID").format(area)} m²`;
}

export function formatDimensions(input: {
  lengthM?: number | null;
  widthM?: number | null;
  heightM?: number | null;
}): string {
  const parts = [
    input.lengthM && input.lengthM > 0 ? `P ${input.lengthM} m` : null,
    input.widthM && input.widthM > 0 ? `L ${input.widthM} m` : null,
    input.heightM && input.heightM > 0 ? `T ${input.heightM} m` : null,
  ].filter(Boolean);
  return parts.join(" × ");
}
