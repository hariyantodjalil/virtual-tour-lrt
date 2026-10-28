"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Image as ImageIcon,
  Info,
  Layers,
  MapPin,
  Maximize2,
  MessageSquare,
  Phone,
  ShieldAlert,
  Sparkles,
  User,
  X,
  XCircle,
  Zap,
  Droplets,
  Wind,
} from "lucide-react";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import { getWhatsAppUrl } from "@/lib/utils";
import { useCommercialProfile } from "@/components/commercial/CommercialProfileProvider";

type StepLog = {
  id: string;
  stepOrder: number;
  action: string;
  notes: string | null;
  performedBy: string;
  createdAt: string;
  pipelineStep: {
    id: string;
    stepOrder: number;
    title: string;
  } | null;
};

type MediaAttachment = {
  id: string;
  stepOrder: number;
  mediaTitle: string;
  documentNumber: string | null;
  mediaLink: string;
  isVisibleToMitra: boolean;
  uploadedByAdmin: string;
  createdAt: string;
};

type WorkflowStep = {
  id: string;
  stepOrder: number;
  title: string;
  description: string | null;
  publicMessage: string | null;
  requiresMedia: boolean;
};

type InquiryDetail = {
  id: string;
  inquiryCode: string | null;
  userId: string | null;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  businessType: string;
  spaceRequirement: string | null;
  message: string | null;
  status: "ACTIVE" | "COMPLETED" | "REJECTED" | string;
  currentStepOrder: number;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  space: {
    id: string;
    code: string;
    name: string;
    type: string;
    status: string;
    area: number;
    leasableAreaDetail: string | null;
    leasingModel: string | null;
    floor: string;
    location: string;
    nearestExit: string | null;
    nearbyFacilities: string[];
    powerSupply: string | null;
    waterAccess: string | null;
    airConditioning: string | null;
    fitOutTerms: string | null;
    description: string | null;
    panoramaUrl: string | null;
    station: {
      id: string;
      name: string;
      slug: string;
      address: string;
      location: string | null;
      line: string;
      imageUrl: string | null;
    } | null;
  } | null;
  workflowVersion: {
    id: string;
    version: number;
    title: string;
    description: string | null;
    steps: WorkflowStep[];
  } | null;
  stepLogs: StepLog[];
  mediaAttachments: MediaAttachment[];
};

const DEFAULT_7_STEPS: WorkflowStep[] = [
  {
    id: "def-1",
    stepOrder: 1,
    title: "Pengajuan Minat",
    description: "Mitra mengirimkan formulir permohonan minat sewa unit.",
    publicMessage:
      "Pengajuan minat Anda telah kami terima dan masuk dalam antrean review tim komersial.",
    requiresMedia: false,
  },
  {
    id: "def-2",
    stepOrder: 2,
    title: "Verifikasi & Kualifikasi",
    description: "Evaluasi kesesuaian jenis usaha dan dokumen profil pemohon.",
    publicMessage:
      "Tim komersial memverifikasi kelayakan profil usaha dan dokumen kualifikasi Anda.",
    requiresMedia: false,
  },
  {
    id: "def-3",
    stepOrder: 3,
    title: "Site Visit & Survei Lokasi",
    description: "Inspeksi fisik unit dan koordinasi teknis di stasiun.",
    publicMessage:
      "Jadwal survei fisik bersama tim stasiun untuk meninjau batas unit dan utilitas.",
    requiresMedia: true,
  },
  {
    id: "def-4",
    stepOrder: 4,
    title: "Negosiasi & Konfirmasi",
    description: "Penyelarasan ketentuan komersial dan skema kerja sama.",
    publicMessage:
      "Finalisasi skema kerja sama, masa sewa, dan kesepakatan komersial tertulis.",
    requiresMedia: false,
  },
  {
    id: "def-5",
    stepOrder: 5,
    title: "Perjanjian Kerja Sama (PKS)",
    description: "Penyusunan dan penandatanganan kontrak kerja sama resmi.",
    publicMessage:
      "Penyusunan berkas legal Perjanjian Kerja Sama (PKS) definitif.",
    requiresMedia: true,
  },
  {
    id: "def-6",
    stepOrder: 6,
    title: "Pembayaran & Administrasi",
    description: "Penyelesaian invoice sewa, deposit jaminan, dan administrasi.",
    publicMessage:
      "Penerbitan tagihan resmi dan konfirmasi pembayaran jaminan.",
    requiresMedia: true,
  },
  {
    id: "def-7",
    stepOrder: 7,
    title: "Serah Terima & Fit-Out",
    description: "Penerbitan Berita Acara Serah Terima (BAST) dan izin fit-out.",
    publicMessage:
      "Pelaksanaan BAST unit komersial dan pendampingan izin pelaksanaan fit-out.",
    requiresMedia: true,
  },
];

