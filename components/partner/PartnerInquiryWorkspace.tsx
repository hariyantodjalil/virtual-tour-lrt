"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Eye,
  FileText,
  History,
  LifeBuoy,
  MessageSquareQuote,
  Phone,
  User,
  X,
  XCircle,
} from "lucide-react";
import PartnerStepCard, {
  type PartnerMediaAttachment,
  type PartnerStepLog,
  type PartnerWorkflowStep,
} from "@/components/partner/PartnerStepCard";
import DocumentPreviewModal from "@/components/pipeline/DocumentPreviewModal";
import { InquirySiteVisit } from "@/components/partner/InquiryTimeline";
import { inquirySiteVisitStep } from "@/lib/inquiry-workflow";
import { resolveDocumentPreview } from "@/lib/document-preview";
import { getFacilityIcon, isFacilityIconId } from "@/lib/facility-icons";
import {
  LEAD_STATUS_LABELS,
  PUBLIC_LEAD_PROCESS_STEPS,
  SITE_VISIT_STATUS_LABELS,
  SPACE_STATUS_LABELS,
  SPACE_TYPE_LABELS,
  formatSpaceRequirementLabel,
  isInquiryFullyCompleted,
  type CommercialLeadStatus,
  type CommercialSiteVisitStatus,
  type CommercialSpaceStatus,
} from "@/lib/commercial-pipeline";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import {
  SPACE_AREA_KIND_LABELS,
  formatArea,
  type SpaceAreaKind,
} from "@/lib/unit-dimensions";
import { getWhatsAppUrl } from "@/lib/utils";

export type PartnerInquiryDetail = {
  id: string;
  inquiryCode: string | null;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  businessType: string;
  spaceRequirement: string | null;
  message: string | null;
  status: string;
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
    areaKind?: string | null;
    exposure?: number;
    parentZone?: { id: string; code: string; name: string; area: number } | null;
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
    version?: number | null;
    title?: string | null;
    steps: PartnerWorkflowStep[];
  } | null;
  stepLogs: PartnerStepLog[];
  mediaAttachments: PartnerMediaAttachment[];
};

type View = "stages" | "unit" | "documents" | "help";

const STEP_LOG_ACTION_LABELS: Record<string, string> = {
  SUBMITTED: "Pengajuan Dikirim",
  STATUS_CHANGED: "Perubahan Tahap",
  COMPLETED: "Tahap Selesai",
  REJECTED: "Pengajuan Dihentikan",
  PARTNER_NOTE: "Pesan untuk Mitra",
  SITE_VISIT_REQUESTED: "Permintaan Site Visit",
  PAYMENT_VERIFIED: "Pembayaran Terverifikasi",
  IMPORTED: "Tercatat Sistem",
};

const SPACE_STATUS_BADGE: Record<string, string> = {
  TERSEDIA: "bg-emerald-600 text-white",
  RESERVED: "bg-amber-500 text-amber-950",
  FIT_OUT: "bg-sky-600 text-white",
  TERISI: "bg-slate-800 text-white",
  MAINTENANCE: "bg-rose-600 text-white",
};

const tabClass = (active: boolean) =>
  `inline-flex min-h-11 items-center justify-center gap-2 border-b-2 px-1 py-3 text-xs sm:justify-start sm:text-sm focus-visible:outline-2 focus-visible:outline-[#c41230] ${
    active
      ? "border-[#c41230] font-semibold text-[#c41230]"
      : "border-transparent text-slate-500 hover:text-[#c41230]"
  }`;

const chipClass =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#c41230] focus-visible:outline-offset-2";

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

function Fact({
  label,
  value,
  subValue,
}: {
  label: string;
  value: string;
  subValue?: string | null;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-[#101828]">
        {value}
        {subValue ? (
          <span className="mt-0.5 block break-words text-xs font-normal text-slate-500">
            {subValue}
          </span>
        ) : null}
      </dd>
    </div>
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
        Pengajuan selesai
      </span>
    );
  }
  if (status === "REJECTED" || status === "CLOSED_LOST") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
        <XCircle className="size-4" strokeWidth={1.5} />
        Pengajuan dihentikan
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50/80 px-2.5 py-1 text-xs font-medium text-[#a60f28]">
      <Clock className="size-4" strokeWidth={1.5} />
      {activeStepTitle
        ? `Tahap ${currentStepOrder}: ${activeStepTitle}`
        : `Diproses · tahap ${currentStepOrder}`}
    </span>
  );
}

