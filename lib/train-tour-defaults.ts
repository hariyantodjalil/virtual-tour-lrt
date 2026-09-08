export type DefaultCarDef = {
  slug: string;
  label: string;
  color: string;
  hint: string;
  defaultZoneLabel: string;
};

/** Formasi LRT Jabodebek — 6 gerbong (sesuai mini-map referensi). */
export const DEFAULT_TRAIN_CARS: DefaultCarDef[] = [
  {
    slug: "gerbong-1",
    label: "Gerbong 1",
    color: "#3b82f6",
    hint: "Gerbong depan",
    defaultZoneLabel: "Kabin Utama",
  },
  {
    slug: "gerbong-2",
    label: "Gerbong 2",
    color: "#10b981",
    hint: "Gerbong 2",
    defaultZoneLabel: "Kabin Utama",
  },
  {
    slug: "gerbong-3",
    label: "Gerbong 3",
    color: "#f59e0b",
    hint: "Gerbong 3",
    defaultZoneLabel: "Kabin Utama",
  },
  {
    slug: "gerbong-4",
    label: "Gerbong 4",
    color: "#8b5cf6",
    hint: "Gerbong 4",
    defaultZoneLabel: "Kabin Utama",
  },
  {
    slug: "gerbong-5",
    label: "Gerbong 5",
    color: "#ec4899",
    hint: "Gerbong 5",
    defaultZoneLabel: "Kabin Utama",
  },
  {
    slug: "gerbong-6",
    label: "Gerbong 6",
    color: "#ef4444",
    hint: "Gerbong belakang",
    defaultZoneLabel: "Kabin Utama",
  },
];

export { slugifyLabel } from "@/lib/virtual-tour-defaults";
