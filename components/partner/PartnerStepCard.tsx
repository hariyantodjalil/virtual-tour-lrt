"use client";

import Image from "next/image";
import {
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Maximize2,
  MessageSquareQuote,
  X,
  XCircle,
} from "lucide-react";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import {
  SITE_VISIT_STATUS_LABELS,
  type CommercialSiteVisitStatus,
  type PipelineStepTypeValue,
  type StepMediaRequirementValue,
  type StepSpaceEffectValue,
} from "@/lib/commercial-pipeline";
import { resolveDocumentPreview } from "@/lib/document-preview";

export type PartnerStepLog = {
  id: string;
  stepOrder: number;
  status?: string;
  fromStatus?: string | null;
  action: string;
  notes: string | null;
  documentNumber?: string | null;
  visitStatus?: string | null;
  scheduledAt?: string | null;
  performedBy: string;
  createdAt: string;
  pipelineStep: {
    id: string;
    stepOrder: number;
    title: string;
    stepType?: PipelineStepTypeValue;
    documentNumberLabel?: string | null;
  } | null;
};

export type PartnerMediaAttachment = {
  id: string;
  stepOrder: number;
  mediaTitle: string;
  documentNumber: string | null;
  mediaLink: string;
  isVisibleToMitra: boolean;
  uploadedByAdmin: string;
  createdAt: string;
};

export type PartnerWorkflowStep = {
  id: string;
  stepOrder: number;
  leadStatus?: string | null;
  stepType?: PipelineStepTypeValue;
  documentNumberLabel?: string | null;
  slaHours?: number | null;
  mediaRequirement?: StepMediaRequirementValue;
  requiresMedia: boolean;
  spaceEffect?: StepSpaceEffectValue;
  title: string;
  description: string | null;
  publicMessage: string | null;
};

function formatPartnerDateTimeId(iso?: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return (
    date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB"
  );
}

function getStepNoteLabel(action?: string | null, performedBy?: string | null) {
  if (action === "IMPORTED") return "Catatan Sistem";
  if (performedBy === "Mitra") return "Catatan Pemohon";
  return "Catatan Tim Komersial";
}

