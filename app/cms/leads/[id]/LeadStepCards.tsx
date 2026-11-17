"use client";

import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  FileText,
  Loader2,
  Lock,
  MessageSquareText,
  Save,
  Timer,
  X,
  XCircle,
} from "lucide-react";
import { cmsFetch } from "@/lib/cms-fetch";
import {
  SITE_VISIT_STATUS_LABELS,
  SITE_VISIT_STATUS_VALUES,
  STEP_MEDIA_REQUIREMENT_LABELS,
  STEP_TYPE_LABELS,
  type CommercialSiteVisitStatus,
  type StepSlaInfo,
  type StepSpaceEffectValue,
} from "@/lib/commercial-pipeline";
import {
  SLA_BADGE_CLASSES,
  formatDateId,
  getSiteVisitStatusLabel,
  toDateTimeLocalInput,
  type CmsInquiryMedia,
  type CmsLeadDetail,
  type CmsStepLogDetail,
  type CmsWorkflowStep,
} from "../lead-types";
import StepDocumentsManager, { type StepDocPreviewHandlers } from "./StepDocumentsManager";
import DocumentPreviewModal from "@/components/pipeline/DocumentPreviewModal";

export const READABLE_SPACE_EFFECT_LABELS: Record<StepSpaceEffectValue, string> = {
  NONE: "Tidak mengubah status unit",
  RESERVE_SPACE: "Kunci unit menjadi Dipesan",
  FIT_OUT_SPACE: "Ubah unit menjadi Fit-Out",
  ACTIVATE_TENANT: "Ubah unit menjadi Terisi & aktifkan penyewa",
};

export type AdminStepPreviewHandlers = {
  defaultShowAddDocForm?: boolean;
  onSaveDraft: (payload: {
    publicNote: string | null;
    documentNumber?: string | null;
    siteVisitStatus?: CommercialSiteVisitStatus;
    siteVisitScheduledAt?: string | null;
  }) => void;
  onAdvanceStage: (payload: {
    publicNote: string | null;
    documentNumber?: string | null;
    siteVisitStatus?: CommercialSiteVisitStatus;
    siteVisitScheduledAt?: string | null;
  }) => void;
  docHandlers: StepDocPreviewHandlers;
};

export function AdminStepTimelineItem({
  lead,
  step,
  nextStep,
  activeEditLog,
  latestStepLog,
  stepMedia,
  stepSla,
  isPast,
  isCurrent,
  isFuture,
  isRejectedHere,
  isLast,
  onLeadUpdated,
  onRefreshLead,
  onPreviewMedia,
  previewHandlers,
}: {
  lead: CmsLeadDetail;
  step: CmsWorkflowStep;
  nextStep: CmsWorkflowStep | undefined;
  activeEditLog: CmsStepLogDetail | undefined;
  latestStepLog: CmsStepLogDetail | undefined;
  stepMedia: CmsInquiryMedia[];
  stepSla: StepSlaInfo | null;
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
  isRejectedHere: boolean;
  isLast: boolean;
  onLeadUpdated: (lead: CmsLeadDetail) => void;
  onRefreshLead: () => Promise<void>;
  onPreviewMedia: (media: CmsInquiryMedia) => void;
  previewHandlers?: AdminStepPreviewHandlers;
}) {
  return (
    <div className="relative flex gap-3 sm:gap-4 md:gap-5">
      {/* Lingkaran Status & Garis Penghubung */}
      <div className="relative flex flex-col items-center">
        <div
          className={`z-10 flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors ${
            isPast
              ? "bg-emerald-600 text-white"
              : isCurrent
                ? "bg-[#c41230] text-white ring-4 ring-[#c41230]/15"
                : isRejectedHere
                  ? "bg-rose-600 text-white ring-4 ring-rose-200"
                  : "border border-slate-300 bg-slate-100 text-slate-500"
          }`}
        >
          {isPast ? (
            <CheckCircle2 className="size-4" strokeWidth={1.5} />
          ) : isRejectedHere ? (
            <X className="size-4" strokeWidth={1.5} />
          ) : (
            step.stepOrder
          )}
        </div>
        {!isLast && (
          <div
            className={`min-h-10 w-0.5 grow ${
              isPast ? "bg-emerald-500" : "bg-slate-200"
            }`}
          />
        )}
      </div>

      {/* Konten Tahap */}
      <div className={isLast ? "min-w-0 flex-1" : "mb-5 min-w-0 flex-1"}>
        {isCurrent ? (
          <ActiveStepEditorCard
            key={`${lead.id}-step-${step.stepOrder}-${activeEditLog?.id ?? "new"}`}
            lead={lead}
            step={step}
            nextStep={nextStep}
            activeLog={activeEditLog}
            stepMedia={stepMedia}
            stepSla={stepSla}
            onLeadUpdated={onLeadUpdated}
            onRefreshLead={onRefreshLead}
            onPreviewMedia={onPreviewMedia}
            previewHandlers={previewHandlers}
          />
        ) : isFuture ? (
          <FutureStepCard step={step} />
        ) : (
          <LockedStepCard
            leadId={lead.id}
            step={step}
            stepLog={latestStepLog}
            stepMedia={stepMedia}
            stepSla={stepSla}
            isRejectedHere={isRejectedHere}
            rejectionReason={lead.rejectionReason}
            legacyRdsNo={lead.rdsOfferNo}
            legacyBaNo={lead.baNegotiationNo}
            legacyVisitStatus={lead.siteVisitStatus}
            legacyVisitAt={lead.siteVisitScheduledAt}
            onRefreshLead={onRefreshLead}
            onPreviewMedia={onPreviewMedia}
            previewDocHandlers={previewHandlers?.docHandlers}
          />
        )}
      </div>
    </div>
  );
}

