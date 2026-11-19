"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, ChevronRight, RefreshCw, Trash2 } from "lucide-react";
import { cmsFetch } from "@/lib/cms-fetch";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import WorkflowVersionBadge from "@/components/cms/WorkflowVersionBadge";
import { leadStageBadgeClass, type LeadItem } from "@/lib/cms-leads-shared";
import { LEAD_STATUS_LABELS, type CommercialLeadStatus } from "@/lib/commercial-pipeline";
import { CMS_LEADS_UPDATED_EVENT, notifyCmsLeadsUpdated } from "@/lib/inquiry-sync-events";
import { useInquiryRealtimeSync } from "@/components/realtime/useInquiryRealtimeSync";
import LeadWorkflowPanel from "./LeadWorkflowPanel";
import TrainInquiryAllocation from "./TrainInquiryAllocation";
import styles from "./inquiry-workspace.module.css";

export default function LeadDetailClient({
  initialLead,
  canManage,
}: {
  initialLead: LeadItem;
  canManage: boolean;
}) {
  const router = useRouter();
  const [lead, setLead] = useState(initialLead);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const { confirmDialog, confirmElement } = useConfirmDialog();
  const [error, setError] = useState("");
  const endpoint = `/api/cms/leads/${encodeURIComponent(lead.id)}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await cmsFetch(endpoint, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data.id !== lead.id) {
        throw new Error(data?.error || "Detail pengajuan gagal dimuat. Silakan coba lagi.");
      }
      setLead(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tidak dapat memuat detail pengajuan.");
      throw cause;
    } finally {
      setLoading(false);
    }
  }, [endpoint, lead.id]);

  useInquiryRealtimeSync({
    enabled: true,
    leadId: lead.id,
    localEvents: [CMS_LEADS_UPDATED_EVENT],
    fallbackIntervalMs: 60_000,
    onSync: async () => {
      try {
        await load();
      } catch {
        /* silent */
      }
    },
  });

  async function save(body: Record<string, unknown>) {
    if (!canManage || saving) return false;
    setSaving(true);
    setError("");
    try {
      const response = await cmsFetch("/api/cms/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, id: lead.id }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Perubahan pengajuan belum tersimpan.");
      await load();
      notifyCmsLeadsUpdated();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Perubahan pengajuan belum tersimpan.");
      throw cause;
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!canManage || saving) return;
    const confirmed = await confirmDialog({
      title: `Hapus pengajuan ${lead.inquiryCode}?`,
      description: `Pengajuan milik ${lead.companyName}. Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: "Ya, Hapus",
      destructive: true,
    });
    if (!confirmed) return;
    setSaving(true);
    setError("");
    try {
      const response = await cmsFetch(endpoint, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Pengajuan tidak dapat dihapus.");
      router.replace("/cms/leads");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pengajuan tidak dapat dihapus.");
    } finally {
      setSaving(false);
    }
  }

  // Document/allocation callbacks are deliberately non-throwing; each editor retains its own drafts.
  async function reload() {
    try {
      await load();
    } catch {
      /* Inline error offers retry without unmounting the editor. */
    }
  }

  const statusLabel =
    LEAD_STATUS_LABELS[lead.status as CommercialLeadStatus] ??
    lead.status.replaceAll("_", " ");

  return (
    <div className={`${styles.workspace} min-w-0 space-y-5`}>
      <nav aria-label="Breadcrumb">
        <ol className="flex min-h-11 flex-wrap items-center gap-2 text-sm">
          <li>
            <Button asChild variant="ghost" size="sm" className="px-2 text-slate-600">
              <Link href="/cms/leads" prefetch={false}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                Pengajuan & Site Visit
              </Link>
            </Button>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-4 text-slate-400" />
          </li>
          <li aria-current="page" className="break-all font-medium">
            {lead.inquiryCode}
          </li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 break-words text-2xl font-bold [overflow-wrap:anywhere]">
              {lead.companyName}
            </h1>
            <Badge variant="outline" className={leadStageBadgeClass(lead.status)}>
              {statusLabel}
            </Badge>
            {lead.workflowVersion ? (
              <WorkflowVersionBadge
                version={lead.workflowVersion.version}
                status={lead.workflowVersion.status}
                title={lead.workflowVersion.title}
                stepCount={lead.workflowVersion.stepCount}
              />
            ) : null}
          </div>
          <p className="mt-2 flex items-start gap-2 text-sm text-slate-600">
            <Building2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">
              {lead.space
                ? `${lead.space.code} · ${lead.space.name} · ${lead.space.station.name}`
                : lead.trainInquiry
                  ? `${lead.trainInquiry.mediaCode} · ${lead.trainInquiry.mediaTitle} · ${lead.trainInquiry.train.name}`
                  : "Pengajuan tanpa unit spesifik"}
            </span>
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Diterima{" "}
            {new Date(lead.createdAt).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "Asia/Jakarta",
            })}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void reload()}
          disabled={loading || saving}
        >
          <RefreshCw
            className={`size-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`}
            aria-hidden="true"
          />
          {loading ? "Memuat…" : "Muat ulang"}
        </Button>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <Card>
        <CardContent className="p-4 sm:p-6">
          <LeadWorkflowPanel
            lead={lead}
            saving={saving || loading}
            canManage={canManage}
            onSave={save}
            onReload={reload}
          />
          <div className="mt-6 divide-y divide-slate-200 border-t border-slate-200">
            {lead.trainInquiry && (
              <details className="py-2">
                <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[#D81435]">
                  Alokasi trainset internal
                  <span className="text-xs font-normal text-slate-500">
                    {lead.trainInquiry.allocatedTrainsets.length} dialokasikan
                    {lead.trainInquiry.requestedTrainsetCount != null
                      ? ` dari ${lead.trainInquiry.requestedTrainsetCount} permintaan`
                      : ""}
                  </span>
                </summary>
                <TrainInquiryAllocation
                  leadId={lead.id}
                  inquiry={lead.trainInquiry}
                  onSaved={reload}
                />
              </details>
            )}
            <details className="py-2">
              <summary className="flex min-h-11 cursor-pointer items-center text-xs text-slate-500 focus-visible:outline-2 focus-visible:outline-[#D81435]">
                Pengelolaan lanjutan
              </summary>
              <p className="mt-2 max-w-prose text-xs leading-relaxed text-slate-500">
                Pengajuan dengan dokumen disimpan untuk audit. Gunakan penghentian pada bagian
                Catatan & pengelolaan untuk melepas reservasi.
              </p>
              <Button
                type="button"
                variant="ghost"
                className="mt-3 text-red-700 hover:bg-red-50 hover:text-red-800"
                onClick={() => void remove()}
                disabled={
                  saving ||
                  loading ||
                  !canManage ||
                  ["COMMERCIAL_OPERATION", "CLOSED_WON"].includes(lead.status)
                }
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Hapus pengajuan
              </Button>
            </details>
          </div>
        </CardContent>
      </Card>
      {confirmElement}
    </div>
  );
}
