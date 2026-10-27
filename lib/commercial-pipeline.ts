export const LEAD_PIPELINE_STATUSES = [
  "NEW",
  "CONTACTED",
  "RDS_OFFER",
  "NEGOTIATING",
  "SITE_CHECK",
  "BA_SIGNED",
  "DESIGN_REVIEW",
  "PKS",
  "BILLING",
  "FIT_OUT_HANDOVER",
  "COMMERCIAL_OPERATION",
  "CLOSED_LOST",
] as const;

export const LEAD_STATUS_VALUES = [
  ...LEAD_PIPELINE_STATUSES,
  "CLOSED_WON",
] as const;

export type CommercialLeadStatus = (typeof LEAD_STATUS_VALUES)[number];

export const LEAD_STATUS_LABELS: Record<CommercialLeadStatus, string> = {
  NEW: "Inquiry Baru",
  CONTACTED: "Sudah Dihubungi",
  RDS_OFFER: "Penawaran Resmi",
  NEGOTIATING: "Negosiasi",
  SITE_CHECK: "Verifikasi Lokasi",
  BA_SIGNED: "BA Negosiasi",
  DESIGN_REVIEW: "Review Desain",
  PKS: "Perjanjian Kerja Sama",
  BILLING: "Tagihan",
  FIT_OUT_HANDOVER: "Fit-Out & Serah Terima",
  COMMERCIAL_OPERATION: "Operasional Komersial",
  CLOSED_WON: "Operasional Komersial (Legacy)",
  CLOSED_LOST: "Drop-off",
};

export const ACTIVE_LEAD_STATUSES: CommercialLeadStatus[] = [
  "NEW",
  "CONTACTED",
  "RDS_OFFER",
  "NEGOTIATING",
  "SITE_CHECK",
  "BA_SIGNED",
  "DESIGN_REVIEW",
  "PKS",
  "BILLING",
  "FIT_OUT_HANDOVER",
];

/** Unit dikunci setelah BA Negosiasi, sebelum serah terima. */
export const SPACE_HOLD_STATUSES: CommercialLeadStatus[] = [
  "BA_SIGNED",
  "DESIGN_REVIEW",
  "PKS",
  "BILLING",
];

export const PUBLIC_LEASING_STEPS = [
  { n: "01", title: "Jelajahi ruang", detail: "Lihat lokasi lewat tur 360°." },
  { n: "02", title: "Ajukan minat", detail: "Isi data usaha untuk ruang yang dipilih." },
  { n: "03", title: "Terima penawaran", detail: "Tim KAI meninjau dan mengirim penawaran resmi." },
  { n: "04", title: "Verifikasi lokasi", detail: "Cek batas area setelah kesepakatan awal." },
  { n: "05", title: "Perjanjian", detail: "BA Negosiasi, review desain, lalu PKS dan serah terima." },
] as const;

export function leadStageIndex(status: string) {
  if (status === "CLOSED_WON") {
    return LEAD_PIPELINE_STATUSES.indexOf("COMMERCIAL_OPERATION");
  }
  return LEAD_PIPELINE_STATUSES.findIndex((step) => step === status);
}

export function isAtOrAfterLeadStage(status: string, gate: CommercialLeadStatus) {
  if (status === "CLOSED_LOST") return false;
  const current = leadStageIndex(status);
  const target = LEAD_PIPELINE_STATUSES.findIndex((step) => step === gate);
  return current >= 0 && target >= 0 && current >= target;
}

export const SITE_VISIT_STATUS_VALUES = [
  "NONE",
  "REQUESTED",
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type CommercialSiteVisitStatus = (typeof SITE_VISIT_STATUS_VALUES)[number];

export const SITE_VISIT_STATUS_LABELS: Record<CommercialSiteVisitStatus, string> = {
  NONE: "Tidak Mengajukan",
  REQUESTED: "Diminta",
  SCHEDULED: "Dijadwalkan",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

export const SPACE_STATUS_VALUES = [
  "TERSEDIA",
  "RESERVED",
  "FIT_OUT",
  "TERISI",
  "MAINTENANCE",
] as const;

export type CommercialSpaceStatus = (typeof SPACE_STATUS_VALUES)[number];

export const SPACE_STATUS_LABELS: Record<CommercialSpaceStatus, string> = {
  TERSEDIA: "Tersedia",
  RESERVED: "Reserved",
  FIT_OUT: "Fit-Out",
  TERISI: "Terisi",
  MAINTENANCE: "Maintenance",
};

export function isCommercialOperation(status: string) {
  return status === "COMMERCIAL_OPERATION" || status === "CLOSED_WON";
}
