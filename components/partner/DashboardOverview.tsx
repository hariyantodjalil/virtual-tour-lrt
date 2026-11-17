"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ChevronRight,
  FileText,
  Glasses,
  Heart,
  Plus,
} from "lucide-react";
import type { PartnerLead } from "@/components/partner/ApplicationsSection";
import type { PartnerSummary } from "@/components/partner/PartnerPortalShell";
import PartnerSectionHeader from "@/components/partner/PartnerSectionHeader";
import {
  PUBLIC_LEAD_PROCESS_STEPS,
  formatSpaceRequirementLabel,
  isInquiryFullyCompleted,
} from "@/lib/commercial-pipeline";
import type { FavoriteSpace } from "@/lib/favorite-spaces";

type Props = {
  displayName: string;
  loading: boolean;
  leads: PartnerLead[];
  favorites: FavoriteSpace[];
  summary: PartnerSummary;
  onExplore: () => void;
  pickerReady: boolean;
};

type LeadVisualMeta = {
  label: string;
  badgeClass: string;
  dotClass: string;
  barClass: string;
  currentStep: number;
  totalSteps: number;
  progressPercent: number;
  isRejected: boolean;
};

function getLeadVisualMeta(lead: PartnerLead): LeadVisualMeta {
  const totalSteps =
    lead.workflowVersion?.steps?.length || PUBLIC_LEAD_PROCESS_STEPS.length;
  const isCompleted = isInquiryFullyCompleted(lead.status);
  const isRejected = lead.status === "REJECTED" || lead.status === "CLOSED_LOST";
  const currentStep = isCompleted
    ? totalSteps
    : Math.min(Math.max(lead.currentStepOrder || 1, 1), totalSteps);
  const completedCount = isCompleted ? totalSteps : Math.max(currentStep - 1, 0);
  const progressPercent = isRejected
    ? 0
    : isCompleted
      ? 100
      : Math.max(8, Math.round((completedCount / totalSteps) * 100));

  if (isCompleted) {
    return {
      label: "Selesai",
      badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-800",
      dotClass: "bg-emerald-600",
      barClass: "bg-emerald-600",
      currentStep,
      totalSteps,
      progressPercent: 100,
      isRejected: false,
    };
  }

  if (isRejected) {
    return {
      label: "Ditolak",
      badgeClass: "border border-rose-200 bg-rose-50 text-rose-800",
      dotClass: "bg-rose-600",
      barClass: "bg-rose-300",
      currentStep,
      totalSteps,
      progressPercent: 0,
      isRejected: true,
    };
  }

  const activeStep = lead.workflowVersion?.steps?.find(
    (s) => s.stepOrder === lead.currentStepOrder
  );

  return {
    label: activeStep
      ? `Tahap ${lead.currentStepOrder}: ${activeStep.title}`
      : "Sedang diproses",
    badgeClass: "border border-rose-200 bg-rose-50/80 text-[#a60f28]",
    dotClass: "bg-[#c41230]",
    barClass: "bg-[#c41230]",
    currentStep,
    totalSteps,
    progressPercent,
    isRejected: false,
  };
}

