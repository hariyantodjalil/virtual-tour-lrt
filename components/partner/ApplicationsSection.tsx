"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  FileText,
  Glasses,
  MapPin,
  Phone,
  Plus,
  XCircle,
} from "lucide-react";
import { formatRupiah, getWhatsAppUrl } from "@/lib/utils";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import { useCommercialProfile } from "@/components/commercial/CommercialProfileProvider";
import {
  ACTIVE_LEAD_STATUSES,
  isCommercialOperation,
  LEAD_PIPELINE_STATUSES,
  LEAD_STATUS_LABELS,
  SITE_VISIT_STATUS_LABELS,
  type CommercialLeadStatus,
} from "@/lib/commercial-pipeline";

export type PartnerLead = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  businessType: string;
  status: string;
  message: string | null;
  surveyPreference: string | null;
  siteVisitStatus: string;
  siteVisitScheduledAt: string | null;
  notes: string | null;
  createdAt: string;
  space: {
    id: string;
    code: string;
    name: string;
    type: string;
    area: number;
    floor: string;
    location: string;
    monthlyRent: number;
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
  monthlyRent: number;
  panoramaUrl: string | null;
  station: { name: string; slug: string };
};

type FilterTab = "semua" | "diproses" | "disetujui" | "ditolak";

const TYPE_LABELS: Record<string, string> = {
  KIOS: "Food & Beverage",
  RUKO: "Ruko",
  ATM: "ATM",
  VENDING: "Vending",
  MEDIA_IKLAN: "Media Iklan",
  AREA_PROMOSI: "Area Promosi",
};

const STEPS = LEAD_PIPELINE_STATUSES.filter((status) => status !== "CLOSED_LOST").map(
  (status) => LEAD_STATUS_LABELS[status]
);

function statusBadge(status: string) {
  const label = LEAD_STATUS_LABELS[status as CommercialLeadStatus] ?? "Baru Diajukan";
  if (status === "CLOSED_LOST") return { label, className: "bg-red-600 text-white" };
  if (isCommercialOperation(status)) {
    return { label: "Operasional Komersial", className: "bg-emerald-600 text-white" };
  }
  return { label, className: "bg-[#1C0A0E] text-white" };
}

function currentStepIndex(status: string): number {
  if (status === "CLOSED_LOST") return -1;
  if (status === "CLOSED_WON") return STEPS.length - 1;
  const index = LEAD_PIPELINE_STATUSES.findIndex((step) => step === status);
  return index >= 0 ? index : 0;
}

function matchesFilter(status: string, filter: FilterTab) {
  if (filter === "semua") return true;
  if (filter === "diproses") {
    return ACTIVE_LEAD_STATUSES.includes(
      status as (typeof ACTIVE_LEAD_STATUSES)[number]
    );
  }
  if (filter === "disetujui") return isCommercialOperation(status);
  if (filter === "ditolak") return status === "CLOSED_LOST";
  return true;
}

function coverUrl(panoramaUrl: string | null | undefined) {
  if (!panoramaUrl) return "/brand/landing/space-card.jpg";
  return getS3ProxyUrl(panoramaUrl);
}

