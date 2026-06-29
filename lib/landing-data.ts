import type { StationInfo } from "./tour-types";

export type LandingSpace = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: "TERSEDIA" | "TERISI" | "MAINTENANCE";
  area: number;
  monthlyRent: number;
  deposit: number;
  floor: string;
  location: string;
  nearestExit: string | null;
  exposure: number;
  powerSupply: string | null;
  waterAccess: boolean;
  airConditioning: boolean;
  description: string | null;
};

export type LandingStation = {
  id: string;
  name: string;
  slug: string;
  line: string;
  dailyPassengers: number;
  spaces: LandingSpace[];
};

type StationSeed = {
  name: string;
  slug: string;
  code: string;
  line: string;
  address: string;
  dailyPassengers: number;
  order: number;
};

const STATIONS: StationSeed[] = [
  { name: "Dukuh Atas BNI", slug: "dukuh-atas", code: "DKA", line: "Jabodebek", address: "Tanah Abang, Jakarta Pusat", dailyPassengers: 45000, order: 1 },
  { name: "Setiabudi", slug: "setiabudi", code: "SET", line: "Jabodebek", address: "Setia Budi, Jakarta Selatan", dailyPassengers: 32000, order: 2 },
  { name: "Rasuna Said", slug: "rasuna-said", code: "RAS", line: "Jabodebek", address: "Setia Budi, Jakarta Selatan", dailyPassengers: 28000, order: 3 },
  { name: "Kuningan", slug: "kuningan", code: "KUA", line: "Jabodebek", address: "Setia Budi, Jakarta Selatan", dailyPassengers: 35000, order: 4 },
  { name: "Pancoran Bank BJB", slug: "pancoran-bank-bjb", code: "PAN", line: "Jabodebek", address: "Pancoran, Jakarta Selatan", dailyPassengers: 22000, order: 5 },
  { name: "Cikoko", slug: "cikoko", code: "CIK", line: "Jabodebek", address: "Pancoran, Jakarta Selatan", dailyPassengers: 18000, order: 6 },
  { name: "Ciliwung", slug: "ciliwung", code: "CIL", line: "Jabodebek", address: "Pancoran, Jakarta Timur", dailyPassengers: 16000, order: 7 },
  { name: "Cawang", slug: "cawang", code: "CWG", line: "Jabodebek", address: "Jatinegara, Jakarta Timur", dailyPassengers: 38000, order: 8 },
  { name: "Halim", slug: "halim", code: "HAL", line: "Jabodebek", address: "Makasar, Jakarta Timur", dailyPassengers: 31000, order: 9 },
  { name: "Jatibening Baru", slug: "jatibening-baru", code: "JTU", line: "Jabodebek", address: "Pondokgede, Kota Bekasi", dailyPassengers: 21000, order: 10 },
  { name: "Cikunir 1", slug: "cikunir-1", code: "CK1", line: "Jabodebek", address: "Pondokmelati, Kota Bekasi", dailyPassengers: 19000, order: 11 },
  { name: "Cikunir 2", slug: "cikunir-2", code: "CK2", line: "Jabodebek", address: "Pondokmelati, Kota Bekasi", dailyPassengers: 18500, order: 12 },
  { name: "Bekasi Barat", slug: "bekasi-barat", code: "BEK", line: "Jabodebek", address: "Bekasi Barat, Kota Bekasi", dailyPassengers: 36000, order: 13 },
  { name: "Jatimulya", slug: "jatimulya", code: "JTM", line: "Jabodebek", address: "Tambun Selatan, Kota Bekasi", dailyPassengers: 24000, order: 14 },
  { name: "TMII", slug: "tmii", code: "TMI", line: "Jabodebek", address: "Pasar Rebo, Jakarta Timur", dailyPassengers: 25000, order: 15 },
  { name: "Kampung Rambutan", slug: "kampung-rambutan", code: "KAM", line: "Jabodebek", address: "Pasar Rebo, Jakarta Timur", dailyPassengers: 42000, order: 16 },
  { name: "Ciracas", slug: "ciracas", code: "CRC", line: "Jabodebek", address: "Cipayung, Jakarta Timur", dailyPassengers: 19000, order: 17 },
  { name: "Harjamukti", slug: "harjamukti", code: "HAR", line: "Jabodebek", address: "Cipayung, Depok", dailyPassengers: 28000, order: 18 },
];

