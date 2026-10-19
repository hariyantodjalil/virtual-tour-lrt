import type { StationPickerItem } from "@/components/tour/StationPickerModal";

export function formatPassengersPerDay(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    const label = Number.isInteger(k) ? String(k) : k.toFixed(1).replace(/\.0$/, "");
    return `${label}K / hari`;
  }
  return `${n} / hari`;
}

export function splitStationLocation(station: StationPickerItem): { area: string; city: string } {
  const location = station.location?.trim() || "";
  const address = station.address?.trim() || "";

  if (address.includes(",")) {
    const [area, ...rest] = address.split(",").map((p) => p.trim());
    return {
      area: area || location || "LRT Jabodebek",
      city: rest.join(", ") || location || "",
    };
  }

  if (address && location && address !== location) {
    return { area: address, city: location };
  }

  return {
    area: address || location || "LRT Jabodebek",
    city: location && location !== address ? location : "",
  };
}

export function stationLineLabel(line: string): string {
  const trimmed = line.trim() || "Jabodebek";
  return /line/i.test(trimmed) ? trimmed : `${trimmed} Line`;
}
