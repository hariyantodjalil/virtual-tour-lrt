"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Compass,
  FileText,
  Glasses,
  MapPin,
  Phone,
  Plus,
  X,
  XCircle,
} from "lucide-react";
import { getWhatsAppUrl } from "@/lib/utils";
import {
  ACTIVE_LEAD_STATUSES,
  PUBLIC_LEAD_PROCESS_STEPS,
  formatSpaceRequirementLabel,
  isInquiryFullyCompleted,
} from "@/lib/commercial-pipeline";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import { useCommercialProfile } from "@/components/commercial/CommercialProfileProvider";
import PartnerSectionHeader from "@/components/partner/PartnerSectionHeader";

export type WorkflowStep = {
  id: string;
  stepOrder: number;
  title: string;
  description: string | null;
  publicMessage: string | null;
  requiresMedia: boolean;
};

export type WorkflowVersion = {
  id: string;
  version: number;
  title: string;
  steps: WorkflowStep[];
};

export type PartnerLead = {
  id: string;
  inquiryCode?: string | null;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  businessType: string;
  spaceRequirement?: string | null;
  status: string; // "ACTIVE" | "COMPLETED" | "REJECTED" | LeadStatus DB
  currentStepOrder: number;
  rejectionReason?: string | null;
  message: string | null;
  notes?: string | null;
  createdAt: string;
  workflowVersion?: WorkflowVersion | null;
  _count?: {
    mediaAttachments: number;
  };
  space: {
    id: string;
    code: string;
    name: string;
    type: string;
    area: number;
    lengthM?: number | null;
    widthM?: number | null;
    heightM?: number | null;
    areaKind?: string | null;
    exposure?: number;
    floor: string;
    location: string;
    leasableAreaDetail?: string | null;
    leasingModel?: string | null;
    fitOutTerms?: string | null;
    panoramaUrl: string | null;
    station: { name: string; slug: string };
  } | null;
};

type RecommendedSpace = {
  id: string;
  code: string;
  name: string;
  type: string;
  area: number;
  lengthM?: number | null;
  widthM?: number | null;
  heightM?: number | null;
  areaKind?: string | null;
  exposure?: number;
  floor: string;
  location: string;
  leasingModel?: string | null;
  panoramaUrl: string | null;
  station: { name: string; slug: string };
};

type FilterTab = "semua" | "diproses" | "disetujui" | "ditolak";

type StepLite = {
  stepOrder: number;
  title: string;
};

const COLLAPSED_WINDOW_SIZE = 5;

const DEFAULT_STEPS: StepLite[] = PUBLIC_LEAD_PROCESS_STEPS.map((step, index) => ({
  stepOrder: index + 1,
  title: step.title,
}));

function getLeadStatusBadge(lead: PartnerLead) {
  if (isInquiryFullyCompleted(lead.status)) {
    return {
      label: "Selesai",
      className: "border border-emerald-200 bg-emerald-50 text-emerald-800",
      dotClass: "bg-emerald-600",
    };
  }
  if (lead.status === "REJECTED" || lead.status === "CLOSED_LOST") {
    return {
      label: "Ditolak",
      className: "border border-rose-200 bg-rose-50 text-rose-800",
      dotClass: "bg-rose-600",
    };
  }
  const activeStep = lead.workflowVersion?.steps?.find(
    (s) => s.stepOrder === lead.currentStepOrder
  );
  const label = activeStep
    ? `Tahap ${lead.currentStepOrder}: ${activeStep.title}`
    : "Sedang diproses";
  return {
    label,
    className: "border border-rose-200 bg-rose-50/80 text-[#a60f28]",
    dotClass: "bg-[#c41230]",
  };
}