const SPACE_TEMPLATES = [
  { type: "KIOS", name: "Kios", area: 12, rent: 8500000 },
  { type: "RUKO", name: "Ruko", area: 48, rent: 28000000 },
  { type: "ATM", name: "ATM Center", area: 4, rent: 5000000 },
  { type: "VENDING", name: "Vending Machine", area: 2, rent: 3000000 },
  { type: "MEDIA_IKLAN", name: "Media Iklan", area: 6, rent: 12000000 },
  { type: "AREA_PROMOSI", name: "Area Promosi", area: 20, rent: 15000000 },
];

const STATUS_PATTERN: LandingSpace["status"][] = ["TERSEDIA", "TERSEDIA", "TERISI", "TERSEDIA", "TERISI", "MAINTENANCE"];

const DEMO_PANORAMAS = [
  "https://pannellum.org/images/alma.jpg",
  "https://pannellum.org/images/cerro-toco-0.jpg",
  "https://pannellum.org/images/jfk.jpg",
];

function makeSpaces(station: StationSeed): LandingSpace[] {
  return SPACE_TEMPLATES.map((template, index) => ({
    id: `${station.slug}-${index + 1}`,
    code: `${station.code}-${String(index + 1).padStart(2, "0")}`,
    name: `${template.name} ${index + 1}`,
    type: template.type,
    status: STATUS_PATTERN[index],
    area: template.area + ((index % 3) * 2),
    monthlyRent: template.rent + (station.order % 5) * 350000 + index * 250000,
    deposit: template.rent * 3,
    floor: index < 2 ? "G" : "1",
    location: index % 2 === 0 ? "Concourse Utama" : "Gate Area",
    nearestExit: `Exit ${String.fromCharCode(65 + (index % 4))}`,
    exposure: Math.round(station.dailyPassengers * (0.34 + index * 0.055)),
    powerSupply: "220V/10A",
    waterAccess: template.type === "RUKO" || template.type === "KIOS",
    airConditioning: true,
    description: `Unit komersial ${template.name.toLowerCase()} di Stasiun ${station.name}.`,
  }));
}

function makeScenes(station: StationSeed, index: number): StationInfo["scenes"] {
  return [
    {
      id: "concourse",
      title: "Concourse",
      panoramaUrl: DEMO_PANORAMAS[index % DEMO_PANORAMAS.length],
      hotspots: [
        { pitch: -4, yaw: 118, type: "space", text: `Kios ${station.code}-01`, spaceCode: `${station.code}-01` },
        { pitch: -6, yaw: -58, type: "space", text: `Ruko ${station.code}-02`, spaceCode: `${station.code}-02` },
        { pitch: -2, yaw: 28, type: "scene", text: "Ke Gate Area", sceneId: "gate-area" },
      ],
    },
    {
      id: "gate-area",
      title: "Gate Area",
      panoramaUrl: DEMO_PANORAMAS[(index + 1) % DEMO_PANORAMAS.length],
      hotspots: [
        { pitch: -3, yaw: 88, type: "space", text: `ATM ${station.code}-03`, spaceCode: `${station.code}-03` },
        { pitch: -5, yaw: -112, type: "space", text: `Vending ${station.code}-04`, spaceCode: `${station.code}-04` },
        { pitch: -1, yaw: -30, type: "scene", text: "Kembali ke Concourse", sceneId: "concourse" },
        { pitch: 0, yaw: 142, type: "scene", text: "Ke Platform", sceneId: "platform" },
      ],
    },
    {
      id: "platform",
      title: "Platform",
      panoramaUrl: DEMO_PANORAMAS[(index + 2) % DEMO_PANORAMAS.length],
      hotspots: [
        { pitch: -4, yaw: 45, type: "space", text: `Media Iklan ${station.code}-05`, spaceCode: `${station.code}-05` },
        { pitch: -3, yaw: -80, type: "space", text: `Area Promosi ${station.code}-06`, spaceCode: `${station.code}-06` },
        { pitch: 0, yaw: 165, type: "scene", text: "Turun ke Gate Area", sceneId: "gate-area" },
      ],
    },
  ];
}

export function getFallbackLandingStations(): LandingStation[] {
  return STATIONS.map((station) => ({
    id: station.slug,
    name: station.name,
    slug: station.slug,
    line: station.line,
    dailyPassengers: station.dailyPassengers,
    spaces: makeSpaces(station),
  }));
}

export function getFallbackTourDataMap(): Record<string, StationInfo> {
  return Object.fromEntries(
    STATIONS.map((station, index) => [
      station.slug,
      {
        slug: station.slug,
        name: station.name,
        code: station.code,
        line: station.line,
        order: station.order,
        dailyPassengers: station.dailyPassengers,
        address: station.address,
        scenes: makeScenes(station, index),
      },
    ]),
  );
}
