"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  RotateCcw,
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
  SITE_VISIT_STATUS_VALUES,
  type CommercialLeadStatus,
  type CommercialSiteVisitStatus,
} from "@/lib/commercial-pipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type { LeadItem } from "@/lib/cms-leads-shared";

const PAGE_SIZES = [10, 25, 50];

function unitLabel(lead: LeadItem) {
  if (lead.space) return `${lead.space.code} · ${lead.space.station.name}`;
  if (lead.trainInquiry?.mediaTitle) return lead.trainInquiry.mediaTitle;
  return "Tanpa unit spesifik";
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
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [siteVisitFilter, setSiteVisitFilter] = useState("ALL");
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

  const filteredLeads = useMemo(() => {
    const text = query.trim().toLowerCase();
    return leads.filter(
      (lead) =>
        (statusFilter === "ALL" ||
          canonicalLeadStatus(lead.status as CommercialLeadStatus) === statusFilter) &&
        (siteVisitFilter === "ALL" || lead.siteVisitStatus === siteVisitFilter) &&
        (!text ||
          [
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
            .includes(text))
    );
  }, [leads, query, statusFilter, siteVisitFilter]);

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
    Boolean(query.trim()) || statusFilter !== "ALL" || siteVisitFilter !== "ALL";

  function resetFilters() {
    setQuery("");
    setStatusFilter("ALL");
    setSiteVisitFilter("ALL");
    setPage(1);
  }

  async function load() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await cmsFetch("/api/cms/leads", { cache: "no-store" });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(data)) {
        throw new Error("Data pengajuan gagal dimuat. Silakan coba lagi.");
      }
      setLeads(data as LeadItem[]);
    } catch (cause) {
      setLoadError(
        cause instanceof Error
          ? cause.message
          : "Tidak dapat terhubung ke layanan pengajuan."
      );
    } finally {
      setIsLoading(false);
    }
  }

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
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search
                aria-hidden="true"
                className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
              />
              <Input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Cari nomor, brand, PIC, unit…"
                aria-label="Cari pengajuan"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-44" aria-label="Filter tahap proses">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua tahap</SelectItem>
                  {ADMIN_LEAD_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {LEAD_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={siteVisitFilter}
                onValueChange={(value) => {
                  setSiteVisitFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-44" aria-label="Filter status site visit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua site visit</SelectItem>
                  {SITE_VISIT_STATUS_VALUES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {SITE_VISIT_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filtersActive && (
                <Button type="button" size="sm" variant="ghost" onClick={resetFilters}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              )}
            </div>
          </div>

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
