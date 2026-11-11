/**
 * Aturan dimensi unit tenant — dipakai bersama oleh form CMS (validasi klien) dan API (validasi server).
 * Semua ukuran dalam meter; luas dalam m².
 */

export const SPACE_AREA_KIND_VALUES = ["FIXED", "ZONE", "ZONE_ALLOCATION"] as const;
export type SpaceAreaKind = (typeof SPACE_AREA_KIND_VALUES)[number];

export const SPACE_AREA_KIND_LABELS: Record<SpaceAreaKind, string> = {
  FIXED: "Area tetap",
  ZONE: "Zona induk (dapat dibagi)",
  ZONE_ALLOCATION: "Bagian dari zona",
};

export type DimensionLimits = {
  maxLength: number;
  maxWidth: number;
  maxHeight: number;
};

/** Ukuran terkecil yang diterima (1 cm) agar nilai 0 dan negatif ditolak. */
export const MIN_DIMENSION_M = 0.01;

export const STATION_DIMENSION_LIMITS: DimensionLimits = { maxLength: 50, maxWidth: 50, maxHeight: 6 };
export const TRAIN_DIMENSION_LIMITS: DimensionLimits = { maxLength: 20, maxWidth: 20, maxHeight: 3 };

/** Toleransi pembulatan saat membandingkan luas alokasi dengan luas zona. */
export const AREA_EPSILON = 0.001;

export type UnitDimensions = {
  lengthM?: number | null;
  widthM?: number | null;
  heightM?: number | null;
};

function hasValue(value: number | null | undefined): value is number {
  return value !== null && value !== undefined;
}

/** true bila panjang, lebar, dan tinggi terisi (> 0) — syarat volume 3D. */
export function hasCompleteDimensions(dimensions: UnitDimensions | null | undefined) {
  return !!dimensions?.lengthM && !!dimensions.widthM && !!dimensions.heightM;
}

export function roundArea(value: number) {
  return Math.round(value * 100) / 100;
}

export function areaFromDimensions(lengthM?: number | null, widthM?: number | null): number | null {
  if (!hasValue(lengthM) || !hasValue(widthM)) return null;
  return roundArea(lengthM * widthM);
}

function checkDimension(label: string, value: number | null | undefined, max: number): string | null {
  if (!hasValue(value)) return null;
  if (!Number.isFinite(value)) return `${label} harus berupa angka.`;
  if (value < MIN_DIMENSION_M) return `${label} harus lebih dari 0 m.`;
  if (value > max) return `${label} maksimal ${max} m.`;
  return null;
}

export function validateDimensions(dimensions: UnitDimensions, limits: DimensionLimits): string | null {
  const { lengthM, widthM, heightM } = dimensions;
  if (hasValue(lengthM) !== hasValue(widthM)) {
    return "Panjang dan lebar harus diisi bersamaan.";
  }
  return (
    checkDimension("Panjang", lengthM, limits.maxLength) ??
    checkDimension("Lebar", widthM, limits.maxWidth) ??
    checkDimension("Tinggi", heightM, limits.maxHeight)
  );
}

function formatMeter(value: number) {
  return value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

/** Contoh: "2 × 1,5 m · tinggi 2,4 m". Kosong bila panjang/lebar belum diisi. */
export function formatDimensions(dimensions: UnitDimensions): string {
  const { lengthM, widthM, heightM } = dimensions;
  if (!hasValue(lengthM) || !hasValue(widthM)) return "";
  const base = `${formatMeter(lengthM)} × ${formatMeter(widthM)} m`;
  return hasValue(heightM) ? `${base} · tinggi ${formatMeter(heightM)} m` : base;
}

/** Luas di bawah 0,1 m² (mis. media handgrip) ditampilkan dalam cm² agar tidak terbulatkan menjadi 0. */
export function formatArea(value: number) {
  if (value > 0 && value < 0.1) return `${Math.round(value * 10_000).toLocaleString("id-ID")} cm²`;
  return `${formatMeter(roundArea(value))} m²`;
}

/** Volume di bawah 0,1 m³ ditampilkan dalam liter. */
export function formatVolume(value: number) {
  if (value > 0 && value < 0.1) {
    return `${(value * 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} liter`;
  }
  return `${formatMeter(value)} m³`;
}
