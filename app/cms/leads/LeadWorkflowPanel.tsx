"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, CalendarClock, Check, ChevronDown, ChevronRight, FileText, GitBranch, LockKeyhole, MessageSquareText, NotebookPen } from "lucide-react";
import { PUBLIC_LEAD_PROCESS_STEPS, canonicalLeadStatus, completedLeadStageIndex, SITE_VISIT_STATUS_LABELS, SITE_VISIT_STATUS_VALUES, type CommercialLeadStatus } from "@/lib/commercial-pipeline";
import { inquirySiteVisitStep, leaseExpiryReminder } from "@/lib/inquiry-workflow";
import { inquiryDocumentTypesForStep } from "@/lib/inquiry-media";
import { cmsFetch } from "@/lib/cms-fetch";
import InquiryDocuments from "./InquiryDocuments";
import LeadUnitSummary from "./LeadUnitSummary";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { LeadItem } from "@/lib/cms-leads-shared";
import type { CmsWorkflowVersionDTO } from "@/lib/cms-workflow";
import WorkflowVersionBadge from "@/components/cms/WorkflowVersionBadge";

const control = "flex h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D81435]/25 focus-visible:border-[#D81435] disabled:cursor-not-allowed disabled:opacity-50";
const areaControl = "block min-h-[6.5rem] w-full min-w-0 resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D81435]/25 focus-visible:border-[#D81435] disabled:cursor-not-allowed disabled:opacity-50";
const primary = "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#D81435] px-4 text-sm font-medium text-white hover:bg-[#B8112D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D81435]/25 disabled:pointer-events-none disabled:opacity-50";
const secondary = "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D81435]/25 disabled:pointer-events-none disabled:opacity-50";
type View = "stages" | "unit" | "documents" | "notes";
type Draft = { start: string; end: string; payment: boolean; visit: string; scheduled: string; notes: string; reason: string };
type LeadStep = NonNullable<LeadItem["workflowVersion"]>["steps"][number];

const FALLBACK_STEPS: LeadStep[] = PUBLIC_LEAD_PROCESS_STEPS.map((item, index) => ({
  id: `fallback-${item.status}`,
  stepOrder: index + 1,
  leadStatus: item.status,
  stepType: index === 2 ? "SITE_VISIT" : "STANDARD",
  documentNumberLabel: null,
  slaHours: null,
  // Tahap 2: 1 dokumen pendukung opsional; 3–5: paket dokumen wajib.
  mediaRequirement:
    index === 1 ? "OPTIONAL" : index === 2 || index === 3 || index === 4 ? "REQUIRED" : "NONE",
  requiresMedia: index === 2 || index === 3 || index === 4,
  spaceEffect: index === 5 ? "ACTIVATE_TENANT" : "NONE",
  title: item.title,
  description: item.detail,
  publicMessage: item.detail,
  showInSummary: true,
}));

function advanceLabel(step: LeadStep | undefined, next: LeadStep | undefined) {
  if (!next) return step ? `Selesaikan ${step.title}` : "Selesaikan tahap";
  return `Lanjut ke tahap ${next.stepOrder}: ${next.title}`;
}
function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value.slice(0, 16);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function dateLabel(value: string | null) {
  return value ? new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }) : "Belum ditetapkan";
}
function visitScheduleLabel(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return (
    date.toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }) + " WIB"
  );
}

