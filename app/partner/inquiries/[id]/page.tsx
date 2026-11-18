"use client";

import { useCallback, useEffect, useRef, useState, use, type RefObject } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Compass,
  History,
  Layers,
  MessageSquareQuote,
  Phone,
  Ruler,
  ShieldAlert,
  User,
  X,
  XCircle,
} from "lucide-react";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import { getWhatsAppUrl } from "@/lib/utils";
import {
  LEAD_STATUS_LABELS,
  PUBLIC_LEAD_PROCESS_STEPS,
  SITE_VISIT_STATUS_LABELS,
  SPACE_STATUS_LABELS,
  SPACE_TYPE_LABELS,
  formatSpaceRequirementLabel,
  isInquiryFullyCompleted,
  resolveLeadStepSla,
  type CommercialLeadStatus,
  type CommercialSiteVisitStatus,
  type CommercialSpaceStatus,
  type PipelineStepTypeValue,
  type StepMediaRequirementValue,
  type StepSpaceEffectValue,
} from "@/lib/commercial-pipeline";
import {
  SPACE_AREA_KIND_LABELS,
  formatArea,
  type SpaceAreaKind,
} from "@/lib/unit-dimensions";
import { getFacilityIcon, isFacilityIconId } from "@/lib/facility-icons";
import ScaledUnitPlan from "@/components/commercial/ScaledUnitPlan";
import { useCommercialProfile } from "@/components/commercial/CommercialProfileProvider";
import { useInquiryRealtimeSync } from "@/components/realtime/useInquiryRealtimeSync";
import { PARTNER_LEADS_UPDATED_EVENT } from "@/lib/inquiry-sync-events";
import PartnerStepCard from "@/components/partner/PartnerStepCard";
import DocumentPreviewModal from "@/components/pipeline/DocumentPreviewModal";

