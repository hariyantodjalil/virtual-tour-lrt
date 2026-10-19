"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  MapPin,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  UserRound,
} from "lucide-react";
import { cmsFetch } from "@/lib/cms-fetch";
import {
  LEAD_PIPELINE_STATUSES,
  LEAD_STATUS_LABELS,
  SITE_VISIT_STATUS_LABELS,
  SITE_VISIT_STATUS_VALUES,
  type CommercialLeadStatus,
  type CommercialSiteVisitStatus,
} from "@/lib/commercial-pipeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type LeadItem = {
  id: string;
  userId: string | null;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  businessType: string;
  status: string;
  message: string | null;
  surveyPreference: string | null;
  siteVisitStatus: string;
  siteVisitScheduledAt: string | null;
  notes: string | null;
  followUpAt: string | null;
  createdAt: string;
  space: {
    id: string;
    code: string;
    name: string;
    status: string;
    station: { name: string };
  } | null;
};

function asLeadList(value: unknown): LeadItem[] {
  return Array.isArray(value) ? (value as LeadItem[]) : [];
}

function dateTimeInputValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function leadStatusLabel(status: string) {
  return (
    LEAD_STATUS_LABELS[status as CommercialLeadStatus] ??
    status.replaceAll("_", " ")
  );
}

function siteVisitLabel(status: string) {
  return (
    SITE_VISIT_STATUS_LABELS[status as CommercialSiteVisitStatus] ??
    status.replaceAll("_", " ")
  );
}

