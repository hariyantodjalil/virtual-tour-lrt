"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  FileText,
  Inbox,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Timer,
  TrainFront,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cmsFetch } from "@/lib/cms-fetch";
import WorkflowVersionBadge from "@/components/cms/WorkflowVersionBadge";
import { CMS_LEADS_UPDATED_EVENT } from "@/lib/inquiry-sync-events";
import { useInquiryRealtimeSync } from "@/components/realtime/useInquiryRealtimeSync";
import {
  PUBLIC_LEAD_PROCESS_STEPS,
  SPACE_TYPE_LABELS,
  resolveLeadStepSla,
  type StepSlaInfo,
} from "@/lib/commercial-pipeline";
import {
  SLA_BADGE_CLASSES,
  SPACE_STATUS_BADGE_CLASSES,
  formatDateId,
  formatSpaceRequirementLabel,
  getLeadStatusLabel,
  getSiteVisitStatusLabel,
  getSpaceStatusLabel,
  type CmsLeadSummary,
} from "./lead-types";

type StatusTab = "ALL" | "INITIAL" | "IN_PROGRESS" | "WON" | "LOST";
type SortOption = "NEWEST" | "URGENT_SLA" | "UPDATED_DESC" | "UPDATED_ASC";

type StepMeta = {
  stepOrder: number;
  totalSteps: number;
  title: string;
  sla: StepSlaInfo | null;
  slaHours: number | null;
  requiresMedia: boolean;
  documentNumberLabel: string | null;
  progressPercent: number;
};

type EnrichedLead = {
  lead: CmsLeadSummary;
  meta: StepMeta;
};

const SLA_HEALTH_RANK: Record<string, number> = {
  BREACHED: 0,
  WARNING: 1,
  SAFE: 2,
};

function compareSlaPriority(a: EnrichedLead, b: EnrichedLead): number {
  const aTerminal = a.lead.status === "CLOSED_WON" || a.lead.status === "CLOSED_LOST" ? 1 : 0;
  const bTerminal = b.lead.status === "CLOSED_WON" || b.lead.status === "CLOSED_LOST" ? 1 : 0;
  if (aTerminal !== bTerminal) return aTerminal - bTerminal;

  const aRank = a.meta.sla ? (SLA_HEALTH_RANK[a.meta.sla.health] ?? 3) : 4;
  const bRank = b.meta.sla ? (SLA_HEALTH_RANK[b.meta.sla.health] ?? 3) : 4;
  if (aRank !== bRank) return aRank - bRank;

  if (a.meta.sla && b.meta.sla && a.meta.sla.remainingMs !== b.meta.sla.remainingMs) {
    return a.meta.sla.remainingMs - b.meta.sla.remainingMs;
  }

  return new Date(b.lead.updatedAt).getTime() - new Date(a.lead.updatedAt).getTime();
}

function getActiveStepMeta(lead: CmsLeadSummary, nowDate: Date): StepMeta {
  const steps = lead.workflowVersion?.steps ?? [];
  const totalSteps = steps.length || 11;
  const activeStep =
    steps.find((s) => s.stepOrder === lead.currentStepOrder) ??
    steps.find((s) => s.leadStatus === lead.status);

  const stepOrder = activeStep?.stepOrder ?? lead.currentStepOrder ?? 1;
  const title = activeStep?.title ?? getLeadStatusLabel(lead.status);
  const slaHours = activeStep?.slaHours ?? null;
  const sla = resolveLeadStepSla({
    stepOrder,
    slaHours,
    leadCreatedAt: lead.createdAt,
    leadStatus: lead.status,
    currentStepOrder: lead.currentStepOrder,
    stepLogs: lead.stepLogs,
    now: nowDate,
  });

  const completedSteps =
    lead.status === "CLOSED_WON"
      ? totalSteps
      : Math.max(0, Math.min(stepOrder - 1, totalSteps));
  const progressPercent =
    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return {
    stepOrder,
    totalSteps,
    title,
    sla,
    slaHours,
    requiresMedia: Boolean(activeStep?.requiresMedia),
    documentNumberLabel: activeStep?.documentNumberLabel ?? null,
    progressPercent,
  };
}

