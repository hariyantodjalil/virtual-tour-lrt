export type SpaceAvailabilityStatus =
  | "TERSEDIA"
  | "RESERVED"
  | "FIT_OUT"
  | "TERISI"
  | "MAINTENANCE";

export function spaceStatusCssVariant(
  status?: SpaceAvailabilityStatus | null
): "available" | "occupied" | "maintenance" | "unknown" {
  if (status === "TERISI") return "occupied";
  if (status === "RESERVED") return "occupied";
  if (status === "FIT_OUT" || status === "MAINTENANCE") return "maintenance";
  if (status === "TERSEDIA") return "available";
  return "unknown";
}

export function spaceStatusPinClass(status?: SpaceAvailabilityStatus | null): string {
  return `lrt-pin-marker--space-${spaceStatusCssVariant(status)}`;
}

export function spaceStatusColor(status?: SpaceAvailabilityStatus | null): string {
  const variant = spaceStatusCssVariant(status);
  if (variant === "occupied") return "#ef4444";
  if (variant === "maintenance") return "#9ca3af";
  if (variant === "available") return "#22c55e";
  return "#94a3b8";
}

/** Cari objek unit berdasarkan kode (case-insensitive & trim whitespace). */
export function findSpaceByCode<T extends { code: string }>(
  spaces: T[],
  code: string | undefined | null
): T | undefined {
  if (!code) return undefined;
  const cleanCode = code.trim().toLowerCase();
  return spaces.find((s) => s.code.trim().toLowerCase() === cleanCode);
}

/** Lookup status unit by kode (case-insensitive). */
export function findSpaceStatus<T extends { code: string; status: SpaceAvailabilityStatus }>(
  spaces: T[],
  code: string | undefined
): SpaceAvailabilityStatus | undefined {
  if (!code) return undefined;
  const lower = code.toLowerCase();
  return findSpaceByCode(spaces, code)?.status;
}
