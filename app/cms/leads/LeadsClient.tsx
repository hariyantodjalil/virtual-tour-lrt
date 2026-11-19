"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
} from "lucide-react";
import { cmsFetch } from "@/lib/cms-fetch";
import { cmsLeadDetailHref, leadStageBadgeClass, type LeadItem } from "@/lib/cms-leads-shared";
import { leaseExpiryReminder } from "@/lib/inquiry-workflow";
import {
  ADMIN_LEAD_STATUSES,
  canonicalLeadStatus,
  LEAD_STATUS_LABELS,
  SITE_VISIT_STATUS_LABELS,
  type CommercialLeadStatus,
  type CommercialSiteVisitStatus,
} from "@/lib/commercial-pipeline";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CMS_LEADS_UPDATED_EVENT } from "@/lib/inquiry-sync-events";
import { useInquiryRealtimeSync } from "@/components/realtime/useInquiryRealtimeSync";

export type { LeadItem } from "@/lib/cms-leads-shared";

const PAGE_SIZES = [10, 25, 50];

type StatusTab = "ALL" | "INITIAL" | "IN_PROGRESS" | "WON" | "LOST";
type SortOption = "NEWEST" | "UPDATED_DESC" | "UPDATED_ASC";

function unitLabel(lead: LeadItem) {
  if (lead.space) return `${lead.space.code} · ${lead.space.station.name}`;
  if (lead.trainInquiry?.mediaTitle) return lead.trainInquiry.mediaTitle;
  return "Tanpa unit spesifik";
}

function isWonStatus(status: string) {
  const canonical = canonicalLeadStatus(status as CommercialLeadStatus);
  return canonical === "COMMERCIAL_OPERATION";
}

function isLostStatus(status: string) {
  return canonicalLeadStatus(status as CommercialLeadStatus) === "CLOSED_LOST";
}

function isInitialStatus(status: string) {
  return canonicalLeadStatus(status as CommercialLeadStatus) === "NEW";
}

function isActiveSiteVisit(status: string) {
  return status === "REQUESTED" || status === "SCHEDULED";
}