/** Meja antrean pengajuan sewa & pemantauan SLA untuk Admin CMS. */
export default function LeadsClient({
  initialLeads,
  initialLoadError,
  initialNowIso,
}: {
  initialLeads: CmsLeadSummary[];
  initialLoadError: string | null;
  initialNowIso: string;
}) {
  const [leads, setLeads] = useState<CmsLeadSummary[]>(initialLeads);
  const leadsRef = useRef<CmsLeadSummary[]>(initialLeads);
  const [loadError, setLoadError] = useState<string | null>(initialLoadError);
  const [liveNotice, setLiveNotice] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => new Date(initialNowIso).getTime());

  const [query, setQuery] = useState("");
  const [statusTab, setStatusTab] = useState<StatusTab>("ALL");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [stationFilter, setStationFilter] = useState<string>("ALL");
  const [siteVisitOnly, setSiteVisitOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("NEWEST");

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

  const nowDate = useMemo(() => new Date(nowMs), [nowMs]);

  const refreshLeads = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const { silent = false } = options;
      if (!silent) {
        setIsRefreshing(true);
        setLoadError(null);
      }
      try {
        const res = await cmsFetch("/api/cms/leads", { cache: "no-store" });
        if (!res.ok) {
          if (silent) return;
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Gagal memuat ulang daftar pengajuan.");
        }
        const data = await res.json();
        const nextLeads = Array.isArray(data) ? (data as CmsLeadSummary[]) : [];
        if (silent) {
          const prevIds = new Set(leadsRef.current.map((item) => item.id));
          const addedCount = nextLeads.filter((item) => !prevIds.has(item.id)).length;
          if (addedCount > 0) {
            setLiveNotice(
              `${addedCount} pengajuan baru masuk ke antrean.`
            );
          }
        }
        leadsRef.current = nextLeads;
        setLeads(nextLeads);
        setNowMs(Date.now());
      } catch (error) {
        if (!silent) {
          setLoadError(
            error instanceof Error ? error.message : "Terjadi kesalahan saat memuat ulang data."
          );
        }
      } finally {
        if (!silent) {
          setIsRefreshing(false);
        }
      }
    },
    []
  );

  useInquiryRealtimeSync({
    enabled: true,
    localEvents: [CMS_LEADS_UPDATED_EVENT],
    onSync: async () => {
      await refreshLeads({ silent: true });
    },
  });

  const enriched = useMemo<EnrichedLead[]>(() => {
    return leads.map((lead) => ({
      lead,
      meta: getActiveStepMeta(lead, nowDate),
    }));
  }, [leads, nowDate]);

  const kpiStats = useMemo(() => {
    let initialCount = 0;
    let initialBreached = 0;
    let initialWarning = 0;
    let inProgressCount = 0;
    let activeSiteVisits = 0;
    let wonCount = 0;
    let lostCount = 0;

    for (const { lead, meta } of enriched) {
      if (lead.status === "CLOSED_WON") {
        wonCount += 1;
        continue;
      }
      if (lead.status === "CLOSED_LOST") {
        lostCount += 1;
        continue;
      }
      if (meta.stepOrder === 1) {
        initialCount += 1;
        if (meta.sla?.health === "BREACHED") initialBreached += 1;
        if (meta.sla?.health === "WARNING") initialWarning += 1;
      } else {
        inProgressCount += 1;
      }
      if (lead.siteVisitStatus === "REQUESTED" || lead.siteVisitStatus === "SCHEDULED") {
        activeSiteVisits += 1;
      }
    }

    return {
      total: leads.length,
      initialCount,
      initialBreached,
      initialWarning,
      inProgressCount,
      activeSiteVisits,
      wonCount,
      lostCount,
    };
  }, [enriched, leads.length]);

  const urgentSlaItems = useMemo(() => {
    return enriched
      .filter(
        ({ lead, meta }) =>
          lead.status !== "CLOSED_WON" &&
          lead.status !== "CLOSED_LOST" &&
          (meta.sla?.health === "BREACHED" || meta.sla?.health === "WARNING")
      )
      .sort(compareSlaPriority);
  }, [enriched]);

  const stageOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of enriched) {
      for (const step of item.lead.workflowVersion?.steps ?? []) {
        const key = step.title.trim();
        if (key && !map.has(key)) {
          map.set(key, `${step.stepOrder}. ${step.title}`);
        }
      }
    }
    if (map.size === 0) {
      PUBLIC_LEAD_PROCESS_STEPS.forEach((step, idx) => {
        map.set(step.title, `${idx + 1}. ${step.title}`);
      });
    }
    return [...map.entries()];
  }, [enriched]);

  const stationOptions = useMemo(() => {
    const map = new Map<string, string>();
    let hasNonUnit = false;
    for (const { lead } of enriched) {
      if (lead.space?.station) {
        map.set(lead.space.station.id, lead.space.station.name);
      } else {
        hasNonUnit = true;
      }
    }
    const stations = [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "id"));
    return { stations, hasNonUnit };
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = enriched.filter(({ lead, meta }) => {
      if (statusTab === "INITIAL") {
        if (lead.status === "CLOSED_WON" || lead.status === "CLOSED_LOST" || meta.stepOrder !== 1) {
          return false;
        }
      } else if (statusTab === "IN_PROGRESS") {
        if (lead.status === "CLOSED_WON" || lead.status === "CLOSED_LOST" || meta.stepOrder < 2) {
          return false;
        }
      } else if (statusTab === "WON" && lead.status !== "CLOSED_WON") {
        return false;
      } else if (statusTab === "LOST" && lead.status !== "CLOSED_LOST") {
        return false;
      }

      if (stageFilter !== "ALL") {
        if (stageFilter === "CLOSED_WON" || stageFilter === "CLOSED_LOST") {
          if (lead.status !== stageFilter) return false;
        } else if (
          lead.status === "CLOSED_WON" ||
          lead.status === "CLOSED_LOST" ||
          meta.title.trim() !== stageFilter
        ) {
          return false;
        }
      }

      if (stationFilter === "NON_UNIT") {
        if (lead.space) return false;
      } else if (stationFilter !== "ALL" && lead.space?.station.id !== stationFilter) {
        return false;
      }

      if (
        siteVisitOnly &&
        (lead.status === "CLOSED_WON" ||
          lead.status === "CLOSED_LOST" ||
          (lead.siteVisitStatus !== "REQUESTED" && lead.siteVisitStatus !== "SCHEDULED"))
      ) {
        return false;
      }

      if (!q) return true;
      const spaceTypeLabel = lead.space
        ? (SPACE_TYPE_LABELS[lead.space.type] ?? lead.space.type)
        : null;
      const haystack = [
        lead.inquiryCode,
        lead.companyName,
        lead.contactName,
        lead.phone,
        lead.email,
        lead.businessType,
        lead.spaceRequirement,
        lead.space?.code,
        lead.space?.name,
        spaceTypeLabel,
        lead.space?.station.name,
        lead.rejectionReason,
        meta.title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

    if (sortBy === "URGENT_SLA") {
      return [...list].sort(compareSlaPriority);
    }
    if (sortBy === "UPDATED_DESC") {
      return [...list].sort(
        (a, b) =>
          new Date(b.lead.updatedAt).getTime() - new Date(a.lead.updatedAt).getTime()
      );
    }
    if (sortBy === "UPDATED_ASC") {
      return [...list].sort(
        (a, b) =>
          new Date(a.lead.updatedAt).getTime() - new Date(b.lead.updatedAt).getTime()
      );
    }
    return [...list].sort(
      (a, b) =>
        new Date(b.lead.createdAt).getTime() - new Date(a.lead.createdAt).getTime()
    );
  }, [enriched, query, statusTab, stageFilter, stationFilter, siteVisitOnly, sortBy]);

  const topUrgent = urgentSlaItems[0];
  const hasActiveFilter =
    Boolean(query.trim()) ||
    statusTab !== "ALL" ||
    stageFilter !== "ALL" ||
    stationFilter !== "ALL" ||
    siteVisitOnly;

  function resetFilters() {
    setQuery("");
    setStatusTab("ALL");
    setStageFilter("ALL");
    setStationFilter("ALL");
    setSiteVisitOnly(false);
    setSortBy("NEWEST");
  }

  return (
    <div className="min-w-0 space-y-5">
      {/* Header Antrean */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#101828]">
            Antrean Pengajuan Sewa & Pemantauan SLA
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Pantau batas waktu SLA tahap aktif dan kelola progres tiap pengajuan secara berurutan
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshLeads()}
          disabled={isRefreshing}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-medium text-[#101828] transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c41230] disabled:opacity-50"
        >
          <RefreshCw
            className={`size-4 text-[#c41230] ${isRefreshing ? "animate-spin" : ""}`}
            strokeWidth={1.5}
          />
          {isRefreshing ? "Memuat..." : "Muat Ulang"}
        </button>
      </div>

      {loadError && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-800 shadow-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#c41230]" strokeWidth={1.5} />
          <p>{loadError}</p>
        </div>
      )}

      {liveNotice && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" strokeWidth={1.5} />
            <span>{liveNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setLiveNotice(null)}
            aria-label="Tutup pemberitahuan"
            className="rounded-md p-1 text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-950"
          >
            <X className="size-3.5" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Strip Ringkasan KPI (selaras kontainer CMS rounded-xl + shadow-sm) */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 shadow-sm lg:grid-cols-5">
        <MetricCell
          label="Total Pengajuan"
          value={kpiStats.total}
          hint={`${kpiStats.lostCount} dihentikan`}
        />
        <MetricCell
          label="Menunggu Awal"
          value={kpiStats.initialCount}
          highlight={kpiStats.initialBreached > 0}
          hint="Tahap 1 baru"
          footer={
            kpiStats.initialBreached > 0 || kpiStats.initialWarning > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {kpiStats.initialBreached > 0 && (
                  <span className="inline-flex items-center whitespace-nowrap rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 tabular-nums">
                    {kpiStats.initialBreached} Lewat SLA
                  </span>
                )}
                {kpiStats.initialWarning > 0 && (
                  <span className="inline-flex items-center whitespace-nowrap rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 tabular-nums">
                    {kpiStats.initialWarning} Mendekati
                  </span>
                )}
              </div>
            ) : undefined
          }
        />
        <MetricCell
          label="Proses Berjalan"
          value={kpiStats.inProgressCount}
          hint="Tahap 2 hingga selesai"
        />
        <MetricCell
          label="Site Visit Aktif"
          value={kpiStats.activeSiteVisits}
          hint="Diminta atau terjadwal"
        />
        <MetricCell
          label="Operasional Selesai"
          value={kpiStats.wonCount}
          hint="Unit berstatus Terisi"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* Banner Peringatan SLA Prioritas (kartu putih minimalis tanpa garis aksen kiri) */}
      {topUrgent && topUrgent.meta.sla && (
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border ${
                topUrgent.meta.sla.health === "BREACHED"
                  ? "border-rose-200 bg-rose-50/80 text-[#c41230]"
                  : "border-amber-200 bg-amber-50/80 text-amber-700"
              }`}
            >
              <AlertTriangle className="size-4" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[#101828]">
                  {urgentSlaItems.length} Pengajuan Membutuhkan Respons SLA Prioritas
                </p>
                <span
                  className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums ${
                    SLA_BADGE_CLASSES[topUrgent.meta.sla.health]
                  }`}
                >
                  {topUrgent.meta.sla.label}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Prioritas tertinggi:{" "}
                <span className="font-semibold text-[#101828] tabular-nums">
                  {topUrgent.lead.inquiryCode}
                </span>{" "}
                · <span className="font-medium text-[#101828]">{topUrgent.lead.companyName}</span>{" "}
                pada Tahap {topUrgent.meta.stepOrder}: {topUrgent.meta.title}
              </p>
            </div>
          </div>

          <Link
            href={`/cms/leads/${topUrgent.lead.id}`}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#c41230] px-4 text-xs font-semibold whitespace-nowrap text-white shadow-sm transition-colors hover:bg-[#a60f28] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c41230]"
          >
            Tangani Sekarang
            <ArrowRight className="size-4" strokeWidth={1.5} />
          </Link>
        </div>
      )}

      {/* Filter, Pencarian & Pengurutan */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "ALL", label: "Semua", count: kpiStats.total },
                  { id: "INITIAL", label: "Menunggu Awal", count: kpiStats.initialCount },
                  { id: "IN_PROGRESS", label: "Proses Berjalan", count: kpiStats.inProgressCount },
                  { id: "WON", label: "Selesai", count: kpiStats.wonCount },
                  { id: "LOST", label: "Dihentikan", count: kpiStats.lostCount },
                ] as const
              ).map((tab) => {
                const active = statusTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusTab(tab.id)}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c41230] ${
                      active
                        ? "bg-[#c41230] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-[#101828]"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-xs tabular-nums ${
                        active ? "bg-white/20 text-white" : "bg-white text-slate-600"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setSiteVisitOnly((prev) => !prev)}
              aria-pressed={siteVisitOnly}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c41230] ${
                siteVisitOnly
                  ? "border-[#c41230] bg-rose-50 text-[#c41230]"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <CalendarClock
                className={`size-3.5 ${siteVisitOnly ? "text-[#c41230]" : "text-slate-400"}`}
                strokeWidth={1.5}
              />
              <span>Site Visit Aktif</span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-xs tabular-nums ${
                  siteVisitOnly ? "bg-[#c41230] text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {kpiStats.activeSiteVisits}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_200px_185px_195px]">
            <div className="relative min-w-0">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
                strokeWidth={1.5}
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari kode, mitra, PIC, telp, unit, atau stasiun"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-xs text-[#101828] placeholder:text-slate-400 transition-colors focus:border-[#c41230] focus:outline-none"
              />
            </div>

            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger
                aria-label="Filter tahapan"
                className="h-9 w-full rounded-lg border-slate-200 bg-white px-3 text-xs font-medium text-[#101828] focus:border-[#c41230] focus:ring-0 focus:ring-offset-0 focus-visible:ring-2 focus-visible:ring-[#c41230]/25"
              >
                <SelectValue placeholder="Semua Tahapan" />
              </SelectTrigger>
              <SelectContent className="border-slate-200 bg-white">
                <SelectItem value="ALL" className="text-xs">
                  Semua Tahapan
                </SelectItem>
                {stageOptions.map(([value, label]) => (
                  <SelectItem key={value} value={value} className="text-xs">
                    {label}
                  </SelectItem>
                ))}
                <SelectItem value="CLOSED_WON" className="text-xs">
                  Operasional Komersial (Selesai)
                </SelectItem>
                <SelectItem value="CLOSED_LOST" className="text-xs">
                  Drop-off (Dihentikan)
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={stationFilter} onValueChange={setStationFilter}>
              <SelectTrigger
                aria-label="Filter stasiun"
                className="h-9 w-full rounded-lg border-slate-200 bg-white px-3 text-xs font-medium text-[#101828] focus:border-[#c41230] focus:ring-0 focus:ring-offset-0 focus-visible:ring-2 focus-visible:ring-[#c41230]/25"
              >
                <SelectValue placeholder="Semua Stasiun" />
              </SelectTrigger>
              <SelectContent className="border-slate-200 bg-white">
                <SelectItem value="ALL" className="text-xs">
                  Semua Stasiun
                </SelectItem>
                {stationOptions.stations.map(([id, name]) => (
                  <SelectItem key={id} value={id} className="text-xs">
                    {name}
                  </SelectItem>
                ))}
                {stationOptions.hasNonUnit && (
                  <SelectItem value="NON_UNIT" className="text-xs">
                    Non-Unit Stasiun
                  </SelectItem>
                )}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger
                aria-label="Urutkan antrean"
                className="h-9 w-full rounded-lg border-slate-200 bg-white px-3 text-xs font-medium text-[#101828] focus:border-[#c41230] focus:ring-0 focus:ring-offset-0 focus-visible:ring-2 focus-visible:ring-[#c41230]/25"
              >
                <SelectValue placeholder="Urutkan" />
              </SelectTrigger>
              <SelectContent className="border-slate-200 bg-white">
                <SelectItem value="NEWEST" className="text-xs">
                  Urut: Terbaru Masuk
                </SelectItem>
                <SelectItem value="URGENT_SLA" className="text-xs">
                  Urut: SLA Mendesak Dulu
                </SelectItem>
                <SelectItem value="UPDATED_DESC" className="text-xs">
                  Urut: Terbaru Diperbarui
                </SelectItem>
                <SelectItem value="UPDATED_ASC" className="text-xs">
                  Urut: Terlama Mengendap
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Daftar Antrean Operasional */}
      <section className="min-w-0 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2">
            <Inbox className="size-4 text-[#c41230]" strokeWidth={1.5} />
            <h3 className="text-sm font-semibold text-[#101828]">Daftar Antrean Pengajuan</h3>
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            Menampilkan {filtered.length} dari {leads.length} pengajuan
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <Inbox className="size-10 text-slate-300" strokeWidth={1.5} />
            <p className="mt-3 text-sm font-semibold text-[#101828]">
              Tidak ada pengajuan yang cocok dengan filter
            </p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500">
              Ubah kata kunci pencarian, tab kelompok status, atau filter lainnya untuk melihat data antrean
            </p>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-medium text-[#101828] transition-colors hover:bg-slate-50"
              >
                Reset Filter
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Tampilan Kartu Lega Mobile (< md) */}
            <div className="divide-y divide-slate-200 md:hidden">
              {filtered.map((item) => (
                <MobileLeadCard key={item.lead.id} item={item} />
              ))}
            </div>

            {/* Tampilan Tabel Desktop (md+) */}
            <div className="hidden w-full overflow-x-auto md:block">
              <table className="w-full min-w-[780px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                    <th className="py-3.5 pr-2 pl-4">Kode & Waktu</th>
                    <th className="px-2 py-3.5">Mitra & Kontak</th>
                    <th className="px-2 py-3.5">Unit & Lokasi</th>
                    <th className="px-2 py-3.5">Tahap Aktif</th>
                    <th className="px-2 py-3.5">SLA</th>
                    <th className="px-2 py-3.5">Visit & Berkas</th>
                    <th className="py-3.5 pr-4 pl-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.map((item) => (
                    <DesktopLeadRow key={item.lead.id} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function MetricCell({
  label,
  value,
  hint,
  highlight = false,
  footer,
  className = "",
}: {
  label: string;
  value: number;
  hint: string;
  highlight?: boolean;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col justify-between bg-white p-4 sm:p-5 ${className}`}>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p
          className={`mt-2 text-[26px] leading-none font-semibold tracking-tight tabular-nums ${
            highlight ? "text-[#c41230]" : "text-[#101828]"
          }`}
        >
          {value}
        </p>
      </div>
      <div className="mt-2.5 min-h-[22px]">
        {footer ?? <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

function DesktopLeadRow({ item }: { item: EnrichedLead }) {
  const { lead, meta } = item;

  return (
    <tr className="transition-colors hover:bg-slate-50/80">
      <td className="w-[126px] py-5 pr-2 pl-4 align-top">
        <div className="flex flex-wrap items-center gap-1.5">
          <LeadCodeBadge code={lead.inquiryCode} />
          {lead.workflowVersion && (
            <WorkflowVersionBadge
              version={lead.workflowVersion.version}
              status={lead.workflowVersion.status}
              title={lead.workflowVersion.title}
              size="xs"
              showIcon={false}
              compact
            />
          )}
        </div>
        <div className="mt-2.5 space-y-1 text-xs leading-snug tabular-nums">
          <p className="text-slate-600">Masuk {formatDateId(lead.createdAt)}</p>
          <p className="text-slate-500">Update {formatDateId(lead.updatedAt, true)}</p>
        </div>
      </td>

      <td className="max-w-[185px] px-2 py-5 align-top">
        <LeadPartnerSummary lead={lead} />
      </td>

      <td className="max-w-[185px] px-2 py-5 align-top">
        <LeadUnitLocation lead={lead} />
      </td>

      <td className="max-w-[195px] px-2 py-5 align-top">
        <LeadStageProgress lead={lead} meta={meta} />
      </td>

      <td className="px-2 py-5 align-top">
        <LeadSlaCell leadStatus={lead.status} meta={meta} />
      </td>

      <td className="max-w-[125px] px-2 py-5 align-top">
        <LeadVisitAndDocs lead={lead} />
      </td>

      <td className="whitespace-nowrap py-5 pr-4 pl-2 text-right align-top">
        <LeadActionLink leadId={lead.id} />
      </td>
    </tr>
  );
}

function MobileLeadCard({ item }: { item: EnrichedLead }) {
  const { lead, meta } = item;

  return (
    <article className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <LeadCodeBadge code={lead.inquiryCode} />
            {lead.workflowVersion && (
              <WorkflowVersionBadge
                version={lead.workflowVersion.version}
                status={lead.workflowVersion.status}
                title={lead.workflowVersion.title}
                size="xs"
                showIcon={false}
                compact
              />
            )}
            <span className="text-xs text-slate-600 tabular-nums">
              Masuk {formatDateId(lead.createdAt)}
            </span>
          </div>
          <p className="text-xs text-slate-500 tabular-nums">
            Diperbarui {formatDateId(lead.updatedAt, true)}
          </p>
        </div>
        <LeadSlaCell leadStatus={lead.status} meta={meta} alignRight />
      </div>

      <LeadPartnerSummary lead={lead} />

      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
        <LeadUnitLocation lead={lead} />
      </div>

      <LeadStageProgress lead={lead} meta={meta} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3.5">
        <LeadVisitAndDocs lead={lead} />
        <LeadActionLink leadId={lead.id} />
      </div>
    </article>
  );
}

function LeadCodeBadge({ code }: { code: string }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-[#101828] tabular-nums">
      {code}
    </span>
  );
}

function LeadPartnerSummary({ lead }: { lead: CmsLeadSummary }) {
  return (
    <div className="flex items-start gap-2.5">
      <Building2 className="mt-0.5 size-4 shrink-0 text-slate-400" strokeWidth={1.5} />
      <div className="min-w-0 space-y-1">
        <p
          className="line-clamp-2 text-sm font-semibold leading-snug text-[#101828]"
          title={lead.companyName}
        >
          {lead.companyName}
        </p>
        <p
          className="line-clamp-2 text-xs leading-relaxed text-slate-600"
          title={`${lead.contactName} · ${lead.businessType}`}
        >
          {lead.contactName} · {lead.businessType}
        </p>
        <p
          className="flex items-center gap-1.5 text-xs text-slate-600 tabular-nums"
          title={lead.email}
        >
          <Phone className="size-3.5 shrink-0 text-slate-400" strokeWidth={1.5} />
          <span className="truncate">{lead.phone}</span>
        </p>
      </div>
    </div>
  );
}

function LeadUnitLocation({ lead }: { lead: CmsLeadSummary }) {
  if (lead.space) {
    const unitStatusClass =
      SPACE_STATUS_BADGE_CLASSES[lead.space.status] ??
      "border-slate-200 bg-slate-50 text-slate-700";
    const unitTypeLabel = SPACE_TYPE_LABELS[lead.space.type] ?? lead.space.type;

    return (
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="whitespace-nowrap text-sm font-semibold text-[#101828] tabular-nums">
            {lead.space.code}
          </span>
          <span
            className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium ${unitStatusClass}`}
          >
            {getSpaceStatusLabel(lead.space.status)}
          </span>
        </div>
        <p
          className="line-clamp-2 text-xs leading-relaxed text-slate-700"
          title={`${lead.space.name} (${unitTypeLabel})`}
        >
          {lead.space.name} · {unitTypeLabel}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin className="size-3.5 shrink-0 text-slate-400" strokeWidth={1.5} />
          <span className="truncate">{lead.space.station.name}</span>
        </p>
      </div>
    );
  }

  const isTrainUnit = Boolean(lead.spaceRequirement?.startsWith("TRAIN_"));
  const LocationIcon = isTrainUnit ? TrainFront : MapPin;

  return (
    <div className="space-y-1">
      <p
        title={lead.spaceRequirement || undefined}
        className="flex items-start gap-1.5 text-xs font-medium leading-relaxed text-[#101828]"
      >
        <LocationIcon className="mt-0.5 size-3.5 shrink-0 text-slate-400" strokeWidth={1.5} />
        <span className="line-clamp-2">
          {formatSpaceRequirementLabel(lead.spaceRequirement) || "Tanpa unit spesifik"}
        </span>
      </p>
      <p className="pl-5 text-xs text-slate-500">Belum terikat unit stasiun</p>
    </div>
  );
}