function getWorkflowWindow(
  steps: StepLite[],
  currentStepOrder: number,
  isCompleted: boolean,
  expanded: boolean
) {
  const isExpandable = steps.length > COLLAPSED_WINDOW_SIZE;
  if (expanded || !isExpandable) {
    return {
      visibleSteps: steps,
      isExpandable,
      hasAbove: false,
      hasBelow: false,
    };
  }

  let activeIdx = steps.findIndex((step) => step.stepOrder === currentStepOrder);
  if (activeIdx < 0) {
    activeIdx = isCompleted ? steps.length - 1 : 0;
  }

  const start = Math.max(
    0,
    Math.min(activeIdx - 2, steps.length - COLLAPSED_WINDOW_SIZE)
  );
  const end = start + COLLAPSED_WINDOW_SIZE;
  const hasAbove = start > 0;
  const hasBelow = end < steps.length;
  const renderStart = hasAbove ? start - 1 : start;
  const renderEnd = hasBelow ? end + 1 : end;

  return {
    visibleSteps: steps.slice(renderStart, renderEnd),
    isExpandable,
    hasAbove,
    hasBelow,
  };
}

function matchesFilter(status: string, filter: FilterTab) {
  if (filter === "semua") return true;
  if (filter === "diproses") {
    return status === "ACTIVE" || ACTIVE_LEAD_STATUSES.some((value) => value === status);
  }
  if (filter === "disetujui") {
    return isInquiryFullyCompleted(status);
  }
  if (filter === "ditolak") {
    return status === "REJECTED" || status === "CLOSED_LOST";
  }
  return true;
}

function coverUrl(panoramaUrl: string | null | undefined) {
  if (!panoramaUrl) return "/brand/landing/space-card.jpg";
  return getS3ProxyUrl(panoramaUrl);
}

type Props = {
  displayName: string;
  loading: boolean;
  leads: PartnerLead[];
  onExplore: () => void;
  pickerReady: boolean;
  contactPhone?: string;
};

