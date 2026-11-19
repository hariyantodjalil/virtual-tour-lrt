"use client";

import { useMemo, useState } from "react";
import { Eye, PanelRightClose, RotateCcw } from "lucide-react";
import type {
  CommercialSiteVisitStatus,
  StepSlaInfo,
} from "@/lib/commercial-pipeline";
import type { CmsWorkflowStepDTO } from "@/lib/cms-workflow";
import type {
  CmsInquiryMedia,
  CmsLeadDetail,
  CmsStepLogDetail,
} from "@/app/cms/leads/lead-types";
import {
  AdminStepTimelineItem,
  MediaPreviewLightbox,
  type AdminStepPreviewHandlers,
} from "@/app/cms/leads/[id]/LeadStepCards";
import PartnerStepCard, {
  type PartnerMediaAttachment,
  type PartnerStepLog,
} from "@/components/partner/PartnerStepCard";
import WorkflowVersionBadge from "@/components/cms/WorkflowVersionBadge";

type PreviewAudience = "ADMIN" | "MITRA";
type PreviewState = "WAITING" | "RUNNING" | "COMPLETED";

type SimStepDraft = {
  publicNote: string;
  documentNumber: string;
  visitStatus: CommercialSiteVisitStatus;
  visitScheduledAt: string;
  media: CmsInquiryMedia[];
  savedCount: number;
};

const SCALE_OPTIONS = [
  { value: 0.75, label: "75%" },
  { value: 0.85, label: "85%" },
  { value: 1, label: "100%" },
] as const;

const SAMPLE_TIMESTAMP = "2026-11-17T03:15:00.000Z";
const SAMPLE_VISIT_AT = "2026-11-20T03:00:00.000Z";

function createDefaultDraft(): SimStepDraft {
  return {
    publicNote: "",
    documentNumber: "",
    visitStatus: "NONE",
    visitScheduledAt: "",
    media: [],
    savedCount: 0,
  };
}

