"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Compass,
  Layers,
  Loader2,
  Phone,
  RefreshCw,
  Ruler,
  Save,
  ShieldAlert,
  StickyNote,
  Timer,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { cmsFetch } from "@/lib/cms-fetch";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import {
  SPACE_TYPE_LABELS,
  STANDARD_FIT_OUT_TERMS,
  STANDARD_LEASING_MODEL,
  isInquiryFullyCompleted,
  resolveLeadStepSla,
} from "@/lib/commercial-pipeline";
import {
  SPACE_AREA_KIND_LABELS,
  formatArea,
  formatDimensions,
  type SpaceAreaKind,
} from "@/lib/unit-dimensions";
import { getFacilityIcon, isFacilityIconId } from "@/lib/facility-icons";
import ScaledUnitPlan from "@/components/commercial/ScaledUnitPlan";
import {
  SLA_BADGE_CLASSES,
  SPACE_STATUS_BADGE_CLASSES,
  buildWhatsAppPartnerUrl,
  formatDateId,
  formatSpaceRequirementLabel,
  getSiteVisitStatusLabel,
  getSpaceStatusLabel,
  type CmsInquiryMedia,
  type CmsLeadDetail,
} from "../lead-types";
import {
  AdminStepTimelineItem,
  MediaPreviewLightbox,
} from "./LeadStepCards";
import WorkflowVersionBadge from "@/components/cms/WorkflowVersionBadge";
import { notifyCmsLeadsUpdated } from "@/lib/inquiry-sync-events";
import { useInquiryRealtimeSync } from "@/components/realtime/useInquiryRealtimeSync";

function buildLeadSyncSignature(item: CmsLeadDetail): string {
  const mediaSig = item.mediaAttachments
    .map((m) => `${m.id}:${m.isVisibleToMitra}:${m.mediaTitle}:${m.documentNumber ?? ""}`)
    .join(",");
  return `${item.updatedAt}|${item.status}|${item.currentStepOrder}|${item.stepLogs.length}|${mediaSig}`;
}