export default function ApplicationsSection({
  displayName,
  loading,
  leads,
  onExplore,
  pickerReady,
  contactPhone,
}: Props) {
  const commercialProfile = useCommercialProfile();
  const resolvedContactPhone = contactPhone || commercialProfile.whatsappNumber;
  const [filter, setFilter] = useState<FilterTab>("semua");
  const [recommendations, setRecommendations] = useState<RecommendedSpace[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/partner/recommendations");
      if (!res.ok || cancelled) return;
      setRecommendations(await res.json());
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(
    () => ({
      total: leads.length,
      diproses: leads.filter((l) => matchesFilter(l.status, "diproses")).length,
      disetujui: leads.filter((l) => matchesFilter(l.status, "disetujui")).length,
      ditolak: leads.filter((l) => matchesFilter(l.status, "ditolak")).length,
    }),
    [leads]
  );

  const filtered = useMemo(
    () => leads.filter((lead) => matchesFilter(lead.status, filter)),
    [leads, filter]
  );

  const visibleLeads = showAll ? filtered : filtered.slice(0, 5);
  const waUrl = getWhatsAppUrl(
    resolvedContactPhone,
    "Halo Tim Komersial LRT Jabodebek, saya ingin menanyakan status pengajuan sewa unit di Portal Mitra."
  );

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "semua", label: "Semua" },
    { id: "diproses", label: "Diproses" },
    { id: "disetujui", label: "Selesai" },
    { id: "ditolak", label: "Ditolak" },
  ];

  return (
    <>
      <PartnerSectionHeader
        displayName={displayName}
        title="Pengajuan Sewa"
        subtitle="Kelola dan pantau seluruh progres pengajuan sewa ruang komersial Anda"
        action={
          <button
            type="button"
            onClick={onExplore}
            disabled={!pickerReady}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#c41230] px-4 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#a60f28] disabled:opacity-50"
          >
            <Plus className="size-4" strokeWidth={1.75} />
            Ajukan Penyewaan Baru
          </button>
        }
      />

      {/* Ringkasan Angka */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="Total Pengajuan"
          value={summary.total}
          icon={<FileText className="size-4" strokeWidth={1.5} />}
        />
        <StatCard
          title="Sedang Diproses"
          value={summary.diproses}
          icon={<Clock3 className="size-4" strokeWidth={1.5} />}
        />
        <StatCard
          title="Pengajuan Selesai"
          value={summary.disetujui}
          icon={<CheckCircle2 className="size-4" strokeWidth={1.5} />}
        />
        <StatCard
          title="Ditolak"
          value={summary.ditolak}
          icon={<XCircle className="size-4" strokeWidth={1.5} />}
        />
      </div>

      {/* Daftar Pengajuan Sewa */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-[#101828]">Daftar Pengajuan Sewa</h2>
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setFilter(tab.id);
                    setShowAll(false);
                    setExpandedLeadId(null);
                  }}
                  className={`inline-flex h-9 items-center rounded-lg px-3.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-[#c41230] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {loading ? (
            <div className="py-16 text-center text-sm text-slate-500">Memuat pengajuan...</div>
          ) : visibleLeads.length === 0 ? (
            <EmptyApplications onExplore={onExplore} pickerReady={pickerReady} />
          ) : (
            visibleLeads.map((lead) => (
              <ApplicationCard
                key={lead.id}
                lead={lead}
                expanded={expandedLeadId === lead.id}
                onToggleExpand={() =>
                  setExpandedLeadId((prev) => (prev === lead.id ? null : lead.id))
                }
              />
            ))
          )}
        </div>

        {!showAll && filtered.length > 5 && (
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-[#c41230] transition-colors hover:bg-rose-50"
            >
              Lihat Semua Pengajuan ({filtered.length})
              <ChevronRight className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </section>

      {/* Rekomendasi Ruang Komersial */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[#101828]">
            Rekomendasi Ruang Komersial
          </h2>
          <button
            type="button"
            onClick={onExplore}
            disabled={!pickerReady}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#c41230] hover:underline disabled:opacity-50"
          >
            Lihat Stasiun Lain
            <ChevronRight className="size-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recommendations.slice(0, 3).map((space) => (
            <div
              key={space.id}
              className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors hover:border-slate-300"
            >
              <div className="relative aspect-[16/9] w-full bg-slate-100">
                <Image
                  src={coverUrl(space.panoramaUrl)}
                  alt={space.name}
                  fill
                  sizes="320px"
                  className="object-cover"
                  unoptimized={coverUrl(space.panoramaUrl).startsWith("/api/")}
                />
              </div>
              <div className="flex flex-1 flex-col justify-between p-4">
                <div>
                  <span className="inline-block rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium tabular-nums text-[#c41230]">
                    {space.code}
                  </span>
                  <p className="mt-2 truncate text-sm font-semibold text-[#101828]">
                    {space.name}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-slate-500">
                    <span>{space.station.name}</span>
                    <span>·</span>
                    <span className="tabular-nums">{space.area} m²</span>
                    {space.leasingModel && (
                      <>
                        <span>·</span>
                        <span>{space.leasingModel}</span>
                      </>
                    )}
                  </div>
                </div>
                <Link
                  href={`/station/${space.station.slug}?unit=${space.id}`}
                  className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#c41230] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#a60f28]"
                >
                  <Compass className="size-4" strokeWidth={1.5} />
                  Jelajahi di Virtual Tour
                </Link>
              </div>
            </div>
          ))}
          {recommendations.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-slate-500">
              Belum ada rekomendasi unit tersedia saat ini
            </p>
          )}
        </div>
      </section>

      {/* Panduan & Bantuan Komersial */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs md:p-6">
          <h2 className="text-base font-semibold text-[#101828]">Panduan Alur Penyewaan</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { n: "1", t: "Jelajahi", d: "Pilih stasiun dan unit di tur 360°" },
              { n: "2", t: "Ajukan", d: "Kirim formulir minat sewa resmi" },
              { n: "3", t: "Survei & PKS", d: "Verifikasi, survei lokasi, dan kontrak" },
              { n: "4", t: "Fit-Out", d: "Serah terima unit hingga siap operasi" },
            ].map((step) => (
              <div
                key={step.n}
                className="rounded-xl border border-slate-200/80 bg-[#f8fafc] p-3.5 text-left"
              >
                <span className="inline-flex size-7 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold tabular-nums text-slate-700">
                  {step.n}
                </span>
                <p className="mt-2.5 text-sm font-semibold text-[#101828]">{step.t}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{step.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs md:p-6">
          <div>
            <h2 className="text-base font-semibold text-[#101828]">Bantuan Tim Komersial</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              Hubungi tim kami jika memerlukan klarifikasi progres pengajuan, spesifikasi teknis,
              atau dokumen administrasi.
            </p>
          </div>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            <Phone className="size-4" strokeWidth={1.5} />
            Hubungi via WhatsApp
          </a>
        </section>
      </div>
    </>
  );
}

function ApplicationCard({
  lead,
  expanded,
  onToggleExpand,
}: {
  lead: PartnerLead;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const badge = getLeadStatusBadge(lead);
  const space = lead.space;
  const cover = coverUrl(space?.panoramaUrl);

  const steps: StepLite[] =
    lead.workflowVersion?.steps && lead.workflowVersion.steps.length > 0
      ? lead.workflowVersion.steps
      : DEFAULT_STEPS;

  const currentStepOrder = lead.currentStepOrder;
  const isRejected = lead.status === "REJECTED" || lead.status === "CLOSED_LOST";
  const isCompleted = isInquiryFullyCompleted(lead.status);

  const mediaCount = lead._count?.mediaAttachments ?? 0;
  const { visibleSteps, isExpandable, hasAbove, hasBelow } = getWorkflowWindow(
    steps,
    currentStepOrder,
    isCompleted,
    expanded
  );
  const displayStepNumber = Math.min(
    steps.length,
    Math.max(1, isCompleted ? steps.length : currentStepOrder)
  );

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors hover:border-slate-300">
      <div className="grid gap-0 lg:grid-cols-[208px_minmax(0,1fr)_304px]">
        {/* Kolom Kiri: Foto Unit */}
        <div className="relative min-h-40 bg-slate-100 lg:min-h-full">
          <Image
            src={cover}
            alt={space?.name ?? "Unit"}
            fill
            sizes="208px"
            className="object-cover"
            unoptimized={cover.startsWith("/api/")}
          />
        </div>

        {/* Kolom Tengah: Ringkasan Unit & Aksi Detail */}
        <div className="flex flex-col justify-between p-5">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium tabular-nums text-slate-500">
                {lead.inquiryCode || "Pengajuan Minat"}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
              >
                <span aria-hidden="true" className={`size-1.5 rounded-full ${badge.dotClass}`} />
                {badge.label}
              </span>
            </div>

            <h3 className="mt-2 text-base font-semibold text-[#101828]">
              {space
                ? `${space.code} — ${space.name}`
                : formatSpaceRequirementLabel(lead.spaceRequirement) ||
                  "Kebutuhan Ruang Komersial"}
            </h3>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                <MapPin className="size-4 shrink-0 text-slate-400" strokeWidth={1.5} />
                {space?.station?.name ?? "-"}
              </span>
              <span>·</span>
              <span className="tabular-nums">{space ? `${space.area} m²` : "-"}</span>
              {lead.businessType && (
                <>
                  <span>·</span>
                  <span className="text-slate-600">{lead.businessType}</span>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <span className="text-xs tabular-nums text-slate-500">
              Diajukan{" "}
              {new Date(lead.createdAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            <Link
              href={`/partner/inquiries/${lead.id}`}
              className="inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <span>Lihat Detail</span>
              <ChevronRight className="size-4" strokeWidth={1.5} />
            </Link>
          </div>
        </div>

        {/* Kolom Kanan: Tahapan Workflow Ringkas 5 Step / Full */}
        <div className="flex flex-col justify-between border-t border-slate-200/80 bg-[#f8fafc] p-5 lg:border-t-0 lg:border-l">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-700">Alur pengajuan</p>
                <p className="mt-0.5 text-xs tabular-nums text-slate-500">
                  {displayStepNumber} dari {steps.length}
                </p>
              </div>
              {mediaCount > 0 && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium tabular-nums text-slate-700">
                  <FileText className="size-3.5 text-slate-500" strokeWidth={1.5} />
                  {mediaCount} Dokumen
                </span>
              )}
            </div>

            <div className="relative -mx-1 mt-3 overflow-hidden px-1">
              {hasAbove && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 z-20 h-6 bg-gradient-to-b from-[#f8fafc] from-10% via-[#f8fafc]/60 via-55% to-transparent"
                />
              )}
              {hasBelow && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-6 bg-gradient-to-t from-[#f8fafc] from-10% via-[#f8fafc]/60 via-55% to-transparent"
                />
              )}

              <div
                className={`relative ${hasAbove ? "-mt-3" : ""} ${hasBelow ? "-mb-3" : ""}`}
              >
                {visibleSteps.map((step) => {
                  const order = step.stepOrder;
                  const isAbsoluteLast = order === steps[steps.length - 1]?.stepOrder;

                  const isPast = isCompleted || order < currentStepOrder;
                  const isCurrent = order === currentStepOrder && !isCompleted;

                  return (
                    <div key={order} className="relative flex h-8 items-center gap-2.5">
                      <div className="relative flex h-full w-6 shrink-0 items-center justify-center">
                        <div
                          className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors ${
                            isPast
                              ? "bg-emerald-600 text-white"
                              : isCurrent && !isRejected
                                ? "bg-[#c41230] text-white ring-2 ring-[#c41230]/20"
                                : isCurrent && isRejected
                                  ? "bg-rose-600 text-white ring-2 ring-rose-200"
                                  : "border border-slate-300 bg-white text-slate-500"
                          }`}
                        >
                          {isPast ? (
                            <CheckCircle2 className="size-3.5" strokeWidth={2} />
                          ) : isCurrent && isRejected ? (
                            <X className="size-3.5" strokeWidth={2.5} />
                          ) : (
                            order
                          )}
                        </div>

                        {!isAbsoluteLast && (
                          <div
                            className={`absolute top-6 -bottom-2 left-1/2 w-[1.5px] -translate-x-1/2 ${
                              isPast ? "bg-emerald-500" : "bg-slate-200"
                            }`}
                          />
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <span
                          className={`truncate text-xs ${
                            isCurrent && !isRejected
                              ? "font-semibold text-[#c41230]"
                              : isCurrent && isRejected
                                ? "font-semibold text-rose-600"
                                : isPast
                                  ? "font-medium text-slate-800"
                                  : "text-slate-500"
                          }`}
                        >
                          {step.title}
                        </span>
                        {isCurrent && !isRejected && (
                          <span className="shrink-0 rounded bg-rose-100/80 px-1.5 py-0.5 text-[11px] font-semibold text-[#a60f28]">
                            Aktif
                          </span>
                        )}
                        {isCurrent && isRejected && (
                          <span className="shrink-0 rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">
                            Ditolak
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {isExpandable && (
            <div className="mt-3 border-t border-slate-200/70 pt-2.5">
              <button
                type="button"
                onClick={onToggleExpand}
                aria-expanded={expanded}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#c41230] transition-colors hover:text-[#9f0e27] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c41230]"
              >
                <span>{expanded ? "Ringkas" : "Lihat Selengkapnya"}</span>
                <ChevronDown
                  className={`size-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                  strokeWidth={1.5}
                />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function EmptyApplications({
  onExplore,
  pickerReady,
}: {
  onExplore: () => void;
  pickerReady: boolean;
}) {
  return (
    <div className="flex flex-col items-center py-14 text-center">
      <FileText className="size-12 text-slate-300" strokeWidth={1.5} />
      <h3 className="mt-3 text-base font-semibold text-[#101828]">Belum Ada Pengajuan Sewa</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Jelajahi unit komersial yang tersedia di stasiun LRT Jabodebek dan kirimkan minat sewa Anda.
      </p>
      <button
        type="button"
        onClick={onExplore}
        disabled={!pickerReady}
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#c41230] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#a60f28] disabled:opacity-50"
      >
        <Glasses className="size-4" strokeWidth={1.5} />
        Jelajahi Virtual Tour
      </button>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">{title}</p>
        <span className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[#101828]">
        {value}
      </p>
    </div>
  );
}
