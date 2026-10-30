"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  Compass,
  FileText,
  Glasses,
  Image as ImageIcon,
  MapPin,
  Phone,
  Plus,
  X,
  XCircle,
} from "lucide-react";
import { getWhatsAppUrl } from "@/lib/utils";
import { ACTIVE_LEAD_STATUSES, PUBLIC_LEAD_PROCESS_STEPS } from "@/lib/commercial-pipeline";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import { useCommercialProfile } from "@/components/commercial/CommercialProfileProvider";

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
  status: string; // "ACTIVE" | "COMPLETED" | "REJECTED"
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
    floor: string;
    location: string;
    leasingModel?: string | null;
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
  floor: string;
  location: string;
  leasingModel?: string | null;
  panoramaUrl: string | null;
  station: { name: string; slug: string };
};

type FilterTab = "semua" | "diproses" | "disetujui" | "ditolak";

const DEFAULT_STEPS = PUBLIC_LEAD_PROCESS_STEPS.map((step, index) => ({ stepOrder: index + 1, title: step.title }));

function getLeadStatusBadge(lead: PartnerLead) {
  if (
    lead.status === "COMPLETED" ||
    lead.status === "COMMERCIAL_OPERATION" ||
    lead.status === "CLOSED_WON"
  ) {
    return { label: "Selesai", className: "bg-emerald-600 text-white" };
  }
  if (lead.status === "REJECTED" || lead.status === "CLOSED_LOST") {
    return { label: "Ditolak", className: "bg-rose-600 text-white" };
  }
  const activeStep = lead.workflowVersion?.steps?.find(
    (s) => s.stepOrder === lead.currentStepOrder
  );
  const label = activeStep
    ? `Tahap ${lead.currentStepOrder}: ${activeStep.title}`
    : "Sedang Diproses";
  return { label, className: "bg-[#c41230] text-white" };
}

