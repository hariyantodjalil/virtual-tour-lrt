import {
  canonicalLeadStatus,
  completedLeadStageIndex,
  publicLeadStageIndex,
  type CommercialLeadStatus,
} from "./commercial-pipeline";

export const NEGOTIATION_DOCUMENTS = ["LOI", "NEGOTIATION_LETTER", "NEGOTIATION_MINUTES"] as const;
export const REQUIRED_INQUIRY_DOCUMENTS = [
  { type: "LOI", title: "LOI", milestone: 3 },
  { type: "NEGOTIATION_LETTER", title: "Surat Negosiasi", milestone: 3 },
  { type: "NEGOTIATION_MINUTES", title: "BA Negosiasi", milestone: 3 },
  { type: "DESIGN_APPROVAL", title: "Persetujuan desain", milestone: 4 },
  { type: "PKS_FINAL", title: "PKS final", milestone: 5 },
] as const;

type Document = { documentType: string; storageKey: string | null; verifiedAt: Date | string | null };
type WorkflowState = {
  status: CommercialLeadStatus;
  leaseStartAt: Date | string | null;
  leaseEndAt: Date | string | null;
  paymentVerifiedAt: Date | string | null;
  siteVisitStatus: string;
  mediaAttachments: readonly Document[];
};

export function hasVerifiedDocument(documents: readonly Document[], type: string) {
  return documents.some(document => document.documentType === type && Boolean(document.storageKey && document.verifiedAt));
}

export function jakartaDate(value: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

/** Pure server-side gate; all checks run again after locking the inquiry row. */
export function inquiryTransitionError(current: CommercialLeadStatus, next: CommercialLeadStatus, state: WorkflowState, now = new Date()): string | null {
  if (next === "CLOSED_LOST") return ["COMMERCIAL_OPERATION", "CLOSED_WON"].includes(current) ? "Sewa aktif harus diakhiri melalui Penyewa Aktif." : null;
  if (current === "CLOSED_LOST") return "Pengajuan yang dihentikan tidak dapat diaktifkan kembali. Buat pengajuan baru.";
  const from = canonicalLeadStatus(current);
  const target = canonicalLeadStatus(next);
  const sequence: CommercialLeadStatus[] = ["NEW", "CONTACTED", "NEGOTIATING", "BA_SIGNED", "DESIGN_REVIEW", "PKS", "COMMERCIAL_OPERATION"];
  const fromIndex = sequence.indexOf(from);
  const toIndex = sequence.indexOf(target);
  // CONTACTED may jump to BA_SIGNED in the 6-step verified alur (negosiasi digabung jadi satu tahap).
  if (toIndex < fromIndex) return "Tahap yang telah dikonfirmasi tidak dapat dimundurkan.";
  if (toIndex > fromIndex + 1 && !(from === "CONTACTED" && target === "BA_SIGNED")) {
    return "Konfirmasikan tahap sebelumnya terlebih dahulu.";
  }

  // Dokumen wajib saat meninggalkan tahap pemiliknya — bukan saat baru masuk tahap itu.
  // Contoh: LOI/surat/BA diisi di tahap Negosiasi (BA_SIGNED), dicek saat lanjut ke Desain.
  const fromPublic = publicLeadStageIndex(from);
  const targetPublic = publicLeadStageIndex(target);
  const required = REQUIRED_INQUIRY_DOCUMENTS.filter(
    (document) => document.milestone <= fromPublic + 1
  );
  const missing = required.filter(
    (document) => !hasVerifiedDocument(state.mediaAttachments, document.type)
  );
  if (missing.length) {
    return `Unggah dan verifikasi dokumen terlebih dahulu: ${missing.map((document) => document.title).join(", ")}.`;
  }

  // Site visit terbuka harus ditutup sebelum meninggalkan milestone negosiasi.
  if (
    fromPublic >= 2 &&
    targetPublic > 2 &&
    ["REQUESTED", "SCHEDULED"].includes(state.siteVisitStatus)
  ) {
    return "Selesaikan atau batalkan site visit yang masih terbuka sebelum menyelesaikan negosiasi.";
  }

  // Tanggal sewa diisi di tahap PKS; wajib saat meninggalkan PKS / aktivasi.
  if (fromPublic >= 4) {
    if (!state.leaseStartAt || !state.leaseEndAt) {
      return "Tanggal mulai dan berakhir masa sewa wajib diisi.";
    }
    if (new Date(state.leaseEndAt) < new Date(state.leaseStartAt)) {
      return "Tanggal berakhir sewa tidak boleh sebelum tanggal mulai.";
    }
  }

  const completed = completedLeadStageIndex(target);
  if (completed >= 5) {
    if (!state.paymentVerifiedAt) {
      return "Admin harus memverifikasi pembayaran sebelum mengaktifkan sewa.";
    }
    const today = jakartaDate(now);
    if (jakartaDate(state.leaseStartAt!) > today) {
      return "Sewa belum memasuki tanggal efektif (Asia/Jakarta).";
    }
    if (jakartaDate(state.leaseEndAt!) < today) {
      return "Masa sewa telah berakhir. Periksa tanggal PKS.";
    }
  }
  return null;
}

/** In-app internal reminders; no external scheduler, email, or push is assumed. */
export function leaseExpiryReminder(end: Date | string | null, now = new Date()) {
  if (!end) return null;
  const remainingDays = Math.round((Date.parse(jakartaDate(end)) - Date.parse(jakartaDate(now))) / 86_400_000);
  if (!Number.isFinite(remainingDays) || remainingDays > 90) return null;
  const threshold = remainingDays <= 30 ? 30 : remainingDays <= 60 ? 60 : 90;
  return { remainingDays, threshold, label: remainingDays < 0 ? "Masa sewa berakhir" : `Pengingat H-${threshold}` };
}
