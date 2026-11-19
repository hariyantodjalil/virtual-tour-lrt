export type ConcourseLayout = "A" | "B" | "C";
export type ConcourseSection = "LEFT" | "CENTER" | "RIGHT";
export type ConcourseSlot = {
  id: string;
  spaceId: string | null;
  access: "PAD" | "UNP";
  kind: "F" | "Z";
  sequence: number;
  section: ConcourseSection;
  row: number;
  position: number;
};

export const CONCOURSE_SECTIONS = ["LEFT", "CENTER", "RIGHT"] as const;
export const CONCOURSE_ACCESS = {
  A: { LEFT: "PAD", CENTER: "UNP", RIGHT: "PAD" },
  B: { LEFT: "UNP", CENTER: "PAD", RIGHT: "UNP" },
} as const;

export const CONCOURSE_LABELS = {
  A: { LEFT: "Paid kiri", CENTER: "Unpaid", RIGHT: "Paid kanan" },
  B: { LEFT: "Unpaid kiri", CENTER: "Paid", RIGHT: "Unpaid kanan" },
  C: { LEFT: "Area kiri", CENTER: "Area transit", RIGHT: "Area kanan" },
} as const;

export function concourseLayout(value: string | null): ConcourseLayout | null {
  return value === "A" || value === "B" || value === "C" ? value : null;
}

export function concourseSlot(row: Omit<ConcourseSlot, "access" | "kind" | "section"> & {
  access: string; kind: string; section: string;
}): ConcourseSlot {
  if ((row.access !== "PAD" && row.access !== "UNP") || (row.kind !== "F" && row.kind !== "Z")
    || (row.section !== "LEFT" && row.section !== "CENTER" && row.section !== "RIGHT")) {
    throw new Error("Posisi aset concourse tidak valid.");
  }
  return { ...row, access: row.access, kind: row.kind, section: row.section };
}

export function concourseAssetCode(prefix: string, slot: Pick<ConcourseSlot, "access" | "kind" | "sequence">) {
  return `${prefix}-CON-${slot.access}-${slot.kind}-${String(slot.sequence).padStart(3, "0")}`;
}