export default function InquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const commercialProfile = useCommercialProfile();

  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLightbox, setActiveLightbox] = useState<MediaAttachment | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInquiry() {
      try {
        setLoading(true);
        const res = await fetch(`/api/partner/inquiries/${resolvedParams.id}`);
        if (res.status === 401 || res.status === 403) {
          router.push("/auth/login?redirect=" + encodeURIComponent(`/partner/inquiries/${resolvedParams.id}`));
          return;
        }
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Gagal memuat detail pengajuan");
        }
        const data = await res.json();
        if (!cancelled) {
          setInquiry(data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memuat data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInquiry();

    return () => {
      cancelled = true;
    };
  }, [resolvedParams.id, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f4f6]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 animate-spin rounded-full border-3 border-[#c41230] border-t-transparent" />
          <p className="text-sm font-semibold text-slate-600">Memuat detail pengajuan sewa...</p>
        </div>
      </div>
    );
  }

  if (error || !inquiry) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f3f4f6] px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <ShieldAlert className="size-6" />
          </div>
          <h2 className="mt-3 text-lg font-bold text-[#101828]">Pengajuan Tidak Ditemukan</h2>
          <p className="mt-1 text-sm text-slate-500">{error || "Data pengajuan tidak ditemukan."}</p>
          <Link
            href="/partner"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#c41230] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
          >
            <ArrowLeft className="size-4" />
            Kembali ke Portal Mitra
          </Link>
        </div>
      </div>
    );
  }

  const steps: WorkflowStep[] =
    inquiry.workflowVersion?.steps && inquiry.workflowVersion.steps.length > 0
      ? inquiry.workflowVersion.steps
      : DEFAULT_7_STEPS;

  const totalSteps = steps.length;
  const currentStepOrder = inquiry.currentStepOrder;
  const isRejected = inquiry.status === "REJECTED";
  const isCompleted = inquiry.status === "COMPLETED";

  // Calculate progress percent
  const completedCount = isCompleted
    ? totalSteps
    : isRejected
    ? Math.max(0, currentStepOrder - 1)
    : Math.max(0, currentStepOrder - 1);
  const progressPercent = Math.min(100, Math.round((completedCount / totalSteps) * 100));

  const space = inquiry.space;
  const coverImage = space?.panoramaUrl
    ? getS3ProxyUrl(space.panoramaUrl)
    : "/brand/landing/space-card.jpg";

  const waUrl = getWhatsAppUrl(
    commercialProfile.whatsappNumber,
    `Halo Tim Komersial LRT Jabodebek, saya ingin menanyakan status pengajuan sewa unit ${space?.code ?? ""} (${space?.name ?? ""}) dengan kode ${inquiry.inquiryCode || inquiry.id}.`
  );

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-[#101828]">
      {/* Top Header */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between bg-[#c41230] px-4 text-white shadow-md md:px-6">
        <div className="flex items-center gap-4">
          <Link href="/partner" className="flex items-center gap-2.5" aria-label="Portal Mitra">
            <span className="relative h-8 w-[72px] shrink-0">
              <Image
                src="/brand/landing/logo-kai-nav.png"
                alt="KAI"
                fill
                sizes="72px"
                className="object-contain object-left"
                priority
              />
            </span>
            <span className="relative h-9 w-[84px] shrink-0">
              <Image
                src="/brand/landing/logo-lrt-nav.png"
                alt="LRT Jabodebek"
                fill
                sizes="84px"
                className="object-contain object-left"
                priority
              />
            </span>
          </Link>

          <span className="hidden h-5 w-[1px] bg-white/20 sm:inline-block" />

          <Link
            href="/partner"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            <ArrowLeft className="size-3.5" />
            <span>Kembali ke Pengajuan Sewa</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
            {inquiry.inquiryCode || "Pengajuan Mitra"}
          </span>
        </div>
      </header>

      {/* Main Body */}
      <main className="mx-auto max-w-7xl px-4 pt-20 pb-16 md:px-6">
        {/* Breadcrumb & Title */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Link href="/partner" className="hover:text-[#c41230] transition">
              Portal Mitra
            </Link>
            <span>/</span>
            <Link href="/partner" className="hover:text-[#c41230] transition">
              Pengajuan Sewa
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-semibold">
              {inquiry.inquiryCode || inquiry.id}
            </span>
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#101828] md:text-3xl">
                Detail Proses & Dokumentasi
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Pantau riwayat proses, catatan admin, serta dokumentasi resmi foto per tahap secara
                transparan.
              </p>
            </div>
            <div>
              <StatusBadge status={inquiry.status} currentStepOrder={currentStepOrder} />
            </div>
          </div>
        </div>

        {/* 2-Panel Grid (30% Left : 70% Right on Desktop) */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-10">
          {/* ========================================================================= */}
          {/* PANEL KIRI (30% / lg:col-span-3) - Metadata & Detail Unit Komersial       */}
          {/* ========================================================================= */}
          <div className="space-y-5 lg:col-span-3">
            {/* Card Unit & Foto */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="relative aspect-[16/10] w-full bg-slate-200">
                <Image
                  src={coverImage}
                  alt={space?.name ?? "Unit Komersial"}
                  fill
                  sizes="400px"
                  className="object-cover"
                  unoptimized={coverImage.startsWith("/api/")}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute right-3 bottom-3 left-3 text-white">
                  <span className="inline-block rounded-md bg-[#c41230] px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                    {space?.code ?? "UNIT"}
                  </span>
                  <h3 className="mt-1 truncate text-base font-bold drop-shadow-sm">
                    {space?.name ?? "Unit Komersial LRT"}
                  </h3>
                </div>
              </div>

              <div className="p-4">
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-400">Stasiun</span>
                    <span className="font-semibold text-slate-800">
                      {space?.station?.name ?? "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-400">Lokasi / Lantai</span>
                    <span className="font-semibold text-slate-800">
                      {space?.floor ? `Lantai ${space.floor}` : space?.location || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-400">Tipe Unit</span>
                    <span className="font-semibold text-slate-800">{space?.type ?? "-"}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-400">Luas Unit</span>
                    <span className="font-semibold text-slate-800">
                      {space ? `${space.area} m²` : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-400">Model Sewa</span>
                    <span className="font-semibold text-slate-800">
                      {space?.leasingModel ?? "Space-Only Leasing"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">ID Pengajuan</span>
                    <span className="font-semibold text-slate-800">
                      {inquiry.inquiryCode || inquiry.id.slice(0, 8)}
                    </span>
                  </div>
                </div>

                {/* Quick actions for space */}
                {space?.station?.slug && (
                  <Link
                    href={`/station/${space.station.slug}?unit=${space.id}`}
                    className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#c41230]/30 bg-[#c41230]/5 px-3 py-2 text-xs font-semibold text-[#c41230] transition hover:bg-[#c41230]/10"
                  >
                    <Compass className="size-3.5" />
                    Lihat Unit di 360° Virtual Tour
                  </Link>
                )}
              </div>
            </div>

            {/* Card Spesifikasi Teknis */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h4 className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
                <Layers className="size-3.5 text-[#c41230]" />
                Spesifikasi Teknis
              </h4>
              <div className="mt-3 space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400">Kelistrikan</span>
                  <span className="font-semibold text-slate-800 text-right">
                    {space?.powerSupply || "Standar Stasiun"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400">Akses Air</span>
                  <span className="font-semibold text-slate-800 text-right">
                    {space?.waterAccess || "Penyesuaian Teknis"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400">AC / Exhaust</span>
                  <span className="font-semibold text-slate-800 text-right">
                    {space?.airConditioning || "Penyesuaian Teknis"}
                  </span>
                </div>
                {space?.fitOutTerms && (
                  <div className="flex items-start justify-between pt-1">
                    <span className="text-slate-400 shrink-0">Ketentuan Fit-Out</span>
                    <span className="font-semibold text-slate-800 text-right">
                      {space.fitOutTerms}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Card Data Pengajuan Mitra */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h4 className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
                <User className="size-3.5 text-[#c41230]" />
                Data Pemohon
              </h4>
              <div className="mt-3 space-y-2 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400">Brand / Perusahaan:</span>
                  <p className="font-semibold text-slate-800">{inquiry.companyName}</p>
                </div>
                <div>
                  <span className="text-slate-400">Nama PIC:</span>
                  <p className="font-semibold text-slate-800">{inquiry.contactName}</p>
                </div>
                <div>
                  <span className="text-slate-400">Jenis Usaha:</span>
                  <p className="font-semibold text-slate-800">{inquiry.businessType}</p>
                </div>
                <div>
                  <span className="text-slate-400">Kontak:</span>
                  <p className="font-semibold text-slate-800">
                    {inquiry.phone} · {inquiry.email}
                  </p>
                </div>
                {inquiry.message && (
                  <div className="mt-2 rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-700">Catatan Pengajuan: </span>
                    {inquiry.message}
                  </div>
                )}
              </div>
            </div>

            {/* Card Hubungi Tim Komersial */}
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-[#c41230]/[0.03] p-4 shadow-sm">
              <h4 className="text-xs font-bold text-[#101828]">Pusat Informasi Komersial</h4>
              <p className="mt-1 text-xs text-slate-500">
                Ada kendala atau pertanyaan terkait kelanjutan proses?
              </p>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#c41230] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-110"
              >
                <Phone className="size-3.5" />
                Hubungi via WhatsApp
              </a>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PANEL KANAN (70% / lg:col-span-7) - Connected Vertical Stepper & Dokumen */}
          {/* ========================================================================= */}
          <div className="space-y-6 lg:col-span-7">
            {/* Header Progres Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Kemajuan Workflow
                </span>
                <h3 className="mt-1 text-lg font-bold text-[#101828]">
                  {isCompleted
                    ? "Seluruh Tahapan Telah Selesai"
                    : isRejected
                    ? `Pengajuan Dihentikan pada Tahap ${currentStepOrder}`
                    : `Tahap ${currentStepOrder} dari ${totalSteps}: ${
                        steps.find((s) => s.stepOrder === currentStepOrder)?.title ||
                        "Sedang Berlangsung"
                      }`}
                </h3>
              </div>

              {/* Rejected alert box */}
              {isRejected && (
                <div className="mt-5 flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                  <XCircle className="mt-0.5 size-5 shrink-0 text-rose-600" />
                  <div>
                    <p className="font-bold">Pengajuan Tidak Dapat Dilanjutkan</p>
                    <p className="mt-1 text-xs text-rose-800">
                      {inquiry.rejectionReason ||
                        "Mohon maaf, pengajuan sewa ini belum dapat disetujui. Anda dapat mengajukan unit lain atau menghubungi tim komersial."}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Stepper Timeline Container */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <h3 className="mb-6 text-base font-bold text-[#101828]">
                Alur Tahapan & Dokumentasi Resmi
              </h3>

              <div className="relative">
                {steps.map((step, idx) => {
                  const isLast = idx === steps.length - 1;
                  const stepOrder = step.stepOrder;

                  // Determine state
                  const isPast =
                    isCompleted ||
                    (!isRejected && stepOrder < currentStepOrder) ||
                    (isRejected && stepOrder < currentStepOrder);
                  const isCurrent = stepOrder === currentStepOrder && !isCompleted;
                  const isFuture = stepOrder > currentStepOrder;

                  // Find log & media for this step
                  const stepLog = inquiry.stepLogs?.find((l) => l.stepOrder === stepOrder);
                  const stepMedia = inquiry.mediaAttachments?.filter(
                    (m) => m.stepOrder === stepOrder && m.isVisibleToMitra
                  );

                  return (
                    <div key={step.id || step.stepOrder} className="relative flex gap-4 md:gap-5">
                      {/* Left Column: Number/Check Circle + Connected Vertical Line */}
                      <div className="relative flex flex-col items-center">
                        <div
                          className={`z-10 flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-sm transition-colors ${
                            isPast
                              ? "bg-emerald-600 text-white"
                              : isCurrent && !isRejected
                              ? "bg-[#c41230] text-white ring-4 ring-[#c41230]/15"
                              : isCurrent && isRejected
                              ? "bg-rose-600 text-white ring-4 ring-rose-200"
                              : "border border-slate-300 bg-slate-100 text-slate-400"
                          }`}
                        >
                          {isPast ? (
                            <CheckCircle2 className="size-4.5" />
                          ) : isCurrent && isRejected ? (
                            <X className="size-4" strokeWidth={3} />
                          ) : (
                            stepOrder
                          )}
                        </div>

                        {/* Vertical Connecting Line (stops at last step) */}
                        {!isLast && (
                          <div
                            className={`w-[2px] grow transition-colors ${
                              isPast ? "bg-emerald-500" : "bg-slate-200"
                            }`}
                            style={{ minHeight: "44px" }}
                          />
                        )}
                      </div>

                      {/* Right Column: Step Detail Card */}
                      <div
                        className={`mb-6 min-w-0 flex-1 rounded-xl border p-4 transition-all md:p-5 ${
                          isCurrent && !isRejected
                            ? "border-[#c41230]/40 bg-gradient-to-br from-white to-[#c41230]/[0.02] shadow-sm"
                            : isCurrent && isRejected
                            ? "border-rose-300 bg-rose-50/30"
                            : isPast
                            ? "border-slate-200 bg-white"
                            : "border-slate-200/70 bg-slate-50/50 opacity-75"
                        }`}
                      >
                        {/* Title & Status Row */}
                        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                              Tahap {stepOrder}
                            </span>
                            <h4
                              className={`text-base font-bold ${
                                isCurrent && !isRejected
                                  ? "text-[#c41230]"
                                  : isCurrent && isRejected
                                  ? "text-rose-700"
                                  : "text-[#101828]"
                              }`}
                            >
                              {step.title}
                            </h4>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {isPast && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="size-3" />
                                Selesai
                              </span>
                            )}
                            {isCurrent && !isRejected && (
                              <span className="inline-flex items-center rounded-md bg-[#c41230] px-2 py-0.5 text-[11px] font-semibold text-white shadow-xs">
                                Sedang Berlangsung
                              </span>
                            )}
                            {isCurrent && isRejected && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                                <XCircle className="size-3" />
                                Ditolak
                              </span>
                            )}
                            {isFuture && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                Menunggu
                              </span>
                            )}

                            {stepLog?.createdAt && (
                              <span className="text-[11px] text-slate-400">
                                {new Date(stepLog.createdAt).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Master Data Step Message */}
                        <p className="mt-2 text-xs leading-relaxed text-slate-600 md:text-sm">
                          {step.publicMessage || step.description || "Proses tahapan administrasi."}
                        </p>

                        

                        {/* Media Documentation Gallery */}
                        {stepMedia && stepMedia.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-slate-100">
                            <p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-slate-700">
                              <ImageIcon className="size-3.5 text-[#c41230]" />
                              Dokumentasi & Berkas Resmi ({stepMedia.length})
                            </p>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                              {stepMedia.map((media) => {
                                const proxyUrl = getS3ProxyUrl(media.mediaLink);
                                const isPdf =
                                  media.mediaLink.toLowerCase().endsWith(".pdf") ||
                                  media.mediaTitle.toLowerCase().includes("pdf");

                                return (
                                  <button
                                    key={media.id}
                                    type="button"
                                    onClick={() => setActiveLightbox(media)}
                                    className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left transition hover:border-[#c41230]/40 hover:shadow-md"
                                  >
                                    <div className="relative aspect-[4/3] w-full bg-slate-200">
                                      {isPdf ? (
                                        <div className="flex size-full flex-col items-center justify-center bg-slate-100 text-slate-500">
                                          <FileText className="size-8 text-[#c41230]" />
                                          <span className="mt-1 text-[10px] font-bold uppercase">
                                            Dokumen PDF
                                          </span>
                                        </div>
                                      ) : (
                                        <Image
                                          src={proxyUrl}
                                          alt={media.mediaTitle}
                                          fill
                                          sizes="240px"
                                          className="object-cover transition duration-300 group-hover:scale-105"
                                          unoptimized={proxyUrl.startsWith("/api/")}
                                        />
                                      )}
                                      <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100">
                                        <span className="rounded-full bg-white/90 p-1.5 text-slate-800 shadow-sm">
                                          <Maximize2 className="size-3.5" />
                                        </span>
                                      </div>
                                    </div>
                                    <div className="p-2">
                                      <p className="truncate text-xs font-semibold text-[#101828]">
                                        {media.mediaTitle}
                                      </p>
                                      {media.documentNumber && (
                                        <p className="truncate text-[10px] text-slate-400">
                                          No: {media.documentNumber}
                                        </p>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Lightbox Modal */}
      {activeLightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setActiveLightbox(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <div className="min-w-0">
                <h4 className="truncate text-sm font-bold text-[#101828]">
                  {activeLightbox.mediaTitle}
                </h4>
                {activeLightbox.documentNumber && (
                  <p className="text-xs text-slate-400">
                    Nomor Dokumen: {activeLightbox.documentNumber}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveLightbox(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Tutup"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Media Body */}
            <div className="relative flex max-h-[70vh] min-h-[300px] items-center justify-center bg-slate-900 p-2">
              {activeLightbox.mediaLink.toLowerCase().endsWith(".pdf") ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-white">
                  <FileText className="size-16 text-[#c41230]" />
                  <div>
                    <p className="text-base font-bold">{activeLightbox.mediaTitle}</p>
                    <p className="text-xs text-slate-400">Pratinjau berkas PDF resmi</p>
                  </div>
                  <a
                    href={getS3ProxyUrl(activeLightbox.mediaLink)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#c41230] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:brightness-110"
                  >
                    <ExternalLink className="size-3.5" />
                    Buka / Unduh Dokumen
                  </a>
                </div>
              ) : (
                <div className="relative h-[65vh] w-full">
                  <Image
                    src={getS3ProxyUrl(activeLightbox.mediaLink)}
                    alt={activeLightbox.mediaTitle}
                    fill
                    sizes="(max-width: 1024px) 100vw, 800px"
                    className="object-contain"
                    unoptimized={getS3ProxyUrl(activeLightbox.mediaLink).startsWith("/api/")}
                  />
                </div>
              )}
            </div>

            {/* Footer with actions */}
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
              <span className="text-xs text-slate-400">
                Diunggah oleh tim komersial pada{" "}
                {new Date(activeLightbox.createdAt).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <a
                href={getS3ProxyUrl(activeLightbox.mediaLink)}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <Download className="size-3.5" />
                Unduh Berkas
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  currentStepOrder,
}: {
  status: string;
  currentStepOrder: number;
}) {
  if (status === "COMPLETED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="size-3.5" />
        Pengajuan Selesai
      </span>
    );
  }
  if (status === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 border border-rose-200">
        <XCircle className="size-3.5" />
        Pengajuan Ditolak
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#c41230]/10 px-3 py-1 text-xs font-bold text-[#c41230] border border-[#c41230]/20">
      <Clock className="size-3.5" />
      Diproses: Tahap {currentStepOrder}
    </span>
  );
}