function priceLabel(monthlyRent: number | undefined | null) {
  if (monthlyRent && monthlyRent > 0) return formatRupiah(monthlyRent);
  return "Hubungi tim";
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
  const [detailLead, setDetailLead] = useState<PartnerLead | null>(null);
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
      diproses: leads.filter((l) =>
        ACTIVE_LEAD_STATUSES.includes(
          l.status as (typeof ACTIVE_LEAD_STATUSES)[number]
        )
      ).length,
      siteVisit: leads.filter((l) =>
        ["REQUESTED", "SCHEDULED"].includes(l.siteVisitStatus)
      ).length,
      disetujui: leads.filter((l) => isCommercialOperation(l.status)).length,
      ditolak: leads.filter((l) => l.status === "CLOSED_LOST").length,
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
    "Halo, saya ingin menanyakan status pengajuan sewa di Panel Mitra Virtual Tour LRT Jabodebek."
  );

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "semua", label: "Semua" },
    { id: "diproses", label: "Diproses" },
    { id: "disetujui", label: "Operasional" },
    { id: "ditolak", label: "Ditolak" },
  ];

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-base text-slate-600 md:text-lg">
            Halo, <span className="font-semibold text-[#101828]">{displayName}</span>          </p>
          <p className="mt-1 text-sm text-slate-500">
            Kelola dan pantau pengajuan sewa Anda di sini.
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

      {/* Summary */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
          title="Site Visit"
          value={summary.siteVisit}
          icon={<CalendarDays className="size-4" />}
          tone="violet"
        />
        <StatCard
          title="Operasional"
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

      {/* Info banner */}
      <div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <div>
          <p className="font-semibold">Informasi Terbaru</p>
          <p className="mt-0.5 text-amber-800/90">
            Tim leasing sedang memproses pengajuan aktif Anda. Status akan diperbarui otomatis di
            halaman ini.
          </p>
        </div>
      </div>

      {/* Pengajuan Saya */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-[#101828]">Pengajuan Saya</h2>
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
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
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
            visibleLeads.map((lead) => (
              <ApplicationCard
                key={lead.id}
                lead={lead}
                onDetail={() => setDetailLead(lead)}
              />
            ))
          )}
        </div>

        {!showAll && filtered.length > 5 && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#c41230] hover:underline"
            >
              Lihat Semua Pengajuan
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </section>

      {/* Bottom widgets */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-[#101828]">Rekomendasi untuk Anda</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {recommendations.slice(0, 3).map((space) => (
              <div
                key={space.id}
                className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50"
              >
                <div className="relative aspect-[16/9] w-full bg-slate-200">
                  <Image
                    src={coverUrl(space.panoramaUrl)}
                    alt={space.name}
                    fill
                    sizes="280px"
                    className="object-cover"
                    unoptimized={coverUrl(space.panoramaUrl).startsWith("/api/")}
                  />
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-bold text-[#101828]">
                    {space.code} — {space.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {space.station.name} · {space.area} m²
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#c41230]">
                    {priceLabel(space.monthlyRent)}
                  </p>
                  <Link
                    href={`/station/${space.station.slug}?unit=${space.id}`}
                    className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-[#c41230] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                  >
                    Lihat Unit
                  </Link>
                </div>
              </div>
            ))}
            {recommendations.length === 0 && (
              <p className="col-span-full py-6 text-center text-sm text-slate-500">
                Belum ada rekomendasi.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-[#101828]">Site Visit</h3>
          {leads.some((l) => l.siteVisitStatus !== "NONE") ? (
            <ul className="mt-4 space-y-3">
              {leads
                .filter((l) => l.siteVisitStatus !== "NONE")
                .slice(0, 4)
                .map((l) => (
                  <li
                    key={l.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3"
                  >
                    <p className="text-sm font-semibold text-[#101828]">
                      {l.space ? `${l.space.code} — ${l.space.name}` : "Unit"}
                    </p>
                    <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-600">
                      <CalendarDays className="mt-0.5 size-3.5 shrink-0 text-[#c41230]" />
                      {l.siteVisitScheduledAt
                        ? new Date(l.siteVisitScheduledAt).toLocaleString("id-ID", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : `${SITE_VISIT_STATUS_LABELS[
                            l.siteVisitStatus as keyof typeof SITE_VISIT_STATUS_LABELS
                          ] ?? l.siteVisitStatus}: ${
                            l.surveyPreference ||
                            "menunggu jadwal dari admin"
                          }`}
                    </p>
                  </li>
                ))}
            </ul>
          ) : (
            <div className="mt-8 flex flex-col items-center py-6 text-center">
              <CalendarDays className="size-12 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-600">
                Belum ada permintaan site visit.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Preferensi Anda akan masuk ke CMS untuk dijadwalkan admin.
              </p>
            </div>
          )}
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-[#101828]">Panduan Penyewaan</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { n: "1", t: "Jelajahi", d: "Tur 360° stasiun" },
              { n: "2", t: "Ajukan", d: "Kirim minat sewa" },
              { n: "3", t: "Penawaran", d: "KAI mengirim penawaran resmi" },
              { n: "4", t: "Verifikasi", d: "Cek lokasi setelah kesepakatan" },
              { n: "5", t: "Perjanjian", d: "BA, desain, PKS, serah terima" },
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
            <h3 className="text-base font-bold text-[#101828]">Hubungi Leasing</h3>
            <p className="mt-1 text-sm text-slate-500">
              Butuh bantuan soal pengajuan? Tim komersial siap membantu.
            </p>
          </div>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#c41230] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            <Phone className="size-4" />
            Hubungi Sekarang
          </a>
        </section>
      </div>

      {detailLead && (
        <DetailModal lead={detailLead} onClose={() => setDetailLead(null)} />
      )}
    </>
  );
}

function ApplicationCard({
  lead,
  onDetail,
}: {
  lead: PartnerLead;
  onDetail: () => void;
}) {
  const badge = statusBadge(lead.status);
  const stepIdx = currentStepIndex(lead.status);
  const space = lead.space;
  const cover = coverUrl(space?.panoramaUrl);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[200px_minmax(0,1fr)_200px]">
        <div className="relative min-h-[160px] bg-slate-200 lg:min-h-full">
          <Image
            src={cover}
            alt={space?.name ?? "Unit"}
            fill
            sizes="200px"
            className="object-cover"
            unoptimized={cover.startsWith("/api/")}
          />
          <span
            className={`absolute bottom-3 left-3 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>

        <div className="flex flex-col p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-[#101828] md:text-lg">
                {space?.code ?? "-"} — {space?.name ?? "Unit Komersial"}
              </h3>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {space?.station?.name ?? "-"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Building2 className="size-3.5" />
                  {space?.floor || space?.location || "-"}
                </span>
                <span>{TYPE_LABELS[space?.type ?? ""] ?? lead.businessType}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onDetail}
              className="hidden shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:inline-flex"
            >
              Lihat Detail
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 px-3 py-3">
            <div>
              <p className="text-[10px] font-medium tracking-wide text-slate-400 uppercase">
                Luas
              </p>
              <p className="mt-0.5 text-sm font-bold text-[#101828]">
                {space ? `${space.area} m²` : "-"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium tracking-wide text-slate-400 uppercase">
                Harga / Bulan
              </p>
              <p className="mt-0.5 text-sm font-bold text-[#101828]">
                {priceLabel(space?.monthlyRent)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium tracking-wide text-slate-400 uppercase">
                Tanggal Pengajuan
              </p>
              <p className="mt-0.5 text-sm font-bold text-[#101828]">
                {new Date(lead.createdAt).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onDetail}
            className="mt-3 inline-flex rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:hidden"
          >
            Lihat Detail
          </button>
        </div>

        <div className="border-t border-slate-100 p-4 lg:border-t-0 lg:border-l">
          <p className="mb-3 text-[10px] font-bold tracking-wide text-slate-400 uppercase">
            Status Pengajuan
          </p>
          {lead.status === "CLOSED_LOST" ? (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <XCircle className="mt-0.5 size-4 shrink-0" />
              Pengajuan ditolak. Silakan ajukan unit lain.
            </div>
          ) : (
            <ol className="space-y-2.5">
              {STEPS.map((label, index) => {
                const finalIndex = STEPS.length - 1;
                const done =
                  stepIdx > index || (stepIdx === finalIndex && index === finalIndex);
                const current = stepIdx === index && stepIdx < finalIndex;
                const completeFinal =
                  stepIdx === finalIndex && index === finalIndex;
                return (
                  <li key={label} className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0">
                      {done || completeFinal ? (
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      ) : current ? (
                        <span className="flex size-4 items-center justify-center rounded-full border-2 border-amber-500">
                          <span className="size-1.5 rounded-full bg-amber-500" />
                        </span>
                      ) : (
                        <Circle className="size-4 text-slate-300" />
                      )}
                    </span>
                    <span
                      className={`text-xs leading-snug ${
                        done || completeFinal || current
                          ? "font-semibold text-[#101828]"
                          : "text-slate-400"
                      }`}
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </article>
  );
}

function DetailModal({ lead, onClose }: { lead: PartnerLead; onClose: () => void }) {
  const space = lead.space;
  const badge = statusBadge(lead.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span
              className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${badge.className}`}
            >
              {badge.label}
            </span>
            <h3 className="mt-2 text-xl font-bold text-[#101828]">
              {space?.code ?? "-"} — {space?.name ?? "Unit"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {space?.station?.name ?? "-"} · {space?.floor || space?.location || "-"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tutup"
          >
            <XCircle className="size-5" />
          </button>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-400">Luas</dt>
            <dd className="font-bold text-[#101828]">{space ? `${space.area} m²` : "-"}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-400">Harga / Bulan</dt>
            <dd className="font-bold text-[#101828]">{priceLabel(space?.monthlyRent)}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-400">Jenis Usaha</dt>
            <dd className="font-bold text-[#101828]">{lead.businessType}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-400">Tanggal</dt>
            <dd className="font-bold text-[#101828]">
              {new Date(lead.createdAt).toLocaleDateString("id-ID")}
            </dd>
          </div>
        </dl>

        {lead.siteVisitStatus !== "NONE" && (
          <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50 p-3">
            <p className="text-xs font-semibold uppercase text-sky-600">Site Visit</p>
            <p className="mt-1 text-sm font-semibold text-sky-900">
              {SITE_VISIT_STATUS_LABELS[
                lead.siteVisitStatus as keyof typeof SITE_VISIT_STATUS_LABELS
              ] ?? lead.siteVisitStatus}
            </p>
            {lead.siteVisitScheduledAt && (
              <p className="mt-1 text-sm text-sky-800">
                {new Date(lead.siteVisitScheduledAt).toLocaleString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        )}

        {lead.surveyPreference && (
          <div className="mt-4 rounded-xl border border-slate-100 p-3">
            <p className="text-xs font-semibold text-slate-400 uppercase">Preferensi Survei</p>
            <p className="mt-1 text-sm text-slate-700">{lead.surveyPreference}</p>
          </div>
        )}

        {lead.message && (
          <div className="mt-4 rounded-xl border border-slate-100 p-3">
            <p className="text-xs font-semibold text-slate-400 uppercase">Pesan</p>
            <p className="mt-1 text-sm text-slate-700">{lead.message}</p>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Tutup
          </button>
          {space?.station?.slug && (
            <Link
              href={`/station/${space.station.slug}?unit=${space.id}`}
              className="flex-1 rounded-xl bg-[#c41230] px-4 py-2.5 text-center text-sm font-semibold text-white hover:brightness-110"
            >
              Lihat di Tour
            </Link>
          )}
        </div>
      </div>
    </div>
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
      <h3 className="mt-3 text-lg font-bold text-[#101828]">Belum ada pengajuan</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Jelajahi virtual tour, pilih unit, lalu ajukan minat sewa.
      </p>
      <button
        type="button"
        onClick={onExplore}
        disabled={!pickerReady}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#c41230] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
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
  tone: "red" | "orange" | "violet" | "green" | "rose";
}) {
  const tones = {
    red: "bg-[#c41230]/10 text-[#c41230]",
    orange: "bg-orange-50 text-orange-600",
    violet: "bg-violet-50 text-violet-600",
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
