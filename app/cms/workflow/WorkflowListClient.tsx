"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronRight,
  CopyPlus,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { cmsFetch } from "@/lib/cms-fetch";
import type { CmsWorkflowVersionDTO } from "@/lib/cms-workflow";
import { showAppToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type StatusTab = "ALL" | "ACTIVE" | "ARCHIVED" | "DRAFT";

function workflowStatusLabel(status: string) {
  if (status === "ACTIVE") return "Aktif";
  if (status === "DRAFT") return "Draf";
  return "Arsip";
}

function workflowStatusBadgeClass(status: string) {
  if (status === "ACTIVE") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "DRAFT") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function versionLabel(v: CmsWorkflowVersionDTO) {
  return typeof v.version === "number" ? `v${v.version}` : "—";
}

function formatUpdated(iso: string) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function WorkflowListClient({
  initialVersions,
}: {
  initialVersions: CmsWorkflowVersionDTO[];
}) {
  const router = useRouter();
  const [versions, setVersions] = useState<CmsWorkflowVersionDTO[]>(initialVersions);
  const [query, setQuery] = useState("");
  const [statusTab, setStatusTab] = useState<StatusTab>("ALL");
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const tabCounts = useMemo(() => {
    let active = 0;
    let archived = 0;
    let draft = 0;
    for (const v of versions) {
      if (v.status === "ACTIVE") active += 1;
      else if (v.status === "DRAFT") draft += 1;
      else archived += 1;
    }
    return { total: versions.length, active, archived, draft };
  }, [versions]);

  const filteredVersions = useMemo(() => {
    const text = query.trim().toLowerCase();
    return versions.filter((v) => {
      if (statusTab === "ACTIVE" && v.status !== "ACTIVE") return false;
      if (statusTab === "ARCHIVED" && v.status !== "ARCHIVED") return false;
      if (statusTab === "DRAFT" && v.status !== "DRAFT") return false;
      if (!text) return true;
      const versionText =
        typeof v.version === "number" ? `v${v.version}` : String(v.version ?? "");
      return [v.title, versionText].filter(Boolean).join(" ").toLowerCase().includes(text);
    });
  }, [versions, query, statusTab]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await cmsFetch("/api/cms/workflow", { cache: "no-store" });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(data)) {
        throw new Error("Data alur gagal dimuat. Silakan coba lagi.");
      }
      setVersions(data as CmsWorkflowVersionDTO[]);
    } catch (cause) {
      setLoadError(
        cause instanceof Error ? cause.message : "Tidak dapat terhubung ke layanan alur."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  async function handleCreateDraft() {
    setCreatingDraft(true);
    try {
      const res = await cmsFetch("/api/cms/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showAppToast({
          type: "error",
          title: "Gagal membuat draf",
          description: data.error || "Terjadi kesalahan saat membuat draf baru.",
        });
        return;
      }
      const created = data.version as CmsWorkflowVersionDTO;
      showAppToast({
        type: "success",
        title: "Draf baru berhasil dibuat",
        description: `Membuka "${created.title}" untuk diedit.`,
      });
      router.push(`/cms/workflow/${created.id}`);
    } finally {
      setCreatingDraft(false);
    }
  }

  async function handleToggleStatus(
    version: CmsWorkflowVersionDTO,
    nextStatus: "ACTIVE" | "ARCHIVED"
  ) {
    if (version.version === null || version.status === "DRAFT") return;
    setStatusUpdatingId(version.id);
    try {
      const res = await cmsFetch(`/api/cms/workflow/${version.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showAppToast({
          type: "error",
          title: "Status tidak dapat diubah",
          description: data.error || "Permintaan gagal diproses.",
        });
        return;
      }
      const updated = data.version as CmsWorkflowVersionDTO;
      setVersions((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      showAppToast({
        type: "success",
        title:
          nextStatus === "ACTIVE"
            ? `${versionLabel(version)} diaktifkan`
            : `${versionLabel(version)} dinonaktifkan (arsip)`,
        description:
          nextStatus === "ACTIVE"
            ? "Versi ini kini tersedia untuk pengajuan baru (multi-aktif didukung)."
            : "Versi ini tidak lagi aktif; pengajuan terikat tetap berjalan.",
      });
    } finally {
      setStatusUpdatingId(null);
    }
  }

  const filtersActive = Boolean(query.trim()) || statusTab !== "ALL";

  function resetFilters() {
    setQuery("");
    setStatusTab("ALL");
  }

  function renderVersionActions(version: CmsWorkflowVersionDTO) {
    const updating = statusUpdatingId === version.id;
    const isActive = version.status === "ACTIVE";
    return (
      <>
        <Button asChild size="sm" variant="outline" className="min-h-9">
          <Link href={`/cms/workflow/${version.id}`} prefetch={false}>
            Detail
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </Button>
        {version.version !== null && (isActive || version.status === "ARCHIVED") ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={updating}
            onClick={() => void handleToggleStatus(version, isActive ? "ARCHIVED" : "ACTIVE")}
            className="min-h-9"
          >
            {updating ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
            {isActive ? "Nonaktifkan" : "Aktifkan"}
          </Button>
        ) : null}
      </>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          disabled={creatingDraft}
          onClick={() => void handleCreateDraft()}
          className="h-9 gap-1.5 text-xs focus-visible:outline-2 focus-visible:outline-[#D81435]"
        >
          {creatingDraft ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CopyPlus className="size-3.5" />
          )}
          Buat draf baru
        </Button>
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

      {loadError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Daftar alur tidak dapat dimuat</p>
            <p className="mt-1">{loadError}</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3">
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="tablist"
            aria-label="Kelompok status alur"
          >
            {(
              [
                { id: "ALL", label: "Semua", count: tabCounts.total },
                { id: "ACTIVE", label: "Aktif", count: tabCounts.active },
                { id: "ARCHIVED", label: "Arsip", count: tabCounts.archived },
                { id: "DRAFT", label: "Draf", count: tabCounts.draft },
              ] as const
            ).map((tab) => {
              const active = statusTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusTab(tab.id)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D81435] ${
                    active
                      ? "bg-[#D81435] text-white"
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

          <div className="relative min-w-0 max-w-xl">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
              strokeWidth={1.5}
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama alur atau versi (mis. v2)"
              aria-label="Cari alur"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-xs text-[#101828] placeholder:text-slate-400 transition-colors focus:border-[#D81435] focus:outline-none"
            />
          </div>

          {filtersActive && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#101828] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D81435]"
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
            <CardTitle>Daftar Alur Pengajuan</CardTitle>
            <CardDescription>
              {filteredVersions.length} dari {versions.length} versi alur
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {filteredVersions.length > 0 ? (
            <ul className="space-y-3 lg:hidden">
              {filteredVersions.map(version => (
                <li key={version.id} className="rounded-xl border border-slate-200 p-3.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="font-mono">{versionLabel(version)}</span>
                    <Badge variant="outline" className={workflowStatusBadgeClass(version.status)}>
                      {workflowStatusLabel(version.status)}
                    </Badge>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold break-words">{version.title}</h3>
                  <p className="mt-1 text-xs text-slate-600">{version.steps.length} tahap · {version.leadsCount} pengajuan</p>
                  <div className="mt-3 flex flex-wrap gap-2">{renderVersionActions(version)}</div>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="hidden rounded-lg border border-slate-200 lg:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Nama Alur</TableHead>
                  <TableHead>Versi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Tahap</TableHead>
                  <TableHead className="hidden md:table-cell">Pengajuan</TableHead>
                  <TableHead className="hidden lg:table-cell">Diperbarui</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVersions.map((v) => {
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="max-w-56">
                        <span className="break-words font-medium">{v.title}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600 tabular-nums">
                        {versionLabel(v)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={workflowStatusBadgeClass(v.status)}>
                          {workflowStatusLabel(v.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-sm tabular-nums text-slate-600 sm:table-cell">
                        {v.steps.length}
                      </TableCell>
                      <TableCell className="hidden text-sm tabular-nums text-slate-600 md:table-cell">
                        {v.leadsCount}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-xs text-slate-600 lg:table-cell">
                        {formatUpdated(v.updatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">{renderVersionActions(v)}</div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {versions.length === 0 && !loadError && (
            <p className="rounded-lg border border-dashed border-slate-200 px-5 py-12 text-center text-sm text-slate-500">
              Belum ada versi alur. Buat draf baru untuk memulai.
            </p>
          )}
          {versions.length > 0 && filteredVersions.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 px-5 py-12 text-center">
              <Search aria-hidden="true" className="mx-auto size-7 text-slate-400" />
              <h2 className="mt-3 font-semibold">Alur tidak ditemukan</h2>
              <p className="mt-1 text-sm text-slate-500">
                Coba kata kunci lain atau reset filter.
              </p>
              <Button type="button" variant="ghost" className="mt-3" onClick={resetFilters}>
                Reset filter
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}