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

export function isInquiryFullyCompleted(status: string) {
  return isCommercialOperation(status);
}

export const SPACE_TYPE_LABELS: Record<string, string> = {
  KIOS: "Kios",
  RUKO: "Ruko",
  ATM: "ATM",
  VENDING: "Vending Machine",
  MEDIA_IKLAN: "Media Iklan",
  AREA_PROMOSI: "Area Promosi",
};

export const STANDARD_LEASING_MODEL =
  "Space-Only Leasing (Sewa Ruang Kosong)";
export const STANDARD_FIT_OUT_TERMS =
  "Fit-Out oleh Mitra (Wajib Persetujuan Desain Teknis KAI · Dilarang Menggunakan Tabung Gas LPG di Area Stasiun Layang)";

export type PipelineStepTypeValue = "STANDARD" | "DOCUMENT_ISSUANCE" | "SITE_VISIT";
export type StepMediaRequirementValue = "NONE" | "OPTIONAL" | "REQUIRED";
export type StepSpaceEffectValue =
  | "NONE"
  | "RESERVE_SPACE"
  | "FIT_OUT_SPACE"
  | "ACTIVATE_TENANT";

/**
 * Menurunkan nilai enum legacy `LeadStatus` secara otomatis di balik layar
 * dari posisi tahap, Tipe Proses, dan Efek Unit agar UI tidak perlu
 * menampilkan pilihan kategori status yang membingungkan.
 */
export function deriveStepLeadStatus(input: {
  index: number;
  totalSteps: number;
  stepType: PipelineStepTypeValue;
  spaceEffect: StepSpaceEffectValue;
  title?: string | null;
  existingLeadStatus?: string | null;
}): Exclude<CommercialLeadStatus, "CLOSED_WON" | "CLOSED_LOST"> {
  const { index, totalSteps, stepType, spaceEffect, title, existingLeadStatus } =
    input;
  if (index <= 0) return "NEW";
  if (index >= totalSteps - 1) return "COMMERCIAL_OPERATION";

  if (stepType === "SITE_VISIT") return "SITE_CHECK";
  if (stepType === "DOCUMENT_ISSUANCE") {
    if (spaceEffect === "RESERVE_SPACE") {
      return /pks|perjanjian/i.test(title ?? "") ? "PKS" : "BA_SIGNED";
    }
    if (spaceEffect === "FIT_OUT_SPACE") return "FIT_OUT_HANDOVER";
    return "RDS_OFFER";
  }

  if (spaceEffect === "FIT_OUT_SPACE") return "FIT_OUT_HANDOVER";
  if (spaceEffect === "RESERVE_SPACE") {
    if (existingLeadStatus === "PKS" || existingLeadStatus === "BILLING") {
      return existingLeadStatus;
    }
    if (/tagihan|billing|invoice/i.test(title ?? "")) return "BILLING";
    if (/pks|perjanjian/i.test(title ?? "")) return "PKS";
    return "DESIGN_REVIEW";
  }

  if (existingLeadStatus === "CONTACTED" || existingLeadStatus === "NEGOTIATING") {
    return existingLeadStatus;
  }
  if (
    existingLeadStatus === "BA_SIGNED" ||
    existingLeadStatus === "DESIGN_REVIEW" ||
    existingLeadStatus === "PKS"
  ) {
    return existingLeadStatus;
  }
  return index < Math.ceil(totalSteps / 2) ? "CONTACTED" : "NEGOTIATING";
}

export function formatSpaceRequirementLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("TRAIN:")) {
    const parts = trimmed
      .slice("TRAIN:".length)
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 2) return `Media Kereta · ${parts.slice(1).join(" — ")}`;
    return "Media Iklan Kereta";
  }
  return trimmed;
}

export const STEP_TYPE_LABELS: Record<PipelineStepTypeValue, string> = {
  STANDARD: "Administrasi / Diskusi Standar",
  DOCUMENT_ISSUANCE: "Penerbitan Nomor Surat Resmi",
  SITE_VISIT: "Penjadwalan & Verifikasi Lokasi",
};

export const STEP_MEDIA_REQUIREMENT_LABELS: Record<StepMediaRequirementValue, string> = {
  NONE: "Tidak Memerlukan Dokumen",
  OPTIONAL: "Dokumen Opsional",
  REQUIRED: "Wajib Unggah Dokumen",
};

export const STEP_SPACE_EFFECT_LABELS: Record<StepSpaceEffectValue, string> = {
  NONE: "Tidak Mengubah Status Unit",
  RESERVE_SPACE: "Kunci Unit menjadi RESERVED",
  FIT_OUT_SPACE: "Ubah Unit menjadi FIT_OUT",
  ACTIVATE_TENANT: "Ubah Unit menjadi TERISI & Aktifkan Penyewa",
};

export type StepSlaHealth = "SAFE" | "WARNING" | "BREACHED" | "MET" | "MISSED";

export interface StepSlaInfo {
  slaHours: number;
  startedAt: string;
  dueAt: string;
  completedAt: string | null;
  elapsedMs: number;
  remainingMs: number;
  health: StepSlaHealth;
  isRunning: boolean;
  label: string;
}
