import type { TrainFleetCar } from "@/lib/train-fleet-shared";

export const TRAIN_RENTAL_STATUS_VALUES = ["TERSEDIA", "TERBATAS", "PENUH"] as const;
export type TrainRentalStatus = (typeof TRAIN_RENTAL_STATUS_VALUES)[number];

export const TRAIN_RENTAL_STATUS_LABELS: Record<TrainRentalStatus, string> = {
  TERSEDIA: "Tersedia",
  TERBATAS: "Kuota terbatas",
  PENUH: "Penuh",
};

export function trainRentalStatusBadgeClass(status: string): string {
  switch (status) {
    case "TERSEDIA":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "TERBATAS":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "PENUH":
      return "border-violet-200 bg-violet-50 text-violet-800";
    default:
      return "border-[var(--work-line)] bg-[var(--work-subtle)] text-[var(--work-muted)]";
  }
}

export type CarTrainsetMap = Record<string, string[]>;

export function emptyCarTrainsetMap(cars: Pick<TrainFleetCar, "slug">[] = []): CarTrainsetMap {
  return Object.fromEntries(cars.map((car) => [car.slug, []]));
}

export function parseCarTrainsetMap(
  value: unknown,
  fallbackTrainsets: string[] = [],
  cars: Pick<TrainFleetCar, "slug">[] = []
): CarTrainsetMap {
  const map = emptyCarTrainsetMap(cars);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const hasCarKeys = Object.keys(record).length > 0;
    if (hasCarKeys) {
      for (const [slug, raw] of Object.entries(record)) {
        if (Array.isArray(raw)) {
          Object.defineProperty(map, slug, { value: normalizeTrainsets(raw.filter((item) => typeof item === "string")), enumerable: true, writable: true, configurable: true });
        }
      }
      return map;
    }
  }

  const shared = normalizeTrainsets(fallbackTrainsets);
  if (shared.length > 0) {
    for (const car of cars) {
      map[car.slug] = [...shared];
    }
  }
  return map;
}

export function unionCarTrainsets(map: CarTrainsetMap): string[] {
  return normalizeTrainsets(Object.values(map).flat());
}

export function isAllTrainsets(values: string[], options: string[] = []): boolean {
  return options.length > 0 && options.every((trainset) => values.includes(trainset));
}

export function formatCarTrainsetSummary(map: CarTrainsetMap, fleetCars: Pick<TrainFleetCar, "slug" | "label">[] = [], trainsets: string[] = []): string {
  const cars = fleetCars.map((car) => {
    const items = map[car.slug] ?? [];
    if (items.length === 0) return `${car.label}: belum diatur`;
    if (isAllTrainsets(items, trainsets)) return `${car.label}: semua TS`;
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
