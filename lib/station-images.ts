const STATION_IMAGES: Record<string, string> = {
  "dukuh-atas": "/brand/stations/dukuh-atas-bni.png",
  harjamukti: "/brand/stations/harjamukti.png",
  cawang: "/brand/stations/cawang.png",
  "bekasi-barat": "/brand/stations/bekasi-barat.png",
  jatimulya: "/brand/stations/jatimulya.png",
};

const FALLBACK_IMAGES = Object.values(STATION_IMAGES);

export function getStationImage(slug: string, order = 0): string {
  return STATION_IMAGES[slug] ?? FALLBACK_IMAGES[order % FALLBACK_IMAGES.length];
}
