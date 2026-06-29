export type DefaultLevelDef = {
  slug: string;
  legacyLevel: string;
  label: string;
  color: string;
  hint: string;
  defaultAreaLabel: string;
};

export const DEFAULT_TOUR_LEVELS: DefaultLevelDef[] = [
  {
    slug: "concourse",
    legacyLevel: "CONCOURSE",
    label: "Concourse",
    color: "#10b981",
    hint: "Area unpaid/paid concourse, gate, hall",
    defaultAreaLabel: "Concourse Umum",
  },
  {
    slug: "platform",
    legacyLevel: "PLATFORM",
    label: "Peron",
    color: "#3b82f6",
    hint: "Area platform dan boarding",
    defaultAreaLabel: "Peron Utama",
  },
  {
    slug: "outdoor",
    legacyLevel: "OUTDOOR",
    label: "Outdoor",
    color: "#f59e0b",
    hint: "Akses luar, drop-off, entrance",
    defaultAreaLabel: "Area Luar",
  },
  {
    slug: "transfer",
    legacyLevel: "TRANSFER",
    label: "Transfer",
    color: "#8b5cf6",
    hint: "Koridor koneksi dan interchange",
    defaultAreaLabel: "Koridor Transfer",
  },
  {
    slug: "commercial",
    legacyLevel: "COMMERCIAL",
    label: "Komersial",
    color: "#ef4444",
    hint: "Area tenant, retail, media",
    defaultAreaLabel: "Area Komersial",
  },
];

export function slugifyLabel(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "area";
}