export function ActiveStepEditorCard({
  lead,
  step,
  nextStep,
  activeLog,
  stepMedia,
  stepSla,
  onLeadUpdated,
  onRefreshLead,
  onPreviewMedia,
  previewHandlers,
}: {
  lead: CmsLeadDetail;
  step: CmsWorkflowStep;
  nextStep: CmsWorkflowStep | undefined;
  activeLog: CmsStepLogDetail | undefined;
  stepMedia: CmsInquiryMedia[];
  stepSla: StepSlaInfo | null;
  onLeadUpdated: (lead: CmsLeadDetail) => void;
  onRefreshLead: () => Promise<void>;
  onPreviewMedia: (media: CmsInquiryMedia) => void;
  previewHandlers?: AdminStepPreviewHandlers;
}) {
  const initialDocNo =
    activeLog?.documentNumber ??
    (step.leadStatus === "RDS_OFFER"
      ? lead.rdsOfferNo
      : step.leadStatus === "BA_SIGNED"
        ? lead.baNegotiationNo
        : null) ??
    "";

  const [publicNote, setPublicNote] = useState(activeLog?.notes ?? "");
  const [documentNumber, setDocumentNumber] = useState(initialDocNo);
  const [siteVisitStatus, setSiteVisitStatus] = useState<CommercialSiteVisitStatus>(
    ((activeLog?.visitStatus ?? lead.siteVisitStatus) as CommercialSiteVisitStatus) ||
      "NONE"
  );
  const [siteVisitScheduledAt, setSiteVisitScheduledAt] = useState(
    toDateTimeLocalInput(activeLog?.scheduledAt ?? lead.siteVisitScheduledAt)
  );

  const [submittingOp, setSubmittingOp] = useState<
    "SAVE_CURRENT_STEP" | "ADVANCE_STAGE" | null
  >(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showAdvanceConfirm, setShowAdvanceConfirm] = useState(false);

  const needsConfirmDialog =
    !nextStep ||
    nextStep.spaceEffect === "RESERVE_SPACE" ||
    nextStep.spaceEffect === "FIT_OUT_SPACE";

  function buildStepInputs() {
    return {
      publicNote: publicNote.trim() || null,
      ...(step.stepType === "DOCUMENT_ISSUANCE"
        ? { documentNumber: documentNumber.trim() || null }
        : {}),
      ...(step.stepType === "SITE_VISIT"
        ? {
            siteVisitStatus,
            siteVisitScheduledAt: siteVisitScheduledAt
              ? new Date(siteVisitScheduledAt).toISOString()
              : null,
          }
        : {}),
    };
  }

  function buildPayload(operation: "SAVE_CURRENT_STEP" | "ADVANCE_STAGE") {
    return {
      id: lead.id,
      operation,
      ...buildStepInputs(),
    };
  }

  async function handleSaveDraft() {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (
      step.stepType === "SITE_VISIT" &&
      siteVisitStatus === "SCHEDULED" &&
      !siteVisitScheduledAt
    ) {
      setErrorMsg(
        "Tanggal & jam verifikasi lokasi wajib diisi ketika status dijadwalkan."
      );
      return;
    }

    if (previewHandlers) {
      previewHandlers.onSaveDraft(buildStepInputs());
      setSuccessMsg(
        "Perubahan tahap ini disimulasikan tersimpan (mode preview — tidak tersimpan ke database)."
      );
      return;
    }

    setSubmittingOp("SAVE_CURRENT_STEP");
    try {
      const res = await cmsFetch("/api/cms/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload("SAVE_CURRENT_STEP")),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal menyimpan perubahan tahap.");
      }
      const updated = (await res.json()) as CmsLeadDetail;
      onLeadUpdated(updated);
      setSuccessMsg("Perubahan tahap ini berhasil disimpan.");
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Gagal menyimpan perubahan tahap."
      );
    } finally {
      setSubmittingOp(null);
    }
  }

  function validateAdvance(): string | null {
    if (!publicNote.trim()) {
      return "Pesan publik untuk Mitra wajib diisi sebelum menyelesaikan tahap ini.";
    }
    if (step.stepType === "DOCUMENT_ISSUANCE" && !documentNumber.trim()) {
      return `${step.documentNumberLabel || "Nomor surat resmi"} wajib diisi sebelum menyelesaikan tahap ${step.title}.`;
    }
    if (
      step.stepType === "SITE_VISIT" &&
      (siteVisitStatus === "SCHEDULED" || siteVisitStatus === "COMPLETED") &&
      !siteVisitScheduledAt
    ) {
      return "Tanggal & jam verifikasi lokasi wajib diisi.";
    }
    if (
      (step.mediaRequirement === "REQUIRED" || step.requiresMedia) &&
      stepMedia.length === 0
    ) {
      return `Tahap ${step.title} mewajibkan minimal 1 dokumen resmi diunggah sebelum dapat diselesaikan.`;
    }
    return null;
  }

  function handleAdvanceClick() {
    setErrorMsg(null);
    setSuccessMsg(null);
    const err = validateAdvance();
    if (err) {
      setErrorMsg(err);
      return;
    }
    if (needsConfirmDialog) {
      setShowAdvanceConfirm(true);
      return;
    }
    void executeAdvance();
  }

  async function executeAdvance() {
    if (previewHandlers) {
      setShowAdvanceConfirm(false);
      previewHandlers.onAdvanceStage(buildStepInputs());
      return;
    }

    setSubmittingOp("ADVANCE_STAGE");
    setErrorMsg(null);
    try {
      const res = await cmsFetch("/api/cms/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload("ADVANCE_STAGE")),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal menyelesaikan tahap ini.");
      }
      const updated = (await res.json()) as CmsLeadDetail;
      setShowAdvanceConfirm(false);
      onLeadUpdated(updated);
    } catch (error) {
      setShowAdvanceConfirm(false);
      setErrorMsg(
        error instanceof Error ? error.message : "Gagal menyelesaikan tahap ini."
      );
    } finally {
      setSubmittingOp(null);
    }
  }

  return (
    <div className="rounded-xl border border-[#c41230]/35 bg-white p-5 shadow-sm">
      {/* Header Tahap Aktif */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#c41230] px-2.5 py-0.5 text-xs font-medium text-white">
              <Clock className="size-3.5" strokeWidth={1.5} />
              Sedang Berlangsung
            </span>
            {stepSla && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-medium tabular-nums ${
                  SLA_BADGE_CLASSES[stepSla.health]
                }`}
              >
                <Timer className="size-3.5" strokeWidth={1.5} />
                {stepSla.label}
              </span>
            )}
            {step.spaceEffect !== "NONE" && (
              <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                {READABLE_SPACE_EFFECT_LABELS[step.spaceEffect]}
              </span>
            )}
          </div>
          <h4 className="mt-2.5 text-base font-semibold text-[#101828]">
            Tahap {step.stepOrder}: {step.title}
          </h4>
          {step.description && (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{step.description}</p>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {/* Form Pesan Publik Mitra */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor={`public-note-${step.stepOrder}`}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#101828]"
            >
              <MessageSquareText className="size-3.5 text-[#c41230]" strokeWidth={1.5} />
              Pesan Publik untuk Mitra <span className="text-[#c41230]">*</span>
            </label>
            <button
              type="button"
              onClick={() => setPublicNote(step.publicMessage)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              <ClipboardList className="size-3.5 text-[#c41230]" strokeWidth={1.5} />
              Gunakan Teks Standar Tahap
            </button>
          </div>
          <textarea
            id={`public-note-${step.stepOrder}`}
            rows={3}
            maxLength={2000}
            value={publicNote}
            onChange={(e) => setPublicNote(e.target.value)}
            placeholder="Tuliskan keterangan perkembangan tahap yang akan dilihat oleh Mitra"
            className="w-full rounded-lg border border-slate-300 p-3 text-xs text-[#101828] focus:border-[#c41230] focus:outline-none"
          />
        </div>

        {/* Form Kontekstual stepType === DOCUMENT_ISSUANCE */}
        {step.stepType === "DOCUMENT_ISSUANCE" && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[#101828]">
                {step.documentNumberLabel || "Nomor Dokumen Resmi"}{" "}
                <span className="text-[#c41230]">*</span>
              </span>
              <input
                type="text"
                maxLength={160}
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder={`Masukkan ${(
                  step.documentNumberLabel || "nomor surat resmi"
                ).toLowerCase()}`}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-[#101828] tabular-nums focus:border-[#c41230] focus:outline-none"
              />
            </label>
          </div>
        )}

        {/* Form Kontekstual stepType === SITE_VISIT */}
        {step.stepType === "SITE_VISIT" && (
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="block text-xs font-semibold text-[#101828]">
                Status Verifikasi Lokasi
              </span>
              <div className="relative">
                <select
                  value={siteVisitStatus}
                  onChange={(e) =>
                    setSiteVisitStatus(e.target.value as CommercialSiteVisitStatus)
                  }
                  className="h-9 w-full appearance-none rounded-lg border border-slate-300 bg-white pr-8 pl-3 text-xs font-medium text-[#101828] focus:border-[#c41230] focus:outline-none"
                >
                  {SITE_VISIT_STATUS_VALUES.map((val) => (
                    <option key={val} value={val}>
                      {SITE_VISIT_STATUS_LABELS[val]}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-slate-500"
                  strokeWidth={1.5}
                />
              </div>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[#101828]">
                Tanggal & Jam Verifikasi Lokasi{" "}
                {(siteVisitStatus === "SCHEDULED" ||
                  siteVisitStatus === "COMPLETED") && (
                  <span className="text-[#c41230]">*</span>
                )}
              </span>
              <input
                type="datetime-local"
                value={siteVisitScheduledAt}
                onChange={(e) => setSiteVisitScheduledAt(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-[#101828] tabular-nums focus:border-[#c41230] focus:outline-none"
              />
            </label>
          </div>
        )}

        {/* Pengelola Dokumen Tahap Ini */}
        <StepDocumentsManager
          leadId={lead.id}
          stepOrder={step.stepOrder}
          mediaRequirement={step.mediaRequirement}
          defaultDocumentNumber={documentNumber}
          mediaItems={stepMedia}
          isEditable
          defaultShowAddForm={previewHandlers?.defaultShowAddDocForm}
          previewHandlers={previewHandlers?.docHandlers}
          onRefreshLead={onRefreshLead}
          onPreviewMedia={onPreviewMedia}
        />

        {errorMsg && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" strokeWidth={1.5} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" strokeWidth={1.5} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Info Efek Unit pada Tahap Berikutnya */}
        {nextStep && nextStep.spaceEffect !== "NONE" && lead.space && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700">
            <span className="font-semibold text-[#101828]">Efek tahap berikutnya: </span>
            Melanjutkan ke{" "}
            <span className="font-medium text-[#101828]">
              Tahap {nextStep.stepOrder} ({nextStep.title})
            </span>{" "}
            akan menjalankan aturan{" "}
            <span className="font-medium text-[#101828]">
              {READABLE_SPACE_EFFECT_LABELS[nextStep.spaceEffect]}
            </span>
            .
          </p>
        )}

        {/* Action Bar */}
        <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            disabled={submittingOp !== null}
            onClick={() => void handleSaveDraft()}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-[#101828] transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {submittingOp === "SAVE_CURRENT_STEP" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4 text-slate-600" strokeWidth={1.5} />
            )}
            Simpan Perubahan Tahap Ini
          </button>

          <button
            type="button"
            disabled={submittingOp !== null}
            onClick={handleAdvanceClick}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#c41230] px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#a60f28] disabled:opacity-50"
          >
            {submittingOp === "ADVANCE_STAGE" && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {nextStep
              ? `Selesaikan Tahap ${step.stepOrder} & Lanjut ke Tahap ${nextStep.stepOrder}`
              : `Selesaikan Tahap ${step.stepOrder} & Resmikan Operasional Komersial`}
            <ArrowRight className="size-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Dialog Konfirmasi Dampak Unit / Penutupan */}
      {showAdvanceConfirm && (
        <DialogPrimitive.Root open onOpenChange={setShowAdvanceConfirm}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/50" />
            <DialogPrimitive.Content
              aria-describedby={undefined}
              className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
            >
              <DialogPrimitive.Title className="text-base font-semibold text-[#101828]">
                {nextStep
                  ? `Konfirmasi Lanjut ke Tahap ${nextStep.stepOrder}`
                  : "Konfirmasi Penyelesaian Pengajuan"}
              </DialogPrimitive.Title>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                {!nextStep
                  ? `Tahap ${step.stepOrder} (${step.title}) akan dikunci secara permanen dan pengajuan ${lead.inquiryCode} akan ditandai Selesai${
                      lead.space
                        ? `, mengubah status unit ${lead.space.code} menjadi Terisi serta mengaktifkan data penyewa`
                        : ""
                    }.`
                  : nextStep.spaceEffect === "RESERVE_SPACE"
                    ? `Masuk ke Tahap ${nextStep.stepOrder} (${nextStep.title})${
                        lead.space
                          ? ` akan mengunci unit ${lead.space.code} menjadi Dipesan (Reserved) dan otomatis menutup pengajuan aktif lain pada unit ini`
                          : ""
                      }. Data pada Tahap ${step.stepOrder} akan terkunci.`
                    : `Masuk ke Tahap ${nextStep.stepOrder} (${nextStep.title})${
                        lead.space
                          ? ` akan memperbarui status unit ${lead.space.code} menjadi Fit-Out`
                          : ""
                      }. Data pada Tahap ${step.stepOrder} akan terkunci.`}
              </p>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanceConfirm(false)}
                  className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={submittingOp === "ADVANCE_STAGE"}
                  onClick={() => void executeAdvance()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#c41230] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#a60f28] disabled:opacity-50"
                >
                  {submittingOp === "ADVANCE_STAGE" && (
                    <Loader2 className="size-3.5 animate-spin" />
                  )}
                  Konfirmasi & Lanjutkan
                </button>
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )}
    </div>
  );
}

export function LockedStepCard({
  leadId,
  step,
  stepLog,
  stepMedia,
  stepSla,
  isRejectedHere,
  rejectionReason,
  legacyRdsNo,
  legacyBaNo,
  legacyVisitStatus,
  legacyVisitAt,
  onRefreshLead,
  onPreviewMedia,
  previewDocHandlers,
}: {
  leadId: string;
  step: CmsWorkflowStep;
  stepLog: CmsStepLogDetail | undefined;
  stepMedia: CmsInquiryMedia[];
  stepSla: StepSlaInfo | null;
  isRejectedHere: boolean;
  rejectionReason: string | null;
  legacyRdsNo: string | null;
  legacyBaNo: string | null;
  legacyVisitStatus: string;
  legacyVisitAt: string | null;
  onRefreshLead: () => Promise<void>;
  onPreviewMedia: (media: CmsInquiryMedia) => void;
  previewDocHandlers?: StepDocPreviewHandlers;
}) {
  const [showDocs, setShowDocs] = useState(false);

  const docNumber =
    stepLog?.documentNumber ??
    (step.leadStatus === "RDS_OFFER"
      ? legacyRdsNo
      : step.leadStatus === "BA_SIGNED"
        ? legacyBaNo
        : null);
  const visitStatus = stepLog?.visitStatus ?? legacyVisitStatus;
  const visitAt = stepLog?.scheduledAt ?? legacyVisitAt;

  return (
    <div
      className={`rounded-xl border p-4 ${
        isRejectedHere
          ? "border-rose-200 bg-rose-50/40"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {isRejectedHere ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                <XCircle className="size-3.5" strokeWidth={1.5} />
                Dihentikan · Terkunci
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <Lock className="size-3.5" strokeWidth={1.5} />
                Selesai · Terkunci
              </span>
            )}
            {stepSla && (
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums ${
                  SLA_BADGE_CLASSES[stepSla.health]
                }`}
              >
                {stepSla.label}
              </span>
            )}
          </div>
          <h4 className="mt-2 text-sm font-semibold text-[#101828]">
            Tahap {step.stepOrder}: {step.title}
          </h4>
        </div>

        {stepLog?.createdAt && (
          <span className="text-xs text-slate-500 tabular-nums">
            {formatDateId(stepLog.createdAt, true)}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2.5">
        {isRejectedHere ? (
          <div className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs text-rose-800">
            <span className="font-semibold">Alasan penghentian: </span>
            {rejectionReason || stepLog?.notes || "Pengajuan dihentikan."}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <span className="font-semibold text-[#101828]">Pesan Publik: </span>
            {stepLog?.notes || step.publicMessage}
          </div>
        )}

        {step.stepType === "DOCUMENT_ISSUANCE" && docNumber && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <span className="font-semibold text-[#101828]">
              {step.documentNumberLabel || "Nomor Dokumen Resmi"}:{" "}
            </span>
            <span className="font-semibold text-[#101828] tabular-nums">{docNumber}</span>
          </div>
        )}

        {step.stepType === "SITE_VISIT" && visitStatus && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <span className="font-semibold text-[#101828]">
              Verifikasi Lokasi:{" "}
              <span className="font-normal text-slate-700">
                {getSiteVisitStatusLabel(visitStatus)}
              </span>
            </span>
            {visitAt && (
              <span className="inline-flex items-center gap-1.5 text-slate-600 tabular-nums">
                <CalendarClock className="size-3.5 text-slate-400" strokeWidth={1.5} />
                {formatDateId(visitAt, true)}
              </span>
            )}
          </div>
        )}

        {stepMedia.length > 0 && (
          <div className="space-y-2.5 pt-0.5">
            <button
              type="button"
              onClick={() => setShowDocs((prev) => !prev)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-[#101828]"
            >
              <FileText className="size-3.5 text-[#c41230]" strokeWidth={1.5} />
              <span>
                {showDocs
                  ? `Sembunyikan dokumen (${stepMedia.length})`
                  : `Lihat dokumen terlampir (${stepMedia.length})`}
              </span>
              {showDocs ? (
                <ChevronUp className="size-3.5 text-slate-400" strokeWidth={1.5} />
              ) : (
                <ChevronDown className="size-3.5 text-slate-400" strokeWidth={1.5} />
              )}
            </button>

            {showDocs && (
              <StepDocumentsManager
                leadId={leadId}
                stepOrder={step.stepOrder}
                mediaRequirement={step.mediaRequirement}
                mediaItems={stepMedia}
                isEditable={false}
                previewHandlers={previewDocHandlers}
                onRefreshLead={onRefreshLead}
                onPreviewMedia={onPreviewMedia}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function FutureStepCard({ step }: { step: CmsWorkflowStep }) {
  const metaParts = [
    STEP_TYPE_LABELS[step.stepType],
    STEP_MEDIA_REQUIREMENT_LABELS[step.mediaRequirement],
    step.slaHours ? `Target SLA ${step.slaHours} jam` : null,
    step.spaceEffect !== "NONE"
      ? READABLE_SPACE_EFFECT_LABELS[step.spaceEffect]
      : null,
  ].filter(Boolean);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-700">
          Tahap {step.stepOrder}: {step.title}
        </h4>
        <span className="rounded-md border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-500">
          Menunggu
        </span>
      </div>
      {step.description && (
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{step.description}</p>
      )}
      <p className="mt-2 text-xs text-slate-500 tabular-nums">
        {metaParts.join(" · ")}
      </p>
    </div>
  );
}

export function MediaPreviewLightbox({
  media,
  onClose,
}: {
  media: CmsInquiryMedia;
  onClose: () => void;
}) {
  return (
    <DocumentPreviewModal
      documentItem={media}
      onClose={onClose}
    />
  );
}