export default function LeadsClient({ initialLeads }: { initialLeads: LeadItem[] }) {
  const [leads, setLeads] = useState(() => asLeadList(initialLeads));
  const [savingId, setSavingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [siteVisitFilter, setSiteVisitFilter] = useState("ALL");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const filteredLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        lead.status === statusFilter ||
        (statusFilter === "COMMERCIAL_OPERATION" && lead.status === "CLOSED_WON");
      const matchesSiteVisit =
        siteVisitFilter === "ALL" || lead.siteVisitStatus === siteVisitFilter;
      const searchableText = [
        lead.companyName,
        lead.contactName,
        lead.phone,
        lead.email,
        lead.businessType,
        lead.space?.code,
        lead.space?.name,
        lead.space?.station.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        matchesSiteVisit &&
        (!normalizedQuery || searchableText.includes(normalizedQuery))
      );
    });
  }, [leads, query, siteVisitFilter, statusFilter]);

  const filtersActive =
    Boolean(query.trim()) || statusFilter !== "ALL" || siteVisitFilter !== "ALL";
  const allVisibleExpanded =
    filteredLeads.length > 0 &&
    filteredLeads.every((lead) => expandedIds.has(lead.id));

  async function load() {
    const res = await cmsFetch("/api/cms/leads");
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    setLeads(asLeadList(data));
  }

  function updateLocal(id: string, patch: Partial<LeadItem>) {
    setLeads((current) =>
      current.map((lead) => (lead.id === id ? { ...lead, ...patch } : lead))
    );
  }

  function toggleLead(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setExpandedIds((current) => {
      const next = new Set(current);
      for (const lead of filteredLeads) {
        if (allVisibleExpanded) next.delete(lead.id);
        else next.add(lead.id);
      }
      return next;
    });
  }

  function clearFilters() {
    setQuery("");
    setStatusFilter("ALL");
    setSiteVisitFilter("ALL");
  }

  async function patchLead(id: string, body: Record<string, unknown>) {
    setSavingId(id);
    const res = await cmsFetch("/api/cms/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingId(null);
    if (!res.ok) {
      alert((data as { error?: string }).error ?? "Gagal memperbarui pengajuan.");
      await load();
      return false;
    }
    await load();
    return true;
  }

  async function updateStatus(lead: LeadItem, status: string) {
    if (status === "COMMERCIAL_OPERATION") {
      const confirmed = confirm(
        `Ubah "${lead.companyName}" menjadi Operasional Komersial?\n\nSistem akan otomatis membuat atau memperbarui Penyewa Aktif dan mengisi unit ${lead.space?.code ?? ""}.`
      );
      if (!confirmed) return;
    }
    if (status === "CLOSED_LOST") {
      const confirmed = confirm(
        "Tandai pengajuan sebagai Drop-off? Reservasi unit dari pengajuan ini akan dilepas."
      );
      if (!confirmed) return;
    }
    await patchLead(lead.id, { status });
  }

  async function saveSiteVisit(lead: LeadItem) {
    const scheduledAt = lead.siteVisitScheduledAt
      ? new Date(lead.siteVisitScheduledAt).toISOString()
      : null;
    await patchLead(lead.id, {
      siteVisitStatus: lead.siteVisitStatus,
      siteVisitScheduledAt: scheduledAt,
      notes: lead.notes || null,
    });
  }

  async function deleteLead(lead: LeadItem) {
    if (
      !confirm(
        `Hapus pengajuan "${lead.companyName}"? Tindakan ini tidak bisa dibatalkan.`
      )
    ) {
      return;
    }
    const res = await cmsFetch(`/api/cms/leads/${lead.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert((data as { error?: string }).error ?? "Gagal menghapus pengajuan.");
      return;
    }
    setExpandedIds((current) => {
      const next = new Set(current);
      next.delete(lead.id);
      return next;
    });
    await load();
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pengajuan & Site Visit</h1>
          <p className="mt-1 text-sm text-slate-400">
            Kelola proses dari inquiry hingga otomatis menjadi penyewa aktif.
          </p>
        </div>
        <p className="text-sm text-slate-400" aria-live="polite">
          <span className="font-semibold text-white">{filteredLeads.length}</span> dari{" "}
          {leads.length} pengajuan
        </p>
      </div>

      <div className="mb-5 rounded-xl border border-slate-800 bg-slate-900 p-3">
        <div className="flex flex-col gap-2 lg:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Cari pengajuan</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari brand, PIC, telepon, email, unit, atau stasiun..."
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-2 lg:w-[430px]">
            <label className="relative">
              <span className="sr-only">Filter tahap proses</span>
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 w-full appearance-none rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-8 text-sm text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="ALL">Semua tahap</option>
                {LEAD_PIPELINE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {LEAD_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </label>

            <label className="relative">
              <span className="sr-only">Filter status site visit</span>
              <CalendarClock className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <select
                value={siteVisitFilter}
                onChange={(event) => setSiteVisitFilter(event.target.value)}
                className="h-10 w-full appearance-none rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-8 text-sm text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="ALL">Semua site visit</option>
                {SITE_VISIT_STATUS_VALUES.map((status) => (
                  <option key={status} value={status}>
                    {SITE_VISIT_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </label>
          </div>
        </div>

        <div className="mt-3 flex min-h-8 flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3">
          <div>
            {filtersActive && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={clearFilters}
                className="h-8 text-slate-300"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset filter
              </Button>
            )}
          </div>
          {filteredLeads.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={toggleAllVisible}
              className="h-8 text-slate-300"
            >
              {allVisibleExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              {allVisibleExpanded ? "Tutup semua" : "Buka semua"}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2.5">
        {filteredLeads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            expanded={expandedIds.has(lead.id)}
            saving={savingId === lead.id}
            onToggle={() => toggleLead(lead.id)}
            onUpdateStatus={(status) => updateStatus(lead, status)}
            onUpdateLocal={(patch) => updateLocal(lead.id, patch)}
            onSaveSiteVisit={() => saveSiteVisit(lead)}
            onDelete={() => deleteLead(lead)}
          />
        ))}

        {leads.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-700 py-14 text-center text-slate-400">
            Belum ada pengajuan.
          </div>
        )}

        {leads.length > 0 && filteredLeads.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-700 px-5 py-14 text-center">
            <Search className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-3 font-medium text-slate-300">Pengajuan tidak ditemukan</p>
            <p className="mt-1 text-sm text-slate-500">
              Coba kata kunci lain atau reset filter.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={clearFilters}
              className="mt-4"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset filter
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function LeadCard({
  lead,
  expanded,
  saving,
  onToggle,
  onUpdateStatus,
  onUpdateLocal,
  onSaveSiteVisit,
  onDelete,
}: {
  lead: LeadItem;
  expanded: boolean;
  saving: boolean;
  onToggle: () => void;
  onUpdateStatus: (status: string) => void;
  onUpdateLocal: (patch: Partial<LeadItem>) => void;
  onSaveSiteVisit: () => void;
  onDelete: () => void;
}) {
  const detailId = `lead-detail-${lead.id}`;

  return (
    <Card className="overflow-hidden border-slate-800 bg-slate-900">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={detailId}
          className="flex w-full items-start gap-3 px-4 py-3.5 text-left outline-none transition hover:bg-white/[0.035] focus-visible:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300">
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-white">{lead.companyName}</span>
              <Badge variant="outline">{leadStatusLabel(lead.status)}</Badge>
              {lead.siteVisitStatus !== "NONE" && (
                <Badge
                  variant="outline"
                  className="border-sky-800 bg-sky-950/40 text-sky-300"
                >
                  Site Visit: {siteVisitLabel(lead.siteVisitStatus)}
                </Badge>
              )}
            </span>
            <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5" />
                {lead.contactName} · {lead.phone}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {lead.space
                  ? `${lead.space.code} · ${lead.space.station.name}`
                  : "Tanpa unit"}
              </span>
            </span>
          </span>

          <span className="hidden shrink-0 pt-1 text-xs text-slate-500 sm:block">
            {new Date(lead.createdAt).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </button>

        {expanded && (
          <div id={detailId} className="border-t border-slate-800 px-4 py-4">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm text-slate-400">
                  <UserRound className="h-3.5 w-3.5" />
                  {lead.contactName} · {lead.phone} · {lead.email}
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-950/50 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <Building2 className="h-3.5 w-3.5" />
                      Unit
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-200">
                      {lead.space
                        ? `${lead.space.code} — ${lead.space.name}`
                        : "Tanpa unit spesifik"}
                    </p>
                    {lead.space && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="h-3 w-3" />
                        {lead.space.station.name} · {lead.space.status}
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl bg-slate-950/50 p-3">
                    <p className="text-xs font-semibold text-slate-500">Kebutuhan</p>
                    <p className="mt-1 text-sm text-slate-200">{lead.businessType}</p>
                    {lead.message && (
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        {lead.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-full shrink-0 space-y-3 xl:w-[340px]">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-400">
                    Tahap Proses
                  </label>
                  <Select
                    value={
                      lead.status === "CLOSED_WON"
                        ? "COMMERCIAL_OPERATION"
                        : lead.status
                    }
                    onValueChange={onUpdateStatus}
                    disabled={saving}
                  >
                    <SelectTrigger className="w-full border-slate-700 bg-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_PIPELINE_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {LEAD_STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-xl bg-slate-950/40 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Site Visit
                  </p>
                  {lead.surveyPreference && (
                    <p className="mb-2 rounded-lg bg-sky-950/40 px-2.5 py-2 text-xs text-sky-200">
                      Preferensi Mitra: {lead.surveyPreference}
                    </p>
                  )}
                  <Select
                    value={lead.siteVisitStatus}
                    onValueChange={(value) =>
                      onUpdateLocal({ siteVisitStatus: value })
                    }
                  >
                    <SelectTrigger className="w-full border-slate-700 bg-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SITE_VISIT_STATUS_VALUES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {siteVisitLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input
                    type="datetime-local"
                    value={dateTimeInputValue(lead.siteVisitScheduledAt)}
                    onChange={(event) =>
                      onUpdateLocal({
                        siteVisitScheduledAt: event.target.value || null,
                      })
                    }
                    className="mt-2 h-10 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100"
                  />
                  <textarea
                    value={lead.notes ?? ""}
                    onChange={(event) => onUpdateLocal({ notes: event.target.value })}
                    placeholder="Catatan internal tim leasing"
                    rows={2}
                    className="mt-2 w-full resize-none rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                  />
                  <Button
                    size="sm"
                    className="mt-2 w-full"
                    onClick={onSaveSiteVisit}
                    disabled={saving}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saving ? "Menyimpan..." : "Simpan Site Visit"}
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full text-red-400 hover:bg-red-950/40"
                  onClick={onDelete}
                  disabled={saving}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus Pengajuan
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
