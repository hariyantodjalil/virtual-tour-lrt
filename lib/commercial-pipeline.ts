export const INQUIRY_LIFECYCLE_STATUSES = [
  "ACTIVE",
  "COMPLETED",
  "REJECTED",
] as const;

export const LEAD_PIPELINE_STATUSES = INQUIRY_LIFECYCLE_STATUSES;
export const LEAD_STATUS_VALUES = INQUIRY_LIFECYCLE_STATUSES;

export type CommercialLeadStatus = (typeof INQUIRY_LIFECYCLE_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Sedang Diproses",
  COMPLETED: "Selesai / Beroperasi",
  REJECTED: "Ditolak",
  NEW: "Inquiry Baru",
  CONTACTED: "Sudah Dihubungi",
  NEGOTIATING: "Negosiasi",
  PKS: "Perjanjian Kerja Sama",
  FIT_OUT_HANDOVER: "Fit-Out & Serah Terima",
  COMMERCIAL_OPERATION: "Operasional Komersial",
  CLOSED_WON: "Operasional Komersial (Legacy)",
  CLOSED_LOST: "Drop-off",
};

export const ACTIVE_LEAD_STATUSES: string[] = ["ACTIVE"];

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
  return status === "COMPLETED" || status === "COMMERCIAL_OPERATION" || status === "CLOSED_WON";
}