type StepLog = {
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

type MediaAttachment = {
  id: string;
  stepOrder: number;
  mediaTitle: string;
  documentNumber: string | null;
  mediaLink: string;
  isVisibleToMitra: boolean;
  uploadedByAdmin: string;
  createdAt: string;
};

type WorkflowStep = {
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

type InquiryDetail = {
  id: string;
  inquiryCode: string | null;
  userId: string | null;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  businessType: string;
  spaceRequirement: string | null;
  message: string | null;
  status: "ACTIVE" | "COMPLETED" | "REJECTED" | string;
  currentStepOrder: number;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  surveyPreference?: string | null;
  siteVisitStatus?: string | null;
  siteVisitScheduledAt?: string | null;
  rdsOfferNo?: string | null;
  baNegotiationNo?: string | null;
  space: {
    id: string;
    code: string;
    name: string;
    type: string;
    status: string;
    area: number;
    lengthM?: number | null;
    widthM?: number | null;
    heightM?: number | null;
    areaKind?: string | null;
    exposure?: number;
    parentZone?: {
      id: string;
      code: string;
      name: string;
      area: number;
    } | null;
    leasableAreaDetail: string | null;
    leasingModel: string | null;
    floor: string;
    location: string;
    nearestExit: string | null;
    nearbyFacilities: string[];
    powerSupply: string | null;
    waterAccess: string | null;
    airConditioning: string | null;
    fitOutTerms: string | null;
    description: string | null;
    panoramaUrl: string | null;
    station: {
      id: string;
      code?: string | null;
      name: string;
      slug: string;
      address: string;
      location: string | null;
      line: string;
      dailyPassengers?: number;
      imageUrl: string | null;
    } | null;
  } | null;
  workflowVersion: {
    id: string;
    version: number;
    title: string;
    description: string | null;
    steps: WorkflowStep[];
  } | null;
  stepLogs: StepLog[];
  mediaAttachments: MediaAttachment[];
};

const STEP_LOG_ACTION_LABELS: Record<string, string> = {
  SUBMITTED: "Pengajuan Dikirim",
  STATUS_CHANGED: "Perubahan Tahap",
  COMPLETED: "Tahap Selesai",
  REJECTED: "Pengajuan Dihentikan",
  IMPORTED: "Tercatat Sistem",
};

const SPACE_STATUS_BADGE_CLASSES: Record<string, string> = {
  TERSEDIA: "bg-emerald-600/95 text-white",
  RESERVED: "bg-amber-500/95 text-slate-950",
  FIT_OUT: "bg-sky-600/95 text-white",
  TERISI: "bg-slate-800/95 text-white",
  MAINTENANCE: "bg-rose-600/95 text-white",
};

function formatDateTimeId(iso?: string | null) {
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

function leadStatusLabel(status?: string | null) {
  if (!status) return null;
  return LEAD_STATUS_LABELS[status as CommercialLeadStatus] ?? status;
}

function getStepNoteLabel(action?: string | null, performedBy?: string | null) {
  if (action === "IMPORTED") return "Catatan Sistem";
  if (performedBy === "Mitra") return "Catatan Pemohon";
  return "Catatan Tim Komersial";
}

function InfoRow({
  label,
  value,
  subValue,
  isLast = false,
}: {
  label: string;
  value: string;
  subValue?: string | null;
  isLast?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 ${
        isLast ? "" : "border-b border-slate-100 pb-2.5"
      }`}
    >
      <span className="shrink-0 text-slate-500">{label}</span>
      <div className="min-w-0 text-right">
        <p className="font-medium break-words text-[#101828] tabular-nums">{value}</p>
        {subValue && (
          <p className="mt-0.5 text-xs leading-snug break-words text-slate-500">
            {subValue}
          </p>
        )}
      </div>
    </div>
  );
}

const DEFAULT_STEPS: WorkflowStep[] = PUBLIC_LEAD_PROCESS_STEPS.map((step, index) => ({
  id: step.status,
  stepOrder: index + 1,
  leadStatus: step.status,
  title: step.title,
  description: step.detail,
  publicMessage: step.detail,
  requiresMedia: false,
}));

function hasInquiryDetailChanged(prev: InquiryDetail | null, next: InquiryDetail): boolean {
  if (!prev) return false;
  return (
    prev.status !== next.status ||
    prev.currentStepOrder !== next.currentStepOrder ||
    prev.updatedAt !== next.updatedAt ||
    prev.siteVisitStatus !== next.siteVisitStatus ||
    prev.siteVisitScheduledAt !== next.siteVisitScheduledAt ||
    prev.rejectionReason !== next.rejectionReason ||
    prev.stepLogs.length !== next.stepLogs.length ||
    prev.mediaAttachments.length !== next.mediaAttachments.length
  );
}

type InquiryFetchResult =
  | { kind: "unauthorized" }
  | { kind: "not-found" }
  | { kind: "error"; message: string }
  | { kind: "ok"; data: InquiryDetail };

async function requestInquiryDetail(id: string): Promise<InquiryFetchResult> {
  try {
    const res = await fetch(`/api/partner/inquiries/${id}`, {
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) {
      return { kind: "unauthorized" };
    }
    if (res.status === 404) {
      return { kind: "not-found" };
    }
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { kind: "error", message: errData.error || "Gagal memuat detail pengajuan" };
    }
    const data = (await res.json()) as InquiryDetail;
    return { kind: "ok", data };
  } catch (err: unknown) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Terjadi kesalahan saat memuat data",
    };
  }
}

export default function InquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const commercialProfile = useCommercialProfile();

  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null);
  const inquiryRef = useRef<InquiryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLightbox, setActiveLightbox] = useState<MediaAttachment | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [liveNotice, setLiveNotice] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const mediaTrigger = useRef<HTMLButtonElement | null>(null);
  const historyTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!liveNotice) return;
    const timer = window.setTimeout(() => setLiveNotice(null), 6_000);
    return () => window.clearTimeout(timer);
  }, [liveNotice]);

  const applyInquiryResult = useCallback(
    (result: InquiryFetchResult, options: { silent: boolean }) => {
      if (result.kind === "unauthorized") {
        router.push(
          "/login?redirect=" +
            encodeURIComponent(`/partner/inquiries/${resolvedParams.id}`)
        );
        return;
      }
      if (result.kind === "not-found") {
        if (options.silent) {
          inquiryRef.current = null;
          setInquiry(null);
          setError("Pengajuan ini telah dihapus atau tidak lagi tersedia.");
        } else {
          setError("Pengajuan tidak ditemukan.");
        }
        return;
      }
      if (result.kind === "error") {
        if (!options.silent) {
          setError(result.message);
        }
        return;
      }

      const data = result.data;
      const changed = options.silent && hasInquiryDetailChanged(inquiryRef.current, data);
      inquiryRef.current = data;
      setInquiry(data);
      setError(null);
      setNowMs(Date.now());
      if (changed) {
        setLiveNotice("Status atau detail pengajuan baru saja diperbarui oleh Tim Komersial.");
        setActiveLightbox((current) =>
          current
            ? (data.mediaAttachments.find((item) => item.id === current.id) ?? null)
            : null
        );
      }
    },
    [resolvedParams.id, router]
  );

  useEffect(() => {
    let cancelled = false;
    async function loadInitial() {
      const result = await requestInquiryDetail(resolvedParams.id);
      if (cancelled) return;
      applyInquiryResult(result, { silent: false });
      setLoading(false);
    }
    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, [applyInquiryResult, resolvedParams.id]);

  useInquiryRealtimeSync({
    enabled: Boolean(resolvedParams.id),
    leadId: resolvedParams.id,
    localEvents: [PARTNER_LEADS_UPDATED_EVENT],
    onSync: async () => {
      const result = await requestInquiryDetail(resolvedParams.id);
      applyInquiryResult(result, { silent: true });
    },
  });

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 animate-spin rounded-full border-2 border-[#c41230] border-t-transparent" />
          <p className="text-sm font-medium text-slate-600">Memuat detail pengajuan sewa</p>
        </div>
      </div>
    );
  }

  if (error || !inquiry) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <ShieldAlert className="size-6" strokeWidth={1.5} />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-[#101828]">Pengajuan Tidak Ditemukan</h2>
          <p className="mt-1 text-sm text-slate-500">{error || "Data pengajuan tidak ditemukan"}</p>
          <Link
            href="/partner/inquiries"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#c41230] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#a60f28]"
          >
            <ArrowLeft className="size-4" strokeWidth={1.5} />
            Kembali ke Pengajuan Sewa
          </Link>
        </div>
      </div>
    );
  }

  const steps: WorkflowStep[] =
    inquiry.workflowVersion?.steps && inquiry.workflowVersion.steps.length > 0
      ? inquiry.workflowVersion.steps
      : DEFAULT_STEPS;

  const totalSteps = steps.length;
  const currentStepOrder = inquiry.currentStepOrder;
  const isRejected = inquiry.status === "REJECTED" || inquiry.status === "CLOSED_LOST";
  const isCompleted = isInquiryFullyCompleted(inquiry.status);
  const activeStep = steps.find((step) => step.stepOrder === currentStepOrder);
  const completedStepsCount = isCompleted
    ? totalSteps
    : Math.max(0, Math.min(currentStepOrder - 1, totalSteps));
  const progressPercent =
    totalSteps > 0 ? Math.round((completedStepsCount / totalSteps) * 100) : 0;

  const activeStepSla =
    !isCompleted && !isRejected && activeStep && nowMs !== null
      ? resolveLeadStepSla({
          stepOrder: activeStep.stepOrder,
          slaHours: activeStep.slaHours ?? null,
          leadCreatedAt: inquiry.createdAt,
          leadStatus: inquiry.status,
          currentStepOrder,
          stepLogs: inquiry.stepLogs.map((log) => ({
            stepOrder: log.stepOrder,
            status: log.status ?? inquiry.status,
            action: log.action,
            createdAt: log.createdAt,
          })),
          now: new Date(nowMs),
        })
      : null;

  const spaceRequirementLabel = formatSpaceRequirementLabel(inquiry.spaceRequirement);

  const space = inquiry.space;
  const station = space?.station ?? null;
  const coverImage = space?.panoramaUrl
    ? getS3ProxyUrl(space.panoramaUrl)
    : "/brand/landing/space-card.jpg";
  const floorLocationText = space
    ? [space.floor ? `Lantai ${space.floor}` : null, space.location?.trim() || null]
        .filter(Boolean)
        .join(" · ") || "-"
    : "-";
  const stationLineLocation = station
    ? [
        station.line ? `LRT ${station.line}` : null,
        station.location?.trim() || null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const resolvedFacilities = (space?.nearbyFacilities ?? []).map((item) => {
    const def = isFacilityIconId(item) ? getFacilityIcon(item) : undefined;
    return { key: item, label: def?.label ?? item, src: def?.src ?? null };
  });
  const hasDimensions = Boolean(
    space?.lengthM && space.lengthM > 0 && space?.widthM && space.widthM > 0
  );
  const createdLabel = formatDateTimeId(inquiry.createdAt);
  const updatedLabel = formatDateTimeId(inquiry.updatedAt);
  const siteVisitStatusText =
    SITE_VISIT_STATUS_LABELS[
      (inquiry.siteVisitStatus || "NONE") as CommercialSiteVisitStatus
    ] ??
    inquiry.siteVisitStatus ??
    "Tidak Mengajukan";
  const siteVisitScheduledText = formatDateTimeId(inquiry.siteVisitScheduledAt);

  const inquirySubject = space
    ? `unit ${space.code} (${space.name})`
    : spaceRequirementLabel || "ruang komersial LRT";
  const waUrl = getWhatsAppUrl(
    commercialProfile.whatsappNumber,
    `Halo Tim Komersial LRT Jabodebek, saya ingin menanyakan status pengajuan sewa ${inquirySubject} dengan kode ${inquiry.inquiryCode || inquiry.id}.`
  );

  const unitDetailRows: { label: string; value: string; subValue?: string | null }[] = [
    {
      label: "Kode Pengajuan",
      value: inquiry.inquiryCode || inquiry.id.slice(0, 8),
    },
    ...(space
      ? [
          {
            label: "Stasiun",
            value: station
              ? station.code
                ? `${station.name} (${station.code})`
                : station.name
              : "-",
            subValue: stationLineLocation || undefined,
          },
          ...(station?.address
            ? [{ label: "Alamat Stasiun", value: station.address }]
            : []),
          { label: "Area & Lantai", value: floorLocationText },
          ...(space.nearestExit
            ? [{ label: "Exit Terdekat", value: space.nearestExit }]
            : []),
          {
            label: "Tipe Unit",
            value: SPACE_TYPE_LABELS[space.type] ?? space.type,
          },
          {
            label: "Luas & Dimensi",
            value: space.leasableAreaDetail || formatArea(space.area),
          },
          ...(space.areaKind
            ? [
                {
                  label: "Kategori Ruang",
                  value:
                    SPACE_AREA_KIND_LABELS[space.areaKind as SpaceAreaKind] ??
                    space.areaKind,
                  subValue: space.parentZone
                    ? `Zona induk: ${space.parentZone.code} — ${space.parentZone.name} (${formatArea(space.parentZone.area)})`
                    : null,
                },
              ]
            : []),
          ...(typeof space.exposure === "number" && space.exposure > 0
            ? [
                {
                  label: "Eksposur Unit",
                  value: `±${space.exposure.toLocaleString("id-ID")} penumpang/hari`,
                },
              ]
            : []),
          ...(typeof station?.dailyPassengers === "number" && station.dailyPassengers > 0
            ? [
                {
                  label: "Trafik Stasiun",
                  value: `±${station.dailyPassengers.toLocaleString("id-ID")} penumpang/hari`,
                },
              ]
            : []),
          ...(space.leasingModel
            ? [{ label: "Model Sewa", value: space.leasingModel }]
            : []),
        ]
      : spaceRequirementLabel
        ? [{ label: "Kebutuhan Ruang", value: spaceRequirementLabel }]
        : []),
  ];

  return (
    <>
      {/* Main Body */}
      <main className="px-4 pt-6 pb-16 md:pr-6 md:pl-56">
        <div className="max-w-7xl">
          {/* Title & Status */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#101828] md:text-[28px]">
              Detail Proses & Dokumentasi
            </h1>
            {(createdLabel || updatedLabel) && (
              <p className="mt-1 text-xs tabular-nums text-slate-500">
                {createdLabel ? `Diajukan ${createdLabel}` : ""}
                {createdLabel && updatedLabel ? " · " : ""}
                {updatedLabel ? `Pembaruan terakhir ${updatedLabel}` : ""}
              </p>
            )}
          </div>
          <div>
            <StatusBadge
              status={inquiry.status}
              currentStepOrder={currentStepOrder}
              activeStepTitle={activeStep?.title}
            />
          </div>
        </div>

        {liveNotice && (
          <div
            role="status"
            aria-live="polite"
            className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900 shadow-xs"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" strokeWidth={1.75} />
              <span>{liveNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setLiveNotice(null)}
              aria-label="Tutup pemberitahuan"
              className="rounded-md p-1 text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-950"
            >
              <X className="size-3.5" strokeWidth={1.75} />
            </button>
          </div>
        )}

        {/* 2-Panel Grid (30% Left : 70% Right on Desktop) */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-10">
          {/* PANEL KIRI (30% / lg:col-span-3) */}
          <div className="space-y-5 lg:col-span-3">
            {/* Card Unit & Foto */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="relative aspect-[16/10] w-full bg-slate-100">
                <Image
                  src={coverImage}
                  alt={space?.name ?? "Unit Komersial"}
                  fill
                  sizes="400px"
                  className="object-cover"
                  unoptimized={coverImage.startsWith("/api/")}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent" />
                <div className="absolute right-4 bottom-3 left-4 text-white">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-block rounded-md bg-slate-900/85 px-2 py-0.5 text-xs font-medium tabular-nums text-white backdrop-blur-[2px]">
                      {space?.code ?? "Pengajuan"}
                    </span>
                    {space?.status && (
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${
                          SPACE_STATUS_BADGE_CLASSES[space.status] ??
                          "bg-slate-700/95 text-white"
                        }`}
                      >
                        {SPACE_STATUS_LABELS[space.status as CommercialSpaceStatus] ??
                          space.status}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1.5 truncate text-base font-semibold text-white">
                    {space?.name ??
                      (spaceRequirementLabel || "Pengajuan Ruang Komersial LRT")}
                  </h2>
                </div>
              </div>

              <div className="p-5">
                <div className="space-y-2.5 text-xs">
                  {unitDetailRows.map((row, idx) => (
                    <InfoRow
                      key={row.label}
                      label={row.label}
                      value={row.value}
                      subValue={row.subValue}
                      isLast={idx === unitDetailRows.length - 1}
                    />
                  ))}
                </div>

                {space ? (
                  <>
                    {resolvedFacilities.length > 0 && (
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <p className="text-xs font-semibold text-slate-700">
                          Fasilitas Terdekat
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {resolvedFacilities.map((facility) => (
                            <span
                              key={facility.key}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-[#f8fafc] px-2.5 py-1 text-xs font-medium text-slate-700"
                            >
                              {facility.src && (
                                <Image
                                  src={facility.src}
                                  alt=""
                                  width={14}
                                  height={14}
                                  className="size-3.5 shrink-0 object-contain"
                                />
                              )}
                              {facility.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {space.description && (
                      <div className="mt-4 rounded-lg border border-slate-200 bg-[#f8fafc] p-3 text-xs leading-relaxed text-slate-600">
                        <p className="mb-1 text-xs font-medium text-[#101828]">
                          Deskripsi Unit
                        </p>
                        <p>{space.description}</p>
                      </div>
                    )}

                    {station?.slug && (
                      <Link
                        href={`/station/${station.slug}?unit=${space.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-[#101828] transition-colors hover:border-slate-400 hover:bg-slate-50"
                      >
                        <Compass className="size-4 text-slate-500" strokeWidth={1.5} />
                        Lihat Unit di 360° Virtual Tour
                      </Link>
                    )}
                  </>
                ) : (
                  <p className="mt-3 rounded-lg border border-slate-200 bg-[#f8fafc] p-3 text-xs leading-relaxed text-slate-600">
                    Pengajuan ini belum terikat ke satu kode unit spesifik stasiun. Tim
                    komersial akan menindaklanjuti alokasi lokasi melalui tahapan proses.
                  </p>
                )}
              </div>
            </div>

            {/* Card Visual Ukuran Unit (3D / 2D) */}
            {space && hasDimensions && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <h3 className="flex items-center gap-2 text-xs font-semibold text-[#101828]">
                  <Ruler className="size-4 text-[#c41230]" strokeWidth={1.5} />
                  Visual Ukuran Unit
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Proporsi dimensi ruang dengan pembanding manusia (±1,7 m)
                </p>
                <div className="mt-3">
                  <ScaledUnitPlan
                    tone="light"
                    lengthM={space.lengthM}
                    widthM={space.widthM}
                    heightM={space.heightM}
                  />
                </div>
              </div>
            )}

            {/* Card Spesifikasi Teknis */}
            {space && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <h3 className="flex items-center gap-2 text-xs font-semibold text-[#101828]">
                  <Layers className="size-4 text-[#c41230]" strokeWidth={1.5} />
                  Spesifikasi Teknis
                </h3>
                <div className="mt-3 space-y-2.5 text-xs">
                  <InfoRow label="Kelistrikan" value={space.powerSupply || "—"} />
                  <InfoRow label="Akses Air" value={space.waterAccess || "—"} />
                  <InfoRow
                    label="AC / Exhaust"
                    value={space.airConditioning || "—"}
                    isLast={!space.fitOutTerms}
                  />
                  {space.fitOutTerms && (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-[#f8fafc] p-3">
                      <p className="text-xs font-medium text-[#101828]">
                        Ketentuan Fit-Out & K3 Stasiun Layang
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {space.fitOutTerms}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Card Data Pengajuan Mitra */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-[#101828]">
                <User className="size-4 text-[#c41230]" strokeWidth={1.5} />
                Data Pemohon & Pengajuan
              </h3>
              <div className="mt-3 space-y-2.5 text-xs">
                <InfoRow label="Brand / Perusahaan" value={inquiry.companyName} />
                <InfoRow label="Nama PIC" value={inquiry.contactName} />
                <InfoRow label="Jenis Usaha" value={inquiry.businessType} />
                <InfoRow
                  label="Kontak"
                  value={inquiry.phone}
                  subValue={inquiry.email}
                />
                {space && spaceRequirementLabel && (
                  <InfoRow label="Kebutuhan Ruang" value={spaceRequirementLabel} />
                )}
                <InfoRow
                  label="Status Site Visit"
                  value={siteVisitStatusText}
                  subValue={
                    siteVisitScheduledText
                      ? `Jadwal: ${siteVisitScheduledText}`
                      : undefined
                  }
                />
                <InfoRow
                  label="Preferensi Survei"
                  value={inquiry.surveyPreference || "Tidak dicantumkan"}
                />
                {inquiry.rdsOfferNo && (
                  <InfoRow label="No. Penawaran RDS" value={inquiry.rdsOfferNo} />
                )}
                {inquiry.baNegotiationNo && (
                  <InfoRow
                    label="No. BA Negosiasi"
                    value={inquiry.baNegotiationNo}
                  />
                )}
                {createdLabel && (
                  <InfoRow
                    label="Tanggal Pengajuan"
                    value={createdLabel}
                    isLast={!updatedLabel && !inquiry.message}
                  />
                )}
                {updatedLabel && (
                  <InfoRow
                    label="Pembaruan Terakhir"
                    value={updatedLabel}
                    isLast={!inquiry.message}
                  />
                )}
                {inquiry.message && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-[#f8fafc] p-3 text-xs leading-relaxed text-slate-600">
                    <span className="font-medium text-[#101828]">
                      Catatan Pengajuan:{" "}
                    </span>
                    {inquiry.message}
                  </div>
                )}
              </div>
            </div>

            {/* Card Hubungi Tim Komersial */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="text-xs font-semibold text-[#101828]">
                Pusat Informasi Komersial
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Hubungi tim kami bila memerlukan penjelasan kelanjutan proses atau berkas
              </p>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#c41230] px-4 text-xs font-medium text-white transition-colors hover:bg-[#a60f28]"
              >
                <Phone className="size-4" strokeWidth={1.5} />
                Hubungi via WhatsApp
              </a>
            </div>
          </div>

          {/* PANEL KANAN (70% / lg:col-span-7) */}
          <div className="space-y-6 lg:col-span-7">
            {/* Header Progres Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs md:p-6">
              <p className="text-xs font-medium text-slate-500">Kemajuan Workflow</p>
              <h2 className="mt-1 text-lg font-semibold text-[#101828]">
                {isCompleted
                  ? "Seluruh Tahapan Telah Selesai"
                  : isRejected
                  ? `Pengajuan Dihentikan pada Tahap ${currentStepOrder}`
                  : `Tahap ${currentStepOrder} dari ${totalSteps}: ${
                      activeStep?.title || "Sedang Berlangsung"
                    }`}
              </h2>
              <div className="mt-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>
                    <strong className="font-semibold text-slate-800 tabular-nums">
                      {completedStepsCount} dari {totalSteps}
                    </strong>{" "}
                    tahapan selesai
                  </span>
                  <span>
                    <strong className="font-semibold text-slate-800 tabular-nums">
                      {inquiry.mediaAttachments.length}
                    </strong>{" "}
                    dokumen resmi tersedia
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 ${
                      isRejected
                        ? "bg-rose-500"
                        : isCompleted
                        ? "bg-emerald-600"
                        : "bg-[#c41230]"
                    }`}
                    style={{
                      width: `${isCompleted ? 100 : Math.max(progressPercent, 6)}%`,
                    }}
                  />
                </div>
              </div>

              {isRejected && (
                <div className="mt-5 flex gap-3 rounded-lg border border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-900">
                  <XCircle className="mt-0.5 size-4 shrink-0 text-rose-600" strokeWidth={1.5} />
                  <div>
                    <p className="font-semibold text-[#101828]">Pengajuan Tidak Dapat Dilanjutkan</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-700">
                      {inquiry.rejectionReason ||
                        "Mohon maaf, pengajuan sewa ini belum dapat disetujui. Anda dapat mengajukan unit lain atau menghubungi tim komersial."}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {!isCompleted && !isRejected && activeStep && activeStepSla?.health === "BREACHED" && (
              <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between md:px-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50/80 text-[#c41230]">
                    <AlertTriangle className="size-4" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#101828]">
                        Tindak Lanjut SLA Melewati Target Waktu
                      </p>
                      <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50/80 px-2 py-0.5 text-xs font-medium tabular-nums text-[#a60f28]">
                        {activeStepSla.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Tahap {currentStepOrder}: {activeStep.title} telah melampaui batas target respons. Anda dapat langsung menghubungi Tim Komersial LRT Jabodebek untuk percepatan konfirmasi.
                    </p>
                  </div>
                </div>
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-medium text-[#101828] transition-colors hover:border-slate-400 hover:bg-slate-50"
                >
                  <Phone className="size-4 text-[#c41230]" strokeWidth={1.5} />
                  Hubungi Tim Komersial
                </a>
              </div>
            )}

            {/* Stepper Timeline Container */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs md:p-6">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-[#101828]">
                  Alur Tahapan & Dokumentasi Resmi
                </h2>
                {inquiry.stepLogs.length > 0 && (
                  <button
                    ref={historyTriggerRef}
                    type="button"
                    onClick={() => setHistoryOpen(true)}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-[#101828]"
                  >
                    <History className="size-4 text-[#c41230]" strokeWidth={1.5} />
                    <span>Riwayat Aktivitas</span>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-slate-700">
                      {inquiry.stepLogs.length}
                    </span>
                  </button>
                )}
              </div>

              <div className="relative">
                {steps.map((step, idx) => {
                  const isLast = idx === steps.length - 1;
                  const stepOrder = step.stepOrder;

                  const isPast = isCompleted || stepOrder < currentStepOrder;
                  const isCurrent = !isCompleted && stepOrder === currentStepOrder;
                  const isFuture = !isCompleted && stepOrder > currentStepOrder;

                  const stepLog = inquiry.stepLogs?.findLast((l) => l.stepOrder === stepOrder);
                  const stepMedia = inquiry.mediaAttachments?.filter(
                    (m) => m.stepOrder === stepOrder && m.isVisibleToMitra
                  );

                  return (
                    <PartnerStepCard
                      key={step.id || step.stepOrder}
                      step={step}
                      isLast={isLast}
                      isPast={isPast}
                      isCurrent={isCurrent}
                      isFuture={isFuture}
                      isRejected={isRejected}
                      stepLog={stepLog}
                      stepMedia={stepMedia}
                      legacyRdsOfferNo={inquiry.rdsOfferNo}
                      legacyBaNegotiationNo={inquiry.baNegotiationNo}
                      legacySiteVisitStatus={inquiry.siteVisitStatus}
                      legacySiteVisitScheduledAt={inquiry.siteVisitScheduledAt}
                      onPreviewMedia={(media, triggerEl) => {
                        mediaTrigger.current = triggerEl;
                        setActiveLightbox(media);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        </div>
      </main>

      {/* Drawer Riwayat Aktivitas Pengajuan */}
      <StepHistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        triggerRef={historyTriggerRef}
        inquiryCode={inquiry.inquiryCode || inquiry.id.slice(0, 8)}
        logs={inquiry.stepLogs}
      />

      {/* Lightbox Modal Pratinjau Dokumen Terpadu */}
      {activeLightbox && (
        <DocumentPreviewModal
          documentItem={activeLightbox}
          returnFocusRef={mediaTrigger}
          onClose={() => setActiveLightbox(null)}
        />
      )}
    </>
  );
}

/**
 * Slide-over drawer kanan yang menampilkan log aktivitas lengkap pengajuan
 * (urutan terbaru di atas) tanpa memperpanjang halaman utama alur tahapan.
 */
function StepHistoryDrawer({
  open,
  onOpenChange,
  triggerRef,
  inquiryCode,
  logs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  inquiryCode: string;
  logs: StepLog[];
}) {
  if (!open) return null;

  const orderedLogs = [...logs].reverse();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/45" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
          className="fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-xl focus:outline-none"
        >
          <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-black/10 bg-[#c41230] px-5 text-white">
            <div className="flex min-w-0 items-center gap-2.5">
              <History className="size-4 shrink-0 text-white" strokeWidth={1.75} />
              <div className="min-w-0">
                <DialogPrimitive.Title className="truncate text-sm font-semibold leading-tight text-white">
                  Riwayat Aktivitas Pengajuan
                </DialogPrimitive.Title>
                <p className="truncate text-xs leading-tight text-white/85 tabular-nums">
                  {inquiryCode} · {logs.length} catatan aktivitas
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              aria-label="Tutup riwayat aktivitas"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <ol className="space-y-3">
              {orderedLogs.map((log) => {
                const actionText =
                  STEP_LOG_ACTION_LABELS[log.action] ?? log.action;
                const toLabel = leadStatusLabel(log.status);
                const timeLabel = formatDateTimeId(log.createdAt);
                const terminalSuffix =
                  log.status === "CLOSED_WON"
                    ? " · Pengajuan Selesai"
                    : log.status === "CLOSED_LOST"
                      ? " · Pengajuan Dihentikan"
                      : "";
                const visitStatusText =
                  log.visitStatus && log.visitStatus !== "NONE"
                    ? SITE_VISIT_STATUS_LABELS[
                        log.visitStatus as CommercialSiteVisitStatus
                      ] ?? log.visitStatus
                    : null;
                const visitScheduledText = formatDateTimeId(log.scheduledAt);
                const trimmedNotes = log.notes?.trim();

                return (
                  <li key={log.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {actionText}
                      </span>
                      {timeLabel && (
                        <span className="text-xs tabular-nums text-slate-500">
                          {timeLabel}
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-sm font-medium text-[#101828]">
                      Tahap {log.stepOrder}:{" "}
                      {log.pipelineStep?.title || toLabel || "Proses"}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-500">
                      Oleh{" "}
                      <span className="font-medium text-slate-700">
                        {log.performedBy}
                      </span>
                      {terminalSuffix}
                    </p>

                    {(log.documentNumber || visitStatusText || visitScheduledText) && (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {log.documentNumber && (
                          <span className="rounded-md border border-slate-200 bg-[#f8fafc] px-2 py-1 tabular-nums text-slate-700">
                            {log.pipelineStep?.documentNumberLabel || "No. Dokumen"}:{" "}
                            {log.documentNumber}
                          </span>
                        )}
                        {(visitStatusText || visitScheduledText) && (
                          <span className="rounded-md border border-slate-200 bg-[#f8fafc] px-2 py-1 tabular-nums text-slate-700">
                            Site Visit: {visitStatusText ?? "Terjadwal"}
                            {visitScheduledText ? ` (${visitScheduledText})` : ""}
                          </span>
                        )}
                      </div>
                    )}

                    {trimmedNotes && (
                      <blockquote className="mt-2.5 rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-xs leading-relaxed text-slate-700">
                        <span className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-[#101828]">
                          <MessageSquareQuote
                            className="size-3.5 text-[#c41230]"
                            strokeWidth={1.5}
                          />
                          {getStepNoteLabel(log.action, log.performedBy)}
                        </span>
                        <p>{trimmedNotes}</p>
                      </blockquote>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function StatusBadge({
  status,
  currentStepOrder,
  activeStepTitle,
}: {
  status: string;
  currentStepOrder: number;
  activeStepTitle?: string;
}) {
  if (isInquiryFullyCompleted(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="size-4" strokeWidth={1.5} />
        Pengajuan Selesai
      </span>
    );
  }
  if (status === "REJECTED" || status === "CLOSED_LOST") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
        <XCircle className="size-4" strokeWidth={1.5} />
        Pengajuan Ditolak
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50/80 px-2.5 py-1 text-xs font-medium text-[#a60f28]">
      <Clock className="size-4" strokeWidth={1.5} />
      {activeStepTitle
        ? `Tahap ${currentStepOrder}: ${activeStepTitle}`
        : `Diproses: Tahap ${currentStepOrder}`}
    </span>
  );
}
