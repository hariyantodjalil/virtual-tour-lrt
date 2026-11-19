"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  CopyPlus,
  Eye,
  EyeOff,
  FileText,
  FolderOpen,
  GitBranch,
  Loader2,
  Lock,
  Plus,
  Rocket,
  Save,
  ShieldCheck,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { cmsFetch } from "@/lib/cms-fetch";
import {
  STEP_MEDIA_REQUIREMENT_LABELS,
  STEP_SPACE_EFFECT_LABELS,
  deriveStepLeadStatus,
  type PipelineStepTypeValue,
  type StepMediaRequirementValue,
  type StepSpaceEffectValue,
} from "@/lib/commercial-pipeline";
import type { CmsWorkflowStepDTO, CmsWorkflowVersionDTO } from "@/lib/cms-workflow";
import { showAppToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import WorkflowVersionBadge from "@/components/cms/WorkflowVersionBadge";
import WorkflowStepPreview from "./WorkflowStepPreview";

const STEP_TYPE_CARDS: Array<{
  value: PipelineStepTypeValue;
  title: string;
  shortLabel: string;
  desc: string;
  icon: typeof FileText;
}> = [
  {
    value: "STANDARD",
    title: "Administrasi standar",
    shortLabel: "Administrasi",
    desc: "Pesan publik dan unggah dokumen. Untuk review berkas, negosiasi, atau konfirmasi.",
    icon: ClipboardList,
  },
  {
    value: "DOCUMENT_ISSUANCE",
    title: "Penerbitan nomor surat",
    shortLabel: "Nomor surat",
    desc: "Admin wajib mengisi nomor surat (RDS, BA, PKS) sebelum tahap selesai.",
    icon: FileText,
  },
  {
    value: "SITE_VISIT",
    title: "Kunjungan lokasi",
    shortLabel: "Kunjungan",
    desc: "Status dan jadwal survei lapangan yang tampil di Portal Mitra.",
    icon: CalendarClock,
  },
];

const STEP_TYPE_BY_VALUE = Object.fromEntries(
  STEP_TYPE_CARDS.map((card) => [card.value, card])
) as Record<PipelineStepTypeValue, (typeof STEP_TYPE_CARDS)[number]>;

const MEDIA_OPTIONS: StepMediaRequirementValue[] = ["NONE", "OPTIONAL", "REQUIRED"];
const SPACE_EFFECT_OPTIONS: StepSpaceEffectValue[] = [
  "NONE",
  "RESERVE_SPACE",
  "FIT_OUT_SPACE",
  "ACTIVATE_TENANT",
];

function getStatusBadgeClass(status: string) {
  if (status === "ACTIVE") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "DRAFT") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function getVersionStatusLabel(status: string) {
  if (status === "ACTIVE") return "Aktif";
  if (status === "DRAFT") return "Calon Versi";
  return "Arsip";
}

function formatDateTimeId(iso: string) {
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

function sortWorkflowVersions(list: CmsWorkflowVersionDTO[]): CmsWorkflowVersionDTO[] {
  return [...list].sort((a, b) => {
    const aIsDraft = a.status === "DRAFT" || a.version === null;
    const bIsDraft = b.status === "DRAFT" || b.version === null;
    if (!aIsDraft && !bIsDraft) {
      return (b.version ?? 0) - (a.version ?? 0);
    }
    if (aIsDraft && !bIsDraft) return 1;
    if (!aIsDraft && bIsDraft) return -1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function getVersionShortLabel(v: CmsWorkflowVersionDTO | null | undefined) {
  if (!v) return "Workflow";
  return typeof v.version === "number" ? `v${v.version}` : v.title || "Draf";
}

function validateClientDraftSteps(steps: CmsWorkflowStepDTO[], title: string): string[] {
  const issues: string[] = [];
  if (title.trim().length < 3) {
    issues.push("Nama draf versi workflow minimal 3 karakter.");
  }
  if (steps.length < 2) {
    issues.push("Workflow wajib memiliki minimal 2 tahapan.");
    return issues;
  }
  for (const step of steps) {
    if (step.title.trim().length < 2) {
      issues.push(`Tahap ${step.stepOrder}: judul tahap minimal 2 karakter.`);
    }
    if (step.publicMessage.trim().length < 5) {
      issues.push(`Tahap ${step.stepOrder}: pesan panduan publik minimal 5 karakter.`);
    }
    if (step.stepType === "DOCUMENT_ISSUANCE" && !step.documentNumberLabel?.trim()) {
      issues.push(
        `Tahap ${step.stepOrder} (${step.title || "Tanpa judul"}): label nomor surat wajib diisi.`
      );
    }
    if (step.slaHours !== null && (step.slaHours < 1 || step.slaHours > 720)) {
      issues.push(`Tahap ${step.stepOrder}: target SLA harus antara 1 sampai 720 jam.`);
    }
  }
  const lastStep = steps[steps.length - 1];
  if (!lastStep || lastStep.spaceEffect !== "ACTIVATE_TENANT") {
    issues.push(
      "Tahap terakhir harus memiliki efek unit ACTIVATE_TENANT (Ubah unit jadi TERISI & aktifkan penyewa)."
    );
  }
  return issues;
}

export default function WorkflowBuilderClient({
  initialVersions,
  focusedVersionId,
}: {
  initialVersions: CmsWorkflowVersionDTO[];
  focusedVersionId?: string;
}) {
  const [versions, setVersions] = useState<CmsWorkflowVersionDTO[]>(() =>
    sortWorkflowVersions(initialVersions)
  );

  const initialPublished = initialVersions.filter((v) => v.status !== "DRAFT");
  const focusedVersion = focusedVersionId
    ? initialVersions.find((v) => v.id === focusedVersionId)
    : null;
  const initialSelected =
    focusedVersion ??
    initialVersions.find((v) => v.status === "ACTIVE") ??
    initialPublished[0] ??
    initialVersions[0] ??
    null;

  const isFocusedView = Boolean(focusedVersionId);

  const [selectedVersionId, setSelectedVersionId] = useState<string>(
    initialSelected?.id ?? ""
  );
  const [draftTitle, setDraftTitle] = useState<string>(initialSelected?.title ?? "");
  const [draftDescription, setDraftDescription] = useState<string>(
    initialSelected?.description ?? ""
  );
  const [steps, setSteps] = useState<CmsWorkflowStepDTO[]>(initialSelected?.steps ?? []);
  const [selectedStepOrder, setSelectedStepOrder] = useState<number>(
    initialSelected?.steps[0]?.stepOrder ?? 1
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [showDraftsModal, setShowDraftsModal] = useState(false);

  const [cloning, setCloning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [deleteTargetDraft, setDeleteTargetDraft] =
    useState<CmsWorkflowVersionDTO | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    label: string;
    run: () => Promise<void> | void;
  } | null>(null);
  const [resolvingUnsaved, setResolvingUnsaved] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const publishedVersions = useMemo(
    () =>
      versions.filter(
        (v) => v.status !== "DRAFT" && typeof v.version === "number"
      ),
    [versions]
  );

  const draftVersions = useMemo(
    () =>
      [...versions.filter((v) => v.status === "DRAFT")].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [versions]
  );

  const activeVersion = useMemo(
    () => publishedVersions.find((v) => v.status === "ACTIVE") ?? publishedVersions[0] ?? null,
    [publishedVersions]
  );

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) ?? activeVersion ?? versions[0] ?? null,
    [versions, selectedVersionId, activeVersion]
  );

  const isDraftMode = selectedVersion?.status === "DRAFT";

  useEffect(() => {
    if (!isDraftMode || !hasUnsavedChanges) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDraftMode, hasUnsavedChanges]);

  function guardUnsavedChanges(
    label: string,
    action: () => Promise<void> | void
  ) {
    if (!isDraftMode || !hasUnsavedChanges) {
      void action();
      return;
    }
    setPendingAction({ label, run: action });
  }
  const displayedSteps = useMemo(
    () => (isDraftMode ? steps : (selectedVersion?.steps ?? [])),
    [isDraftMode, steps, selectedVersion]
  );
  const selectedStep =
    displayedSteps.find((step) => step.stepOrder === selectedStepOrder) ??
    displayedSteps[0] ??
    null;
  const nextSelectedStep = useMemo(() => {
    if (!selectedStep) return null;
    return (
      displayedSteps.find((step) => step.stepOrder === selectedStep.stepOrder + 1) ??
      null
    );
  }, [displayedSteps, selectedStep]);

  const guardrailIssues = useMemo(
    () =>
      validateClientDraftSteps(
        displayedSteps,
        isDraftMode ? draftTitle : (selectedVersion?.title ?? "")
      ),
    [displayedSteps, draftTitle, isDraftMode, selectedVersion?.title]
  );

  function selectVersion(version: CmsWorkflowVersionDTO) {
    setSelectedVersionId(version.id);
    setDraftTitle(version.title);
    setDraftDescription(version.description ?? "");
    setSteps(version.steps);
    setSelectedStepOrder(version.steps[0]?.stepOrder ?? 1);
    setHasUnsavedChanges(false);
    setActionError(null);
  }

  function updateVersionInList(nextVersion: CmsWorkflowVersionDTO) {
    setVersions((prev) => {
      const exists = prev.some((v) => v.id === nextVersion.id);
      const next = exists
        ? prev.map((v) => (v.id === nextVersion.id ? nextVersion : v))
        : [nextVersion, ...prev];
      return sortWorkflowVersions(next);
    });
  }

  async function handleCreateDraft(sourceVersionId?: string) {
    setCloning(true);
    setActionError(null);
    try {
      const targetSourceId = sourceVersionId ?? activeVersion?.id ?? selectedVersion?.id;
      const res = await cmsFetch("/api/cms/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(targetSourceId ? { sourceVersionId: targetSourceId } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error || "Gagal membuat draf versi baru.");
        return;
      }

      const created: CmsWorkflowVersionDTO = data.version;
      updateVersionInList(created);
      selectVersion(created);
      setShowDraftsModal(false);
      showAppToast({
        type: "success",
        title: "Draf versi baru berhasil dibuat",
        description: `Dibuka dengan nama "${created.title}". Ubah nama draf sesuai kebutuhan.`,
      });
    } finally {
      setCloning(false);
    }
  }

  function renumberSteps(list: CmsWorkflowStepDTO[]): CmsWorkflowStepDTO[] {
    return list.map((step, index) => ({
      ...step,
      stepOrder: index + 1,
      leadStatus: deriveStepLeadStatus({
        index,
        totalSteps: list.length,
        stepType: step.stepType,
        spaceEffect: step.spaceEffect,
        title: step.title,
        existingLeadStatus: step.leadStatus,
      }),
    }));
  }

  function updateStep(stepOrder: number, patch: Partial<CmsWorkflowStepDTO>) {
    if (!isDraftMode) return;
    setSteps((prev) =>
      prev.map((step, index) => {
        if (step.stepOrder !== stepOrder) return step;
        const next: CmsWorkflowStepDTO = { ...step, ...patch };
        if (patch.mediaRequirement !== undefined) {
          next.requiresMedia = patch.mediaRequirement === "REQUIRED";
        }
        if (patch.stepType && patch.stepType !== "DOCUMENT_ISSUANCE") {
          next.documentNumberLabel = null;
        }
        next.leadStatus = deriveStepLeadStatus({
          index,
          totalSteps: prev.length,
          stepType: next.stepType,
          spaceEffect: next.spaceEffect,
          title: next.title,
          existingLeadStatus: next.leadStatus,
        });
        return next;
      })
    );
    setHasUnsavedChanges(true);
    setActionError(null);
  }

  function handleMoveStep(stepOrder: number, direction: -1 | 1) {
    if (!isDraftMode) return;
    const idx = steps.findIndex((s) => s.stepOrder === stepOrder);
    const targetIdx = idx + direction;
    if (idx < 0 || targetIdx < 0 || targetIdx >= steps.length) return;

    const copy = [...steps];
    const [moved] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, moved);
    const normalized = renumberSteps(copy);
    setSteps(normalized);
    setSelectedStepOrder(targetIdx + 1);
    setHasUnsavedChanges(true);
  }

  function handleAddStep() {
    if (!isDraftMode || steps.length >= 30) return;
    const newStep: CmsWorkflowStepDTO = {
      id: `draft-step-${Date.now()}`,
      stepOrder: steps.length,
      leadStatus: "CONTACTED",
      stepType: "STANDARD",
      documentNumberLabel: null,
      slaHours: null,
      mediaRequirement: "OPTIONAL",
      requiresMedia: false,
      spaceEffect: "NONE",
      title: "Tahap Verifikasi Tambahan",
      description: "Tahap evaluasi atau koordinasi tambahan sebelum proses berikutnya.",
      publicMessage:
        "Tim komersial sedang memproses tahap verifikasi lanjutan untuk pengajuan Anda.",
      showInSummary: true,
    };

    // Sisipkan tepat setelah tahap yang sedang dipilih (tetap di sebelum tahap penutup jika sedang di tahap akhir).
    const currentIdx = steps.findIndex((s) => s.stepOrder === selectedStepOrder);
    const insertIdx =
      currentIdx >= 0 && currentIdx < steps.length - 1
        ? currentIdx + 1
        : Math.max(1, steps.length - 1);
    const copy = [...steps];
    copy.splice(insertIdx, 0, newStep);
    const normalized = renumberSteps(copy);
    setSteps(normalized);
    setSelectedStepOrder(insertIdx + 1);
    setHasUnsavedChanges(true);
    setActionError(null);
    showAppToast({
      type: "info",
      title: `Tahap baru disisipkan di urutan ke-${insertIdx + 1}`,
    });
  }

  function handleRemoveStep(stepOrder: number) {
    if (
      !isDraftMode ||
      steps.length <= 2 ||
      stepOrder <= 1 ||
      stepOrder >= steps.length
    ) {
      return;
    }
    const filtered = steps.filter((s) => s.stepOrder !== stepOrder);
    const normalized = renumberSteps(filtered);
    setSteps(normalized);
    setSelectedStepOrder(Math.min(stepOrder, normalized.length));
    setHasUnsavedChanges(true);
    setActionError(null);
  }

  async function saveDraftRequest(): Promise<CmsWorkflowVersionDTO | null> {
    if (!selectedVersion || !isDraftMode) return null;
    if (guardrailIssues.length > 0) {
      setActionError(guardrailIssues[0]);
      return null;
    }

    setSaving(true);
    setActionError(null);
    try {
      const payload = {
        title: draftTitle.trim(),
        description: draftDescription.trim() || null,
        steps: steps.map((step) => ({
          stepOrder: step.stepOrder,
          leadStatus: step.leadStatus,
          stepType: step.stepType,
          documentNumberLabel:
            step.stepType === "DOCUMENT_ISSUANCE"
              ? step.documentNumberLabel?.trim() || null
              : null,
          slaHours: step.slaHours && step.slaHours > 0 ? step.slaHours : null,
          mediaRequirement: step.mediaRequirement,
          spaceEffect: step.spaceEffect,
          title: step.title.trim(),
          description: step.description?.trim() || null,
          publicMessage: step.publicMessage.trim(),
          showInSummary: step.showInSummary,
        })),
      };

      const res = await cmsFetch(`/api/cms/workflow/${selectedVersion.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error || "Gagal menyimpan perubahan draf.");
        return null;
      }

      const savedVersion: CmsWorkflowVersionDTO = data.version;
      updateVersionInList(savedVersion);
      setSteps(savedVersion.steps);
      setDraftTitle(savedVersion.title);
      setDraftDescription(savedVersion.description ?? "");
      setHasUnsavedChanges(false);
      return savedVersion;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDraft() {
    const saved = await saveDraftRequest();
    if (saved) {
      showAppToast({
        type: "success",
        title: `Draf "${saved.title}" tersimpan`,
        description: `${saved.steps.length} tahapan berhasil diperbarui.`,
      });
    }
  }

  async function handleConfirmPublish() {
    if (!selectedVersion || !isDraftMode) return;
    if (hasUnsavedChanges) {
      const saved = await saveDraftRequest();
      if (!saved) {
        setShowPublishDialog(false);
        return;
      }
    }

    setPublishing(true);
    setActionError(null);
    try {
      const res = await cmsFetch(
        `/api/cms/workflow/${selectedVersion.id}/publish`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error || "Gagal mempublikasikan workflow.");
        setShowPublishDialog(false);
        return;
      }

      const publishedVersion: CmsWorkflowVersionDTO = data.version;
      setVersions((prev) =>
        sortWorkflowVersions(
          prev.map((v) => (v.id === publishedVersion.id ? publishedVersion : v))
        )
      );
      selectVersion(publishedVersion);
      setShowPublishDialog(false);
      showAppToast({
        type: "success",
        title: `Workflow v${publishedVersion.version} resmi dipublikasikan`,
        description: "Pengajuan mitra baru otomatis memakai versi ini.",
      });
    } finally {
      setPublishing(false);
    }
  }

  async function handleDeleteDraft() {
    if (!deleteTargetDraft || deleteTargetDraft.status !== "DRAFT") return;
    setDeleting(true);
    setActionError(null);
    try {
      const targetId = deleteTargetDraft.id;
      const targetName = deleteTargetDraft.title;
      const res = await cmsFetch(`/api/cms/workflow/${targetId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error || "Gagal menghapus draf workflow.");
        setDeleteTargetDraft(null);
        return;
      }

      const remaining = sortWorkflowVersions(
        versions.filter((v) => v.id !== targetId)
      );
      setVersions(remaining);

      if (selectedVersion?.id === targetId) {
        const fallback =
          remaining.find((v) => v.status === "ACTIVE") ??
          remaining.find((v) => v.status !== "DRAFT") ??
          remaining[0] ??
          null;
        if (fallback) {
          selectVersion(fallback);
        }
      }

      setDeleteTargetDraft(null);
      showAppToast({
        type: "info",
        title: `Draf "${targetName}" dihapus`,
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="w-full space-y-5 pb-12">
      {/* Slot navigasi selalu ada agar SSR/CSR punya pohon DOM yang sama (hindari hydration mismatch). */}
      <nav
        aria-label="Navigasi alur"
        className={isFocusedView ? "block" : "hidden"}
      >
        <Link
          href="/cms/workflow"
          prefetch={false}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D81435]"
          tabIndex={isFocusedView ? 0 : -1}
          aria-hidden={!isFocusedView}
        >
          ← Daftar alur
        </Link>
      </nav>
      {/* Toolbar utama */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-rose-50 text-[#D81435]">
                <GitBranch className="size-4" strokeWidth={1.75} />
              </span>
              <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                {isFocusedView
                  ? selectedVersion?.title || "Detail alur pengajuan"
                  : "Studio Konfigurasi Alur Pengajuan"}
              </h1>
            </div>
            {isFocusedView && selectedVersion ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-slate-600">
                <WorkflowVersionBadge
                  version={selectedVersion.version}
                  status={selectedVersion.status}
                  title={isDraftMode ? draftTitle : selectedVersion.title}
                  prefix={null}
                  size="xs"
                />
                <span className="tabular-nums">
                  <span className="font-semibold text-slate-900">{displayedSteps.length}</span> tahap
                </span>
                <span aria-hidden className="text-slate-300">·</span>
                <span className="tabular-nums">
                  <span className="font-semibold text-slate-900">{selectedVersion.leadsCount}</span> pengajuan terikat
                </span>
                <span aria-hidden className="text-slate-300">·</span>
                <span className="tabular-nums" suppressHydrationWarning>
                  {isDraftMode ? "Disimpan " : "Terbit "}
                  {formatDateTimeId(
                    (isDraftMode ? selectedVersion.updatedAt : selectedVersion.publishedAt) ??
                      selectedVersion.updatedAt
                  )}{" "}
                  WIB
                </span>
                {isDraftMode && hasUnsavedChanges && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    Belum disimpan
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Kelola versi tahapan, tipe form proses, target SLA, syarat dokumen, serta efek status unit tanpa mengganggu pengajuan yang sedang berjalan.
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowDraftsModal(true)}
              className="h-9 gap-1.5 border-slate-300 text-xs font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-[#D81435]"
            >
              <FolderOpen className="size-3.5 text-slate-600" strokeWidth={1.6} />
              Lihat Draf
              {draftVersions.length > 0 && (
                <Badge className="ml-0.5 h-5 min-w-5 rounded-full border-amber-200 bg-amber-100 px-1.5 text-xs font-semibold text-amber-800 tabular-nums">
                  {draftVersions.length}
                </Badge>
              )}
            </Button>

            {!isDraftMode ? (
              <Button
                type="button"
                size="sm"
                onClick={() => void handleCreateDraft(selectedVersion?.id)}
                disabled={cloning}
                className="h-9 gap-2 text-xs focus-visible:outline-2 focus-visible:outline-[#D81435]"
              >
                {cloning ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CopyPlus className="size-3.5" />
                )}
                {typeof selectedVersion?.version === "number"
                  ? `Buat Draf dari v${selectedVersion.version}`
                  : "Buat Draf Versi Baru"}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => selectedVersion && setDeleteTargetDraft(selectedVersion)}
                  disabled={deleting || saving || publishing}
                  className="h-9 gap-1.5 border-slate-200 text-xs font-medium text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-[#D81435] focus-visible:outline-2 focus-visible:outline-[#D81435]"
                >
                  <Trash2 className="size-3.5" />
                  Hapus Draf
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleSaveDraft()}
                  disabled={saving || publishing}
                  className="h-9 gap-1.5 border-slate-300 text-xs font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-[#D81435]"
                >
                  {saving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  Simpan Draf
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowPublishDialog(true)}
                  disabled={saving || publishing || guardrailIssues.length > 0}
                  className="h-9 gap-1.5 text-xs focus-visible:outline-2 focus-visible:outline-[#D81435]"
                >
                  <Rocket className="size-3.5" />
                  Publikasikan Versi Aktif
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Pemilih versi terbit — selalu di pohon DOM; disembunyikan di mode detail. */}
      <section
        className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${
          isFocusedView || publishedVersions.length === 0 ? "hidden" : ""
        }`}
        aria-hidden={isFocusedView || publishedVersions.length === 0}
      >
        <h2 className="text-sm font-semibold text-slate-900">Versi terbit</h2>
        <p className="mt-0.5 text-sm text-slate-600">
          Pilih versi yang sudah dipublikasikan untuk ditinjau (read-only).
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {publishedVersions.map((v) => {
            const selected = v.id === selectedVersion?.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() =>
                  guardUnsavedChanges(`membuka versi v${v.version}`, () =>
                    selectVersion(v)
                  )
                }
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D81435] ${
                  selected
                    ? "border-[#D81435] bg-rose-50 font-semibold text-rose-950"
                    : "border-slate-200 bg-white font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="tabular-nums">v{v.version}</span>
                <span
                  className={`rounded border px-1.5 py-0.5 text-xs font-medium ${getStatusBadgeClass(
                    v.status
                  )}`}
                >
                  {getVersionStatusLabel(v.status)}
                </span>
                <span
                  className={`text-xs tabular-nums ${
                    selected ? "text-rose-800" : "text-slate-500"
                  }`}
                >
                  {v.steps.length} tahap · {v.leadsCount} pengajuan
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Banner status versi terkunci (read-only) */}
      {selectedVersion && !isDraftMode && (
        <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Lock className="size-3.5" />
            </span>
            <div className="min-w-0 text-sm">
              <p className="font-medium text-slate-900">
                Hanya baca. Versi {getVersionShortLabel(selectedVersion)} dikunci untuk{" "}
                <span className="tabular-nums">{selectedVersion.leadsCount}</span> pengajuan yang memakainya.
              </p>
              <p className="mt-0.5 truncate text-slate-600">
                {selectedVersion.description?.trim()
                  ? selectedVersion.description
                  : "Belum ada catatan perubahan."}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Metadata draf sedang diedit */}
      {isDraftMode && selectedVersion && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <WorkflowVersionBadge
                  version={selectedVersion.version}
                  status={selectedVersion.status}
                  title={draftTitle}
                  prefix="Mengedit Draf"
                />
                <span className="text-xs text-slate-500 tabular-nums">
                  {displayedSteps.length} tahapan · Terakhir disimpan{" "}
                  <span suppressHydrationWarning>
                    {formatDateTimeId(selectedVersion.updatedAt)} WIB
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                {hasUnsavedChanges && (
                  <span className="text-xs font-medium text-amber-700">
                    Perubahan belum disimpan
                  </span>
                )}
                {activeVersion && (
                  <button
                    type="button"
                    onClick={() =>
                      guardUnsavedChanges(
                        `melihat versi aktif v${activeVersion.version}`,
                        () => selectVersion(activeVersion)
                      )
                    }
                    className="text-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                  >
                    Lihat versi aktif (v{activeVersion.version})
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="workflow-draft-title"
                  className="mb-1.5 block text-sm font-medium text-slate-800"
                >
                  Nama Draf Versi
                </label>
                <input
                  id="workflow-draft-title"
                  type="text"
                  value={draftTitle}
                  onChange={(e) => {
                    setDraftTitle(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  maxLength={120}
                  placeholder="Contoh: Draf Penyederhanaan Alur Q4 2026"
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#D81435] focus:outline-none focus-visible:outline-2 focus-visible:outline-[#D81435] focus-visible:outline-offset-2"
                />
                <p className="mt-1 text-sm text-slate-500">
                  Digunakan sebagai nama versi saat draf ini resmi dipublikasikan.
                </p>
              </div>
              <div>
                <label
                  htmlFor="workflow-draft-desc"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Catatan Perubahan (Opsional)
                </label>
                <input
                  id="workflow-draft-desc"
                  type="text"
                  value={draftDescription}
                  onChange={(e) => {
                    setDraftDescription(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  maxLength={500}
                  placeholder="Contoh: Menambah tahap verifikasi pajak sebelum PKS dan mempercepat SLA"
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#D81435] focus:outline-none focus-visible:outline-2 focus-visible:outline-[#D81435] focus-visible:outline-offset-2"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Opsional. Catat ringkasan pembaruan dibanding versi sebelumnya — catatan ini akan ditampilkan di info versi terbit.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 shadow-sm">
          <div className="flex items-start gap-2 text-sm text-rose-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#D81435]" />
            <span>{actionError}</span>
          </div>
        </div>
      )}

      {isDraftMode && guardrailIssues.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
          <p className="font-semibold">
            Lengkapi syarat integritas sebelum publikasi:
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
            {guardrailIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Workspace Utama: 2 Kolom Default (4:8) atau 50:50 saat Preview Terbuka */}
      <div className="grid items-start gap-5 lg:grid-cols-12">
        {/* Kiri: Urutan Tahapan + Konfigurasi Tahap (Lebar penuh saat preview tertutup, 50% saat preview terbuka) */}
        <div
          className={
            showPreview
              ? "grid items-start gap-4 lg:col-span-6 xl:grid-cols-[232px_minmax(0,1fr)]"
              : "grid items-start gap-5 lg:col-span-12 lg:grid-cols-12"
          }
        >
          {/* Panel Urutan Tahapan dengan Timeline Connector */}
          <section
            className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${
              showPreview ? "" : "lg:sticky lg:top-6 lg:col-span-4 xl:col-span-3"
            }`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Daftar tahap
                </h2>
                <p className="mt-0.5 text-sm text-slate-600 tabular-nums">
                  {displayedSteps.length} langkah berurutan
                </p>
              </div>
              {isDraftMode && (
                <button
                  type="button"
                  onClick={handleAddStep}
                  disabled={steps.length >= 30}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  <Plus className="size-3.5 text-[#D81435]" />
                  Tambah
                </button>
              )}
            </div>

            <div className="mt-4">
              {displayedSteps.map((step, index) => {
                const isSelected = step.stepOrder === selectedStep?.stepOrder;
                const isFirst = index === 0;
                const isLast = index === displayedSteps.length - 1;
                const canReorder = isDraftMode && !isFirst && !isLast;

                return (
                  <div key={step.id} className="flex items-stretch gap-3">
                    {/* Track Node & Garis Penghubung Stepper */}
                    <div className="flex flex-col items-center pt-3">
                      <button
                        type="button"
                        onClick={() => setSelectedStepOrder(step.stepOrder)}
                        aria-label={`Pilih Tahap ${step.stepOrder}: ${step.title}`}
                        className={`z-10 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors ${
                          isSelected
                            ? "bg-[#D81435] text-white ring-4 ring-rose-50"
                            : isLast
                              ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
                              : "border border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                        }`}
                      >
                        {step.stepOrder}
                      </button>
                      {!isLast && (
                        <div
                          className={`mt-1 w-0.5 flex-1 min-h-4 ${
                            isSelected ? "bg-rose-200" : "bg-slate-200"
                          }`}
                        />
                      )}
                    </div>

                    {/* Kartu Tahap */}
                    <div
                      className={`min-w-0 flex-1 ${
                        !isLast ? "pb-2.5" : ""
                      }`}
                    >
                      <div
                        className={`rounded-xl border transition-colors ${
                          isSelected
                            ? "border-[#D81435] bg-white shadow-[0_0_0_3px_rgba(216,20,53,0.08)]"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                        }`}
                      >
                        <div className="flex items-start gap-2 p-3">
                          <button
                            type="button"
                            onClick={() => setSelectedStepOrder(step.stepOrder)}
                            aria-current={isSelected ? "step" : undefined}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="block truncate text-sm font-semibold text-slate-900">
                              {step.title || `Tahap ${step.stepOrder}`}
                            </span>
                            {(() => {
                              const typeCard = STEP_TYPE_BY_VALUE[step.stepType];
                              const TypeIcon = typeCard?.icon ?? ClipboardList;
                              return (
                                <span
                                  className={`mt-0.5 flex items-center gap-1 text-xs ${
                                    isSelected ? "text-[#D81435]" : "text-slate-500"
                                  }`}
                                >
                                  <TypeIcon className="size-3" />
                                  {typeCard?.shortLabel ?? "Administrasi"}
                                  {isFirst && " · Pembuka"}
                                  {isLast && " · Penutup"}
                                </span>
                              );
                            })()}

                            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 empty:hidden">
                              {step.slaHours && step.slaHours > 0 && (
                                <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700 tabular-nums">
                                  <Timer className="size-3" />
                                  {step.slaHours}j
                                </span>
                              )}
                              {step.mediaRequirement !== "NONE" && (
                                <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                                  <FileText className="size-3" />
                                  {step.mediaRequirement === "REQUIRED"
                                    ? "Wajib Dokumen"
                                    : "Opsional"}
                                </span>
                              )}
                              {step.spaceEffect !== "NONE" && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                                  {step.spaceEffect === "RESERVE_SPACE"
                                    ? "Reserved"
                                    : step.spaceEffect === "FIT_OUT_SPACE"
                                      ? "Fit-Out"
                                      : "Terisi"}
                                </span>
                              )}
                            </div>
                          </button>

                          {canReorder && (
                            <div className="flex shrink-0 flex-col gap-0.5">
                              <button
                                type="button"
                                aria-label={`Naikkan tahap ${step.stepOrder}`}
                                disabled={index <= 1}
                                onClick={() => handleMoveStep(step.stepOrder, -1)}
                                className="flex size-5 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                              >
                                <ArrowUp className="size-3" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Turunkan tahap ${step.stepOrder}`}
                                disabled={index >= displayedSteps.length - 2}
                                onClick={() => handleMoveStep(step.stepOrder, 1)}
                                className="flex size-5 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                              >
                                <ArrowDown className="size-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Panel Konfigurasi Tahap (Unslopped, tenang, terstruktur) */}
          <section
            className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${
              showPreview ? "" : "lg:col-span-8 xl:col-span-9"
            }`}
          >
            {!selectedStep ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Pilih salah satu tahapan pada urutan di sebelah kiri.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header Konfigurasi & Tombol Lihat Preview */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500 tabular-nums">
                      Tahap {selectedStep.stepOrder} dari {displayedSteps.length}
                      {selectedStep.stepOrder === 1 && " · Pembuka"}
                      {selectedStep.stepOrder === displayedSteps.length && " · Penutup"}
                    </p>
                    <h2 className="mt-0.5 truncate text-lg font-semibold tracking-tight text-slate-900">
                      {selectedStep.title || "Tahap tanpa judul"}
                    </h2>
                    {selectedStep.description?.trim() && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">
                        {selectedStep.description}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPreview((prev) => !prev)}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${
                        showPreview
                          ? "border-[#D81435] bg-rose-50 text-[#D81435]"
                          : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                      }`}
                    >
                      {showPreview ? (
                        <>
                          <EyeOff className="size-3.5" strokeWidth={1.6} />
                          Tutup Preview
                        </>
                      ) : (
                        <>
                          <Eye className="size-3.5 text-[#D81435]" strokeWidth={1.6} />
                          Lihat Preview
                        </>
                      )}
                    </button>

                    {isDraftMode && (
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(selectedStep.stepOrder)}
                        disabled={
                          displayedSteps.length <= 2 ||
                          selectedStep.stepOrder === 1 ||
                          selectedStep.stepOrder === displayedSteps.length
                        }
                        title={
                          selectedStep.stepOrder === 1 ||
                          selectedStep.stepOrder === displayedSteps.length
                            ? "Tahap pembuka dan penutup tidak dapat dihapus."
                            : "Hapus tahap ini"
                        }
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-[#D81435] disabled:opacity-40"
                      >
                        <Trash2 className="size-3.5" />
                        Hapus Tahap
                      </button>
                    )}
                  </div>
                </div>

                {isDraftMode &&
                  (selectedStep.stepOrder === 1 ||
                    selectedStep.stepOrder === displayedSteps.length) && (
                    <p className="flex items-center gap-2 text-xs text-slate-500">
                      <Lock className="size-3 shrink-0" />
                      {selectedStep.stepOrder === 1
                        ? "Posisi tahap pembuka terkunci. Isi dan aturannya tetap bisa diubah."
                        : "Posisi tahap penutup terkunci. Isi dan aturannya tetap bisa diubah."}
                    </p>
                  )}

                {/* Bagian A: Identitas & Pesan Tahap */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Konten tahap
                    </h3>
                    <p className="text-sm text-slate-500">
                      Tampil di linimasa admin dan Portal Mitra.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="step-title-input"
                      className="mb-1.5 block text-sm font-medium text-slate-800"
                    >
                      Judul
                    </label>
                    <input
                      id="step-title-input"
                      type="text"
                      disabled={!isDraftMode}
                      value={selectedStep.title}
                      onChange={(e) =>
                        updateStep(selectedStep.stepOrder, {
                          title: e.target.value,
                        })
                      }
                      maxLength={120}
                      placeholder="Contoh: Penawaran Resmi (RDS)"
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:cursor-default disabled:border-slate-200 disabled:bg-white disabled:text-slate-900 focus:border-[#D81435] focus:outline-none focus-visible:outline-2 focus-visible:outline-[#D81435] focus-visible:outline-offset-2"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="step-description-input"
                      className="mb-1.5 block text-sm font-medium text-slate-800"
                    >
                      Ringkasan
                    </label>
                    <input
                      id="step-description-input"
                      type="text"
                      disabled={!isDraftMode}
                      value={selectedStep.description ?? ""}
                      onChange={(e) =>
                        updateStep(selectedStep.stepOrder, {
                          description: e.target.value,
                        })
                      }
                      maxLength={500}
                      placeholder="Contoh: Tim komersial menyampaikan surat penawaran resmi sewa ruang kepada calon mitra"
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:cursor-default disabled:border-slate-200 disabled:bg-white disabled:text-slate-900 focus:border-[#D81435] focus:outline-none focus-visible:outline-2 focus-visible:outline-[#D81435] focus-visible:outline-offset-2"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Satu kalimat di bawah judul tahap.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="step-public-message-input"
                      className="mb-1.5 block text-sm font-medium text-slate-800"
                    >
                      Pesan standar untuk mitra
                    </label>
                    <textarea
                      id="step-public-message-input"
                      rows={3}
                      disabled={!isDraftMode}
                      value={selectedStep.publicMessage}
                      onChange={(e) =>
                        updateStep(selectedStep.stepOrder, {
                          publicMessage: e.target.value,
                        })
                      }
                      maxLength={2000}
                      placeholder="Pesan standar yang dilihat calon mitra dan dapat disisipkan sekali klik oleh tim komersial"
                      className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm leading-relaxed text-slate-900 disabled:cursor-default disabled:border-slate-200 disabled:bg-white disabled:text-slate-900 focus:border-[#D81435] focus:outline-none focus-visible:outline-2 focus-visible:outline-[#D81435] focus-visible:outline-offset-2"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Bisa disisipkan admin lewat &ldquo;Gunakan Teks Standar Tahap&rdquo;.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 border-t border-slate-100 pt-5">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Tipe proses
                    </h3>
                    <p className="text-sm text-slate-500">
                      Menentukan form aksi admin di tahap ini.
                    </p>
                  </div>

                  <div
                    role="radiogroup"
                    aria-label="Tipe proses tahap"
                    className={`grid gap-2.5 ${
                      showPreview ? "grid-cols-1 2xl:grid-cols-3" : "md:grid-cols-3"
                    }`}
                  >
                    {STEP_TYPE_CARDS.map((card) => {
                      const active = selectedStep.stepType === card.value;
                      const CardIcon = card.icon;
                      return (
                        <button
                          key={card.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          disabled={!isDraftMode}
                          onClick={() =>
                            updateStep(selectedStep.stepOrder, {
                              stepType: card.value,
                              documentNumberLabel:
                                card.value === "DOCUMENT_ISSUANCE"
                                  ? selectedStep.documentNumberLabel ||
                                    "Nomor Surat Resmi"
                                  : null,
                            })
                          }
                          className={`flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D81435] disabled:cursor-default ${
                            active
                              ? "border-[#D81435] bg-white shadow-[0_0_0_3px_rgba(216,20,53,0.08)]"
                              : "border-slate-200 bg-white enabled:hover:border-slate-300 enabled:hover:bg-slate-50 disabled:opacity-60"
                          }`}
                        >
                          <span className="flex w-full items-center justify-between gap-2">
                            <span
                              className={`flex size-8 items-center justify-center rounded-lg ${
                                active
                                  ? "bg-[#D81435] text-white"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              <CardIcon className="size-4" strokeWidth={1.75} />
                            </span>
                            {active && (
                              <CheckCircle2 className="size-4 text-[#D81435]" />
                            )}
                          </span>
                          <span className="text-sm font-semibold text-slate-900">
                            {card.title}
                          </span>
                          <span className="text-xs leading-relaxed text-slate-600">
                            {card.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedStep.stepType === "DOCUMENT_ISSUANCE" && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                      <label
                        htmlFor="step-doc-label-input"
                        className="mb-1.5 block text-sm font-medium text-slate-800"
                      >
                        Label nomor surat <span className="text-[#D81435]">*</span>
                      </label>
                      <input
                        id="step-doc-label-input"
                        type="text"
                        disabled={!isDraftMode}
                        value={selectedStep.documentNumberLabel ?? ""}
                        onChange={(e) =>
                          updateStep(selectedStep.stepOrder, {
                            documentNumberLabel: e.target.value,
                          })
                        }
                        maxLength={120}
                        placeholder="Contoh: Nomor Surat Penawaran Resmi (RDS)"
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:cursor-default disabled:border-slate-200 disabled:bg-white disabled:text-slate-900 focus:border-[#D81435] focus:outline-none focus-visible:outline-2 focus-visible:outline-[#D81435] focus-visible:outline-offset-2"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Jadi field wajib saat admin menyelesaikan tahap.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-4 border-t border-slate-100 pt-5">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Aturan
                    </h3>
                    <p className="text-sm text-slate-500">
                      SLA, lampiran dokumen, dan efek ke status unit.
                    </p>
                  </div>

                  {/* 1. Target SLA */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Target SLA
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Menampilkan indikator sisa waktu respons di daftar antrean dan detail pengajuan.
                        </p>
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-900">
                        <input
                          type="checkbox"
                          disabled={!isDraftMode}
                          checked={Boolean(
                            selectedStep.slaHours && selectedStep.slaHours > 0
                          )}
                          onChange={(e) =>
                            updateStep(selectedStep.stepOrder, {
                              slaHours: e.target.checked
                                ? selectedStep.slaHours || 24
                                : null,
                            })
                          }
                          className="size-4 rounded border-slate-300 accent-[#D81435]"
                        />
                        Aktifkan SLA
                      </label>
                    </div>

                    {selectedStep.slaHours && selectedStep.slaHours > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-3">
                        <input
                          type="number"
                          min={1}
                          max={720}
                          disabled={!isDraftMode}
                          value={selectedStep.slaHours}
                          onChange={(e) => {
                            const parsed = Number.parseInt(e.target.value, 10);
                            updateStep(selectedStep.stepOrder, {
                              slaHours: Number.isNaN(parsed)
                                ? 1
                                : Math.max(1, Math.min(720, parsed)),
                            });
                          }}
                          className="h-8 w-24 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-900 tabular-nums focus:border-[#D81435] focus:outline-none focus-visible:outline-2 focus-visible:outline-[#D81435] focus-visible:outline-offset-2"
                        />
                        <span className="text-xs text-slate-600">jam</span>
                        {isDraftMode &&
                          [24, 48, 72].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() =>
                                updateStep(selectedStep.stepOrder, {
                                  slaHours: preset,
                                })
                              }
                              className={`rounded-md border px-2.5 py-1 text-xs font-medium tabular-nums ${
                                selectedStep.slaHours === preset
                                  ? "border-[#D81435] bg-rose-50 text-[#D81435]"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              {preset}j
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* 2 & 3: Aturan Dokumen & Efek Unit */}
                  <div
                    className={`grid gap-4 ${
                      showPreview ? "grid-cols-1 2xl:grid-cols-2" : "sm:grid-cols-2"
                    }`}
                  >
                    <div>
                      <label
                        htmlFor="step-media-req-select"
                        className="mb-1.5 block text-sm font-medium text-slate-800"
                      >
                        Aturan Dokumen Resmi
                      </label>
                      <select
                        id="step-media-req-select"
                        disabled={!isDraftMode}
                        value={selectedStep.mediaRequirement}
                        onChange={(e) =>
                          updateStep(selectedStep.stepOrder, {
                            mediaRequirement: e.target
                              .value as StepMediaRequirementValue,
                          })
                        }
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 disabled:cursor-default disabled:border-slate-200 disabled:bg-white disabled:text-slate-900 focus:border-[#D81435] focus:outline-none focus-visible:outline-2 focus-visible:outline-[#D81435] focus-visible:outline-offset-2"
                      >
                        {MEDIA_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {STEP_MEDIA_REQUIREMENT_LABELS[opt]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="step-space-effect-select"
                        className="mb-1.5 block text-sm font-medium text-slate-800"
                      >
                        Efek Otomatis Status Unit & Penyewa
                      </label>
                      <select
                        id="step-space-effect-select"
                        disabled={!isDraftMode}
                        value={selectedStep.spaceEffect}
                        onChange={(e) =>
                          updateStep(selectedStep.stepOrder, {
                            spaceEffect: e.target.value as StepSpaceEffectValue,
                          })
                        }
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 disabled:cursor-default disabled:border-slate-200 disabled:bg-white disabled:text-slate-900 focus:border-[#D81435] focus:outline-none focus-visible:outline-2 focus-visible:outline-[#D81435] focus-visible:outline-offset-2"
                      >
                        {SPACE_EFFECT_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {STEP_SPACE_EFFECT_LABELS[opt]}
                          </option>
                        ))}
                      </select>

                      {selectedStep.spaceEffect === "ACTIVATE_TENANT" &&
                        selectedStep.stepOrder < displayedSteps.length && (
                          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs leading-relaxed text-amber-900">
                            <span className="font-semibold">Perhatian: </span>
                            Memilih efek ini sebelum tahap terakhir akan langsung mengaktifkan data penyewa dan menandai unit <strong>TERISI</strong> saat tahap {selectedStep.stepOrder} selesai, walaupun masih ada tahapan lanjutan.
                          </p>
                        )}

                      {selectedStep.stepOrder === displayedSteps.length &&
                        selectedStep.spaceEffect !== "ACTIVATE_TENANT" && (
                          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs leading-relaxed text-amber-900">
                            Tahap penutup wajib menggunakan efek{" "}
                            <strong>Ubah Unit menjadi TERISI &amp; Aktifkan Penyewa</strong> agar alur dapat dipublikasikan.
                          </p>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Kanan: Live Dual-Preview (50% lebar kontainer saat aktif) */}
        {showPreview && (
          <div className="lg:col-span-6 lg:sticky lg:top-6">
            <WorkflowStepPreview
              step={selectedStep}
              nextStep={nextSelectedStep}
              totalSteps={displayedSteps.length}
              versionNumber={selectedVersion?.version}
              versionStatus={selectedVersion?.status}
              versionTitle={isDraftMode ? draftTitle : selectedVersion?.title}
              onClosePreview={() => setShowPreview(false)}
            />
          </div>
        )}
      </div>

      {isDraftMode && hasUnsavedChanges && (
        <div className="sticky bottom-4 z-20 mx-auto flex w-full max-w-2xl items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur">
          <span className="flex items-center gap-2 text-sm text-slate-700">
            <span className="size-2 rounded-full bg-amber-500" />
            Perubahan draf belum disimpan
          </span>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSaveDraft()}
            disabled={saving || publishing}
            className="h-8 gap-1.5 text-xs"
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            Simpan draf
          </Button>
        </div>
      )}

      {/* Modal Daftar Draf (Pilih / Kelola Multi-Draft) */}
      <DialogPrimitive.Root open={showDraftsModal} onOpenChange={setShowDraftsModal}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[1px]" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed top-1/2 left-1/2 z-50 max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl outline-none"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <DialogPrimitive.Title className="text-base font-semibold text-slate-900">
                  Daftar Draf Alur Pengajuan
                </DialogPrimitive.Title>
                <p className="mt-1 text-xs text-slate-600">
                  Pilih salah satu draf calon versi selanjutnya untuk diedit, atau buat draf baru dari versi aktif. Nomor versi resmi (v2, v3, dst.) otomatis diberikan saat draf dipublikasikan.
                </p>
              </div>
              <DialogPrimitive.Close
                aria-label="Tutup daftar draf"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-4" />
              </DialogPrimitive.Close>
            </div>

            <div className="mt-4 space-y-2.5">
              {draftVersions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
                  <p className="text-xs font-medium text-slate-700">
                    Belum ada draf tersimpan
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Buat draf baru untuk menyusun rancangan perubahan tahapan sebelum dipublikasikan.
                  </p>
                </div>
              ) : (
                draftVersions.map((draft) => {
                  const isCurrentlyOpen = selectedVersion?.id === draft.id;
                  return (
                    <div
                      key={draft.id}
                      className={`flex flex-col justify-between gap-3 rounded-xl border p-3.5 sm:flex-row sm:items-center ${
                        isCurrentlyOpen
                          ? "border-[#D81435] bg-rose-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-slate-900">
                            {draft.title}
                          </span>
                          <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                            Calon Versi
                          </span>
                          {isCurrentlyOpen && (
                            <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-xs font-medium text-[#D81435]">
                              Sedang dibuka
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs text-slate-500 tabular-nums">
                          Diperbarui {formatDateTimeId(draft.updatedAt)} WIB ·{" "}
                          {draft.steps.length} tahapan
                        </p>

                        {draft.description && (
                          <p className="mt-1 truncate text-xs text-slate-600">
                            {draft.description}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowDraftsModal(false);
                            if (!isCurrentlyOpen) {
                              guardUnsavedChanges(
                                `membuka draf "${draft.title}"`,
                                () => selectVersion(draft)
                              );
                            }
                          }}
                          className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
                            isCurrentlyOpen
                              ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              : "bg-slate-900 text-white hover:bg-slate-800"
                          }`}
                        >
                          {isCurrentlyOpen ? "Lanjut Edit" : "Buka & Edit"}
                        </button>
                        <button
                          type="button"
                          aria-label={`Hapus draf ${draft.title}`}
                          onClick={() => {
                            setShowDraftsModal(false);
                            setDeleteTargetDraft(draft);
                          }}
                          className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-[#D81435]"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowDraftsModal(false);
                  guardUnsavedChanges("membuat draf baru", () =>
                    handleCreateDraft(activeVersion?.id)
                  );
                }}
                disabled={cloning}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#D81435] px-3.5 text-xs font-semibold text-white hover:bg-[#B8112D] disabled:opacity-60"
              >
                {cloning ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CopyPlus className="size-3.5" />
                )}
                Buat Draf Baru{activeVersion ? ` dari v${activeVersion.version}` : ""}
              </button>
              <button
                type="button"
                onClick={() => setShowDraftsModal(false)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Modal Konfirmasi Publikasi */}
      <DialogPrimitive.Root
        open={showPublishDialog}
        onOpenChange={setShowPublishDialog}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[1px]" />
          <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl outline-none">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <ShieldCheck className="size-5" />
                </span>
                <div>
                  <DialogPrimitive.Title className="text-base font-semibold text-slate-900">
                    Publikasikan &ldquo;{draftTitle || selectedVersion?.title}&rdquo;
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="text-xs text-slate-600">
                    Sistem akan menetapkan nomor versi berikutnya secara otomatis dan menjadikannya alur aktif.
                  </DialogPrimitive.Description>
                </div>
              </div>
              <DialogPrimitive.Close
                aria-label="Tutup modal"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-4" />
              </DialogPrimitive.Close>
            </div>

            <div className="mt-4 space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
              <p className="flex items-center gap-2 font-medium text-slate-900">
                <CheckCircle2 className="size-4 text-emerald-600" />
                Total {displayedSteps.length} tahapan lolos pemeriksaan integritas
              </p>
              <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2">
                <span className="font-medium text-slate-600">Catatan Perubahan: </span>
                {draftDescription.trim() ? (
                  <span className="text-slate-900">{draftDescription.trim()}</span>
                ) : (
                  <span className="text-slate-400">
                    Tidak ada catatan perubahan yang diisi.
                  </span>
                )}
              </div>
              <p className="leading-relaxed text-slate-600">
                Versi ini akan berstatus{" "}
                <strong className="font-semibold text-slate-900">Aktif</strong> tanpa
                menonaktifkan versi aktif lainnya. Pengajuan mitra lama tetap pada versi
                masing-masing.
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPublishDialog(false)}
                disabled={publishing}
                className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmPublish()}
                disabled={publishing}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#D81435] px-4 text-xs font-semibold text-white hover:bg-[#B8112D] disabled:opacity-60"
              >
                {publishing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Rocket className="size-3.5" />
                )}
                Ya, Publikasikan Sekarang
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Modal Konfirmasi Hapus Draf */}
      <DialogPrimitive.Root
        open={Boolean(deleteTargetDraft)}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetDraft(null);
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[1px]" />
          <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl outline-none">
            <DialogPrimitive.Title className="text-base font-semibold text-slate-900">
              Hapus Draf &ldquo;{deleteTargetDraft?.title}&rdquo;?
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Seluruh rancangan tahapan pada draf ini akan dihapus permanen. Versi aktif dan draf lainnya tetap aman.
            </DialogPrimitive.Description>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetDraft(null)}
                disabled={deleting}
                className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteDraft()}
                  disabled={deleting}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#D81435] px-4 text-xs font-semibold text-white hover:bg-[#B8112D] disabled:opacity-60"
                >
                  {deleting && <Loader2 className="size-3.5 animate-spin" />}
                  Hapus Draf
                </button>
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

      {/* Modal Konfirmasi Perubahan Belum Disimpan */}
      <DialogPrimitive.Root
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open && !resolvingUnsaved) setPendingAction(null);
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[1px]" />
          <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl outline-none">
            <DialogPrimitive.Title className="text-base font-semibold text-slate-900">
              Simpan perubahan draf sebelum {pendingAction?.label}?
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Anda memiliki perubahan pada draf{" "}
              <strong className="font-semibold text-slate-900">
                {draftTitle || selectedVersion?.title}
              </strong>{" "}
              yang belum disimpan ke database.
            </DialogPrimitive.Description>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={resolvingUnsaved}
                onClick={() => setPendingAction(null)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={resolvingUnsaved}
                onClick={() => {
                  const next = pendingAction;
                  setPendingAction(null);
                  setHasUnsavedChanges(false);
                  if (next) void next.run();
                }}
                className="h-9 rounded-lg border border-rose-200 bg-rose-50 px-3.5 text-xs font-medium text-[#D81435] hover:bg-rose-100"
              >
                Buang Perubahan
              </button>
              <button
                type="button"
                disabled={resolvingUnsaved}
                onClick={async () => {
                  const next = pendingAction;
                  if (!next) return;
                  setResolvingUnsaved(true);
                  try {
                    const saved = await saveDraftRequest();
                    if (saved) {
                      setPendingAction(null);
                      await next.run();
                    } else {
                      setPendingAction(null);
                    }
                  } finally {
                    setResolvingUnsaved(false);
                  }
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#D81435] px-4 text-xs font-semibold text-white hover:bg-[#B8112D] disabled:opacity-60"
              >
                {resolvingUnsaved && <Loader2 className="size-3.5 animate-spin" />}
                Simpan &amp; Lanjutkan
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