export default function LeadDetailWorkspace({
  initialLead,
  initialNowIso,
}: {
  initialLead: CmsLeadDetail;
  initialNowIso: string;
}) {
  const router = useRouter();
  const [lead, setLead] = useState<CmsLeadDetail>(initialLead);
  const leadRef = useRef<CmsLeadDetail>(initialLead);
  const [nowMs, setNowMs] = useState<number>(() => new Date(initialNowIso).getTime());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [internalNotes, setInternalNotes] = useState(initialLead.notes ?? "");
  const [savingInternalNote, setSavingInternalNote] = useState(false);
  const [internalNoteFeedback, setInternalNoteFeedback] = useState<string | null>(null);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [previewMedia, setPreviewMedia] = useState<CmsInquiryMedia | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const nowDate = useMemo(() => new Date(nowMs), [nowMs]);

  const refreshLead = useCallback(async (options: { silent?: boolean } = {}) => {
    const { silent = false } = options;
    if (!silent) {
      setIsRefreshing(true);
    }
    try {
      const res = await cmsFetch(`/api/cms/leads/${leadRef.current.id}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const fresh = (await res.json()) as CmsLeadDetail;
      const changed =
        buildLeadSyncSignature(leadRef.current) !== buildLeadSyncSignature(fresh);
      const prevNotes = leadRef.current.notes ?? "";
      leadRef.current = fresh;
      if (changed || !silent) {
        setLead(fresh);
        setInternalNotes((current) => (current === prevNotes ? (fresh.notes ?? "") : current));
        setNowMs(Date.now());
      }
      if (!silent) {
        notifyCmsLeadsUpdated();
      }
    } finally {
      if (!silent) {
        setIsRefreshing(false);
      }
    }
  }, []);

  useInquiryRealtimeSync({
    enabled: true,
    leadId: lead.id,
    onSync: async () => {
      await refreshLead({ silent: true });
    },
  });

  function handleLeadUpdated(updated: CmsLeadDetail) {
    leadRef.current = updated;
    setLead(updated);
    setInternalNotes(updated.notes ?? "");
    setNowMs(Date.now());
    notifyCmsLeadsUpdated();
  }

  async function handleSaveInternalNote(event: React.FormEvent) {
    event.preventDefault();
    setSavingInternalNote(true);
    setInternalNoteFeedback(null);
    try {
      const res = await cmsFetch("/api/cms/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lead.id,
          operation: "SAVE_INTERNAL_NOTE",
          notes: internalNotes.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal menyimpan catatan internal.");
      }
      const updated = (await res.json()) as CmsLeadDetail;
      handleLeadUpdated(updated);
      setInternalNoteFeedback("Catatan internal disimpan.");
    } catch (error) {
      setInternalNoteFeedback(
        error instanceof Error ? error.message : "Gagal menyimpan catatan."
      );
    } finally {
      setSavingInternalNote(false);
    }
  }

  async function handleRejectLead(event: React.FormEvent) {
    event.preventDefault();
    setRejectError(null);
    if (!rejectionReason.trim()) {
      setRejectError("Alasan penghentian wajib diisi.");
      return;
    }

    setRejecting(true);
    try {
      const res = await cmsFetch("/api/cms/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lead.id,
          operation: "REJECT_STAGE",
          rejectionReason: rejectionReason.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal menghentikan pengajuan.");
      }
      const updated = (await res.json()) as CmsLeadDetail;
      handleLeadUpdated(updated);
      setShowRejectModal(false);
    } catch (error) {
      setRejectError(
        error instanceof Error ? error.message : "Gagal menghentikan pengajuan."
      );
    } finally {
      setRejecting(false);
    }
  }

  async function handleDeleteLead() {
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await cmsFetch(`/api/cms/leads/${lead.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal menghapus pengajuan.");
      }
      notifyCmsLeadsUpdated();
      router.push("/cms/leads");
      router.refresh();
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Gagal menghapus pengajuan."
      );
      setDeleting(false);
    }
  }

  const steps = lead.workflowVersion?.steps ?? [];
  const totalSteps = steps.length || 11;
  const isCompletedAll = isInquiryFullyCompleted(lead.status);
  const isRejected = lead.status === "CLOSED_LOST";
  const isTerminal = isCompletedAll || isRejected;

  const activeStep =
    steps.find((s) => s.stepOrder === lead.currentStepOrder) ?? steps[0];
  const completedStepsCount = isCompletedAll
    ? totalSteps
    : Math.max(0, Math.min(lead.currentStepOrder - 1, totalSteps));
  const progressPercent =
    totalSteps > 0 ? Math.round((completedStepsCount / totalSteps) * 100) : 0;

  const activeStepSla = activeStep
    ? resolveLeadStepSla({
        stepOrder: activeStep.stepOrder,
        slaHours: activeStep.slaHours,
        leadCreatedAt: lead.createdAt,
        leadStatus: lead.status,
        currentStepOrder: lead.currentStepOrder,
        stepLogs: lead.stepLogs,
        now: nowDate,
      })
    : null;

  const space = lead.space;
  const station = space?.station ?? null;
  const spaceRequirementLabel = formatSpaceRequirementLabel(lead.spaceRequirement);
  const coverImage = space?.panoramaUrl
    ? getS3ProxyUrl(space.panoramaUrl)
    : "/brand/landing/space-card.jpg";
  const floorLocationText = space
    ? [space.floor ? `Lantai ${space.floor}` : null, space.location?.trim() || null]
        .filter(Boolean)
        .join(" · ") || "-"
    : "-";
  const dimensionsText = space ? formatDimensions(space) : "";
  const areaDetailText = space
    ? [formatArea(space.area), dimensionsText ? `(${dimensionsText})` : null]
        .filter(Boolean)
        .join(" ")
    : null;
  const hasDimensions = Boolean(
    space?.lengthM && space.lengthM > 0 && space?.widthM && space.widthM > 0
  );
  const resolvedFacilities = (space?.nearbyFacilities ?? []).map((item) => {
    const def = isFacilityIconId(item) ? getFacilityIcon(item) : undefined;
    return { key: item, label: def?.label ?? item, src: def?.src ?? null };
  });
  const canDeleteLead = !isCompletedAll && !space?.occupancy;
  const contextTargetLabel = space
    ? `${space.code} — ${space.name}${station ? ` · ${station.name}` : ""}`
    : spaceRequirementLabel || "Kebutuhan Ruang Komersial Umum";

  const whatsappUrl = buildWhatsAppPartnerUrl(
    lead.phone,
    `Halo ${lead.contactName} (${lead.companyName}), kami dari Tim Komersial LRT Jabodebek menindaklanjuti pengajuan sewa ${lead.inquiryCode}${
      space ? ` untuk unit ${space.code} (${space.station.name})` : ""
    }.`
  );

  return (
    <div className="min-w-0 space-y-6">
      {/* Header Navigasi & Identitas Pengajuan */}
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/cms/leads"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-[#101828]"
            >
              <ArrowLeft className="size-4" strokeWidth={1.5} />
              Kembali ke Antrean
            </Link>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-[#101828] tabular-nums">
              {lead.inquiryCode}
            </span>
            {lead.workflowVersion && (
              <WorkflowVersionBadge
                version={lead.workflowVersion.version}
                status={lead.workflowVersion.status}
                title={lead.workflowVersion.title}
              />
            )}
          </div>

          <button
            type="button"
            onClick={() => void refreshLead()}
            disabled={isRefreshing}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`size-3.5 text-[#c41230] ${isRefreshing ? "animate-spin" : ""}`}
              strokeWidth={1.5}
            />
            Segarkan Data
          </button>
        </div>

        <div className="mt-3.5 border-t border-slate-100 pt-3.5">
          <h1 className="text-lg font-semibold tracking-tight text-[#101828] sm:text-xl">
            {lead.companyName}
            <span className="font-normal text-slate-500"> · {contextTargetLabel}</span>
          </h1>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            PIC {lead.contactName} · Masuk {formatDateId(lead.createdAt, true)} · Diperbarui{" "}
            {formatDateId(lead.updatedAt, true)}
          </p>
        </div>
      </div>

      {/* Layout 2 Panel Simetris (30% Kiri : 70% Kanan) */}
      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-10 lg:items-start">
        {/* PANEL KIRI (30% / lg:col-span-3) */}
        <div className="min-w-0 space-y-5 lg:col-span-3">
          {/* 1. Kartu Unit & Foto Sampul */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="relative h-40 w-full bg-slate-900">
              <Image
                src={coverImage}
                alt={space?.name ?? "Foto Unit Komersial"}
                fill
                sizes="(max-width: 1024px) 100vw, 360px"
                className="object-cover"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
              <div className="absolute right-3 bottom-3 left-3 flex items-end justify-between gap-2 text-white">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white/85 tabular-nums">
                    {space ? space.code : "Non-Unit"}
                  </p>
                  <p className="truncate text-sm font-semibold">
                    {space ? space.name : "Kebutuhan Ruang Umum"}
                  </p>
                </div>
                {space && (
                  <span
                    className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium ${
                      SPACE_STATUS_BADGE_CLASSES[space.status] ??
                      "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {getSpaceStatusLabel(space.status)}
                  </span>
                )}
              </div>
            </div>

            <div className="p-5">
              {space ? (
                <>
                  <div className="space-y-2 text-xs">
                    <InfoRow
                      label="Stasiun"
                      value={
                        station
                          ? station.code
                            ? `${station.name} (${station.code})`
                            : station.name
                          : "-"
                      }
                      subValue={station?.line ? `LRT ${station.line}` : undefined}
                    />
                    <InfoRow label="Area & Lantai" value={floorLocationText} />
                    {space.nearestExit && (
                      <InfoRow label="Exit Terdekat" value={space.nearestExit} />
                    )}
                    <InfoRow
                      label="Tipe Unit"
                      value={SPACE_TYPE_LABELS[space.type] ?? space.type}
                    />
                    <InfoRow
                      label="Luas & Dimensi"
                      value={areaDetailText || formatArea(space.area)}
                    />
                    {space.areaKind && (
                      <InfoRow
                        label="Kategori Ruang"
                        value={
                          SPACE_AREA_KIND_LABELS[space.areaKind as SpaceAreaKind] ??
                          space.areaKind
                        }
                        subValue={
                          space.parentZone
                            ? `Zona induk: ${space.parentZone.code} — ${space.parentZone.name}`
                            : undefined
                        }
                      />
                    )}
                    <InfoRow
                      label="Model Sewa"
                      value={STANDARD_LEASING_MODEL}
                      isLast
                    />
                  </div>

                  {resolvedFacilities.length > 0 && (
                    <div className="mt-4 border-t border-slate-100 pt-3.5">
                      <p className="text-xs font-semibold text-slate-700">
                        Fasilitas Terdekat
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {resolvedFacilities.map((facility) => (
                          <span
                            key={facility.key}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                          >
                            {facility.src && (
                              <Image
                                src={facility.src}
                                alt=""
                                width={12}
                                height={12}
                                className="size-3 object-contain"
                              />
                            )}
                            {facility.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {station?.slug && (
                    <Link
                      href={`/station/${station.slug}?unit=${space.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-[#101828] transition-colors hover:bg-slate-50"
                    >
                      <Compass className="size-4 text-[#c41230]" strokeWidth={1.5} />
                      Lihat Unit di 360° Virtual Tour
                    </Link>
                  )}
                </>
              ) : (
                <div className="space-y-2 text-xs">
                  {spaceRequirementLabel && (
                    <InfoRow
                      label="Kebutuhan Ruang"
                      value={spaceRequirementLabel}
                    />
                  )}
                  <InfoRow label="Kode Pengajuan" value={lead.inquiryCode} isLast />
                  <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                    Pengajuan ini belum terikat ke satu kode unit spesifik stasiun. Proses dapat diselesaikan hingga tahap akhir tanpa mengubah okupansi unit stasiun.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 2. Kartu Visual Ukuran Unit (3D/2D) */}
          {space && hasDimensions && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-[#101828]">
                <Ruler className="size-4 text-[#c41230]" strokeWidth={1.5} />
                Visual Ukuran Unit
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Proporsi dimensi ruang dengan pembanding manusia (±1,7 m)
              </p>
              <div className="mt-3">
                <ScaledUnitPlan
                  tone="light"
                  lengthM={space.lengthM}
                  widthM={space.widthM}
                  heightM={space.heightM}
                />
              </div>
            </div>
          )}

          {/* 3. Kartu Spesifikasi Teknis & K3 */}
          {space && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-[#101828]">
                <Layers className="size-4 text-[#c41230]" strokeWidth={1.5} />
                Spesifikasi Teknis & K3
              </h3>
              <div className="mt-3 space-y-2 text-xs">
                <InfoRow label="Kelistrikan" value={space.powerSupply || "—"} />
                <InfoRow
                  label="Akses Air"
                  value={space.waterAccess ? "Tersedia" : "Tidak tersedia"}
                />
                <InfoRow
                  label="AC / Exhaust"
                  value={space.airConditioning ? "Tersedia" : "Tidak tersedia"}
                  isLast
                />
              </div>
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                <p className="text-xs font-semibold text-[#101828]">
                  Ketentuan Fit-Out & K3 Stasiun Layang
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {STANDARD_FIT_OUT_TERMS}
                </p>
              </div>
            </div>
          )}

          {/* 4. Kartu Data Pemohon & WhatsApp Mitra */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-xs font-semibold text-[#101828]">
              <User className="size-4 text-[#c41230]" strokeWidth={1.5} />
              Data Pemohon & Kontak Mitra
            </h3>
            <div className="mt-3 space-y-2 text-xs">
              <InfoRow label="Brand / Perusahaan" value={lead.companyName} />
              <InfoRow label="Nama PIC" value={lead.contactName} />
              <InfoRow label="Jenis Usaha" value={lead.businessType} />
              <InfoRow label="Telepon / WA" value={lead.phone} subValue={lead.email} />
              {lead.surveyPreference && (
                <InfoRow label="Preferensi Survei" value={lead.surveyPreference} />
              )}
              <InfoRow
                label="Site Visit"
                value={getSiteVisitStatusLabel(lead.siteVisitStatus)}
                subValue={
                  lead.siteVisitScheduledAt
                    ? formatDateId(lead.siteVisitScheduledAt, true)
                    : undefined
                }
              />
              <InfoRow
                label="Diajukan"
                value={formatDateId(lead.createdAt, true)}
                isLast={!lead.message}
              />
              {lead.message && (
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                  <span className="font-semibold text-[#101828]">Pesan Pemohon: </span>
                  {lead.message}
                </div>
              )}
            </div>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-[#101828] transition-colors hover:bg-slate-50"
            >
              <Phone className="size-4 text-emerald-600" strokeWidth={1.5} />
              Hubungi Mitra via WhatsApp
            </a>
          </div>

          {/* 5. Kartu Catatan Internal Tim Komersial */}
          <form
            onSubmit={(e) => void handleSaveInternalNote(e)}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <StickyNote className="size-4 text-[#c41230]" strokeWidth={1.5} />
              <h3 className="text-xs font-semibold text-[#101828]">
                Catatan Internal Tim Komersial
              </h3>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Disimpan khusus di CMS admin dan tidak ditampilkan kepada Mitra.
            </p>
            <textarea
              rows={3}
              maxLength={5000}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Catat hasil negosiasi internal, kesiapan berkas, atau tindak lanjut tim"
              className="mt-3 w-full rounded-lg border border-slate-300 p-3 text-xs text-[#101828] focus:border-[#c41230] focus:outline-none"
            />
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500">
                {internalNoteFeedback ?? ""}
              </span>
              <button
                type="submit"
                disabled={savingInternalNote}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-[#101828] transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                {savingInternalNote ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5 text-[#c41230]" strokeWidth={1.5} />
                )}
                Simpan Catatan
              </button>
            </div>
          </form>

          {/* 6. Kartu Tindakan Penghentian & Hapus */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-xs font-semibold text-[#101828]">
              <ShieldAlert className="size-4 text-[#c41230]" strokeWidth={1.5} />
              Penghentian & Arsip Pengajuan
            </h3>
            <div className="mt-3 space-y-2.5">
              {!isTerminal && (
                <button
                  type="button"
                  onClick={() => {
                    setRejectError(null);
                    setRejectionReason("");
                    setShowRejectModal(true);
                  }}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                >
                  <Ban className="size-4" strokeWidth={1.5} />
                  Hentikan Pengajuan (Drop-off)
                </button>
              )}

              <button
                type="button"
                disabled={!canDeleteLead}
                onClick={() => {
                  setDeleteError(null);
                  setShowDeleteModal(true);
                }}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Trash2 className="size-4" strokeWidth={1.5} />
                Hapus Pengajuan
              </button>

              {!canDeleteLead && (
                <p className="text-xs leading-relaxed text-slate-500">
                  Pengajuan yang telah selesai beroperasi atau sedang menempati unit tidak dapat dihapus.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* PANEL KANAN (70% / lg:col-span-7) */}
        <div className="min-w-0 space-y-6 lg:col-span-7">
          {/* Header Progres Workflow + Indikator SLA */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-medium text-slate-500">
                    Kendali Alur Tahapan Sekuensial
                  </p>
                  {lead.workflowVersion && (
                    <WorkflowVersionBadge
                      version={lead.workflowVersion.version}
                      status={lead.workflowVersion.status}
                      title={lead.workflowVersion.title}
                      stepCount={totalSteps}
                      size="xs"
                    />
                  )}
                </div>
                <h2 className="mt-1 text-lg font-semibold text-[#101828]">
                  {isCompletedAll
                    ? "Seluruh Tahapan Telah Selesai"
                    : isRejected
                      ? `Pengajuan Dihentikan pada Tahap ${lead.currentStepOrder}`
                      : `Tahap ${lead.currentStepOrder} dari ${totalSteps}: ${
                          activeStep?.title ?? "Sedang Berlangsung"
                        }`}
                </h2>
              </div>

              {activeStepSla && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium tabular-nums ${
                    SLA_BADGE_CLASSES[activeStepSla.health]
                  }`}
                >
                  <Timer className="size-3.5" strokeWidth={1.5} />
                  {activeStepSla.label}
                </span>
              )}
            </div>

            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  <strong className="font-semibold text-[#101828] tabular-nums">
                    {completedStepsCount} dari {totalSteps}
                  </strong>{" "}
                  tahapan selesai
                </span>
                <span>
                  <strong className="font-semibold text-[#101828] tabular-nums">
                    {lead.mediaAttachments.length}
                  </strong>{" "}
                  dokumen tersimpan
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${
                    isRejected
                      ? "bg-rose-500"
                      : isCompletedAll
                        ? "bg-emerald-600"
                        : "bg-[#c41230]"
                  }`}
                  style={{
                    width: `${isCompletedAll ? 100 : Math.max(progressPercent, 6)}%`,
                  }}
                />
              </div>
            </div>

            {isCompletedAll && (
              <div className="mt-4 flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" strokeWidth={1.5} />
                <div>
                  <p className="font-semibold">
                    Operasional Komersial Resmi Berjalan
                  </p>
                  <p className="mt-0.5 leading-relaxed text-emerald-800">
                    Seluruh tahapan pengajuan terkunci sebagai arsip resmi
                    {space ? ` dan unit ${space.code} berstatus Terisi` : ""}.
                  </p>
                </div>
              </div>
            )}

            {isRejected && (
              <div className="mt-4 flex gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900">
                <XCircle className="mt-0.5 size-4 shrink-0 text-rose-600" strokeWidth={1.5} />
                <div>
                  <p className="font-semibold">Pengajuan Dihentikan (Drop-off)</p>
                  <p className="mt-0.5 leading-relaxed text-rose-800">
                    {lead.rejectionReason ||
                      "Pengajuan dihentikan oleh Tim Komersial."}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Stepper 1..N Berbasis PipelineStep */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-[#101828]">
                Tahapan Proses & Verifikasi Data
              </h3>
              {lead.workflowVersion && (
                <WorkflowVersionBadge
                  version={lead.workflowVersion.version}
                  status={lead.workflowVersion.status}
                  title={lead.workflowVersion.title}
                  stepCount={totalSteps}
                  size="xs"
                />
              )}
            </div>

            <div className="relative">
              {steps.map((step, idx) => {
                const isLast = idx === steps.length - 1;
                const isPast = isCompletedAll || step.stepOrder < lead.currentStepOrder;
                const isCurrent = !isTerminal && step.stepOrder === lead.currentStepOrder;
                const isRejectedHere = isRejected && step.stepOrder === lead.currentStepOrder;
                const isFuture = !isPast && !isCurrent && !isRejectedHere;

                const logsForStep = lead.stepLogs.filter(
                  (l) => l.stepOrder === step.stepOrder
                );
                const latestStepLog = logsForStep.at(-1);
                const activeEditLog =
                  logsForStep.find(
                    (l) => l.action !== "COMPLETED" && l.action !== "REJECTED"
                  ) ?? latestStepLog;

                const stepMedia = lead.mediaAttachments.filter(
                  (m) => m.stepOrder === step.stepOrder
                );
                const nextStep = steps.find(
                  (candidate) => candidate.stepOrder === step.stepOrder + 1
                );

                const stepSla = resolveLeadStepSla({
                  stepOrder: step.stepOrder,
                  slaHours: step.slaHours,
                  leadCreatedAt: lead.createdAt,
                  leadStatus: lead.status,
                  currentStepOrder: lead.currentStepOrder,
                  stepLogs: lead.stepLogs,
                  now: nowDate,
                });

                return (
                  <AdminStepTimelineItem
                    key={step.id}
                    lead={lead}
                    step={step}
                    nextStep={nextStep}
                    activeEditLog={activeEditLog}
                    latestStepLog={latestStepLog}
                    stepMedia={stepMedia}
                    stepSla={stepSla}
                    isPast={isPast}
                    isCurrent={isCurrent}
                    isFuture={isFuture}
                    isRejectedHere={isRejectedHere}
                    isLast={isLast}
                    onLeadUpdated={handleLeadUpdated}
                    onRefreshLead={refreshLead}
                    onPreviewMedia={setPreviewMedia}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Drop-off Pengajuan */}
      {showRejectModal && (
        <DialogPrimitive.Root open onOpenChange={setShowRejectModal}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/50" />
            <DialogPrimitive.Content
              aria-describedby={undefined}
              className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
            >
              <DialogPrimitive.Title className="text-base font-semibold text-[#101828]">
                Hentikan Pengajuan Sewa?
              </DialogPrimitive.Title>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                Pengajuan{" "}
                <span className="font-semibold text-[#101828] tabular-nums">
                  {lead.inquiryCode}
                </span>{" "}
                akan berstatus Drop-off dan tidak dapat dilanjutkan lagi. Status unit komersial yang ditahan akan dilepaskan jika tidak digunakan pengajuan lain.
              </p>

              <form onSubmit={(e) => void handleRejectLead(e)} className="mt-4 space-y-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-[#101828]">
                    Alasan Penghentian (ditampilkan ke Mitra){" "}
                    <span className="text-[#c41230]">*</span>
                  </span>
                  <textarea
                    required
                    rows={3}
                    maxLength={1000}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Jelaskan alasan penghentian secara profesional dan jelas"
                    className="w-full rounded-lg border border-slate-300 p-3 text-xs text-[#101828] focus:border-[#c41230] focus:outline-none"
                  />
                </label>

                {rejectError && (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {rejectError}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(false)}
                    className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={rejecting}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
                  >
                    {rejecting && <Loader2 className="size-3.5 animate-spin" />}
                    Ya, Hentikan Pengajuan
                  </button>
                </div>
              </form>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )}

      {/* Modal Hapus Permanen */}
      {showDeleteModal && (
        <DialogPrimitive.Root open onOpenChange={setShowDeleteModal}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/50" />
            <DialogPrimitive.Content
              aria-describedby={undefined}
              className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
            >
              <DialogPrimitive.Title className="text-base font-semibold text-[#101828]">
                Hapus Pengajuan Permanen?
              </DialogPrimitive.Title>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                Seluruh log tahapan dan lampiran dokumen untuk{" "}
                <span className="font-semibold text-[#101828] tabular-nums">
                  {lead.inquiryCode}
                </span>{" "}
                akan dihapus permanen dari database.
              </p>

              {deleteError && (
                <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {deleteError}
                </p>
              )}

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void handleDeleteLead()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
                >
                  {deleting && <Loader2 className="size-3.5 animate-spin" />}
                  Hapus Permanen
                </button>
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )}

      {/* Lightbox Pratinjau Dokumen */}
      {previewMedia && (
        <MediaPreviewLightbox
          media={previewMedia}
          onClose={() => setPreviewMedia(null)}
        />
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  subValue,
  isLast = false,
}: {
  label: string;
  value: string;
  subValue?: string;
  isLast?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-3 py-1.5 ${
        isLast ? "" : "border-b border-slate-100"
      }`}
    >
      <span className="shrink-0 text-slate-500">{label}</span>
      <div className="min-w-0 text-right">
        <span className="block break-words font-medium text-[#101828] tabular-nums">
          {value}
        </span>
        {subValue && (
          <span className="block break-words text-xs text-slate-500 tabular-nums">
            {subValue}
          </span>
        )}
      </div>
    </div>
  );
}
