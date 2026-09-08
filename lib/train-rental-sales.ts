import { DEFAULT_TRAIN_CARS } from "@/lib/train-tour-defaults";

export const TRAIN_RENTAL_STATUS_VALUES = ["TERSEDIA", "TERBATAS", "PENUH"] as const;
export type TrainRentalStatus = (typeof TRAIN_RENTAL_STATUS_VALUES)[number];

export const TRAIN_RENTAL_STATUS_LABELS: Record<TrainRentalStatus, string> = {
  TERSEDIA: "Tersedia",
  TERBATAS: "Kuota terbatas",
  PENUH: "Penuh",
};

export const TRAINSET_OPTIONS = Array.from(
  { length: 31 },
  (_, index) => `TS${String(index + 1).padStart(2, "0")}`
);

export type CarTrainsetMap = Record<string, string[]>;

export function emptyCarTrainsetMap(): CarTrainsetMap {
  return Object.fromEntries(DEFAULT_TRAIN_CARS.map((car) => [car.slug, []]));
}

export function parseCarTrainsetMap(
  value: unknown,
  fallbackTrainsets: string[] = []
): CarTrainsetMap {
  const map = emptyCarTrainsetMap();
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const hasCarKeys = DEFAULT_TRAIN_CARS.some((car) => car.slug in record);
    if (hasCarKeys) {
      for (const car of DEFAULT_TRAIN_CARS) {
        const raw = record[car.slug];
        if (Array.isArray(raw)) {
          map[car.slug] = normalizeTrainsets(raw.filter((item) => typeof item === "string"));
        }
      }
      return map;
    }
  }

  const shared = normalizeTrainsets(fallbackTrainsets);
  if (shared.length > 0) {
    for (const car of DEFAULT_TRAIN_CARS) {
      map[car.slug] = [...shared];
    }
  }
  return map;
}

export function unionCarTrainsets(map: CarTrainsetMap): string[] {
  return normalizeTrainsets(Object.values(map).flat());
}

export function isAllTrainsets(values: string[]): boolean {
  return (
    values.length >= TRAINSET_OPTIONS.length ||
    TRAINSET_OPTIONS.every((trainset) => values.includes(trainset))
  );
}

export function formatCarTrainsetSummary(map: CarTrainsetMap): string {
  const cars = DEFAULT_TRAIN_CARS.map((car) => {
    const items = map[car.slug] ?? [];
    if (items.length === 0) return `${car.label}: belum diatur`;
    if (isAllTrainsets(items)) return `${car.label}: semua TS`;
    return `${car.label}: ${items.length} TS`;
  });
  return cars.join(" · ");
}

export function isTrainRentalStatus(value: unknown): value is TrainRentalStatus {
  return TRAIN_RENTAL_STATUS_VALUES.includes(value as TrainRentalStatus);
}

export function normalizeTrainsets(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of values) {
    const token = raw.trim().toUpperCase().replace(/\s+/g, "");
    if (!token) continue;

    const match = token.match(/^(?:TS)?0*(\d+)$/);
    const normalized = match ? `TS${String(Number(match[1])).padStart(2, "0")}` : token;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function parseTrainsetInput(value: string): string[] {
  return normalizeTrainsets(value.split(/[,;\n]+/));
}

export function formatTrainsetList(values: string[]): string {
  return normalizeTrainsets(values).join(", ");
}

export function trainRentalStatusToSpaceStatus(
  status: TrainRentalStatus
): "TERSEDIA" | "RESERVED" | "TERISI" {
  if (status === "PENUH") return "TERISI";
  if (status === "TERBATAS") return "RESERVED";
  return "TERSEDIA";
}