export default function PartnerInquiryWorkspace({
  inquiry,
  whatsappNumber,
  liveNotice,
  onDismissNotice,
}: {
  inquiry: PartnerInquiryDetail;
  whatsappNumber: string;
  liveNotice?: string | null;
  onDismissNotice?: () => void;
}) {
  const steps: PartnerWorkflowStep[] =
    inquiry.workflowVersion?.steps?.length
      ? inquiry.workflowVersion.steps
      : PUBLIC_LEAD_PROCESS_STEPS.map((step, index) => ({
          id: step.status,
          stepOrder: index + 1,
          leadStatus: step.status,
          title: step.title,
          description: step.detail,
          publicMessage: step.detail,
          requiresMedia: index === 2 || index === 3 || index === 4,
        }));

  const totalSteps = steps.length;
  const currentStepOrder = inquiry.currentStepOrder;
  const isRejected =
    inquiry.status === "REJECTED" || inquiry.status === "CLOSED_LOST";
  const isCompleted = isInquiryFullyCompleted(inquiry.status);
  const activeIndex = Math.max(
    0,
    Math.min(currentStepOrder - 1, totalSteps - 1)
  );
  const completedCount = isCompleted
    ? totalSteps
    : Math.max(0, Math.min(currentStepOrder - 1, totalSteps));

  const [view, setView] = useState<View>("stages");
  const [selected, setSelected] = useState(activeIndex);
  useEffect(() => {
    setSelected((current) =>
      isCompleted ? current : Math.min(current, activeIndex)
    );
  }, [activeIndex, isCompleted, inquiry.id, inquiry.workflowVersion?.id]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeLightbox, setActiveLightbox] =
    useState<PartnerMediaAttachment | null>(null);
  const mediaTrigger = useRef<HTMLButtonElement | null>(null);
  const historyTriggerRef = useRef<HTMLButtonElement | null>(null);

  const step = steps[selected] ?? steps[0];
  const visitStep = inquirySiteVisitStep(steps);
  const stepOrder = step?.stepOrder ?? selected + 1;
  const isPast = isCompleted || stepOrder < currentStepOrder;
  const isCurrent = !isCompleted && stepOrder === currentStepOrder;
  const isFuture = !isCompleted && stepOrder > currentStepOrder;

  const stepLog = inquiry.stepLogs
    .filter((log) => log.stepOrder === stepOrder)
    .at(-1);
  const stepMedia = inquiry.mediaAttachments.filter(
    (media) => media.stepOrder === stepOrder && media.isVisibleToMitra
  );

  const space = inquiry.space;
  const station = space?.station ?? null;
  const spaceRequirementLabel = formatSpaceRequirementLabel(
    inquiry.spaceRequirement
  );
  const coverImage = space?.panoramaUrl
    ? getS3ProxyUrl(space.panoramaUrl)
    : "/brand/landing/space-card.jpg";
  const createdLabel = formatDateTimeId(inquiry.createdAt);
  const updatedLabel = formatDateTimeId(inquiry.updatedAt);

  const waUrl = useMemo(() => {
    const subject = space
      ? `unit ${space.code} (${space.name})`
      : spaceRequirementLabel || "ruang komersial LRT";
    return getWhatsAppUrl(
      whatsappNumber,
      `Halo Tim Komersial LRT Jabodebek, saya ingin menanyakan status pengajuan sewa ${subject} dengan kode ${inquiry.inquiryCode || inquiry.id}.`
    );
  }, [
    inquiry.id,
    inquiry.inquiryCode,
    space,
    spaceRequirementLabel,
    whatsappNumber,
  ]);

  const facilities = (space?.nearbyFacilities ?? []).map((item) => {
    const def = isFacilityIconId(item) ? getFacilityIcon(item) : undefined;
    return { key: item, label: def?.label ?? item, src: def?.src ?? null };
  });

  return (
    <>
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium tabular-nums text-slate-500">
              {inquiry.inquiryCode || inquiry.id.slice(0, 8)}
              {createdLabel ? ` · Diajukan ${createdLabel}` : ""}
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-[#101828] md:text-2xl">
              Detail pengajuan
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {isRejected
                ? "Pengajuan dihentikan. Dokumen yang dibagikan tetap dapat dibaca."
                : isCompleted
                  ? "Seluruh tahap selesai. Pantau dokumen dan periode sewa di sini."
                  : `${completedCount} dari ${totalSteps} tahap selesai · lanjutkan pantau ${steps[activeIndex]?.title ?? "proses"}.`}
            </p>
          </div>
          <StatusBadge
            status={inquiry.status}
            currentStepOrder={currentStepOrder}
            activeStepTitle={steps.find((item) => item.stepOrder === currentStepOrder)?.title}
          />
        </div>

        {isRejected && inquiry.rejectionReason ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
            Alasan: {inquiry.rejectionReason}
          </p>
        ) : null}

        {liveNotice ? (
          <div
            role="status"
            className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-900"
          >
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600" strokeWidth={1.75} />
              {liveNotice}
            </span>
            {onDismissNotice ? (
              <button
                type="button"
                onClick={onDismissNotice}
                aria-label="Tutup pemberitahuan"
                className="rounded-md p-1 text-emerald-700 hover:bg-emerald-100"
              >
                <X className="size-3.5" strokeWidth={1.75} />
              </button>
            ) : null}
          </div>
        ) : null}

        <nav
          aria-label="Bagian detail pengajuan"
          className="mt-5 grid grid-cols-2 gap-1 border-b border-slate-200 sm:flex sm:flex-wrap sm:gap-x-5"
        >
          {(
            [
              { key: "stages", label: "Tahapan", short: "Tahapan", icon: CalendarClock },
              { key: "unit", label: "Unit & pemohon", short: "Unit", icon: Building2 },
              { key: "documents", label: "Semua dokumen", short: "Dokumen", icon: FileText },
              { key: "help", label: "Bantuan", short: "Bantuan", icon: LifeBuoy },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={view === item.key}
              onClick={() => setView(item.key)}
              className={tabClass(view === item.key)}
            >
              <item.icon aria-hidden className="hidden size-4 sm:block" />
              <span className="sm:hidden">{item.short}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </nav>

        <div
          className={
            view === "stages"
              ? "mt-5 grid min-w-0 gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]"
              : "mt-5 min-w-0"
          }
        >
          {view === "stages" ? (
            <>
              <div className="lg:hidden">
                <label
                  htmlFor={`partner-stage-${inquiry.id}`}
                  className="mb-2 block text-xs font-medium text-slate-500"
                >
                  Lihat tahap
                </label>
                <select
                  id={`partner-stage-${inquiry.id}`}
                  value={selected}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (!isCompleted && next > activeIndex) return;
                    setSelected(next);
                  }}
                  className="flex h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus-visible:border-[#c41230] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c41230]/25"
                >
                  {steps.map((item, index) => {
                    const locked = !isCompleted && index > activeIndex;
                    return (
                      <option
                        key={item.id || item.stepOrder}
                        value={index}
                        disabled={locked}
                      >
                        {index + 1}. {item.title}
                        {index < completedCount || isCompleted ? " · selesai" : ""}
                        {index === activeIndex && !isCompleted && !isRejected
                          ? " · berlangsung"
                          : ""}
                        {locked ? " · terkunci" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              <nav aria-label="Tahapan pengajuan" className="hidden lg:block">
                <ol className="space-y-1">
                  {steps.map((item, index) => {
                    const done = isCompleted || index < completedCount;
                    const current = !isCompleted && index === activeIndex;
                    const locked = !isCompleted && index > activeIndex;
                    return (
                      <li key={item.id || item.stepOrder}>
                        <button
                          type="button"
                          disabled={locked}
                          aria-current={selected === index ? "step" : undefined}
                          aria-disabled={locked || undefined}
                          title={
                            locked
                              ? "Tahap ini terbuka setelah tahap sebelumnya selesai"
                              : undefined
                          }
                          onClick={() => {
                            if (locked) return;
                            setSelected(index);
                          }}
                          className={`flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-[#c41230] disabled:cursor-not-allowed disabled:opacity-45 ${
                            locked
                              ? "text-slate-400"
                              : selected === index
                                ? "bg-rose-50 text-[#c41230]"
                                : "text-slate-500 hover:bg-slate-50"
                          }`}
                        >
                          <span
                            aria-hidden
                            className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${
                              done
                                ? "bg-emerald-50 text-emerald-700"
                                : locked
                                  ? "border border-dashed border-slate-200 text-slate-400"
                                  : selected === index
                                    ? "bg-[#c41230] text-white"
                                    : "border border-slate-200"
                            }`}
                          >
                            {done ? <Check className="size-3.5" /> : index + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">
                              {item.title}
                            </span>
                            {current ? (
                              <span className="mt-0.5 block text-xs font-medium text-[#c41230]">
                                Sedang berlangsung
                              </span>
                            ) : null}
                            {locked ? (
                              <span className="mt-0.5 block text-xs text-slate-400">
                                Belum dibuka
                              </span>
                            ) : null}
                            {isRejected && index === activeIndex ? (
                              <span className="mt-0.5 block text-xs text-slate-500">
                                Tidak dilanjutkan
                              </span>
                            ) : null}
                          </span>
                          {selected === index && !locked ? (
                            <ChevronRight
                              aria-hidden
                              className="size-3.5 shrink-0"
                            />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>
            </>
          ) : null}

          <div className="min-w-0 space-y-5">
            {view === "stages" ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                  <header>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-500">
                        Tahap {selected + 1} dari {totalSteps}
                      </span>
                      {isPast ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                          <Check className="size-3.5" aria-hidden />
                          Selesai
                        </span>
                      ) : isCurrent && !isRejected ? (
                        <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-[#c41230]">
                          Sedang berlangsung
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          {isRejected ? "Tidak dilanjutkan" : "Menunggu"}
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1 text-lg font-semibold text-[#101828]">
                      {step?.title}
                    </h2>
                  </header>
                  {inquiry.stepLogs.length > 0 ? (
                    <button
                      ref={historyTriggerRef}
                      type="button"
                      onClick={() => setHistoryOpen(true)}
                      className={chipClass}
                    >
                      <History className="size-3.5 text-[#c41230]" aria-hidden />
                      Riwayat
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 tabular-nums text-slate-700">
                        {inquiry.stepLogs.length}
                      </span>
                    </button>
                  ) : null}
                </div>

                {visitStep && step?.stepOrder === visitStep.stepOrder ? (
                  <InquirySiteVisit
                    id={inquiry.id}
                    status={inquiry.status}
                    siteVisitStatus={inquiry.siteVisitStatus ?? "NONE"}
                    scheduledAt={inquiry.siteVisitScheduledAt ?? null}
                    preference={inquiry.surveyPreference ?? null}
                    eligible={!isCompleted && !isRejected && currentStepOrder <= visitStep.stepOrder}
                  />
                ) : null}

                {step ? (
                  <PartnerStepCard
                    step={step}
                    isLast
                    embedded
                    isPast={isPast}
                    isCurrent={isCurrent}
                    isFuture={isFuture}
                    isRejected={isRejected && isCurrent}
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
                ) : null}
              </>
            ) : null}

            {view === "unit" ? (
              <div className="space-y-6">
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="relative aspect-[16/9] bg-slate-100">
                    <Image
                      src={coverImage}
                      alt={space?.name ?? "Unit komersial"}
                      fill
                      sizes="800px"
                      className="object-cover"
                      unoptimized={coverImage.startsWith("/api/")}
                    />
                  </div>
                  <div className="space-y-4 p-4 md:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-medium tabular-nums text-white">
                            {space?.code ?? inquiry.inquiryCode ?? "Pengajuan"}
                          </span>
                          {space?.status ? (
                            <span
                              className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                                SPACE_STATUS_BADGE[space.status] ??
                                "bg-slate-700 text-white"
                              }`}
                            >
                              {SPACE_STATUS_LABELS[
                                space.status as CommercialSpaceStatus
                              ] ?? space.status}
                            </span>
                          ) : null}
                        </div>
                        <h2 className="mt-2 text-base font-semibold text-[#101828]">
                          {space?.name ??
                            spaceRequirementLabel ??
                            "Pengajuan ruang komersial"}
                        </h2>
                      </div>
                      {station?.slug && space ? (
                        <Link
                          href={`/station/${station.slug}?unit=${space.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={chipClass}
                        >
                          <Compass className="size-3.5" aria-hidden />
                          Virtual tour
                        </Link>
                      ) : null}
                    </div>

                    <dl className="grid gap-4 sm:grid-cols-2">
                      {space ? (
                        <>
                          <Fact
                            label="Stasiun"
                            value={
                              station
                                ? station.code
                                  ? `${station.name} (${station.code})`
                                  : station.name
                                : "—"
                            }
                            subValue={
                              [station?.line ? `LRT ${station.line}` : null, station?.location]
                                .filter(Boolean)
                                .join(" · ") || null
                            }
                          />
                          <Fact
                            label="Area & lantai"
                            value={
                              [space.floor ? `Lantai ${space.floor}` : null, space.location]
                                .filter(Boolean)
                                .join(" · ") || "—"
                            }
                          />
                          <Fact
                            label="Tipe unit"
                            value={SPACE_TYPE_LABELS[space.type] ?? space.type}
                          />
                          <Fact
                            label="Luas"
                            value={
                              space.leasableAreaDetail || formatArea(space.area)
                            }
                          />
                          {space.areaKind ? (
                            <Fact
                              label="Kategori ruang"
                              value={
                                SPACE_AREA_KIND_LABELS[
                                  space.areaKind as SpaceAreaKind
                                ] ?? space.areaKind
                              }
                              subValue={
                                space.parentZone
                                  ? `Zona induk: ${space.parentZone.code}`
                                  : null
                              }
                            />
                          ) : null}
                          {space.nearestExit ? (
                            <Fact label="Exit terdekat" value={space.nearestExit} />
                          ) : null}
                          {space.leasingModel ? (
                            <Fact label="Model sewa" value={space.leasingModel} />
                          ) : null}
                        </>
                      ) : (
                        <Fact
                          label="Kebutuhan ruang"
                          value={spaceRequirementLabel || "Belum terikat unit"}
                        />
                      )}
                    </dl>

                    {space ? (
                      <dl className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
                        <Fact label="Kelistrikan" value={space.powerSupply || "—"} />
                        <Fact label="Akses air" value={space.waterAccess || "—"} />
                        <Fact
                          label="AC / exhaust"
                          value={space.airConditioning || "—"}
                        />
                      </dl>
                    ) : null}

                    {facilities.length > 0 ? (
                      <div className="border-t border-slate-100 pt-4">
                        <p className="text-xs font-medium text-slate-500">
                          Fasilitas terdekat
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {facilities.map((facility) => (
                            <span
                              key={facility.key}
                              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                            >
                              {facility.src ? (
                                <Image
                                  src={facility.src}
                                  alt=""
                                  width={14}
                                  height={14}
                                  className="size-3.5 object-contain"
                                />
                              ) : null}
                              {facility.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {space?.fitOutTerms || space?.description ? (
                      <div className="space-y-3 border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-600">
                        {space.description ? <p>{space.description}</p> : null}
                        {space.fitOutTerms ? (
                          <p>
                            <span className="font-medium text-[#101828]">
                              Fit-out:{" "}
                            </span>
                            {space.fitOutTerms}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 md:p-5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-[#101828]">
                    <User className="size-4 text-[#c41230]" aria-hidden />
                    Data pemohon
                  </h3>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Fact label="Brand / perusahaan" value={inquiry.companyName} />
                    <Fact label="Nama PIC" value={inquiry.contactName} />
                    <Fact label="Jenis usaha" value={inquiry.businessType} />
                    <Fact
                      label="Kontak"
                      value={inquiry.phone}
                      subValue={inquiry.email}
                    />
                    <Fact
                      label="Site visit"
                      value={
                        SITE_VISIT_STATUS_LABELS[
                          (inquiry.siteVisitStatus ||
                            "NONE") as CommercialSiteVisitStatus
                        ] ?? inquiry.siteVisitStatus ?? "Tidak mengajukan"
                      }
                      subValue={formatDateTimeId(inquiry.siteVisitScheduledAt)}
                    />
                    {createdLabel ? (
                      <Fact label="Tanggal pengajuan" value={createdLabel} />
                    ) : null}
                    {updatedLabel ? (
                      <Fact label="Pembaruan terakhir" value={updatedLabel} />
                    ) : null}
                  </dl>
                  {inquiry.message ? (
                    <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-relaxed text-slate-700">
                      <span className="font-medium text-[#101828]">
                        Catatan pengajuan:{" "}
                      </span>
                      {inquiry.message}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {view === "documents" ? (
              <div className="space-y-3">
                <header className="border-b border-slate-200 pb-4">
                  <h2 className="text-lg font-semibold text-[#101828]">
                    Semua dokumen
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Berkas resmi yang dibagikan tim komersial untuk pengajuan ini.
                  </p>
                </header>
                {inquiry.mediaAttachments.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Belum ada dokumen yang dibagikan.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {inquiry.mediaAttachments.map((media) => {
                      const resolved = resolveDocumentPreview(
                        media.mediaLink,
                        media.mediaTitle
                      );
                      return (
                        <li
                          key={media.id}
                          className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 items-start gap-2.5">
                            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                              <FileText className="size-4" aria-hidden />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#101828]">
                                {media.mediaTitle}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                                <span>Tahap {media.stepOrder}</span>
                                {media.documentNumber ? (
                                  <span className="font-medium text-slate-700">
                                    No. {media.documentNumber}
                                  </span>
                                ) : null}
                                <span className="tabular-nums">
                                  {formatDateTimeId(media.createdAt)}
                                </span>
                                <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-medium text-slate-600">
                                  {resolved.formatLabel ?? "Dokumen"}
                                </span>
                                {media.verifiedAt ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                                    <CheckCircle2
                                      className="size-3"
                                      strokeWidth={1.5}
                                    />
                                    Terverifikasi
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            className={chipClass}
                            onClick={(event) => {
                              mediaTrigger.current = event.currentTarget;
                              setActiveLightbox(media);
                            }}
                          >
                            <Eye className="size-3.5" aria-hidden />
                            Pratinjau
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}

            {view === "help" ? (
              <div className="max-w-xl space-y-4">
                <header className="border-b border-slate-200 pb-4">
                  <h2 className="text-lg font-semibold text-[#101828]">
                    Bantuan
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Hubungi tim komersial bila perlu penjelasan tahap atau berkas.
                  </p>
                </header>
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#c41230] px-4 text-sm font-medium text-white hover:bg-[#a60f28]"
                >
                  <Phone className="size-4" aria-hidden />
                  Hubungi via WhatsApp
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <StepHistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        triggerRef={historyTriggerRef}
        inquiryCode={inquiry.inquiryCode || inquiry.id.slice(0, 8)}
        logs={inquiry.stepLogs}
      />

      {activeLightbox ? (
        <DocumentPreviewModal
          documentItem={activeLightbox}
          returnFocusRef={mediaTrigger}
          onClose={() => setActiveLightbox(null)}
        />
      ) : null}
    </>
  );
}

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
  logs: PartnerStepLog[];
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
            <div className="min-w-0">
              <DialogPrimitive.Title className="truncate text-sm font-semibold text-white">
                Riwayat aktivitas
              </DialogPrimitive.Title>
              <p className="truncate text-xs text-white/85 tabular-nums">
                {inquiryCode} · {logs.length} catatan
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex size-9 items-center justify-center rounded-lg border border-white/25 bg-white/10 text-white hover:bg-white/20"
              aria-label="Tutup riwayat"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <ol className="space-y-3">
              {orderedLogs.map((log) => {
                const trimmedNotes = log.notes?.trim();
                return (
                  <li
                    key={log.id}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {STEP_LOG_ACTION_LABELS[log.action] ?? log.action}
                      </span>
                      <span className="text-xs tabular-nums text-slate-500">
                        {formatDateTimeId(log.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-[#101828]">
                      Tahap {log.stepOrder}:{" "}
                      {log.pipelineStep?.title ||
                        leadStatusLabel(log.status) ||
                        "Proses"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Oleh{" "}
                      <span className="font-medium text-slate-700">
                        {log.performedBy}
                      </span>
                    </p>
                    {trimmedNotes ? (
                      <blockquote className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700">
                        <span className="mb-1 inline-flex items-center gap-1.5 font-medium text-[#101828]">
                          <MessageSquareQuote
                            className="size-3.5 text-[#c41230]"
                            strokeWidth={1.5}
                          />
                          Pesan tahap
                        </span>
                        <p>{trimmedNotes}</p>
                      </blockquote>
                    ) : null}
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
