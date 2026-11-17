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
  CLOSED_WON: "Operasional Komersial (Selesai)",
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
  "COMMERCIAL_OPERATION",
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

const PUBLIC_LEAD_STAGE_DETAILS = {
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

/** Mengikuti urutan status yang juga digunakan CMS dan Portal Mitra GitDev. */
export const PUBLIC_LEAD_PROCESS_STEPS = LEAD_PIPELINE_STATUSES
  .filter(status => status !== "CLOSED_LOST")
  .map(status => ({ status, title: LEAD_STATUS_LABELS[status], detail: PUBLIC_LEAD_STAGE_DETAILS[status] }));

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

export function isCommercialOperation(status: string) {
  return status === "COMMERCIAL_OPERATION" || status === "CLOSED_WON";
}

export function isInquiryFullyCompleted(status: string) {
  return status === "CLOSED_WON";
}

export type PipelineStepTypeValue = "STANDARD" | "DOCUMENT_ISSUANCE" | "SITE_VISIT";
export type StepMediaRequirementValue = "NONE" | "OPTIONAL" | "REQUIRED";
export type StepSpaceEffectValue =
  | "NONE"
  | "RESERVE_SPACE"
  | "FIT_OUT_SPACE"
  | "ACTIVATE_TENANT";

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

export interface StepTimingLog {
  stepOrder: number;
  status: string;
  action: string;
  createdAt: Date | string;
}

export function formatDurationCompact(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}j`;
  return `${hours}j ${minutes}m`;
}

export function computeStepSla(input: {
  slaHours: number | null | undefined;
  stepStartedAt: Date | string;
  stepCompletedAt?: Date | string | null;
  isStepCurrentlyRunning: boolean;
  now?: Date;
}): StepSlaInfo | null {
  const { slaHours, stepStartedAt, stepCompletedAt, isStepCurrentlyRunning, now } = input;
  if (!slaHours || slaHours <= 0) return null;

  const startMs = new Date(stepStartedAt).getTime();
  if (Number.isNaN(startMs)) return null;

  const slaMs = slaHours * 3600_000;
  const dueMs = startMs + slaMs;

  if (isStepCurrentlyRunning) {
    const nowMs = (now ?? new Date()).getTime();
    const elapsedMs = Math.max(0, nowMs - startMs);
    const remainingMs = dueMs - nowMs;
    const elapsedHours = elapsedMs / 3600_000;

    let health: StepSlaHealth = "SAFE";
    let label = `Sisa ${formatDurationCompact(remainingMs)}`;

    if (elapsedHours > slaHours) {
      health = "BREACHED";
      label = `Lewat SLA ${formatDurationCompact(Math.abs(remainingMs))}`;
    } else if (elapsedHours > slaHours * (2 / 3)) {
      health = "WARNING";
      label = `Sisa ${formatDurationCompact(remainingMs)}`;
    }

    return {
      slaHours,
      startedAt: new Date(startMs).toISOString(),
      dueAt: new Date(dueMs).toISOString(),
      completedAt: null,
      elapsedMs,
      remainingMs,
      health,
      isRunning: true,
      label,
    };
  }

  const endMs = stepCompletedAt ? new Date(stepCompletedAt).getTime() : startMs;
  const elapsedMs = Math.max(0, endMs - startMs);
  const remainingMs = dueMs - endMs;
  const health: StepSlaHealth = elapsedMs <= slaMs ? "MET" : "MISSED";
  const tag = health === "MET" ? "Tepat Waktu" : "Lewat SLA";

  return {
    slaHours,
    startedAt: new Date(startMs).toISOString(),
    dueAt: new Date(dueMs).toISOString(),
    completedAt: new Date(endMs).toISOString(),
    elapsedMs,
    remainingMs,
    health,
    isRunning: false,
    label: `Respons: ${formatDurationCompact(elapsedMs)} (${tag})`,
  };
}

export function resolveLeadStepSla(input: {
  stepOrder: number;
  slaHours: number | null | undefined;
  leadCreatedAt: Date | string;
  leadStatus: string;
  currentStepOrder: number;
  stepLogs: StepTimingLog[];
  now?: Date;
}): StepSlaInfo | null {
  if (!input.slaHours || input.slaHours <= 0) return null;

  const sortedLogs = [...input.stepLogs].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const isTerminal = input.leadStatus === "CLOSED_WON" || input.leadStatus === "CLOSED_LOST";
  const isCompletedStep =
    input.leadStatus === "CLOSED_WON" ? true : input.stepOrder < input.currentStepOrder;
  const isCurrentlyRunning = !isTerminal && input.stepOrder === input.currentStepOrder;
  const isRejectedOnThisStep =
    input.leadStatus === "CLOSED_LOST" && input.stepOrder === input.currentStepOrder;

  if (!isCompletedStep && !isCurrentlyRunning && !isRejectedOnThisStep) {
    return null;
  }

  const enteredLog = sortedLogs.find((log) => log.stepOrder === input.stepOrder);
  const stepStartedAt =
    input.stepOrder === 1
      ? enteredLog?.createdAt ?? input.leadCreatedAt
      : enteredLog?.createdAt;

  if (!stepStartedAt) return null;

  const nextStepLog = sortedLogs.find((log) => log.stepOrder > input.stepOrder);
  const terminalOnThisStepLog = sortedLogs.find(
    (log) =>
      log.stepOrder === input.stepOrder &&
      (log.action === "COMPLETED" ||
        log.action === "REJECTED" ||
        log.status === "CLOSED_WON" ||
        log.status === "CLOSED_LOST")
  );
  const stepCompletedAt =
    nextStepLog?.createdAt ?? terminalOnThisStepLog?.createdAt ?? null;

  return computeStepSla({
    slaHours: input.slaHours,
    stepStartedAt,
    stepCompletedAt,
    isStepCurrentlyRunning: isCurrentlyRunning,
    now: input.now,
  });
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
    if (parts.length >= 2) {
      return `Media Kereta · ${parts.slice(1).join(" — ")}`;
    }
    return "Media Iklan Kereta";
  }
  return trimmed;
}

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
  return index < Math.ceil(totalSteps / 2) ? "CONTACTED" : "NEGOTIATING";
}