export default function LeadWorkflowPanel({ lead, saving, canManage, onSave, onReload }: {
  lead: LeadItem; saving: boolean; canManage: boolean;
  onSave: (body: Record<string, unknown>) => Promise<boolean>;
  onReload: () => Promise<void>;
}) {
  const [activeWorkflows, setActiveWorkflows] = useState<CmsWorkflowVersionDTO[]>([]);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [showStopDialog, setShowStopDialog] = useState(false);
  const [stopReason, setStopReason] = useState("");
  const [stopError, setStopError] = useState("");
  const canChangeWorkflow = canManage && lead.status === "NEW" && (lead.currentStepOrder ?? 1) === 1;
  const status = canonicalLeadStatus(lead.status as CommercialLeadStatus);
  const stopped = status === "CLOSED_LOST";
  const active = status === "COMMERCIAL_OPERATION";
  const steps = useMemo<LeadStep[]>(() => {
    const pinned = lead.workflowVersion?.steps;
    return pinned && pinned.length > 0 ? pinned : FALLBACK_STEPS;
  }, [lead.workflowVersion?.steps]);
  const totalSteps = steps.length;
  const currentStep =
    steps.find((step) => step.stepOrder === lead.currentStepOrder) ??
    steps.find((step) => step.leadStatus === status) ??
    steps[0];
  const nextStep = currentStep
    ? steps.find((step) => step.stepOrder === currentStep.stepOrder + 1)
    : undefined;
  const completedCount = active
    ? totalSteps
    : Math.max(0, Math.min((currentStep?.stepOrder ?? 1) - 1, totalSteps));
  const [selectedOrder, setSelectedOrder] = useState(
    () => currentStep?.stepOrder ?? steps[0]?.stepOrder ?? 1
  );
  const [view, setView] = useState<View>("stages");
  // Keep only local edits. Server refreshes update clean fields without discarding other drafts.
  const [changes, setChanges] = useState<Partial<Draft>>({});
  const draft: Draft = { start: lead.leaseStartAt?.slice(0, 10) ?? "", end: lead.leaseEndAt?.slice(0, 10) ?? "", payment: Boolean(lead.paymentVerifiedAt), visit: lead.siteVisitStatus, scheduled: localDateTime(lead.siteVisitScheduledAt), notes: lead.notes ?? "", reason: lead.rejectionReason ?? "", ...changes };
  const change = <K extends keyof Draft>(key: K, value: Draft[K]) => setChanges(current => ({ ...current, [key]: value }));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploadDirty, setUploadDirty] = useState(false);
  const [documentBusy, setDocumentBusy] = useState(false);
  const { confirmDialog, confirmElement } = useConfirmDialog();
  const busy = saving || documentBusy || workflowBusy;
  const disabled = !canManage || busy;
  const canStop = canManage && !active && !stopped;
  const id = `workflow-${lead.id}`;
  const selectedStep =
    steps.find((step) => step.stepOrder === selectedOrder) ?? currentStep ?? steps[0];
  const selectedIsCurrent = Boolean(
    selectedStep && currentStep && selectedStep.stepOrder === currentStep.stepOrder
  );
  const selectedIsPast = Boolean(
    selectedStep && (active || selectedStep.stepOrder < (currentStep?.stepOrder ?? 1))
  );
  const reminder = active ? leaseExpiryReminder(lead.leaseEndAt) : null;
  const documentTypes =
    view === "stages" && selectedStep
      ? inquiryDocumentTypesForStep(selectedStep)
      : undefined;
  // Hanya tampilkan slot dokumen yang memang dipetakan ke status tahap ini.
  // Jangan pakai mediaRequirement OPTIONAL sebagai alasan menampilkan semua tipe.
  const showDocuments =
    view === "documents" || (view === "stages" && Boolean(documentTypes));
  const showSiteVisit = view === "stages" && Boolean(selectedStep && selectedStep.stepOrder === inquirySiteVisitStep(steps)?.stepOrder);
  const canActivateNext = selectedIsCurrent && nextStep?.spaceEffect === "ACTIVATE_TENANT";
  const canVerifyPayment = canActivateNext || completedLeadStageIndex(lead.status) >= 4;
  const showLeaseDates =
    view === "stages" &&
    Boolean(selectedStep && (["PKS", "BILLING", "FIT_OUT_HANDOVER"].includes(selectedStep.leadStatus) || canActivateNext));
  const showPayment =
    view === "stages" &&
    Boolean(
      selectedStep &&
        (canActivateNext || selectedStep.spaceEffect === "ACTIVATE_TENANT" ||
          selectedStep.leadStatus === "COMMERCIAL_OPERATION" ||
          selectedStep.stepOrder === totalSteps)
    );
  const stageDraftDirty =
    (showSiteVisit && (changes.visit !== undefined || changes.scheduled !== undefined)) ||
    (showLeaseDates && (changes.start !== undefined || changes.end !== undefined)) ||
    (showPayment && changes.payment !== undefined);

  const latestPartnerNote = useMemo(() => {
    if (!selectedStep) return null;
    const matching = (lead.stepLogs ?? [])
      .filter(
        (log) =>
          log.notes?.trim() &&
          log.stepOrder === selectedStep.stepOrder
      )
      .at(-1);
    return matching?.notes?.trim() || null;
  }, [lead.stepLogs, selectedStep]);

  const [partnerMessage, setPartnerMessage] = useState(
    () => selectedStep?.publicMessage || selectedStep?.description || ""
  );

  useEffect(() => {
    setPartnerMessage(
      latestPartnerNote || selectedStep?.publicMessage || selectedStep?.description || ""
    );
  }, [selectedOrder, selectedStep?.publicMessage, selectedStep?.description, latestPartnerNote, lead.id, lead.workflowVersion?.id]);

  useEffect(() => {
    const nextOrder = currentStep?.stepOrder ?? steps[0]?.stepOrder ?? 1;
    setSelectedOrder(nextOrder);
  }, [lead.workflowVersion?.id, lead.currentStepOrder]); // eslint-disable-line react-hooks/exhaustive-deps -- hanya reset saat alur/pointer berubah

  useEffect(() => {
    if (active) return;
    const cap = currentStep?.stepOrder ?? steps[0]?.stepOrder ?? 1;
    setSelectedOrder((order) => Math.min(order, cap));
  }, [active, currentStep?.stepOrder, steps]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#site-visit") return;
    setView("stages");
    const visitStep = inquirySiteVisitStep(steps);
    if (visitStep) setSelectedOrder(visitStep.stepOrder);
    requestAnimationFrame(() => {
      document.getElementById("site-visit")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [lead.id, steps]);

  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await cmsFetch("/api/cms/workflow", { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(data) || cancelled) return;
        setActiveWorkflows(
          (data as CmsWorkflowVersionDTO[]).filter((item) => item.status === "ACTIVE")
        );
      } catch {
        /* silent — picker tetap tampil dengan opsi terikat saat ini */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManage, lead.id]);

  const workflowOptions = useMemo(() => {
    const map = new Map<string, CmsWorkflowVersionDTO>();
    for (const item of activeWorkflows) map.set(item.id, item);
    if (lead.workflowVersion && !map.has(lead.workflowVersion.id)) {
      map.set(lead.workflowVersion.id, {
        id: lead.workflowVersion.id,
        version: lead.workflowVersion.version,
        title: lead.workflowVersion.title,
        description: null,
        status: lead.workflowVersion.status,
        publishedAt: null,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
        leadsCount: 0,
        steps: lead.workflowVersion.steps,
      });
    }
    return Array.from(map.values()).sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
  }, [activeWorkflows, lead.createdAt, lead.updatedAt, lead.workflowVersion]);

  async function changeWorkflow(nextId: string) {
    if (!canChangeWorkflow || workflowBusy || nextId === lead.workflowVersion?.id) return;
    const target = workflowOptions.find((item) => item.id === nextId);
    const label =
      target && typeof target.version === "number"
        ? `v${target.version} — ${target.title}`
        : target?.title ?? "alur terpilih";
    const confirmed = await confirmDialog({
      title: "Ganti alur pengajuan?",
      description: `Pengajuan ini akan memakai ${label}. Bisa diganti lagi selama masih di tahap 1.`,
      confirmLabel: "Ya, ganti alur",
    });
    if (!confirmed) return;
    setWorkflowBusy(true);
    setError("");
    setMessage("");
    try {
      if (await onSave({ workflowVersionId: nextId })) {
        setMessage(`Alur diganti ke ${label}.`);
      } else {
        setError("Alur belum diganti. Silakan coba lagi.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Alur belum diganti. Periksa koneksi lalu coba lagi.");
    } finally {
      setWorkflowBusy(false);
    }
  }

  const maxSelectableOrder = active
    ? totalSteps
    : (currentStep?.stepOrder ?? steps[0]?.stepOrder ?? 1);

  async function navigate(target: View, stageOrder = selectedOrder) {
    if (busy || (target === view && stageOrder === selectedOrder)) return;
    // Tahap setelah yang berjalan dikunci sampai tahap saat ini dikonfirmasi.
    if (target === "stages" && !active && stageOrder > maxSelectableOrder) return;
    if (uploadDirty) {
      const confirmed = await confirmDialog({
        title: "Pindah bagian editor?",
        description: "Berkas yang dipilih belum diunggah. Pindah bagian akan membatalkan pilihan berkas.",
        confirmLabel: "Pindah",
      });
      if (!confirmed) return;
    }
    setUploadDirty(false);
    setView(target);
    setSelectedOrder(Math.min(stageOrder, maxSelectableOrder));
    setError("");
    setMessage("");
  }
  function openStopDialog() {
    if (!canStop || busy) return;
    setStopReason("");
    setStopError("");
    setShowStopDialog(true);
  }

  async function submitStop() {
    const reason = stopReason.trim();
    if (!reason) {
      setStopError("Alasan penghentian wajib diisi.");
      return;
    }
    setStopError("");
    try {
      const ok = await onSave({ status: "CLOSED_LOST", rejectionReason: reason });
      if (!ok) {
        setStopError("Pengajuan belum dihentikan. Silakan coba lagi.");
        return;
      }
      setShowStopDialog(false);
      setStopReason("");
      setMessage("Pengajuan dihentikan.");
    } catch (cause) {
      setStopError(
        cause instanceof Error ? cause.message : "Pengajuan belum dihentikan. Periksa koneksi lalu coba lagi."
      );
    }
  }
  async function save(body: Record<string, unknown>, fields: readonly (keyof Draft)[] = []) {
    if (disabled) return;
    setError(""); setMessage("");
    try {
      if (await onSave(body)) {
        setChanges(current => { const rest = { ...current }; for (const field of fields) delete rest[field]; return rest; });
        setMessage("Perubahan tersimpan.");
      } else setError("Perubahan belum tersimpan. Silakan coba lagi.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Perubahan belum tersimpan. Periksa koneksi lalu coba lagi."); }
  }

  return <section className="min-w-0 text-[var(--work-text)]" aria-label="Editor pengajuan">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-base font-semibold">Kelola pengajuan</h3><p className="mt-1 text-sm text-[var(--work-muted)]">{stopped ? "Pengajuan dihentikan. Dokumen tetap tersedia sebagai riwayat." : active ? "Sewa sudah aktif. Pantau periode dan dokumen pengajuan." : `${completedCount} dari ${totalSteps} tahap selesai${currentStep ? ` · saat ini: ${currentStep.title}` : ""}.`}</p></div>
      {!canManage && <span className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[var(--work-line)] px-2 text-xs text-[var(--work-muted)]"><LockKeyhole className="size-3.5" aria-hidden="true" />Akses baca</span>}
    </div>
    {stopped && lead.rejectionReason && <p className="mt-4 rounded-lg border border-red-200 bg-[var(--work-danger-soft)] p-3 text-sm text-[var(--work-danger)]">Alasan penghentian: {lead.rejectionReason}</p>}
    <nav aria-label="Bagian editor pengajuan" className="mt-5 grid grid-cols-2 gap-1 border-b border-[var(--work-line)] sm:flex sm:flex-wrap sm:gap-x-5">
      {([
        { key: "stages", label: "Tahapan", short: "Tahapan", icon: CalendarClock },
        { key: "unit", label: "Unit & pemohon", short: "Unit", icon: Building2 },
        { key: "documents", label: "Semua dokumen", short: "Dokumen", icon: FileText },
        { key: "notes", label: "Catatan & pengelolaan", short: "Catatan", icon: NotebookPen },
      ] as const).map(item => (
        <button
          key={item.key}
          type="button"
          aria-pressed={view === item.key}
          disabled={busy}
          onClick={() => navigate(item.key)}
          className={`inline-flex min-h-11 items-center justify-center gap-2 border-b-2 px-1 py-3 text-xs sm:justify-start sm:text-sm focus-visible:outline-2 focus-visible:outline-[var(--work-accent)] disabled:opacity-50 ${view === item.key ? "border-[var(--work-accent)] font-semibold text-[var(--work-accent)]" : "border-transparent text-[var(--work-muted)] hover:text-[var(--work-accent)]"}`}
        >
          <item.icon aria-hidden="true" className="hidden size-4 sm:block" />
          <span className="sm:hidden">{item.short}</span>
          <span className="hidden sm:inline">{item.label}</span>
        </button>
      ))}
    </nav>
    {view === "stages" && canChangeWorkflow && (
      <div className="mt-5 rounded-xl border border-[var(--work-accent)]/30 bg-[var(--work-accent-soft)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <GitBranch className="size-4 shrink-0 text-[var(--work-accent)]" aria-hidden="true" />
              <h5 className="text-sm font-semibold text-[var(--work-text)]">Pilih alur pengajuan</h5>
            </div>
            <p className="mt-1 text-sm text-[var(--work-muted)]">
              Pilih lalu konfirmasi — daftar tahap di bawah langsung mengikuti versi alur itu. Hanya bisa diganti selama status masih Pengajuan Diterima.
            </p>
          </div>
          {lead.workflowVersion ? (
            <WorkflowVersionBadge
              version={lead.workflowVersion.version}
              status={lead.workflowVersion.status}
              title={lead.workflowVersion.title}
              stepCount={lead.workflowVersion.stepCount}
              size="xs"
            />
          ) : null}
        </div>
        <div className="mt-3 max-w-xl">
          <label htmlFor={`${id}-workflow`} className="mb-1.5 block text-xs font-medium text-[var(--work-muted)]">
            Versi alur aktif
          </label>
          <select
            id={`${id}-workflow`}
            disabled={busy || workflowOptions.length === 0}
            value={lead.workflowVersion?.id ?? ""}
            onChange={(event) => void changeWorkflow(event.target.value)}
            className={control}
          >
            {workflowOptions.length === 0 ? (
              <option value="">Memuat daftar alur…</option>
            ) : (
              workflowOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {typeof item.version === "number" ? `v${item.version} — ` : ""}
                  {item.title}
                  {` · ${item.steps.length} tahap`}
                </option>
              ))
            )}
          </select>
          {workflowOptions.length <= 1 && (
            <p className="mt-1.5 text-xs text-[var(--work-muted)]">
              Hanya satu alur aktif. Aktifkan versi lain di menu Alur Pengajuan agar ada pilihan.
            </p>
          )}
        </div>
      </div>
    )}

    <div className={view === "stages" ? "mt-5 grid min-w-0 gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]" : "mt-5 min-w-0"}>
      {view === "stages" && <>
        <div className="lg:hidden">
          <label htmlFor={`${id}-stage`} className="mb-2 block text-xs font-medium text-[var(--work-muted)]">Lihat tahap</label>
          <select
            id={`${id}-stage`}
            value={selectedOrder}
            disabled={busy}
            onChange={(event) => void navigate("stages", Number(event.target.value))}
            className={control}
          >
            {steps.map((item) => {
              const past = active || item.stepOrder < (currentStep?.stepOrder ?? 1);
              const current = !stopped && !active && item.stepOrder === currentStep?.stepOrder;
              const locked = !active && item.stepOrder > maxSelectableOrder;
              return (
                <option key={item.id} value={item.stepOrder} disabled={locked}>
                  {item.stepOrder}. {item.title}
                  {past ? " · selesai" : current ? " · berjalan" : locked ? " · terkunci" : ""}
                </option>
              );
            })}
          </select>
        </div>
        <nav aria-label={`Daftar ${totalSteps} tahap pengajuan`} className="hidden lg:block">
          <ol className="space-y-1">
            {steps.map((item) => {
              const past = active || item.stepOrder < (currentStep?.stepOrder ?? 1);
              const current =
                !stopped && !active && item.stepOrder === currentStep?.stepOrder;
              const locked = !active && item.stepOrder > maxSelectableOrder;
              const selected = item.stepOrder === selectedOrder;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={busy || locked}
                    aria-current={selected ? "step" : undefined}
                    aria-disabled={locked || undefined}
                    title={locked ? "Selesaikan tahap berjalan dulu" : undefined}
                    onClick={() => {
                      if (locked) return;
                      void navigate("stages", item.stepOrder);
                    }}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-[var(--work-accent)] disabled:cursor-not-allowed disabled:opacity-45 ${
                      locked
                        ? "text-[var(--work-muted)]"
                        : selected
                          ? "bg-[var(--work-accent-soft)] text-[var(--work-accent)]"
                          : "text-[var(--work-muted)] hover:bg-[var(--work-subtle)]"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${
                        past
                          ? "bg-[var(--work-success-soft)] text-[var(--work-success)]"
                          : locked
                            ? "border border-dashed border-[var(--work-control)] text-[var(--work-muted)]"
                            : selected
                              ? "bg-[#E31E2D] text-white"
                              : "border border-[var(--work-control)]"
                      }`}
                    >
                      {past ? <Check className="size-3.5" /> : locked ? <LockKeyhole className="size-3.5" /> : item.stepOrder}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{item.title}</span>
                      {!past &&
                        (stopped ? (
                          <span className="mt-0.5 block text-xs text-[var(--work-muted)]">Tidak dilanjutkan</span>
                        ) : current ? (
                          <span className="mt-0.5 block text-xs font-medium text-[var(--work-accent)]">
                            Perlu ditindaklanjuti
                          </span>
                        ) : locked ? (
                          <span className="mt-0.5 block text-xs text-[var(--work-muted)]">
                            Terkunci sampai tahap sebelumnya selesai
                          </span>
                        ) : null)}
                    </span>
                    {selected && !locked && <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </>}
      <div className="min-w-0 space-y-5">
        {view === "stages" && selectedStep && (
          <header className="border-b border-[var(--work-line)] pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--work-muted)]">
                Tahap {selectedStep.stepOrder} dari {totalSteps}
              </span>
              {selectedIsPast ? (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--work-success)]">
                  <Check aria-hidden="true" className="size-3.5" />
                  Selesai
                </span>
              ) : (
                <span className="rounded-md bg-[var(--work-subtle)] px-2 py-1 text-xs text-[var(--work-muted)]">
                  {stopped ? "Tidak dilanjutkan" : selectedIsCurrent ? "Berjalan" : "Belum dikonfirmasi"}
                </span>
              )}
            </div>
            <h4 className="mt-1 text-lg font-semibold">{selectedStep.title}</h4>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--work-muted)]">
              {selectedStep.description || selectedStep.publicMessage}
            </p>
          </header>
        )}
        {view === "stages" && selectedStep?.leadStatus === "NEW" && (
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[var(--work-muted)]">Nomor pengajuan</dt>
              <dd className="mt-1 font-medium">{lead.inquiryCode}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--work-muted)]">Diterima</dt>
              <dd className="mt-1">{dateLabel(lead.createdAt)}</dd>
            </div>
          </dl>
        )}
        {view === "stages" && selectedStep?.leadStatus === "CONTACTED" && (
          <div className="space-y-3 text-sm">
            <p className="text-[var(--work-muted)]">
              Hubungi penanggung jawab, lalu konfirmasikan tahap ini setelah komunikasi dilakukan.
            </p>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-[var(--work-muted)]">Penanggung jawab</dt>
                <dd className="mt-1 break-words font-medium">{lead.contactName}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--work-muted)]">Telepon</dt>
                <dd className="mt-1 break-words">{lead.phone}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-[var(--work-muted)]">Email</dt>
                <dd className="mt-1 break-all">{lead.email}</dd>
              </div>
            </dl>
          </div>
        )}
        {showDocuments && (
          <InquiryDocuments
            key={`${view}-${selectedOrder}-${lead.workflowVersion?.id ?? "none"}`}
            leadId={lead.id}
            documentTypes={documentTypes}
            stepId={view === "stages" && lead.workflowVersion ? selectedStep?.id : undefined}
            stepOrder={view === "stages" && lead.workflowVersion ? selectedStep?.stepOrder : undefined}
            parentSaving={saving}
            leadStatus={lead.status}
            onChange={() => {
              void onReload();
            }}
            onDraftChange={setUploadDirty}
            onBusyChange={setDocumentBusy}
          />
        )}
        {showSiteVisit && (
          <details
            id="site-visit"
            className="group border-t border-[var(--work-line)] pt-3"
            open={lead.siteVisitStatus !== "NONE"}
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-[var(--work-line)] bg-[var(--work-subtle)] px-3 py-2.5 text-sm font-semibold text-[var(--work-text)] transition-colors hover:border-[var(--work-accent)]/40 hover:bg-white focus-visible:outline-2 focus-visible:outline-[var(--work-accent)] [&::-webkit-details-marker]:hidden">
              <CalendarClock aria-hidden="true" className="size-4 shrink-0 text-[var(--work-accent)]" />
              <span className="min-w-0 flex-1 truncate">Site visit</span>
              <span className="hidden min-w-0 truncate text-right text-xs font-medium tabular-nums text-[var(--work-text)] sm:block sm:max-w-[14rem]">
                {visitScheduleLabel(lead.siteVisitScheduledAt) ??
                  (SITE_VISIT_STATUS_LABELS[lead.siteVisitStatus as keyof typeof SITE_VISIT_STATUS_LABELS] ??
                    lead.siteVisitStatus)}
              </span>
              <span className="inline-flex shrink-0 items-center rounded-md border border-[var(--work-line)] bg-white px-2 py-0.5 text-xs font-medium text-[var(--work-text)]">
                {SITE_VISIT_STATUS_LABELS[lead.siteVisitStatus as keyof typeof SITE_VISIT_STATUS_LABELS] ??
                  lead.siteVisitStatus}
              </span>
              <ChevronDown
                aria-hidden="true"
                className="size-4 shrink-0 text-[var(--work-muted)] transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="mt-3 space-y-3">
              {visitScheduleLabel(lead.siteVisitScheduledAt) ? (
                <p className="text-sm font-medium tabular-nums text-[var(--work-text)] sm:hidden">
                  Jadwal: {visitScheduleLabel(lead.siteVisitScheduledAt)}
                </p>
              ) : null}
              {lead.surveyPreference && (
                <p className="break-words text-sm leading-relaxed text-[var(--work-muted)]">
                  Permintaan mitra: {lead.surveyPreference}
                </p>
              )}
              {selectedIsCurrent && !stopped ? (
                <fieldset disabled={disabled} className="min-w-0 space-y-3">
                  <legend className="sr-only">Jadwal site visit selama negosiasi</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`${id}-visit`} className="mb-2 block text-xs text-[var(--work-muted)]">
                        Status kunjungan
                      </label>
                      <select
                        id={`${id}-visit`}
                        className={control}
                        value={draft.visit}
                        onChange={(event) => change("visit", event.target.value)}
                      >
                        {SITE_VISIT_STATUS_VALUES.map((value) => (
                          <option key={value} value={value}>
                            {SITE_VISIT_STATUS_LABELS[value]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`${id}-scheduled`} className="mb-2 block text-xs text-[var(--work-muted)]">
                        Jadwal · waktu lokal perangkat
                      </label>
                      <input
                        id={`${id}-scheduled`}
                        type="datetime-local"
                        className={control}
                        value={draft.scheduled}
                        onChange={(event) => change("scheduled", event.target.value)}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className={secondary}
                    onClick={() => {
                      if (draft.scheduled && !Number.isFinite(Date.parse(draft.scheduled))) {
                        setError("Periksa tanggal dan waktu site visit.");
                        return;
                      }
                      void save(
                        {
                          siteVisitStatus: draft.visit,
                          siteVisitScheduledAt: draft.scheduled
                            ? new Date(draft.scheduled).toISOString()
                            : null,
                        },
                        ["visit", "scheduled"]
                      );
                    }}
                  >
                    Simpan site visit
                  </button>
                </fieldset>
              ) : (
                <p className="text-sm text-[var(--work-muted)]">
                  {visitScheduleLabel(lead.siteVisitScheduledAt) ?? "Tidak ada jadwal tersimpan."}{" "}
                  Pengelolaan site visit selesai bersama negosiasi.
                </p>
              )}
            </div>
          </details>
        )}
        {showLeaseDates && (
          <fieldset disabled={disabled || active || stopped} className="min-w-0 space-y-4 border-t border-[var(--work-line)] pt-4">
            <legend className="sr-only">Periode sewa pada PKS</legend>
            <h5 className="text-sm font-semibold">Periode sewa sesuai PKS</h5>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${id}-start`} className="mb-2 block text-xs text-[var(--work-muted)]">Tanggal mulai</label>
                <input id={`${id}-start`} type="date" className={control} value={draft.start} onChange={(event) => change("start", event.target.value)} />
              </div>
              <div>
                <label htmlFor={`${id}-end`} className="mb-2 block text-xs text-[var(--work-muted)]">Tanggal berakhir</label>
                <input id={`${id}-end`} type="date" min={draft.start || undefined} className={control} value={draft.end} onChange={(event) => change("end", event.target.value)} />
              </div>
            </div>
            <button type="button" className={secondary} onClick={() => void save({ leaseStartAt: draft.start || null, leaseEndAt: draft.end || null }, ["start", "end"])}>
              Simpan periode sewa
            </button>
          </fieldset>
        )}
        {showPayment && (
          <div className="space-y-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-[var(--work-muted)]">Mulai sewa · WIB</dt>
                <dd className="mt-1">{dateLabel(lead.leaseStartAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--work-muted)]">Akhir sewa · WIB</dt>
                <dd className="mt-1">{dateLabel(lead.leaseEndAt)}</dd>
              </div>
            </dl>
            <fieldset disabled={disabled || active || stopped || !canVerifyPayment} className="space-y-3 border-t border-[var(--work-line)] pt-4">
              <legend className="sr-only">Verifikasi pembayaran</legend>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input type="checkbox" className="size-4 accent-[#E31E2D]" checked={draft.payment} onChange={(event) => change("payment", event.target.checked)} />
                Pembayaran telah diperiksa dan diverifikasi admin
              </label>
              <button type="button" className={secondary} onClick={() => void save({ paymentVerified: draft.payment }, ["payment"])}>
                Simpan verifikasi pembayaran
              </button>
            </fieldset>
            {!canVerifyPayment && (
              <p className="text-xs text-[var(--work-muted)]">Verifikasi pembayaran tersedia setelah PKS dikonfirmasi.</p>
            )}
            {lead.paymentVerifiedAt && (
              <p className="text-sm text-[var(--work-success)]">
                Pembayaran terverifikasi {new Date(lead.paymentVerifiedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB.
              </p>
            )}
            {reminder && (
              <div role="status" className="rounded-lg border border-amber-200 bg-[var(--work-warning-soft)] p-3">
                <p className="text-sm font-semibold text-[var(--work-warning)]">{reminder.label} · internal</p>
                <p className="mt-1 text-sm text-[var(--work-warning)]">
                  {reminder.remainingDays >= 0
                    ? `${reminder.remainingDays} hari sebelum sewa berakhir.`
                    : `${Math.abs(reminder.remainingDays)} hari sejak sewa berakhir.`}{" "}
                  Hubungi mitra untuk tindak lanjut.
                </p>
              </div>
            )}
          </div>
        )}
        {view === "stages" && selectedStep && (
          <div className="space-y-3 border-t border-[var(--work-line)] pt-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <label htmlFor={`${id}-partner-message`} className="flex items-center gap-2 text-sm font-semibold">
                  <MessageSquareText className="size-4 text-[var(--work-accent)]" aria-hidden />
                  Pesan untuk mitra
                  <span className="font-normal text-[var(--work-danger)]">*</span>
                </label>
                <p className="mt-1 text-xs leading-relaxed text-[var(--work-muted)]">
                  Tampil di timeline portal mitra sebagai riwayat progres tahap ini.
                </p>
              </div>
              <button
                type="button"
                className={secondary}
                disabled={disabled}
                onClick={() =>
                  setPartnerMessage(selectedStep.publicMessage || selectedStep.description || "")
                }
              >
                Gunakan teks standar tahap
              </button>
            </div>
            <textarea
              id={`${id}-partner-message`}
              className={areaControl}
              rows={3}
              maxLength={5000}
              disabled={disabled || stopped}
              value={partnerMessage}
              onChange={(event) => setPartnerMessage(event.target.value)}
              placeholder="Jelaskan progres atau keputusan tahap ini untuk mitra"
            />
            {!selectedIsCurrent && !stopped && (
              <button
                type="button"
                className={secondary}
                disabled={disabled || !partnerMessage.trim()}
                onClick={() => void save({ partnerMessage: partnerMessage.trim() })}
              >
                Simpan pesan tahap ini
              </button>
            )}
          </div>
        )}
        {view === "unit" && <LeadUnitSummary lead={lead} />}
        {view === "notes" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h4 className="text-base font-semibold">Catatan internal</h4>
              <p className="mt-1 text-sm text-[var(--work-muted)]">
                Hanya untuk tim pengelola. Tidak ditampilkan kepada mitra.
              </p>
              <label htmlFor={`${id}-notes`} className="sr-only">
                Catatan internal
              </label>
              <textarea
                id={`${id}-notes`}
                className={`${areaControl} mt-3`}
                rows={4}
                maxLength={5000}
                disabled={disabled}
                value={draft.notes}
                onChange={(event) => change("notes", event.target.value)}
              />
              <button
                type="button"
                className={`${secondary} mt-3`}
                disabled={disabled}
                onClick={() => void save({ notes: draft.notes || null }, ["notes"])}
              >
                Simpan catatan
              </button>
            </div>

            <div className="border-t border-red-200 pt-4">
              <h4 className="text-sm font-semibold text-[var(--work-danger)]">
                Hentikan pengajuan
              </h4>
              <p className="mt-1 text-sm leading-relaxed text-[var(--work-muted)]">
                Alasan akan terlihat oleh mitra. Reservasi dilepas, dokumen tetap disimpan untuk audit.
              </p>
              {stopped ? (
                <p className="mt-3 rounded-lg border border-red-200 bg-[var(--work-danger-soft)] p-3 text-sm text-[var(--work-danger)]">
                  Pengajuan ini sudah dihentikan
                  {lead.rejectionReason ? `: ${lead.rejectionReason}` : "."}
                </p>
              ) : active ? (
                <p className="mt-3 text-sm text-[var(--work-muted)]">
                  Sewa sudah aktif. Penghentian dikelola lewat Penyewa Aktif.
                </p>
              ) : (
                <button
                  type="button"
                  disabled={!canStop || busy}
                  className="mt-3 min-h-11 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-[var(--work-danger)] hover:bg-[var(--work-danger-soft)] disabled:opacity-50"
                  onClick={openStopDialog}
                >
                  Hentikan pengajuan…
                </button>
              )}
            </div>
          </div>
        )}
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-[var(--work-danger-soft)] p-3 text-sm text-[var(--work-danger)]">{error}</p>}
        {message && <p role="status" className="text-sm text-[var(--work-success)]">{message}</p>}
        {view === "stages" && !stopped && !active && currentStep && (
          <footer className="flex flex-col gap-3 border-t border-[var(--work-line)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-prose text-xs leading-relaxed text-[var(--work-muted)]">
              {selectedIsCurrent
                ? "Isi pesan untuk mitra, lalu selesaikan tahap. Alur mengikuti versi yang dipilih untuk pengajuan ini."
                : "Memilih tahap hanya mengubah tampilan, bukan status pengajuan."}
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              {selectedIsCurrent && nextStep ? (
                <button
                  type="button"
                  className={primary}
                  disabled={disabled || uploadDirty || stageDraftDirty || !partnerMessage.trim()}
                  onClick={() =>
                    void save({
                      ...(lead.workflowVersion ? { advance: { fromStepId: currentStep.id, toStepId: nextStep.id } } : { status: nextStep.leadStatus }),
                      partnerMessage: partnerMessage.trim(),
                    })
                  }
                >
                  {saving ? "Menyimpan…" : advanceLabel(currentStep, nextStep)}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </button>
              ) : selectedIsCurrent && !nextStep ? (
                <button
                  type="button"
                  className={primary}
                  disabled={disabled || uploadDirty || stageDraftDirty || !partnerMessage.trim()}
                  onClick={() =>
                    void save({
                      status: "COMMERCIAL_OPERATION",
                      partnerMessage: partnerMessage.trim(),
                    })
                  }
                >
                  {saving ? "Menyimpan…" : "Aktifkan sewa"}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </button>
              ) : currentStep ? (
                <button
                  type="button"
                  className={secondary}
                  disabled={busy}
                  onClick={() => void navigate("stages", currentStep.stepOrder)}
                >
                  Ke tahap berjalan
                  <ArrowRight aria-hidden="true" className="size-4" />
                </button>
              ) : null}
            </div>
          </footer>
        )}
      </div>
    </div>

    <Dialog
      open={showStopDialog}
      onOpenChange={(open) => {
        if (saving) return;
        setShowStopDialog(open);
        if (!open) {
          setStopReason("");
          setStopError("");
        }
      }}
    >
      <DialogContent className="max-w-md gap-4 border border-slate-200 bg-white p-5 text-slate-900 sm:p-6">
        <DialogHeader className="gap-2 space-y-0 text-left">
          <DialogTitle className="pr-8 text-base text-slate-900">
            Hentikan pengajuan?
          </DialogTitle>
          <DialogDescription className="leading-relaxed text-slate-600">
            Pengajuan{" "}
            <span className="font-semibold text-slate-900 tabular-nums">
              {lead.inquiryCode}
            </span>{" "}
            akan berstatus Drop-off. Alasan terlihat oleh mitra. Reservasi unit dilepas; dokumen tetap disimpan untuk audit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor={`${id}-stop-reason`} className="block text-sm font-medium text-slate-800">
            Alasan penghentian <span className="text-[#D81435]">*</span>
          </label>
          <textarea
            id={`${id}-stop-reason`}
            rows={4}
            maxLength={2000}
            autoFocus
            disabled={saving}
            value={stopReason}
            onChange={(event) => {
              setStopReason(event.target.value);
              if (stopError) setStopError("");
            }}
            placeholder="Jelaskan alasan penghentian secara jelas untuk mitra"
            className={areaControl}
          />
          {stopError ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {stopError}
            </p>
          ) : null}
        </div>

        <DialogFooter className="flex-row flex-wrap justify-end gap-2 sm:space-x-0">
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={() => setShowStopDialog(false)}
          >
            Batal
          </Button>
          <Button
            type="button"
            disabled={saving || !stopReason.trim()}
            className="bg-rose-600 text-white hover:bg-rose-500"
            onClick={() => void submitStop()}
          >
            {saving ? "Menyimpan…" : "Ya, hentikan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {confirmElement}
  </section>;
}