function matchesFilter(status: string, filter: FilterTab) {
  if (filter === "semua") return true;
  if (filter === "diproses") {
    return status === "ACTIVE" || ACTIVE_LEAD_STATUSES.some(value => value === status);
  }
  if (filter === "disetujui") {
    return status === "COMPLETED" || status === "COMMERCIAL_OPERATION" || status === "CLOSED_WON";
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
  const resolvedContactPhone =
    contactPhone || commercialProfile.whatsappNumber;
  const [filter, setFilter] = useState<FilterTab>("semua");
  const [recommendations, setRecommendations] = useState<RecommendedSpace[]>([]);
  const [showAll, setShowAll] = useState(false);

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
      diproses: leads.filter(
        (l) =>
          l.status === "ACTIVE" ||
          l.status === "NEW" ||
          l.status === "CONTACTED" ||
          l.status === "NEGOTIATING" ||
          l.status === "PKS" ||
          l.status === "FIT_OUT_HANDOVER"
      ).length,
      disetujui: leads.filter(
        (l) =>
          l.status === "COMPLETED" ||
          l.status === "COMMERCIAL_OPERATION" ||
          l.status === "CLOSED_WON"
      ).length,
      ditolak: leads.filter(
        (l) => l.status === "REJECTED" || l.status === "CLOSED_LOST"
      ).length,
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
      {/* Top Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-base text-slate-600 md:text-lg">
            Halo, <span className="font-semibold text-[#101828]">{displayName}</span>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Kelola dan pantau seluruh progres pengajuan sewa unit komersial Anda di sini.
          </p>
        </div>
        <button
          type="button"
          onClick={onExplore}
          disabled={!pickerReady}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#c41230] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
        >
          <Plus className="size-4" strokeWidth={2.5} />
          Ajukan Penyewaan Baru
        </button>
      </div>

      {/* 4-Column Stat Summary Cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="Total Pengajuan"
          value={summary.total}
          icon={<FileText className="size-4" />}
          tone="red"
        />
        <StatCard
          title="Sedang Diproses"
          value={summary.diproses}
          icon={<Clock3 className="size-4" />}
          tone="orange"
        />
        <StatCard
          title="Pengajuan Selesai"
          value={summary.disetujui}
          icon={<CheckCircle2 className="size-4" />}
          tone="green"
        />
        <StatCard
          title="Ditolak"
          value={summary.ditolak}
          icon={<XCircle className="size-4" />}
          tone="rose"
        />
      </div>

      {/* Pengajuan Saya Section */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-[#101828]">Daftar Pengajuan Sewa</h2>
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
                  }}
                  className={`min-h-11 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-[#c41230] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
            visibleLeads.map((lead) => <ApplicationCard key={lead.id} lead={lead} />)
          )}
        </div>

        {!showAll && filtered.length > 5 && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#c41230] hover:underline"
            >
              Lihat Semua Pengajuan ({filtered.length})
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </section>

      {/* Rekomendasi Ruang Komersial */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#101828]">Rekomendasi Ruang Komersial</h3>
          <button
            type="button"
            onClick={onExplore}
            disabled={!pickerReady}
            className="text-xs font-semibold text-[#c41230] hover:underline"
          >
            Lihat Stasiun Lain →
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recommendations.slice(0, 3).map((space) => (
            <div
              key={space.id}
              className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition hover:border-[#c41230]/40 hover:shadow-sm"
            >
              <div className="relative aspect-[16/9] w-full bg-slate-200">
                <Image
                  src={coverUrl(space.panoramaUrl)}
                  alt={space.name}
                  fill
                  sizes="320px"
                  className="object-cover transition duration-300 group-hover:scale-105"
                  unoptimized={coverUrl(space.panoramaUrl).startsWith("/api/")}
                />
              </div>
              <div className="p-3.5">
                <span className="inline-block rounded-md bg-[#c41230]/10 px-2 py-0.5 text-[10px] font-bold text-[#c41230] uppercase">
                  {space.code}
                </span>
                <p className="mt-1 truncate text-sm font-bold text-[#101828]">{space.name}</p>
                <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-slate-500">
                  <span>{space.station.name}</span>
                  <span>·</span>
                  <span>{space.area} m²</span>
                  {space.leasingModel && (
                    <>
                      <span>·</span>
                      <span>{space.leasingModel}</span>
                    </>
                  )}
                </div>
                <Link
                  href={`/station/${space.station.slug}?unit=${space.id}`}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#c41230] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                >
                  <Compass className="size-3.5" />
                  Jelajahi di Virtual Tour
                </Link>
              </div>
            </div>
          ))}
          {recommendations.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-slate-500">
              Belum ada rekomendasi unit tersedia saat ini.
            </p>
          )}
        </div>
      </section>

      {/* Panduan & Kontak Section */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-[#101828]">Panduan Alur Penyewaan</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {[
              { n: "1", t: "Jelajahi", d: "Pilih stasiun & unit di 360° tour" },
              { n: "2", t: "Ajukan", d: "Kirim formulir minat sewa resmi" },
              { n: "3", t: "Survei & PKS", d: "Verifikasi, site visit & kontrak" },
              { n: "4", t: "Fit-Out", d: "Serah terima unit & siap operasi" },
            ].map((step) => (
              <div
                key={step.n}
                className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-center"
              >
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-[#c41230] text-xs font-bold text-white">
                  {step.n}
                </span>
                <p className="mt-2 text-sm font-bold text-[#101828]">{step.t}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{step.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col justify-between rounded-2xl border border-[#c41230]/20 bg-[#c41230]/[0.04] p-5 shadow-sm">
          <div>
            <h3 className="text-base font-bold text-[#101828]">Bantuan Tim Komersial</h3>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Ada kendala pengajuan, pertanyaan spesifikasi teknis, atau dokumen administrasi?
            </p>
          </div>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#c41230] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            <Phone className="size-4" />
            Hubungi via WhatsApp
          </a>
        </section>
      </div>
    </>
  );
}

function ApplicationCard({ lead }: { lead: PartnerLead }) {
  const badge = getLeadStatusBadge(lead);
  const space = lead.space;
  const cover = coverUrl(space?.panoramaUrl);

  const steps =
    lead.workflowVersion?.steps && lead.workflowVersion.steps.length > 0
      ? lead.workflowVersion.steps
      : DEFAULT_STEPS;

  const currentStepOrder = lead.currentStepOrder;
  const isRejected = lead.status === "REJECTED" || lead.status === "CLOSED_LOST";
  const isCompleted =
    lead.status === "COMPLETED" ||
    lead.status === "COMMERCIAL_OPERATION" ||
    lead.status === "CLOSED_WON";

  const mediaCount = lead._count?.mediaAttachments ?? 0;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition hover:shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[200px_minmax(0,1fr)_280px]">
        {/* Kolom Kiri: Foto Unit (Bersih tanpa badge menimpa foto) */}
        <div className="relative min-h-[150px] bg-slate-200 lg:min-h-full">
          <Image
            src={cover}
            alt={space?.name ?? "Unit"}
            fill
            sizes="200px"
            className="object-cover"
            unoptimized={cover.startsWith("/api/")}
          />
        </div>

        {/* Kolom Tengah: Ringkas Esensial & Tombol Putih di Kanan Bawah */}
        <div className="flex flex-col justify-between p-4 md:p-5">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="shrink-0 whitespace-nowrap text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                {lead.inquiryCode || "Pengajuan Minat"}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.className}`}
              >
                {badge.label}
              </span>
            </div>

            <h3 className="mt-1 text-base font-bold text-[#101828]">
              {space?.code ?? "-"} — {space?.name ?? "Unit Komersial"}
            </h3>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                <MapPin className="size-3.5 text-[#c41230]" />
                {space?.station?.name ?? "-"}
              </span>
              <span>·</span>
              <span>{space ? `${space.area} m²` : "-"}</span>
              {lead.businessType && (
                <>
                  <span>·</span>
                  <span className="text-slate-600">{lead.businessType}</span>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <span className="text-[11px] text-slate-400">
              Diajukan:{" "}
              {new Date(lead.createdAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            <Link
              href={`/partner/inquiries/${lead.id}`}
              className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300"
            >
              <span>Lihat Detail</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </div>

        {/* Tahapan dari versi workflow pengajuan. */}
        <div className="flex flex-col justify-center border-t border-slate-100 bg-slate-50/40 p-4 lg:border-t-0 lg:border-l">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Tahapan Workflow
            </p>
            {mediaCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                <ImageIcon className="size-3" />
                {mediaCount} Dokumen
              </span>
            )}
          </div>

          {/* Stepper vertikal ringkas */}
          <div className="space-y-0 relative py-1">
            {steps.map((step, idx) => {
              const isLast = idx === steps.length - 1;
              const order = step.stepOrder;

              const isPast =
                isCompleted ||
                (!isRejected && order < currentStepOrder) ||
                (isRejected && order < currentStepOrder);
              const isCurrent = order === currentStepOrder && !isCompleted;

              return (
                <div key={order} className="relative flex items-center gap-2.5 py-1">
                  {/* Circle */}
                  <div className="relative flex flex-col items-center">
                    <div
                      className={`z-10 flex size-5.5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                        isPast
                          ? "bg-emerald-600 text-white"
                          : isCurrent && !isRejected
                          ? "bg-[#c41230] text-white ring-2 ring-[#c41230]/20"
                          : isCurrent && isRejected
                          ? "bg-rose-600 text-white ring-2 ring-rose-200"
                          : "border border-slate-300 bg-white text-slate-400"
                      }`}
                    >
                      {isPast ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : isCurrent && isRejected ? (
                        <X className="size-3" strokeWidth={3} />
                      ) : (
                        order
                      )}
                    </div>

                    {/* Connecting line */}
                    {!isLast && (
                      <div
                        className={`absolute top-5 bottom-[-4px] left-[10px] w-[1.5px] -translate-x-1/2 ${
                          isPast ? "bg-emerald-500" : "bg-slate-200"
                        }`}
                      />
                    )}
                  </div>

                  {/* Step Title & Pill */}
                  <div className="min-w-0 flex-1 flex items-center justify-between gap-1">
                    <span
                      className={`truncate text-xs ${
                        isCurrent && !isRejected
                          ? "font-bold text-[#c41230]"
                          : isCurrent && isRejected
                          ? "font-bold text-rose-600"
                          : isPast
                          ? "font-semibold text-slate-800"
                          : "text-slate-400"
                      }`}
                    >
                      {step.title}
                    </span>
                    {isCurrent && !isRejected && (
                      <span className="shrink-0 rounded bg-[#c41230]/10 px-1.5 py-0.2 text-[9px] font-bold text-[#c41230]">
                        Aktif
                      </span>
                    )}
                    {isCurrent && isRejected && (
                      <span className="shrink-0 rounded bg-rose-100 px-1.5 py-0.2 text-[9px] font-bold text-rose-700">
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
      <FileText className="size-12 text-slate-300" />
      <h3 className="mt-3 text-lg font-bold text-[#101828]">Belum Ada Pengajuan Sewa</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Jelajahi unit komersial yang tersedia di stasiun LRT Jabodebek dan kirimkan minat sewa Anda.
      </p>
      <button
        type="button"
        onClick={onExplore}
        disabled={!pickerReady}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#c41230] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
      >
        <Glasses className="size-4" />
        Jelajahi Virtual Tour
      </button>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  tone: "red" | "orange" | "green" | "rose";
}) {
  const tones = {
    red: "bg-[#c41230]/10 text-[#c41230]",
    orange: "bg-orange-50 text-orange-600",
    green: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">{title}</p>
        <span className={`flex size-8 items-center justify-center rounded-lg ${tones[tone]}`}>
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-[#101828]">{value}</p>
    </div>
  );
}