function LeadStageProgress({ lead, meta }: { lead: CmsLeadSummary; meta: StepMeta }) {
  const isWon = lead.status === "CLOSED_WON";
  const isLost = lead.status === "CLOSED_LOST";

  return (
    <div className="space-y-2">
      {isWon ? (
        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="size-3.5 shrink-0" strokeWidth={1.5} />
          Selesai ({meta.totalSteps}/{meta.totalSteps})
        </span>
      ) : isLost ? (
        <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
          Dihentikan di Tahap {meta.stepOrder}
        </span>
      ) : (
        <p className="text-xs leading-relaxed font-semibold text-[#101828]">
          Tahap {meta.stepOrder} dari {meta.totalSteps}:{" "}
          <span className="font-normal text-slate-700">{meta.title}</span>
        </p>
      )}

      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${
            isLost ? "bg-rose-500" : isWon ? "bg-emerald-600" : "bg-[#c41230]"
          }`}
          style={{
            width: `${isWon ? 100 : Math.max(meta.progressPercent, 8)}%`,
          }}
        />
      </div>

      {isLost && lead.rejectionReason ? (
        <p
          className="line-clamp-2 text-xs leading-relaxed text-rose-700"
          title={lead.rejectionReason}
        >
          Alasan: {lead.rejectionReason}
        </p>
      ) : !isWon && !isLost && meta.documentNumberLabel ? (
        <p className="truncate text-xs text-slate-500" title={meta.documentNumberLabel}>
          Perlu nomor: {meta.documentNumberLabel}
        </p>
      ) : !isWon && !isLost && meta.requiresMedia ? (
        <p className="text-xs text-slate-500">Perlu dokumen resmi</p>
      ) : isWon ? (
        <p className="text-xs text-emerald-700">Unit beroperasi & penyewa aktif</p>
      ) : null}
    </div>
  );
}

function LeadSlaCell({
  leadStatus,
  meta,
  alignRight = false,
}: {
  leadStatus: string;
  meta: StepMeta;
  alignRight?: boolean;
}) {
  const isTerminal = leadStatus === "CLOSED_WON" || leadStatus === "CLOSED_LOST";

  return (
    <div className={`space-y-1.5 ${alignRight ? "text-right" : ""}`}>
      <LeadSlaBadge sla={meta.sla} />
      {!isTerminal && meta.slaHours && (
        <p className="text-xs text-slate-500 tabular-nums">Target {meta.slaHours} jam</p>
      )}
    </div>
  );
}

function LeadSlaBadge({ sla }: { sla: StepSlaInfo | null }) {
  if (!sla) {
    return <span className="text-xs whitespace-nowrap text-slate-400">Tanpa SLA</span>;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums ${
        SLA_BADGE_CLASSES[sla.health]
      }`}
    >
      <Timer className="size-3.5 shrink-0" strokeWidth={1.5} />
      {sla.label}
    </span>
  );
}

function LeadVisitAndDocs({ lead }: { lead: CmsLeadSummary }) {
  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex items-start gap-1.5 text-slate-700">
        <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-slate-400" strokeWidth={1.5} />
        <span className="leading-snug">{getSiteVisitStatusLabel(lead.siteVisitStatus)}</span>
      </div>
      {lead.siteVisitScheduledAt && (
        <p className="pl-5 text-xs text-slate-500 tabular-nums">
          {formatDateId(lead.siteVisitScheduledAt, true)}
        </p>
      )}
      <p className="flex items-center gap-1.5 whitespace-nowrap text-slate-600 tabular-nums">
        <FileText className="size-3.5 shrink-0 text-slate-400" strokeWidth={1.5} />
        <span>{lead._count.mediaAttachments} dokumen</span>
      </p>
    </div>
  );
}

function LeadActionLink({ leadId }: { leadId: string }) {
  return (
    <Link
      href={`/cms/leads/${leadId}`}
      className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#c41230] px-3 text-xs font-semibold whitespace-nowrap text-white shadow-sm transition-colors hover:bg-[#a60f28] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c41230]"
    >
      Kelola Pengajuan
      <ArrowRight className="size-3.5 text-white" strokeWidth={1.5} />
    </Link>
  );
}