export default function LeadsClient({
  initialLeads,
  initialLoadError,
}: {
  initialLeads: LeadItem[];
  initialLoadError: string | null;
}) {
  const [leads, setLeads] = useState<LeadItem[]>(() =>
    Array.isArray(initialLeads) ? initialLeads : []
  );
  const [loadError, setLoadError] = useState(initialLoadError);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusTab, setStatusTab] = useState<StatusTab>("ALL");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [stationFilter, setStationFilter] = useState("ALL");
  const [siteVisitOnly, setSiteVisitOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("NEWEST");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // App Router may restore this client state on Back. Refresh data without resetting filters.
  useEffect(() => {
    let request: AbortController | undefined;
    async function revalidateOnReturn() {
      if (window.location.pathname !== "/cms/leads") return;
      request?.abort();
      const controller = new AbortController();
      request = controller;
      try {
        const response = await cmsFetch("/api/cms/leads", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data: unknown = await response.json();
        if (!response.ok || !Array.isArray(data)) throw new Error("Invalid lead response");
        if (!controller.signal.aborted) {
          setLeads(data as LeadItem[]);
          setLoadError(null);
        }
      } catch {
        if (!controller.signal.aborted) {
          setLoadError(
            "Data mungkin belum terbaru. Gunakan Muat ulang untuk memperbarui daftar."
          );
        }
      }
    }
    void revalidateOnReturn();
    window.addEventListener("pageshow", revalidateOnReturn);
    window.addEventListener("popstate", revalidateOnReturn);
    return () => {
      request?.abort();
      window.removeEventListener("pageshow", revalidateOnReturn);
      window.removeEventListener("popstate", revalidateOnReturn);
    };
  }, []);

  const kpiStats = useMemo(() => {
    let initialCount = 0;
    let inProgressCount = 0;
    let wonCount = 0;
    let lostCount = 0;
    let activeSiteVisits = 0;

    for (const lead of leads) {
      if (isWonStatus(lead.status)) {
        wonCount += 1;
      } else if (isLostStatus(lead.status)) {
        lostCount += 1;
      } else if (isInitialStatus(lead.status)) {
        initialCount += 1;
      } else {
        inProgressCount += 1;
      }
      if (
        !isWonStatus(lead.status) &&
        !isLostStatus(lead.status) &&
        isActiveSiteVisit(lead.siteVisitStatus)
      ) {
        activeSiteVisits += 1;
      }
    }

    return {
      total: leads.length,
      initialCount,
      inProgressCount,
      wonCount,
      lostCount,
      activeSiteVisits,
    };
  }, [leads]);

  const stationOptions = useMemo(() => {
    const names = new Set<string>();
    let hasNonUnit = false;
    for (const lead of leads) {
      if (lead.space?.station.name) names.add(lead.space.station.name);
      else hasNonUnit = true;
    }
    return {
      stations: [...names].sort((a, b) => a.localeCompare(b, "id")),
      hasNonUnit,
    };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const text = query.trim().toLowerCase();
    const list = leads.filter((lead) => {
      const canonical = canonicalLeadStatus(lead.status as CommercialLeadStatus);

      if (statusTab === "INITIAL") {
        if (!isInitialStatus(lead.status)) return false;
      } else if (statusTab === "IN_PROGRESS") {
        if (isInitialStatus(lead.status) || isWonStatus(lead.status) || isLostStatus(lead.status)) {
          return false;
        }
      } else if (statusTab === "WON") {
        if (!isWonStatus(lead.status)) return false;
      } else if (statusTab === "LOST") {
        if (!isLostStatus(lead.status)) return false;
      }

      if (stageFilter !== "ALL" && canonical !== stageFilter) return false;

      if (stationFilter === "NON_UNIT") {
        if (lead.space) return false;
      } else if (stationFilter !== "ALL" && lead.space?.station.name !== stationFilter) {
        return false;
      }

      if (
        siteVisitOnly &&
        (isWonStatus(lead.status) ||
          isLostStatus(lead.status) ||
          !isActiveSiteVisit(lead.siteVisitStatus))
      ) {
        return false;
      }

      if (!text) return true;
      return [
        lead.inquiryCode,
        lead.companyName,
        lead.contactName,
        lead.phone,
        lead.email,
        lead.businessType,
        lead.space?.code,
        lead.space?.name,
        lead.space?.station.name,
        lead.trainInquiry?.mediaTitle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(text);
    });

    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === "UPDATED_ASC") {
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      }
      if (sortBy === "UPDATED_DESC") {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted;
  }, [leads, query, statusTab, stageFilter, stationFilter, siteVisitOnly, sortBy]);

  const reminders = leads
    .flatMap((lead) => {
      if (!["COMMERCIAL_OPERATION", "CLOSED_WON"].includes(lead.status)) return [];
      const reminder = leaseExpiryReminder(lead.leaseEndAt);
      return reminder ? [{ lead, reminder }] : [];
    })
    .sort((a, b) => a.reminder.remainingDays - b.reminder.remainingDays);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filteredLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const from = filteredLeads.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, filteredLeads.length);
  const filtersActive =
    Boolean(query.trim()) ||
    statusTab !== "ALL" ||
    stageFilter !== "ALL" ||
    stationFilter !== "ALL" ||
    siteVisitOnly ||
    sortBy !== "NEWEST";

  function resetFilters() {
    setQuery("");
    setStatusTab("ALL");
    setStageFilter("ALL");
    setStationFilter("ALL");
    setSiteVisitOnly(false);
    setSortBy("NEWEST");
    setPage(1);
  }

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setIsLoading(true);
    if (!opts?.silent) setLoadError(null);
    try {
      const response = await cmsFetch("/api/cms/leads", { cache: "no-store" });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(data)) {
        throw new Error("Data pengajuan gagal dimuat. Silakan coba lagi.");
      }
      setLeads(data as LeadItem[]);
      setLoadError(null);
    } catch (cause) {
      if (!opts?.silent) {
        setLoadError(
          cause instanceof Error
            ? cause.message
            : "Tidak dapat terhubung ke layanan pengajuan."
        );
      }
    } finally {
      if (!opts?.silent) setIsLoading(false);
    }
  }, []);

  useInquiryRealtimeSync({
    enabled: true,
    localEvents: [CMS_LEADS_UPDATED_EVENT],
    fallbackIntervalMs: 60_000,
    onSync: async () => {
      await load({ silent: true });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLoading}
          onClick={() => void load()}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isLoading ? "animate-spin motion-reduce:animate-none" : ""}`}
          />
          {isLoading ? "Memuat…" : "Muat ulang"}
        </Button>
      </div>

      {reminders.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-900">
              Monitoring masa sewa · {reminders.length} perlu tindak lanjut
            </CardTitle>
            <CardDescription className="text-amber-800">
              Pengingat internal H-90, H-60, dan H-30 berdasarkan tanggal akhir PKS.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-amber-200">
              {reminders.map(({ lead, reminder }) => (
                <li key={lead.id}>
                  <Link
                    href={cmsLeadDetailHref(lead.id)}
                    prefetch={false}
                    className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded py-2 text-sm text-amber-900 focus-visible:outline-2 focus-visible:outline-amber-700"
                  >
                    <span className="min-w-0 break-words">
                      {lead.companyName} · {lead.inquiryCode}
                    </span>
                    <span className="font-semibold">
                      {reminder.label} ·{" "}
                      {reminder.remainingDays >= 0
                        ? `${reminder.remainingDays} hari tersisa`
                        : `${-reminder.remainingDays} hari lewat`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {loadError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Pengajuan tidak dapat dimuat</p>
            <p className="mt-1">{loadError}</p>
          </div>
        </div>
      )}

      {/* Filter, pencarian & pengurutan — Operate chrome CMS */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Kelompok status pengajuan">
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
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setStatusTab(tab.id);
                      setPage(1);
                    }}
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
              onClick={() => {
                setSiteVisitOnly((prev) => !prev);
                setPage(1);
              }}
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
                aria-hidden
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
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Cari kode, mitra, PIC, telp, unit, atau stasiun"
                aria-label="Cari pengajuan"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-xs text-[#101828] placeholder:text-slate-400 transition-colors focus:border-[#c41230] focus:outline-none"
              />
            </div>

            <Select
              value={stageFilter}
              onValueChange={(value) => {
                setStageFilter(value);
                setPage(1);
              }}
            >
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
                {ADMIN_LEAD_STATUSES.map((status) => (
                  <SelectItem key={status} value={status} className="text-xs">
                    {LEAD_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={stationFilter}
              onValueChange={(value) => {
                setStationFilter(value);
                setPage(1);
              }}
            >
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
                {stationOptions.stations.map((name) => (
                  <SelectItem key={name} value={name} className="text-xs">
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

            <Select
              value={sortBy}
              onValueChange={(value) => {
                setSortBy(value as SortOption);
                setPage(1);
              }}
            >
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
                <SelectItem value="UPDATED_DESC" className="text-xs">
                  Urut: Terbaru Diperbarui
                </SelectItem>
                <SelectItem value="UPDATED_ASC" className="text-xs">
                  Urut: Terlama Mengendap
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtersActive && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#101828] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c41230]"
              >
                Reset filter
              </button>
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Daftar Pengajuan</CardTitle>
            <CardDescription>
              {filteredLeads.length} dari {leads.length} pengajuan
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Brand</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Tahap</TableHead>
                  <TableHead className="hidden md:table-cell">Site visit</TableHead>
                  <TableHead className="hidden lg:table-cell">Unit</TableHead>
                  <TableHead className="hidden xl:table-cell">PIC</TableHead>
                  <TableHead className="hidden sm:table-cell">Tanggal</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((lead) => {
                  const status =
                    LEAD_STATUS_LABELS[lead.status as CommercialLeadStatus] ??
                    lead.status.replaceAll("_", " ");
                  const visit =
                    SITE_VISIT_STATUS_LABELS[
                      lead.siteVisitStatus as CommercialSiteVisitStatus
                    ] ?? lead.siteVisitStatus;
                  return (
                    <TableRow key={lead.id} id={`lead-${lead.id}`}>
                      <TableCell className="max-w-48">
                        <span className="break-words font-medium">{lead.companyName}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600">
                        {lead.inquiryCode}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={leadStageBadgeClass(lead.status)}>
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-sm text-slate-600 md:table-cell">
                        {lead.siteVisitStatus === "NONE" ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          visit
                        )}
                      </TableCell>
                      <TableCell className="hidden max-w-56 break-words text-sm text-slate-600 lg:table-cell">
                        {unitLabel(lead)}
                      </TableCell>
                      <TableCell className="hidden max-w-40 break-words text-sm text-slate-600 xl:table-cell">
                        {lead.contactName}
                        <span className="mt-0.5 block text-xs text-slate-400">{lead.phone}</span>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-sm text-slate-600 sm:table-cell">
                        {new Date(lead.createdAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          timeZone: "Asia/Jakarta",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={cmsLeadDetailHref(lead.id)} prefetch={false}>
                            Detail
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {!loadError && leads.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-200 px-5 py-12 text-center text-sm text-slate-500">
              Belum ada pengajuan.
            </p>
          )}
          {leads.length > 0 && filteredLeads.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 px-5 py-12 text-center">
              <Search aria-hidden="true" className="mx-auto size-7 text-slate-400" />
              <h2 className="mt-3 font-semibold">Pengajuan tidak ditemukan</h2>
              <p className="mt-1 text-sm text-slate-500">
                Coba kata kunci lain atau reset filter.
              </p>
              <Button type="button" variant="ghost" className="mt-3" onClick={resetFilters}>
                Reset filter
              </Button>
            </div>
          )}

          {filteredLeads.length > 0 && (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Menampilkan {from}–{to} dari {filteredLeads.length} pengajuan
                {filteredLeads.length !== leads.length ? ` (total ${leads.length})` : ""}
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="leads-page-size" className="text-sm text-slate-600">
                    Baris/halaman
                  </Label>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => {
                      setPageSize(Number(value));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger id="leads-page-size" className="h-9 w-[4.5rem]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZES.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm text-slate-600">
                  Halaman {currentPage} dari {totalPages}
                </p>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => setPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    aria-label="Halaman sebelumnya"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => setPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    aria-label="Halaman berikutnya"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