export default function WorkflowStepPreview({
  step,
  nextStep,
  totalSteps,
  versionNumber,
  versionStatus,
  versionTitle,
  onClosePreview,
}: {
  step: CmsWorkflowStepDTO | null;
  nextStep?: CmsWorkflowStepDTO | null;
  totalSteps: number;
  versionNumber?: number | null;
  versionStatus?: string;
  versionTitle?: string | null;
  onClosePreview?: () => void;
}) {
  const [audience, setAudience] = useState<PreviewAudience>("ADMIN");
  const [simState, setSimState] = useState<PreviewState>("RUNNING");
  const [previewScale, setPreviewScale] = useState<number>(0.85);
  const [resetTick, setResetTick] = useState(0);
  const [draftsByKey, setDraftsByKey] = useState<Record<string, SimStepDraft>>({});
  const [lightboxMedia, setLightboxMedia] = useState<CmsInquiryMedia | null>(null);

  const stepKey = step ? `${step.stepOrder}:${resetTick}` : "none";
  const currentDraft = useMemo(
    () => draftsByKey[stepKey] ?? createDefaultDraft(),
    [draftsByKey, stepKey]
  );

  function updateCurrentDraft(updater: (prev: SimStepDraft) => SimStepDraft) {
    if (!step) return;
    setDraftsByKey((prev) => {
      const base = prev[stepKey] ?? createDefaultDraft();
      return { ...prev, [stepKey]: updater(base) };
    });
  }

  function handleResetSimulation() {
    setResetTick((prev) => prev + 1);
    setSimState("RUNNING");
  }

  if (!step) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
        <p className="text-xs text-slate-500">
          Pilih salah satu tahapan di sebelah kiri untuk mencoba pratinjau interaktif Admin dan Portal Mitra.
        </p>
        {onClosePreview && (
          <button
            type="button"
            onClick={onClosePreview}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <PanelRightClose className="size-3.5" />
            Tutup Preview
          </button>
        )}
      </div>
    );
  }

  const isWaiting = simState === "WAITING";
  const isRunning = simState === "RUNNING";
  const isCompleted = simState === "COMPLETED";
  const isLast = step.stepOrder >= totalSteps;

  const sampleDocNo =
    currentDraft.documentNumber.trim() ||
    (isCompleted || audience === "MITRA" ? "042/LRT-KOM/XI/2026" : "");
  const sampleNote =
    currentDraft.publicNote.trim() ||
    step.publicMessage.trim() ||
    step.description?.trim() ||
    "Proses tahap pengajuan sedang berjalan.";

  const sampleVisitStatus =
    currentDraft.visitStatus !== "NONE"
      ? currentDraft.visitStatus
      : isCompleted
        ? "COMPLETED"
        : audience === "MITRA"
          ? "SCHEDULED"
          : "NONE";
  const sampleVisitAt =
    currentDraft.visitScheduledAt ||
    (sampleVisitStatus === "SCHEDULED" || sampleVisitStatus === "COMPLETED"
      ? SAMPLE_VISIT_AT
      : "");

  // Sample attachment otomatis muncul saat simulasi Selesai jika admin belum menambah berkas uji coba
  const fallbackCompletedSampleMedia: CmsInquiryMedia[] =
    isCompleted && step.mediaRequirement !== "NONE" && currentDraft.media.length === 0
      ? [
          {
            id: `preview-sample-doc-${step.stepOrder}`,
            stepOrder: step.stepOrder,
            mediaTitle: `${step.title || `Tahap ${step.stepOrder}`} — Dokumen Resmi.pdf`,
            documentNumber:
              step.stepType === "DOCUMENT_ISSUANCE"
                ? sampleDocNo || "042/LRT-KOM/XI/2026"
                : null,
            mediaLink: "https://example.com/dokumen-resmi-simulasi.pdf",
            isVisibleToMitra: true,
            uploadedByAdmin: "Tim Komersial (Preview)",
            createdAt: SAMPLE_TIMESTAMP,
          },
        ]
      : [];

  const effectiveAdminMedia =
    currentDraft.media.length > 0 ? currentDraft.media : fallbackCompletedSampleMedia;
  const effectiveMitraMedia: PartnerMediaAttachment[] = effectiveAdminMedia.filter(
    (m) => m.isVisibleToMitra
  );

  const mockSla: StepSlaInfo | null =
    step.slaHours && step.slaHours > 0 && !isWaiting
      ? isRunning
        ? {
            slaHours: step.slaHours,
            startedAt: SAMPLE_TIMESTAMP,
            dueAt: SAMPLE_TIMESTAMP,
            completedAt: null,
            elapsedMs: 3600000,
            remainingMs: step.slaHours * 3600000,
            health: "SAFE",
            isRunning: true,
            label: `Target SLA: Sisa ${step.slaHours}j 00m`,
          }
        : {
            slaHours: step.slaHours,
            startedAt: SAMPLE_TIMESTAMP,
            dueAt: SAMPLE_TIMESTAMP,
            completedAt: SAMPLE_TIMESTAMP,
            elapsedMs: 12000000,
            remainingMs: 3600000,
            health: "MET",
            isRunning: false,
            label: "Respons: 3j 20m (Tepat Waktu)",
          }
      : null;

  const mockActiveLog: CmsStepLogDetail = {
    id: `sim-log-${step.stepOrder}-${currentDraft.savedCount}-${step.mediaRequirement}`,
    stepOrder: step.stepOrder,
    status: step.leadStatus,
    fromStatus: null,
    action: isCompleted ? "COMPLETED" : "STATUS_CHANGED",
    notes: isRunning ? currentDraft.publicNote : sampleNote,
    documentNumber: isRunning ? currentDraft.documentNumber || null : sampleDocNo || null,
    visitStatus: sampleVisitStatus,
    scheduledAt: sampleVisitAt || null,
    performedBy: "Tim Komersial",
    createdAt: SAMPLE_TIMESTAMP,
    pipelineStep: {
      id: step.id,
      stepOrder: step.stepOrder,
      title: step.title,
      stepType: step.stepType,
      documentNumberLabel: step.documentNumberLabel,
    },
  };

  const mockLead: CmsLeadDetail = {
    id: "preview-sandbox-lead",
    inquiryCode: "INQ-PREVIEW-01",
    userId: null,
    spaceId: "preview-space",
    workflowVersionId: "preview-wf",
    companyName: "PT Mitra Simulasi LRT",
    contactName: "Budi Santoso",
    phone: "081200000000",
    email: "preview@mitra.example",
    businessType: "Food & Beverage",
    spaceRequirement: "KIOSK-CKW-01",
    message: null,
    status: step.leadStatus,
    currentStepOrder: step.stepOrder,
    surveyPreference: null,
    siteVisitStatus: sampleVisitStatus,
    siteVisitScheduledAt: sampleVisitAt || null,
    notes: null,
    rdsOfferNo: null,
    baNegotiationNo: null,
    rejectionReason: null,
    followUpAt: null,
    createdAt: SAMPLE_TIMESTAMP,
    updatedAt: SAMPLE_TIMESTAMP,
    space: {
      id: "preview-space",
      code: "CKW-K01",
      name: "Kios Stasiun Cawang Lt. Concourse",
      type: "KIOS",
      status: "TERSEDIA",
      area: 18,
      lengthM: 4.5,
      widthM: 4,
      heightM: 3,
      areaKind: "USABLE",
      exposure: 85,
      floor: "Concourse",
      location: "Zona Komersial A",
      nearestExit: "Pintu B",
      nearbyFacilities: [],
      powerSupply: "3.500 VA",
      waterAccess: true,
      airConditioning: true,
      description: null,
      panoramaUrl: null,
      station: {
        id: "st-preview",
        code: "CKW",
        name: "Stasiun Cawang",
        slug: "cawang",
        address: "Jl. MT Haryono, Jakarta",
        location: "Jakarta Timur",
        line: "Bekasi & Cibubur",
        dailyPassengers: 24000,
        imageUrl: null,
      },
      parentZone: null,
      occupancy: null,
    },
    workflowVersion: null,
    stepLogs: [mockActiveLog],
    mediaAttachments: effectiveAdminMedia,
    _count: {
      mediaAttachments: effectiveAdminMedia.length,
    },
  };

  const previewHandlers: AdminStepPreviewHandlers = {
    defaultShowAddDocForm: step.mediaRequirement !== "NONE",
    onSaveDraft: (payload) => {
      updateCurrentDraft((prev) => ({
        ...prev,
        publicNote: payload.publicNote ?? "",
        documentNumber:
          payload.documentNumber !== undefined
            ? payload.documentNumber ?? ""
            : prev.documentNumber,
        visitStatus: payload.siteVisitStatus ?? prev.visitStatus,
        visitScheduledAt:
          payload.siteVisitScheduledAt !== undefined
            ? payload.siteVisitScheduledAt ?? ""
            : prev.visitScheduledAt,
        savedCount: prev.savedCount + 1,
      }));
    },
    onAdvanceStage: (payload) => {
      updateCurrentDraft((prev) => ({
        ...prev,
        publicNote: payload.publicNote ?? prev.publicNote,
        documentNumber:
          payload.documentNumber !== undefined
            ? payload.documentNumber ?? ""
            : prev.documentNumber,
        visitStatus: payload.siteVisitStatus ?? prev.visitStatus,
        visitScheduledAt:
          payload.siteVisitScheduledAt !== undefined
            ? payload.siteVisitScheduledAt ?? ""
            : prev.visitScheduledAt,
        savedCount: prev.savedCount + 1,
      }));
      setSimState("COMPLETED");
    },
    docHandlers: {
      onCreate: (input) => {
        const newDoc: CmsInquiryMedia = {
          id: `preview-doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          stepOrder: step.stepOrder,
          mediaTitle: input.mediaTitle,
          documentNumber: input.documentNumber,
          mediaLink: input.mediaLink,
          isVisibleToMitra: input.isVisibleToMitra,
          uploadedByAdmin: "Anda (Mode Preview)",
          createdAt: new Date().toISOString(),
        };
        updateCurrentDraft((prev) => ({
          ...prev,
          media: [newDoc, ...prev.media],
        }));
      },
      onUpdate: (input) => {
        updateCurrentDraft((prev) => ({
          ...prev,
          media: prev.media.map((m) =>
            m.id === input.id
              ? {
                  ...m,
                  mediaTitle: input.mediaTitle,
                  documentNumber: input.documentNumber,
                  mediaLink: input.mediaLink ?? m.mediaLink,
                  isVisibleToMitra: input.isVisibleToMitra,
                }
              : m
          ),
        }));
      },
      onToggleVisibility: (item) => {
        updateCurrentDraft((prev) => ({
          ...prev,
          media: prev.media.map((m) =>
            m.id === item.id
              ? { ...m, isVisibleToMitra: !m.isVisibleToMitra }
              : m
          ),
        }));
      },
      onDelete: (mediaId) => {
        updateCurrentDraft((prev) => ({
          ...prev,
          media: prev.media.filter((m) => m.id !== mediaId),
        }));
      },
    },
  };

  const partnerLog: PartnerStepLog | undefined = isWaiting
    ? undefined
    : {
        id: mockActiveLog.id,
        stepOrder: step.stepOrder,
        status: step.leadStatus,
        fromStatus: null,
        action: isCompleted ? "COMPLETED" : "STATUS_CHANGED",
        notes: sampleNote,
        documentNumber: sampleDocNo || null,
        visitStatus: sampleVisitStatus,
        scheduledAt: sampleVisitAt || null,
        performedBy: "Tim Komersial",
        createdAt: SAMPLE_TIMESTAMP,
        pipelineStep: {
          id: step.id,
          stepOrder: step.stepOrder,
          title: step.title,
          stepType: step.stepType,
          documentNumberLabel: step.documentNumberLabel,
        },
      };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header Preview */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-[#D81435]">
            <Eye className="size-4" strokeWidth={1.6} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-[#101828]">
                Live Dual-Preview
              </h3>
              <WorkflowVersionBadge
                version={versionNumber ?? null}
                status={versionStatus}
                title={versionTitle}
                prefix={null}
                size="xs"
                showIcon={false}
              />
            </div>
            <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
              Komponen asli · Interaktif (tidak tersimpan ke database)
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleResetSimulation}
            title="Kembalikan input simulasi preview ke awal"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-[#101828]"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </button>
          {onClosePreview && (
            <button
              type="button"
              onClick={onClosePreview}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-[#101828]"
            >
              <PanelRightClose className="size-3.5 text-slate-500" />
              Tutup Preview
            </button>
          )}
        </div>
      </div>

      {/* Kontroller Audience, Status Simulasi & Skala Rasio */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 sm:px-5">
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setAudience("ADMIN")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              audience === "ADMIN"
                ? "bg-white text-[#101828] shadow-xs"
                : "text-slate-600 hover:text-[#101828]"
            }`}
          >
            Meja Kerja Admin
          </button>
          <button
            type="button"
            onClick={() => setAudience("MITRA")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              audience === "MITRA"
                ? "bg-white text-[#101828] shadow-xs"
                : "text-slate-600 hover:text-[#101828]"
            }`}
          >
            Portal Mitra
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            {(
              [
                { id: "WAITING", label: "Menunggu" },
                { id: "RUNNING", label: "Berjalan" },
                { id: "COMPLETED", label: "Selesai" },
              ] as const
            ).map((item) => {
              const active = simState === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSimState(item.id)}
                  className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "border-[#D81435] bg-rose-50 text-[#D81435]"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div
            className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5"
            title="Skala tampilan komponen pratinjau"
          >
            {SCALE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPreviewScale(opt.value)}
                className={`rounded px-1.5 py-0.5 text-xs font-medium tabular-nums transition-colors ${
                  previewScale === opt.value
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:text-[#101828]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Kanvas Komponen Asli Berskala (Interaktif dalam Memori Preview) */}
      <div className="overflow-x-auto p-3 sm:p-4">
        <div
          className="rounded-xl border border-slate-200 bg-[#f8fafc] p-4"
          style={{ zoom: previewScale }}
        >
          {audience === "ADMIN" ? (
            <AdminStepTimelineItem
              key={`admin-${step.stepOrder}-${step.mediaRequirement}-${resetTick}`}
              lead={mockLead}
              step={step}
              nextStep={nextStep ?? undefined}
              activeEditLog={mockActiveLog}
              latestStepLog={mockActiveLog}
              stepMedia={effectiveAdminMedia}
              stepSla={mockSla}
              isPast={isCompleted}
              isCurrent={isRunning}
              isFuture={isWaiting}
              isRejectedHere={false}
              isLast={isLast}
              onLeadUpdated={() => {}}
              onRefreshLead={async () => {}}
              onPreviewMedia={(media) => setLightboxMedia(media)}
              previewHandlers={previewHandlers}
            />
          ) : (
            <PartnerStepCard
              step={step}
              isLast={isLast}
              isPast={isCompleted}
              isCurrent={isRunning}
              isFuture={isWaiting}
              isRejected={false}
              stepLog={partnerLog}
              stepMedia={effectiveMitraMedia}
              legacySiteVisitStatus={sampleVisitStatus}
              legacySiteVisitScheduledAt={sampleVisitAt || null}
              onPreviewMedia={(media) =>
                setLightboxMedia({
                  id: media.id,
                  stepOrder: media.stepOrder,
                  mediaTitle: media.mediaTitle,
                  documentNumber: media.documentNumber,
                  mediaLink: media.mediaLink,
                  isVisibleToMitra: media.isVisibleToMitra,
                  uploadedByAdmin: media.uploadedByAdmin,
                  createdAt: media.createdAt,
                })
              }
            />
          )}
        </div>

        <p className="mt-2.5 text-xs leading-relaxed text-slate-500">
          {audience === "ADMIN"
            ? "Kotak pesan di Meja Kerja Admin sengaja dimulai kosong seperti pengajuan baru — klik \"Gunakan Teks Standar Tahap\" untuk mengisinya otomatis. Sementara itu, tab Portal Mitra langsung tersinkron dengan Template Pesan Publik Standar di sebelah kiri."
            : "Tampilan kartu asli Portal Mitra akan langsung mencerminkan perubahan Template Pesan Publik Standar maupun pesan, nomor surat, survei, dan dokumen dari simulasi Anda."}
        </p>
      </div>

      {lightboxMedia && (
        <MediaPreviewLightbox
          media={lightboxMedia}
          onClose={() => setLightboxMedia(null)}
        />
      )}
    </div>
  );
}
