"use client";

import { useTourLanguage } from "@/components/tour/TourLanguageProvider";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trainCampaignPeriod, type PublicTrainInquiry } from "@/lib/train-advertising-shared";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Glasses,
  MapPin,
  Plus,
  XCircle,
} from "lucide-react";
import InquiryTimeline from "@/components/partner/InquiryTimeline";
import { cn, formatRupiah } from "@/lib/utils";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import {
  ACTIVE_LEAD_STATUSES,
  inquiryStatusLabel,
  isCommercialOperation,
  SITE_VISIT_STATUS_LABELS,
} from "@/lib/commercial-pipeline";
import { leadStageBadgeClass } from "@/lib/cms-leads-shared";

export type PartnerLead = {
  trainInquiry?: PublicTrainInquiry | null;
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
  leaseStartAt?: string | null;
  leaseEndAt?: string | null;
  paymentVerifiedAt?: string | null;
  createdAt: string;
  space: {
    id: string;
    code: string;
    name: string;
    type: string;
    area: number;
    floor: string;
    location: string;
    monthlyRent: number | null;
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
  monthlyRent: number | null;
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

function matchesFilter(status: string, filter: FilterTab) {
  if (filter === "semua") return true;
  if (filter === "diproses") {
    return ACTIVE_LEAD_STATUSES.includes(status as (typeof ACTIVE_LEAD_STATUSES)[number]);
  }
  if (filter === "disetujui") return isCommercialOperation(status);
  if (filter === "ditolak") return status === "CLOSED_LOST";
  return true;
}

function coverUrl(panoramaUrl: string | null | undefined) {
  if (!panoramaUrl) return "";
  return getS3ProxyUrl(panoramaUrl);
}

function priceLabel(monthlyRent: number | undefined | null, locale: string) {
  if (monthlyRent && monthlyRent > 0) return formatRupiah(monthlyRent, locale);
  return null;
}

function statusLabel(status: string) {
  if (isCommercialOperation(status)) return "Sewa Aktif";
  return inquiryStatusLabel(status);
}

type Props = {
  displayName: string;
  loading: boolean;
  leads: PartnerLead[];
  onExplore: () => void;
  pickerReady: boolean;
};

export default function ApplicationsSection({
  displayName,
  loading,
  leads,
  onExplore,
  pickerReady,
}: Props) {
  const { t, locale, content } = useTourLanguage();
  const router = useRouter();
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
      diproses: leads.filter((l) =>
        ACTIVE_LEAD_STATUSES.includes(l.status as (typeof ACTIVE_LEAD_STATUSES)[number])
      ).length,
      siteVisit: leads.filter((l) => ["REQUESTED", "SCHEDULED"].includes(l.siteVisitStatus)).length,
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
  const siteVisits = leads.filter((l) => l.siteVisitStatus !== "NONE");

  const tabs: { id: FilterTab; label: string; count: number }[] = [
    { id: "semua", label: "Semua", count: summary.total },
    { id: "diproses", label: "Diproses", count: summary.diproses },
    { id: "disetujui", label: "Sewa Aktif", count: summary.disetujui },
    { id: "ditolak", label: "Ditolak", count: summary.ditolak },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-base text-slate-600 md:text-lg">
            {t("Halo,")} <span className="font-semibold text-[#101828]">{displayName}</span>
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#101828] md:text-3xl">
            {t("Pengajuan Sewa")}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            {t("Pantau progres, site visit, dan tindak lanjut pengajuan Anda.")}
          </p>
        </div>
        <button
          type="button"
          onClick={onExplore}
          disabled={!pickerReady}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#c41230] px-4 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c41230] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-4" strokeWidth={2.5} aria-hidden />
          {t("Ajukan Penyewaan Baru")}
        </button>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryStat label="Total" value={summary.total} icon={<FileText className="size-3.5" />} />
          <SummaryStat label={t("Diproses")} value={summary.diproses} icon={<Clock3 className="size-3.5" />} />
          <SummaryStat
            label={t("Site Visit")}
            value={summary.siteVisit}
            icon={<CalendarDays className="size-3.5" />}
          />
          <SummaryStat
            label={t("Sewa Aktif")}
            value={summary.disetujui}
            icon={<CheckCircle2 className="size-3.5" />}
          />
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#101828]">{t("Pengajuan Saya")}</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {filtered.length} {t("pengajuan pada filter ini")}
            </p>
          </div>
          <div
            role="tablist"
            aria-label={t("Filter pengajuan")}
            className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
          >
            {tabs.map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setFilter(tab.id);
                    setShowAll(false);
                  }}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c41230]",
                    active
                      ? "bg-white text-[#101828] shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  {t(tab.label)}
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-xs tabular-nums",
                      active ? "bg-slate-100 text-slate-700" : "bg-transparent text-slate-400"
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {loading ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-16 text-center text-sm text-slate-500">
              {t("Memuat pengajuan…")}
            </div>
          ) : visibleLeads.length === 0 ? (
            <EmptyApplications onExplore={onExplore} pickerReady={pickerReady} filter={filter} />
          ) : (
            visibleLeads.map((lead) => (
              <ApplicationCard
                key={lead.id}
                lead={lead}
                onDetail={() => router.push(`/partner/inquiries/${encodeURIComponent(lead.id)}`)}
              />
            ))
          )}
        </div>

        {!showAll && filtered.length > 5 ? (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[#c41230] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c41230]"
            >
              {t("Lihat semua")} {filtered.length} {t("pengajuan")}
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-[#101828]">{t("Rekomendasi untuk Anda")}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{t("Unit tersedia yang cocok untuk dijelajahi.")}</p>
          <div className="mt-4 space-y-3">
            {recommendations.slice(0, 3).map((space) => {
              const image = coverUrl(space.panoramaUrl);
              return (
                <div
                  key={space.id}
                  className="flex gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {image ? (
                      <Image
                        src={image}
                        alt={content(space.name)}
                        fill
                        sizes="64px"
                        className="object-cover"
                        unoptimized={image.startsWith("/api/")}
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-slate-300">
                        <Building2 className="size-5" aria-hidden />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#101828]">
                      {space.code} — {content(space.name)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {space.station.name} · {space.area} m²
                      {priceLabel(space.monthlyRent, locale)
                        ? ` · ${priceLabel(space.monthlyRent, locale)}`
                        : ""}
                    </p>
                  </div>
                  <Link
                    href={`/station/${space.station.slug}?unit=${space.id}`}
                    className="inline-flex shrink-0 items-center self-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c41230]"
                  >
                    {t("Lihat")}
                  </Link>
                </div>
              );
            })}
            {recommendations.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                {t("Belum ada rekomendasi unit.")}
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-[#101828]">{t("Site Visit")}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{t("Jadwal dan status kunjungan lokasi.")}</p>
          {siteVisits.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {siteVisits.slice(0, 4).map((lead) => (
                <li key={lead.id} className="rounded-xl border border-slate-200 px-3.5 py-3">
                  <p className="text-sm font-semibold text-[#101828]">
                    {lead.space ? `${lead.space.code} — ${content(lead.space.name)}` : t("Unit")}
                  </p>
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-slate-600">
                    <CalendarDays className="mt-0.5 size-3.5 shrink-0 text-[#c41230]" aria-hidden />
                    {lead.siteVisitScheduledAt
                      ? new Date(lead.siteVisitScheduledAt).toLocaleString(locale, {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : `${
                          t(SITE_VISIT_STATUS_LABELS[lead.siteVisitStatus as keyof typeof SITE_VISIT_STATUS_LABELS] ?? lead.siteVisitStatus)
                        }: ${lead.surveyPreference || t("menunggu jadwal dari admin")}`}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
              <CalendarDays className="mx-auto size-8 text-slate-300" aria-hidden />
              <p className="mt-3 text-sm font-medium text-slate-600">{t("Belum ada permintaan site visit")}</p>
              <p className="mt-1 text-xs text-slate-400">
                {t("Preferensi kunjungan akan dijadwalkan admin setelah diajukan.")}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <span className="text-slate-400" aria-hidden>
          {icon}
        </span>
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[#101828]">{value}</dd>
    </div>
  );
}

function ApplicationCard({
  lead,
  onDetail,
}: {
  lead: PartnerLead;
  onDetail: () => void;
}) {
  const { t, locale, content } = useTourLanguage();
  const space = lead.space;
  const cover = coverUrl(lead.trainInquiry?.media?.imageUrl ?? space?.panoramaUrl);
  const label = t(statusLabel(lead.status));
  const code = space?.code ?? lead.trainInquiry?.mediaCode ?? null;
  const name = content(space?.name ?? lead.trainInquiry?.mediaTitle ?? "Unit Komersial");
  const rent = space ? priceLabel(space.monthlyRent, locale) : null;
  const metaParts = space
    ? [
        space.station?.name,
        content(space.floor || space.location || ""),
        content(TYPE_LABELS[space.type] ?? lead.businessType),
        `${space.area} m²`,
        rent,
      ].filter(Boolean)
    : [lead.trainInquiry?.train.name ?? null, content(lead.businessType)].filter(Boolean);

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300">
      <div className="flex flex-col md:flex-row">
        <div className="relative h-36 shrink-0 bg-slate-100 md:h-auto md:w-28 lg:w-32">
          {cover ? (
            <Image
              src={cover}
              alt={name}
              fill
              sizes="128px"
              className="object-cover"
              unoptimized={cover.startsWith("/api/")}
            />
          ) : (
            <div className="flex h-full min-h-[9rem] items-center justify-center text-slate-300 md:min-h-full">
              <Building2 className="size-7" aria-hidden />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-stretch lg:gap-0">
          <div className="min-w-0 flex-1 lg:pr-5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className={cn(
                  "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                  leadStageBadgeClass(lead.status)
                )}
              >
                {label}
              </span>
              <time className="text-xs text-slate-400" dateTime={lead.createdAt}>
                {new Date(lead.createdAt).toLocaleDateString(locale, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </time>
            </div>

            <h3 className="mt-2 text-base font-bold leading-snug text-[#101828]">
              {code ? (
                <>
                  <span className="font-semibold text-slate-500">{code}</span>
                  <span className="mx-1.5 text-slate-300" aria-hidden>
                    ·
                  </span>
                </>
              ) : null}
              {name}
            </h3>

            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                {metaParts[0] ?? "—"}
              </span>
              {metaParts.slice(1).map((part) => (
                <span key={String(part)} className="inline-flex items-center gap-2">
                  <span className="text-slate-300" aria-hidden>
                    ·
                  </span>
                  {part}
                </span>
              ))}
            </p>

            {lead.trainInquiry ? (
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                {[
                  lead.trainInquiry.train.name,
                  lead.trainInquiry.requestedTrainsetCount !== null
                    ? `${lead.trainInquiry.requestedTrainsetCount} trainset`
                    : null,
                  trainCampaignPeriod(lead.trainInquiry, locale),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col justify-between gap-4 border-t border-slate-100 pt-4 lg:w-[220px] lg:border-t-0 lg:border-l lg:pl-5 lg:pt-0">
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">{t("Progres")}</p>
              {lead.status === "CLOSED_LOST" ? (
                <div className="flex items-start gap-2 text-sm text-red-700">
                  <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{t("Pengajuan dihentikan")}</span>
                </div>
              ) : (
                <InquiryTimeline status={lead.status} compact />
              )}
            </div>
            <button
              type="button"
              onClick={onDetail}
              className="inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c41230]"
            >
              {t("Lihat detail")}
              <ChevronRight className="size-4 text-slate-400" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function EmptyApplications({
  onExplore,
  pickerReady,
  filter,
}: {
  onExplore: () => void;
  pickerReady: boolean;
  filter: FilterTab;
}) {
  const { t } = useTourLanguage();
  const copy =
    filter === "semua"
      ? {
          title: "Belum ada pengajuan",
          detail: "Jelajahi virtual tour, pilih unit, lalu ajukan minat sewa.",
          cta: true,
        }
      : {
          title: "Tidak ada pengajuan pada filter ini",
          detail: "Coba pilih filter lain atau ajukan unit baru dari virtual tour.",
          cta: filter !== "ditolak",
        };

  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 px-4 py-14 text-center">
      <FileText className="size-10 text-slate-300" aria-hidden />
      <h3 className="mt-3 text-lg font-bold text-[#101828]">{t(copy.title)}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{t(copy.detail)}</p>
      {copy.cta ? (
        <button
          type="button"
          onClick={onExplore}
          disabled={!pickerReady}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#c41230] px-5 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c41230] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Glasses className="size-4" aria-hidden />
          {t("Jelajahi Virtual Tour")}
        </button>
      ) : null}
    </div>
  );
}
