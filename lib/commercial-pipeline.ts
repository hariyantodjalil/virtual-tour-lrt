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

export const LEGACY_LEAD_STAGE_DETAILS = {
  NEW: "Data minat sewa masuk untuk ditinjau tim komersial.",
  CONTACTED: "Tim komersial menghubungi Anda untuk melengkapi informasi.",
  RDS_OFFER: "Tim komersial menyampaikan penawaran resmi.",
  NEGOTIATING: "Pembahasan kebutuhan usaha dan ketentuan sewa.",
  SITE_CHECK: "Pemeriksaan lokasi dan batas area unit.",
  BA_SIGNED: "Penandatanganan berita acara negosiasi.",
  DESIGN_REVIEW: "Peninjauan rancangan penataan ruang dan kebutuhan teknis.",
  PKS: "Penyusunan dan penandatanganan perjanjian kerja sama.",
  BILLING: "Proses tagihan sesuai kesepakatan.",
  FIT_OUT_HANDOVER: "Persiapan ruang, fit-out, dan serah terima.",
  COMMERCIAL_OPERATION: "Unit memasuki tahap operasional komersial.",
} satisfies Record<Exclude<(typeof LEAD_PIPELINE_STATUSES)[number], "CLOSED_LOST">, string>;

export const LEAD_STATUS_VALUES = [
  ...LEAD_PIPELINE_STATUSES,
  "CLOSED_WON",
] as const;

export type CommercialLeadStatus = (typeof LEAD_STATUS_VALUES)[number];

export const LEAD_STATUS_LABELS: Record<CommercialLeadStatus, string> = {
  NEW: "Pengajuan Diterima",
  CONTACTED: "Dihubungi Tim Komersial",
  RDS_OFFER: "Penawaran Resmi",
  NEGOTIATING: "Negosiasi",
  SITE_CHECK: "Verifikasi Lokasi",
  BA_SIGNED: "Negosiasi Selesai",
  DESIGN_REVIEW: "Desain Disetujui",
  PKS: "PKS Ditandatangani",
  BILLING: "Tagihan",
  FIT_OUT_HANDOVER: "Fit-Out & Serah Terima",
  COMMERCIAL_OPERATION: "Sewa Aktif",
  CLOSED_WON: "Sewa Aktif (Legacy)",
  CLOSED_LOST: "Drop-off",
};

/** Enam milestone bersama. Status legacy tetap disimpan untuk riwayat pengajuan. */
export const PUBLIC_LEAD_PROCESS_STEPS = [
  { status: "NEW", title: "Pengajuan Diterima", detail: "Mitra mengirim pengajuan melalui Virtual Tour. Pengajuan tercatat otomatis." },
  { status: "CONTACTED", title: "Dihubungi Tim Komersial", detail: "Admin mengonfirmasi bahwa tim komersial telah menghubungi calon mitra." },
  { status: "BA_SIGNED", title: "Negosiasi Selesai", detail: "LOI, Surat Negosiasi, dan BA Negosiasi diunggah dan diverifikasi admin. Pengajuan site visit tetap tersedia selama negosiasi." },
  { status: "DESIGN_REVIEW", title: "Desain Disetujui", detail: "Dokumen persetujuan desain diunggah dan diverifikasi admin." },
  { status: "PKS", title: "PKS Ditandatangani", detail: "PKS final terverifikasi serta tanggal mulai dan berakhir masa sewa telah ditetapkan." },
  { status: "COMMERCIAL_OPERATION", title: "Sewa Aktif", detail: "Pembayaran terverifikasi dan tanggal efektif sewa sudah berlaku." },
] as const satisfies readonly { status: CommercialLeadStatus; title: string; detail: string }[];

export const ADMIN_LEAD_STATUSES = ["NEW", "CONTACTED", "NEGOTIATING", "BA_SIGNED", "DESIGN_REVIEW", "PKS", "COMMERCIAL_OPERATION", "CLOSED_LOST"] as const;

/** Legacy sub-stages belong to a milestone, never extra public steps. */
export function publicLeadStageIndex(status: string): number {
  if (["RDS_OFFER", "NEGOTIATING", "SITE_CHECK"].includes(status)) return 2;
  if (["BILLING", "FIT_OUT_HANDOVER"].includes(status)) return 4;
  if (status === "CLOSED_WON") return 5;
  return PUBLIC_LEAD_PROCESS_STEPS.findIndex(step => step.status === status);
}

export function completedLeadStageIndex(status: string): number {
  if (["RDS_OFFER", "NEGOTIATING", "SITE_CHECK"].includes(status)) return 1;
  return publicLeadStageIndex(status);
}

export function inquiryStatusLabel(status: string) {
  if (["RDS_OFFER", "NEGOTIATING", "SITE_CHECK"].includes(status)) return "Negosiasi berlangsung";
  return PUBLIC_LEAD_PROCESS_STEPS[publicLeadStageIndex(status)]?.title ?? "Pengajuan tidak dilanjutkan";
}

export function canonicalLeadStatus(status: CommercialLeadStatus): CommercialLeadStatus {
  if (["RDS_OFFER", "SITE_CHECK"].includes(status)) return "NEGOTIATING";
  if (["BILLING", "FIT_OUT_HANDOVER"].includes(status)) return "PKS";
  return status === "CLOSED_WON" ? "COMMERCIAL_OPERATION" : status;
}


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
  { n: "03", title: "Negosiasi & site visit", detail: "Bahas kebutuhan, ajukan kunjungan lokasi, lalu lengkapi LOI, Surat Negosiasi, dan BA Negosiasi." },
  { n: "04", title: "Persetujuan desain", detail: "Tim memverifikasi dokumen persetujuan desain." },
  { n: "05", title: "PKS & sewa aktif", detail: "Tetapkan tanggal sewa pada PKS final. Sewa aktif setelah pembayaran terverifikasi dan tanggal efektif berlaku." },
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

/** Badge warna status unit — exception-based (hanya status non-default yang menonjol). */
export function spaceStatusBadgeClass(status: string): string {
  switch (status) {
    case "TERSEDIA":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "RESERVED":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "FIT_OUT":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "TERISI":
      return "border-violet-200 bg-violet-50 text-violet-800";
    case "MAINTENANCE":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-[var(--work-line)] bg-[var(--work-subtle)] text-[var(--work-muted)]";
  }
}

export function isCommercialOperation(status: string) {
  return status === "COMMERCIAL_OPERATION" || status === "CLOSED_WON";
}