export default function PartnerStepCard({
  step,
  isLast,
  isPast,
  isCurrent,
  isFuture,
  isRejected,
  stepLog,
  stepMedia,
  legacyRdsOfferNo,
  legacyBaNegotiationNo,
  legacySiteVisitStatus,
  legacySiteVisitScheduledAt,
  onPreviewMedia,
}: {
  step: PartnerWorkflowStep;
  isLast: boolean;
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
  isRejected: boolean;
  stepLog?: PartnerStepLog;
  stepMedia?: PartnerMediaAttachment[];
  legacyRdsOfferNo?: string | null;
  legacyBaNegotiationNo?: string | null;
  legacySiteVisitStatus?: string | null;
  legacySiteVisitScheduledAt?: string | null;
  onPreviewMedia: (
    media: PartnerMediaAttachment,
    triggerEl: HTMLButtonElement
  ) => void;
}) {
  const stepOrder = step.stepOrder;

  const resolvedStepType: PipelineStepTypeValue =
    step.stepType ??
    (step.leadStatus === "SITE_CHECK"
      ? "SITE_VISIT"
      : step.leadStatus === "RDS_OFFER" || step.leadStatus === "BA_SIGNED"
        ? "DOCUMENT_ISSUANCE"
        : "STANDARD");

  const stepDocNumber =
    stepLog?.documentNumber ||
    (step.leadStatus === "RDS_OFFER"
      ? legacyRdsOfferNo
      : step.leadStatus === "BA_SIGNED"
        ? legacyBaNegotiationNo
        : null);

  const stepVisitStatus = stepLog?.visitStatus || legacySiteVisitStatus;
  const stepVisitAt = stepLog?.scheduledAt || legacySiteVisitScheduledAt;
  const requiresMediaForStep =
    step.mediaRequirement === "REQUIRED" || step.requiresMedia;
  const builtInSubtext =
    step.description?.trim() ||
    step.publicMessage?.trim() ||
    (isFuture
      ? "Menunggu penyelesaian tahap sebelumnya."
      : "Proses tahapan administrasi.");

  // Pesan publik / catatan tahap selalu terpisah dari subteks bawaan tahap agar konteks proses tetap terbaca.
  const trimmedStepNote = !isFuture ? stepLog?.notes?.trim() || null : null;
  const showStepQuote =
    Boolean(trimmedStepNote) && trimmedStepNote !== builtInSubtext;
  const stepQuoteLabel = getStepNoteLabel(
    stepLog?.action,
    stepLog?.performedBy
  );

  return (
    <div className="relative flex gap-4 md:gap-5">
      {/* Number/Check Circle + Connected Vertical Line */}
      <div className="relative flex flex-col items-center">
        <div
          className={`z-10 flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums transition-colors ${
            isPast
              ? "bg-emerald-600 text-white"
              : isCurrent && !isRejected
                ? "bg-[#c41230] text-white ring-4 ring-[#c41230]/15"
                : isCurrent && isRejected
                  ? "bg-rose-600 text-white ring-4 ring-rose-200"
                  : "border border-slate-300 bg-slate-100 text-slate-500"
          }`}
        >
          {isPast ? (
            <CheckCircle2 className="size-4" strokeWidth={1.5} />
          ) : isCurrent && isRejected ? (
            <X className="size-4" strokeWidth={1.5} />
          ) : (
            stepOrder
          )}
        </div>

        {!isLast && (
          <div
            className={`min-h-11 w-0.5 grow transition-colors ${
              isPast ? "bg-emerald-500" : "bg-slate-200"
            }`}
          />
        )}
      </div>

      {/* Step Detail Card */}
      <div
        className={`flex-1 min-w-0 rounded-xl border p-4 transition-colors md:p-5 ${
          isLast ? "" : "mb-5 "
        }${
          isCurrent && !isRejected
            ? "border-[#c41230]/40 bg-white"
            : isCurrent && isRejected
              ? "border-rose-300 bg-rose-50/40"
              : isPast
                ? "border-slate-200 bg-white"
                : "border-slate-200/80 bg-[#f8fafc] opacity-80"
        }`}
      >
        {/* Title & Status Row */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="text-xs font-medium tabular-nums text-slate-500">
              Tahap {stepOrder}
            </span>
            <h3
              className={`text-base font-semibold ${
                isCurrent && !isRejected
                  ? "text-[#c41230]"
                  : isCurrent && isRejected
                    ? "text-rose-700"
                    : "text-[#101828]"
              }`}
            >
              {step.title}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isPast && (
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="size-3.5" strokeWidth={1.5} />
                Selesai
              </span>
            )}
            {isCurrent && !isRejected && (
              <span className="inline-flex items-center rounded-md bg-[#c41230] px-2.5 py-0.5 text-xs font-medium text-white">
                Sedang Berlangsung
              </span>
            )}
            {isCurrent && isRejected && (
              <span className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-0.5 text-xs font-medium text-white">
                <XCircle className="size-3.5" strokeWidth={1.5} />
                Ditolak
              </span>
            )}
            {isFuture && (
              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                Menunggu
              </span>
            )}

            {stepLog?.createdAt && (
              <span className="text-xs tabular-nums text-slate-500">
                {stepLog.performedBy} · {formatPartnerDateTimeId(stepLog.createdAt)}
              </span>
            )}
          </div>
        </div>

        {/* Subteks Bawaan Proses */}
        <p
          className={`mt-2 text-xs leading-relaxed md:text-sm ${
            isFuture ? "text-slate-500" : "text-slate-600"
          }`}
        >
          {builtInSubtext}
        </p>

        {/* Catatan Tim Komersial / Tahap sebagai Quote */}
        {showStepQuote && (
          <blockquote className="mt-3 rounded-lg border border-slate-200 bg-[#f8fafc] px-3.5 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5 font-medium text-[#101828]">
                <MessageSquareQuote
                  className="size-3.5 text-[#c41230]"
                  strokeWidth={1.5}
                />
                {stepQuoteLabel}
              </span>
              {stepLog?.createdAt && (
                <span className="tabular-nums text-slate-500">
                  {formatPartnerDateTimeId(stepLog.createdAt)}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-700 md:text-sm">
              {trimmedStepNote}
            </p>
          </blockquote>
        )}

        {requiresMediaForStep && (!stepMedia || stepMedia.length === 0) && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-[#f8fafc] px-2.5 py-1 text-xs font-medium text-slate-600">
            <FileText className="size-3.5 text-slate-500" strokeWidth={1.5} />
            Tahap ini memerlukan unggahan dokumen resmi oleh Tim Komersial
          </p>
        )}

        {/* Nomor Dokumen Resmi Berbasis stepType === DOCUMENT_ISSUANCE */}
        {resolvedStepType === "DOCUMENT_ISSUANCE" && stepDocNumber && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-[#f8fafc] px-3.5 py-2.5">
            <p className="text-xs font-medium text-slate-500">
              {step.documentNumberLabel || "Nomor Dokumen Resmi"}
            </p>
            <p className="mt-0.5 text-xs font-semibold tabular-nums text-[#101828]">
              {stepDocNumber}
            </p>
          </div>
        )}

        {/* Verifikasi Lokasi Berbasis stepType === SITE_VISIT */}
        {resolvedStepType === "SITE_VISIT" &&
          ((stepVisitStatus && stepVisitStatus !== "NONE") || stepVisitAt) && (
            <div className="mt-3 space-y-1 rounded-lg border border-slate-200 bg-[#f8fafc] px-3.5 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#101828]">
                  Verifikasi Lokasi (Site Visit)
                </span>
                {stepVisitStatus && (
                  <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700">
                    {SITE_VISIT_STATUS_LABELS[
                      stepVisitStatus as CommercialSiteVisitStatus
                    ] ?? stepVisitStatus}
                  </span>
                )}
              </div>
              {stepVisitAt && (
                <p className="text-xs tabular-nums text-slate-600">
                  Jadwal:{" "}
                  {new Date(stepVisitAt).toLocaleDateString("id-ID", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  WIB
                </p>
              )}
            </div>
          )}

        {/* Media Documentation Gallery */}
        {stepMedia && stepMedia.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <ImageIcon className="size-4 text-[#c41230]" strokeWidth={1.5} />
              Dokumentasi & Berkas Resmi ({stepMedia.length})
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stepMedia.map((media) => {
                const resolved = resolveDocumentPreview(
                  media.mediaLink,
                  media.mediaTitle
                );
                const previewUrl = resolved.embedUrl ?? getS3ProxyUrl(media.mediaLink);
                const isImage = resolved.kind === "IMAGE";

                return (
                  <button
                    key={media.id}
                    type="button"
                    onClick={(event) => onPreviewMedia(media, event.currentTarget)}
                    className="group relative flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-left transition-colors hover:border-slate-300"
                  >
                    <div className="relative aspect-[4/3] w-full bg-slate-100">
                      {!isImage ? (
                        <div className="flex size-full flex-col items-center justify-center bg-[#f8fafc] px-2 text-center text-slate-500">
                          <FileText
                            className="size-8 text-slate-400"
                            strokeWidth={1.5}
                          />
                          <span className="mt-1.5 text-xs font-medium text-slate-600">
                            {resolved.formatLabel ?? "Dokumen"}
                          </span>
                        </div>
                      ) : previewUrl.startsWith("blob:") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewUrl}
                          alt={media.mediaTitle}
                          className="size-full object-cover"
                        />
                      ) : (
                        <Image
                          src={previewUrl}
                          alt={media.mediaTitle}
                          fill
                          sizes="240px"
                          className="object-cover"
                          unoptimized
                        />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/0 opacity-0 transition-opacity group-hover:bg-slate-950/20 group-hover:opacity-100">
                        <span className="rounded-lg bg-white/95 p-1.5 text-slate-800 shadow-xs">
                          <Maximize2 className="size-4" strokeWidth={1.5} />
                        </span>
                      </div>
                    </div>
                    <div className="p-2.5">
                      <p className="truncate text-xs font-medium text-[#101828]">
                        {media.mediaTitle}
                      </p>
                      {media.documentNumber && (
                        <p className="truncate text-xs text-slate-500 tabular-nums">
                          No: {media.documentNumber}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