function formatDateId(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Ringkasan Dashboard Portal Mitra dengan progres pengajuan dan unit favorit. */
export default function DashboardOverview({
  displayName,
  loading,
  leads,
  favorites,
  summary,
  onExplore,
  pickerReady,
}: Props) {
  const recentLeads = leads.slice(0, 4);
  const recentFavorites = favorites.slice(0, 4);
  const hasFavorites = recentFavorites.length > 0;

  return (
    <>
      <PartnerSectionHeader
        displayName={displayName}
        title="Dashboard Mitra"
        subtitle="Ringkasan pengajuan, favorit, dan akses cepat ke virtual tour"
        onExplore={onExplore}
        pickerReady={pickerReady}
      />

      {/* Strip Ringkasan Angka */}
      <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-xs sm:grid-cols-2 xl:grid-cols-4">
        <MetricCell
          title="Total Pengajuan"
          value={loading ? "—" : summary.total}
          caption="Semua riwayat pengajuan"
        />
        <MetricCell
          title="Sedang Diproses"
          value={loading ? "—" : summary.active}
          caption="Dalam peninjauan komersial"
          highlight={!loading && summary.active > 0}
        />
        <MetricCell
          title="Unit Favorit"
          value={loading ? "—" : favorites.length}
          caption="Disimpan dari tur 360°"
        />
        <MetricCell
          title="Disetujui"
          value={loading ? "—" : summary.won}
          caption="Siap lanjut ke operasi"
        />
      </div>

      {/* Bar Aksi Cepat */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <QuickActionRow
          icon={<FileText className="size-4" strokeWidth={1.5} />}
          title="Pengajuan Sewa"
          description="Pantau status seluruh pengajuan"
          href="/partner/inquiries"
        />
        <QuickActionRow
          icon={<Heart className="size-4" strokeWidth={1.5} />}
          title="Unit Favorit"
          description="Tinjau unit yang Anda simpan"
          href="/partner/favorites"
        />
        <QuickActionRow
          icon={<Plus className="size-4" strokeWidth={1.5} />}
          title="Ajukan Unit Baru"
          description="Pilih stasiun di tur 360°"
          onClick={onExplore}
          disabled={!pickerReady}
          accent
        />
      </div>

      {/* Workspace Utama: Pengajuan Saya (lebar) & Favorit Terbaru (pendamping) */}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-12">
        <section
          className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs ${
            hasFavorites ? "lg:col-span-8" : "lg:col-span-12"
          }`}
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-[#101828]">
              Pengajuan Saya
            </h2>
            <Link
              href="/partner/inquiries"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#c41230] transition-colors hover:text-[#a60f28]"
            >
              Lihat semua
              <ChevronRight className="size-4" strokeWidth={1.5} />
            </Link>
          </div>

          {loading ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              Memuat pengajuan...
            </div>
          ) : recentLeads.length === 0 ? (
            <div className="p-5">
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-10 text-center">
                <p className="text-sm text-slate-600">
                  Belum ada pengajuan sewa. Pilih stasiun di tur virtual untuk mulai mengajukan unit.
                </p>
                <button
                  type="button"
                  onClick={onExplore}
                  disabled={!pickerReady}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#c41230] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#a60f28] disabled:opacity-50"
                >
                  <Glasses className="size-4" strokeWidth={1.5} />
                  Jelajahi Virtual Tour
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentLeads.map((lead) => {
                const meta = getLeadVisualMeta(lead);
                const stationName = lead.space?.station?.name ?? "Stasiun";
                const areaLabel = lead.space ? `${lead.space.area} m²` : "-";

                return (
                  <div
                    key={lead.id}
                    className="px-5 py-4 transition-colors hover:bg-slate-50/70"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${meta.badgeClass}`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${meta.dotClass}`}
                              aria-hidden
                            />
                            {meta.label}
                          </span>
                          <span className="text-xs font-medium tabular-nums text-slate-500">
                            {lead.inquiryCode || "Pengajuan"}
                          </span>
                        </div>

                        <h3 className="mt-2 truncate text-sm font-semibold text-[#101828]">
                          {lead.space
                            ? `${lead.space.code} — ${lead.space.name}`
                            : formatSpaceRequirementLabel(lead.spaceRequirement) ||
                              "Pengajuan Ruang Komersial"}
                        </h3>

                        <p className="mt-1 text-xs tabular-nums text-slate-500">
                          {stationName} · {areaLabel}
                          {lead.businessType ? ` · ${lead.businessType}` : ""}
                        </p>
                      </div>

                      <Link
                        href={`/partner/inquiries/${lead.id}`}
                        className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-[#101828]"
                      >
                        Lihat Detail
                        <ChevronRight className="size-4 text-slate-500" strokeWidth={1.5} />
                      </Link>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-[180px] items-center gap-3">
                        <div className="h-1 w-28 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${meta.barClass}`}
                            style={{ width: `${meta.progressPercent}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-slate-500">
                          {meta.isRejected
                            ? "Dihentikan"
                            : `Tahap ${meta.currentStep}/${meta.totalSteps}`}
                        </span>
                      </div>

                      <span className="text-xs tabular-nums text-slate-500">
                        Diajukan {formatDateId(lead.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {hasFavorites && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs lg:col-span-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-[#101828]">
                Favorit Terbaru
              </h2>
              <Link
                href="/partner/favorites"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#c41230] transition-colors hover:text-[#a60f28]"
              >
                Lihat semua
                <ChevronRight className="size-4" strokeWidth={1.5} />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {recentFavorites.map((item) => (
                <div
                  key={item.spaceId}
                  className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-slate-50/70"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#101828]">
                      {item.code} — {item.name}
                    </p>
                    <p className="mt-1 truncate text-xs tabular-nums text-slate-500">
                      {item.stationName} · {item.area} m²
                    </p>
                  </div>
                  <Link
                    href={`/station/${item.stationSlug}?unit=${item.spaceId}`}
                    className="inline-flex h-8 shrink-0 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-[#101828]"
                  >
                    Buka
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function MetricCell({
  title,
  value,
  caption,
  highlight = false,
}: {
  title: string;
  value: number | string;
  caption: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white p-5">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p
        className={`mt-2 text-[28px] leading-none font-semibold tracking-tight tabular-nums ${
          highlight ? "text-[#c41230]" : "text-[#101828]"
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-xs text-slate-500">{caption}</p>
    </div>
  );
}

function QuickActionRow({
  icon,
  title,
  description,
  href,
  onClick,
  disabled,
  accent = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  const classes =
    "flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-xs transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50";

  const body = (
    <>
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={`flex size-8 flex-none items-center justify-center rounded-lg ${
            accent
              ? "bg-[#c41230] text-white"
              : "border border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-[#101828]">
            {title}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {description}
          </span>
        </span>
      </span>
      <ChevronRight className="size-4 flex-none text-slate-500" strokeWidth={1.5} />
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={classes}
    >
      {body}
    </button>
  );
}
