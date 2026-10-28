"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Heart,
  Info,
  MapPin,
  Maximize2,
  Phone,
  Store,
  Tag,
  Train,
  Users,
  X,
  Zap,
  Droplets,
  Wind,
  AlertCircle,
  XCircle,
  Loader2,
  Building2,
  Sparkles,
  Layers,
  LogIn,
} from "lucide-react";
import { formatNumber, formatRupiah, getWhatsAppUrl, cn } from "@/lib/utils";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import { isFavoriteSpace, toggleFavoriteSpace } from "@/lib/favorite-spaces";
import { FACILITY_ICONS, isFacilityIconId } from "@/lib/facility-icons";
import LoginModal from "@/components/LoginModal";
import { useCommercialProfile } from "@/components/commercial/CommercialProfileProvider";
import type { SpaceAvailabilityStatus } from "@/lib/space-availability";

export type CommercialSpaceModalData = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: SpaceAvailabilityStatus;
  area: number;
  leasableAreaDetail?: string | null;
  leasingModel?: string | null;
  monthlyRent?: number;
  deposit: number;
  floor: string;
  location: string;
  nearestExit: string | null;
  nearbyFacilities?: string[];
  exposure: number;
  powerSupply: string | null;
  waterAccess: string | boolean | null;
  airConditioning: string | boolean | null;
  fitOutTerms?: string | null;
  description: string | null;
  panoramaUrl?: string | null;
  tenantBrand?: string | null;
};

type Props = {
  space: CommercialSpaceModalData;
  stationName: string;
  stationSlug?: string;
  contactPhone?: string;
  onClose: () => void;
  returnToList?: boolean;
};

type WorkflowStepItem = {
  id: string;
  stepOrder: number;
  title: string;
  description: string | null;
  publicMessage: string;
  requiresMedia: boolean;
};

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  companyName?: string | null;
  phone?: string | null;
};

type PageState = "details" | "form" | "review" | "success";
type MobileTab = "visual" | "action";

const TYPE_LABELS: Record<string, string> = {
  KIOS: "Kios",
  RUKO: "Ruko",
  ATM: "ATM",
  VENDING: "Vending Machine",
  MEDIA_IKLAN: "Media Iklan",
  AREA_PROMOSI: "Area Promosi",
};

const MEDIA_TYPES = new Set(["MEDIA_IKLAN", "AREA_PROMOSI"]);

const BUSINESS_USE_OPTIONS = [
  "Vending Machine",
  "Grab-and-Go F&B",
  "Retail Kiosk",
  "Automated Services",
  "Other",
] as const;

function visibilityLabel(exposure: number) {
  if (exposure >= 4000) return "Tinggi";
  if (exposure >= 1500) return "Sedang";
  return "Rendah";
}

function formatWaterAccess(val: string | boolean | null | undefined): string {
  if (typeof val === "boolean") {
    return val ? "Clean Water Pipe Ready" : "Subject to Technical Review";
  }
  if (!val || val === "false") return "Subject to Technical Review";
  if (val === "true") return "Clean Water Pipe Ready";
  return val;
}

function formatAirConditioning(val: string | boolean | null | undefined): string {
  if (typeof val === "boolean") {
    return val ? "Station Central AC" : "Subject to Technical Review";
  }
  if (!val || val === "false") return "Subject to Technical Review";
  if (val === "true") return "Station Central AC";
  return val;
}

export default function SpaceInquiryModal({
  space: inputSpace,
  stationName,
  stationSlug,
  contactPhone,
  onClose,
  returnToList = false,
}: Props) {
  const space = useMemo(() => {
    if (typeof window !== "undefined") {
      const ps = new URLSearchParams(window.location.search).get("previewStatus") as SpaceAvailabilityStatus;
      if (ps && ["TERSEDIA", "TERISI", "RESERVED", "FIT_OUT", "MAINTENANCE"].includes(ps)) {
        return { ...inputSpace, status: ps };
      }
    }
    return inputSpace;
  }, [inputSpace]);

  const commercialProfile = useCommercialProfile();
  const resolvedContactPhone = contactPhone || commercialProfile.whatsappNumber;

  const [favorited, setFavorited] = useState(() => isFavoriteSpace(space.id));
  const [page, setPage] = useState<PageState>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("previewPage");
      if (p === "success" || p === "review" || p === "form" || p === "details") {
        return p;
      }
    }
    return "details";
  });
  const [mobileTab, setMobileTab] = useState<MobileTab>("visual");

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStepItem[]>([]);
  const [isLoadingWorkflow, setIsLoadingWorkflow] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    contactName: "",
    companyName: "",
    phone: "",
    email: "",
    password: "",
    businessUse: "Vending Machine",
    customBusinessUse: "",
    message: "",
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [submittedLead, setSubmittedLead] = useState<{ id: string; inquiryCode: string } | null>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("previewPage");
      if (p === "success") {
        return { id: "preview-id", inquiryCode: "INQ-SET-PREVIEW" };
      }
    }
    return null;
  });

  // Track event analytics
  const trackEvent = async (eventType: string) => {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, spaceId: space.id }),
    }).catch(() => null);
  };

  useEffect(() => {
    trackEvent("SPACE_VIEW");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space.id]);

  // Fetch workflow active steps and current auth user
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setIsLoadingWorkflow(true);
      try {
        const [wfRes, authRes] = await Promise.all([
          fetch("/api/workflow/active").catch(() => null),
          fetch("/api/auth/verify").catch(() => null),
        ]);

        if (wfRes && wfRes.ok) {
          const wfData = await wfRes.json();
          if (!cancelled && Array.isArray(wfData.steps)) {
            setWorkflowSteps(wfData.steps);
          }
        }

        if (authRes && authRes.ok) {
          const authData = await authRes.json();
          if (!cancelled && authData.authenticated && authData.user?.role === "MITRA") {
            setAuthUser(authData.user);
            setFormData((prev) => ({
              ...prev,
              contactName: prev.contactName || authData.user.name || "",
              email: authData.user.email || "",
              companyName: prev.companyName || authData.user.companyName || "",
              phone: prev.phone || authData.user.phone || "",
            }));
          }
        }
      } finally {
        if (!cancelled) setIsLoadingWorkflow(false);
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleToggleFavorite() {
    if (!stationSlug) return;
    const next = toggleFavoriteSpace({
      spaceId: space.id,
      code: space.code,
      name: space.name,
      type: space.type,
      status: space.status,
      area: space.area,
      monthlyRent: space.monthlyRent,
      location: space.location,
      floor: space.floor,
      panoramaUrl: space.panoramaUrl,
      stationSlug,
      stationName,
    });
    setFavorited(next);
  }

  const isMedia = MEDIA_TYPES.has(space.type);
  const occupiedTenant = space.status === "TERISI" ? space.tenantBrand?.trim() : "";
  const categoryLabel = isMedia ? "Media" : "Tenant";
  const coverSrc = space.panoramaUrl
    ? getS3ProxyUrl(space.panoramaUrl)
    : "/brand/landing/space-card.jpg";

  const statusConfig = {
    TERSEDIA: {
      label: "Tersedia",
      className: "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
      dot: "bg-emerald-400",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    },
    TERISI: {
      label: "Terisi",
      className: "border-[#E31E2D]/40 bg-[#E31E2D]/12 text-[#FF4D57]",
      dot: "bg-[#E31E2D]",
      icon: <XCircle className="h-3.5 w-3.5" />,
    },
    RESERVED: {
      label: "Reserved",
      className: "border-indigo-400/30 bg-indigo-500/15 text-indigo-300",
      dot: "bg-indigo-400",
      icon: <AlertCircle className="h-3.5 w-3.5" />,
    },
    FIT_OUT: {
      label: "Fit-Out",
      className: "border-violet-400/30 bg-violet-500/15 text-violet-300",
      dot: "bg-violet-400",
      icon: <AlertCircle className="h-3.5 w-3.5" />,
    },
    MAINTENANCE: {
      label: "Maintenance",
      className: "border-amber-400/30 bg-amber-500/15 text-amber-300",
      dot: "bg-amber-400",
      icon: <AlertCircle className="h-3.5 w-3.5" />,
    },
  }[space.status] ?? {
    label: space.status,
    className: "border-white/20 bg-white/10 text-white",
    dot: "bg-white",
    icon: <Info className="h-3.5 w-3.5" />,
  };

  const highlights = useMemo(() => {
    const items: string[] = [];
    if (space.nearestExit) items.push(`Dekat ${space.nearestExit}`);
    if (space.floor) items.push(`Lantai ${space.floor}`);
    if (space.exposure >= 3000) items.push("Arus Penumpang Tinggi");
    else if (space.exposure > 0) items.push("Mudah Terlihat");
    if (items.length < 3) items.push("Akses Gate Utama");
    return items.slice(0, 3);
  }, [space.nearestExit, space.floor, space.exposure]);

  const nearbyFacilities = useMemo(() => {
    const fromCms = (space.nearbyFacilities ?? [])
      .filter(isFacilityIconId)
      .map((id) => {
        const def = FACILITY_ICONS.find((f) => f.id === id);
        if (!def) return null;
        return {
          label: def.label,
          icon: (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={def.src} alt="" className="h-5 w-5 object-contain" />
          ),
        };
      })
      .filter(Boolean) as { label: string; icon: ReactNode }[];

    if (fromCms.length > 0) {
      const extras: { label: string; icon: ReactNode }[] = [];
      if (space.powerSupply) extras.push({ label: "Listrik", icon: <Zap className="h-4 w-4" /> });
      if (space.waterAccess) extras.push({ label: "Air", icon: <Droplets className="h-4 w-4" /> });
      if (space.airConditioning) extras.push({ label: "AC", icon: <Wind className="h-4 w-4" /> });
      return [...fromCms, ...extras].slice(0, 6);
    }

    const items: { label: string; icon: ReactNode }[] = [
      { label: "Eskalator", icon: <Train className="h-4 w-4" /> },
      {
        label: "Toilet",
        icon: (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/brand/tour-pins/toilet.png" alt="" className="h-5 w-5 object-contain" />
        ),
      },
      {
        label: "Mushola",
        icon: (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/brand/tour-pins/mushola.png" alt="" className="h-5 w-5 object-contain" />
        ),
      },
      { label: "Peron", icon: <Train className="h-4 w-4" /> },
    ];
    if (space.powerSupply) items.push({ label: "Listrik", icon: <Zap className="h-4 w-4" /> });
    if (space.waterAccess) items.push({ label: "Air", icon: <Droplets className="h-4 w-4" /> });
    if (space.airConditioning) items.push({ label: "AC", icon: <Wind className="h-4 w-4" /> });
    return items.slice(0, 5);
  }, [space.nearbyFacilities, space.powerSupply, space.waterAccess, space.airConditioning]);

  const waMessage = `Halo, saya tertarik dengan unit komersial ${space.code} (${space.name}) di Stasiun ${stationName}. Mohon informasi lebih lanjut.`;
  const waUrl = getWhatsAppUrl(resolvedContactPhone, waMessage);

  const handleDownloadSummary = () => {
    trackEvent("PDF_DOWNLOAD");
    const popup = window.open("", "_blank", "width=900,height=1200");
    if (!popup) return;

    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Ringkasan ${space.code} - ${stationName}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; margin: 40px; }
            .brand { color: #E31E2D; font-weight: 800; letter-spacing: .08em; font-size: 12px; text-transform: uppercase; }
            h1 { margin: 8px 0 4px; font-size: 28px; color: #17355f; }
            .muted { color: #6b7280; font-size: 13px; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin: 24px 0; }
            .box { border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; background: #fafafa; }
            .label { color: #6b7280; font-size: 11px; margin-bottom: 4px; text-transform: uppercase; }
            .value { font-size: 16px; font-weight: 800; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            td { border-bottom: 1px solid #e5e7eb; padding: 10px 0; font-size: 13px; }
            td:first-child { color: #6b7280; width: 40%; }
            .cta { margin-top: 28px; padding: 16px; background: #0f172a; color: white; border-radius: 12px; font-size: 13px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="brand">LRT Jabodebek · Komersialisasi Stasiun</div>
          <h1>${space.name} (${space.code})</h1>
          <div class="muted">Stasiun ${stationName} · ${TYPE_LABELS[space.type] ?? space.type} · ${space.location || `Lantai ${space.floor}`}</div>
          
          <div class="grid">
            <div class="box"><div class="label">Status</div><div class="value">${statusConfig.label}</div></div>
            <div class="box"><div class="label">Luas Sewa</div><div class="value">${space.leasableAreaDetail || `${space.area} m²`}</div></div>
            <div class="box"><div class="label">Model Sewa</div><div class="value">${space.leasingModel || "Space-Only Leasing"}</div></div>
            <div class="box"><div class="label">Jenis Ruang</div><div class="value">${TYPE_LABELS[space.type] ?? space.type}</div></div>
          </div>

          <table>
            <tr><td>Daya Listrik</td><td><b>${space.powerSupply || "Tenant-Provided"}</b></td></tr>
            <tr><td>Akses Air Bersih</td><td><b>${formatWaterAccess(space.waterAccess)}</b></td></tr>
            <tr><td>Penyejuk Udara / AC</td><td><b>${formatAirConditioning(space.airConditioning)}</b></td></tr>
            <tr><td>Ketentuan Fit-Out</td><td><b>${space.fitOutTerms || "By Tenant • Approval Required"}</b></td></tr>
            <tr><td>Exit Terdekat</td><td>${space.nearestExit || "-"}</td></tr>
            <tr><td>Mobilitas Penumpang</td><td>${formatNumber(Math.round(space.exposure))} orang/hari</td></tr>
            <tr><td>Catatan Spesifikasi</td><td>${space.description || "Area komersial siap dievaluasi melalui Virtual Tour 360 LRT Jabodebek."}</td></tr>
          </table>

          <div class="cta">
            Hubungi ${commercialProfile.teamName}: ${resolvedContactPhone}. Dokumen ringkasan ini digenerate secara otomatis dari Master Data Aset Virtual Tour LRT Jabodebek.
          </div>
          <script>window.onload = () => setTimeout(() => window.print(), 250);</script>
        </body>
      </html>
    `);
    popup.document.close();
  };

  // Step validation
  function handleProceedToReview(e: React.FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formData.contactName.trim() || formData.contactName.trim().length < 2) {
      errors.contactName = "Nama penanggung jawab minimal 2 karakter.";
    }
    if (!formData.companyName.trim() || formData.companyName.trim().length < 2) {
      errors.companyName = "Nama perusahaan/brand minimal 2 karakter.";
    }
    const cleanPhone = formData.phone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      errors.phone = "Nomor WhatsApp aktif minimal 10 digit.";
    }
    if (!formData.email.trim() || !/^\S+@\S+\.\S+$/.test(formData.email.trim())) {
      errors.email = "Format email bisnis tidak valid.";
    }
    if (!authUser && (!formData.password || formData.password.length < 8)) {
      errors.password = "Password akun Mitra minimal 8 karakter.";
    }
    if (formData.businessUse === "Other" && (!formData.customBusinessUse.trim() || formData.customBusinessUse.trim().length < 3)) {
      errors.customBusinessUse = "Sebutkan jenis usaha Anda (minimal 3 karakter).";
    }

    setFormErrors(errors);
    if (Object.keys(errors).length === 0) {
      setSubmitError("");
      setPage("review");
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setMobileTab("action");
      }
    }
  }



  // Handle final submission
  async function handleConfirmSubmit() {
    setIsSubmitting(true);
    setSubmitError("");

    const resolvedBusinessType =
      formData.businessUse === "Other"
        ? formData.customBusinessUse.trim()
        : formData.businessUse;

    try {
      if (authUser) {
        // Authenticated partner submit
        const res = await fetch("/api/partner/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            spaceId: space.id,
            businessType: resolvedBusinessType,
            message: formData.message.trim() || undefined,
            companyName: formData.companyName.trim(),
            contactName: formData.contactName.trim(),
            phone: formData.phone.trim(),
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "Gagal mengirim formulir pengajuan minat.");
        }

        setSubmittedLead({
          id: data.id,
          inquiryCode: data.inquiryCode || `INQ-${new Date().getFullYear()}-XXXX`,
        });
        setPage("success");
      } else {
        // Guest submit + auto-register partner account
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            spaceId: space.id,
            companyName: formData.companyName.trim(),
            contactName: formData.contactName.trim(),
            phone: formData.phone.trim(),
            email: formData.email.trim(),
            password: formData.password,
            businessType: resolvedBusinessType,
            spaceRequirement: space.leasableAreaDetail || `${space.area} m²`,
            message: formData.message.trim() || undefined,
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "Gagal mengirim formulir pengajuan minat.");
        }

        setSubmittedLead({
          id: data.id,
          inquiryCode: data.inquiryCode || `INQ-${new Date().getFullYear()}-XXXX`,
        });
        setPage("success");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat memproses pengajuan.";
      setSubmitError(msg);
      if (msg.includes("Email sudah terdaftar") || msg.includes("password akun yang benar")) {
        setPage("form");
        setFormErrors((prev) => ({
          ...prev,
          password: "Email ini telah terdaftar sebagai akun mitra. Masukkan password akun Anda yang benar untuk menautkan pengajuan sewa ini.",
        }));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-2 sm:p-4 md:p-6 backdrop-blur-md animate-in fade-in duration-200">
      <div className="tour-panel-in pointer-events-auto relative flex h-[92vh] max-h-[860px] w-[96vw] max-w-[1240px] flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0F0F0F]/95 text-white shadow-[0_32px_80px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        
        {/* ── TOP HEADER BAR (Mobile Navigation & Close Button) ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 sm:px-6 py-3 bg-black/40">
          <div className="flex min-w-0 items-center gap-2">
            {returnToList ? (
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-2 text-left transition hover:opacity-80"
              >
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-[#E31E2D]/55 bg-[#161616]">
                  <ChevronLeft className="size-4 text-[#E31E2D]" strokeWidth={2.4} />
                </span>
                <span className="truncate text-xs font-semibold text-white">
                  Kembali ke Daftar Unit
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-[#1c1c1e]/78 text-white">
                  <Info className="size-4 text-[#E31E2D]" />
                </span>
                <span className="font-display text-xs sm:text-sm font-semibold tracking-wide text-white">
                  Informasi & Pengajuan Unit Komersial
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile Tab Switcher */}
            <div className="flex lg:hidden rounded-lg bg-black/50 p-1 border border-white/10">
              <button
                type="button"
                onClick={() => setMobileTab("visual")}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-semibold rounded-md transition",
                  mobileTab === "visual" ? "bg-[#E31E2D] text-white" : "text-white/60 hover:text-white"
                )}
              >
                Visual
              </button>
              <button
                type="button"
                onClick={() => setMobileTab("action")}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-semibold rounded-md transition",
                  mobileTab === "action" ? "bg-[#E31E2D] text-white" : "text-white/60 hover:text-white"
                )}
              >
                Pengajuan
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Tutup detail unit"
            >
              <X className="size-5" strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {/* ── BODY: 2-COLUMN SPLIT WITH INDEPENDENT SCROLLING (min-h-0 is crucial) ── */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-white/10">

          {/* ── LEFT COLUMN: VISUAL, AREA POTENTIAL, FACILITIES & QUICK ACTIONS ── */}
          <div
            className={cn(
              "flex flex-col h-full min-h-0 bg-black/20 lg:flex",
              mobileTab === "visual" ? "flex" : "hidden lg:flex"
            )}
          >
            {/* Scrollable Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-thin scrollbar-thumb-white/15 scrollbar-track-transparent">
              {/* Cover image & Favorite Button */}
              <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-xl bg-[#1A1A1A] border border-white/10 shadow-lg">
                <Image
                  src={coverSrc}
                  alt={space.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 640px"
                  className="object-cover transition-transform duration-300 hover:scale-105"
                  unoptimized={coverSrc.startsWith("/api/") || coverSrc.startsWith("http")}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  disabled={!stationSlug}
                  className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#1c1c1e]/85 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60 shadow-md"
                >
                  <Heart
                    className={cn(
                      "h-3.5 w-3.5 transition",
                      favorited ? "fill-[#E31E2D] text-[#E31E2D]" : "text-white"
                    )}
                  />
                  Favorit
                </button>
              </div>

              {/* Red Glow Card: Title & Basic Info (Tanpa duplikasi kotak lokasi/luas) */}
              <div className="rounded-2xl bg-black/35 p-4 shadow-[0_0_0_1px_rgba(227,30,45,0.38),0_0_20px_rgba(227,30,45,0.14)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-lg sm:text-xl font-bold tracking-tight text-white uppercase">
                      {occupiedTenant ? `${occupiedTenant} · ${space.name}` : `${space.name} (${space.code})`}
                    </h3>
                    <p className="mt-1 flex items-center gap-1.5 text-xs sm:text-sm text-white/60">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[#E31E2D]" />
                      <span className="truncate">
                        {space.location || `Lantai ${space.floor}`}, Stasiun {stationName}
                      </span>
                    </p>
                    {occupiedTenant && (
                      <p className="mt-1 text-xs font-semibold text-[#FF4D57]">
                        Unit {space.code} · {space.name}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-start">
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/8 px-2.5 py-1 text-[11px] font-semibold text-white/80">
                      <Store className="h-3 w-3 text-[#E31E2D]" />
                      {categoryLabel}
                    </span>
                  </div>
                </div>

                <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-white/65">
                  {space.description?.trim() ||
                    `Area komersial strategis dengan mobilitas penumpang yang tinggi di stasiun LRT Jabodebek. Sangat cocok untuk ${
                      isMedia ? "media promosi dan periklanan digital." : "retail, minimarket, maupun gerai grab-and-go F&B."
                    }`}
                </p>
              </div>

              {/* Area Potential Box */}
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/35 p-3.5">
                <div className="flex items-center gap-2 pb-2.5 border-b border-white/10">
                  <BarChart3 className="h-4 w-4 text-[#E31E2D]" />
                  <p className="text-xs sm:text-sm font-bold text-white">Potensi Area Stasiun</p>
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  <div>
                    <Users className="mb-1 h-3.5 w-3.5 text-[#E31E2D]" />
                    <p className="text-[10px] text-white/50">Mobilitas</p>
                    <p className="mt-0.5 text-xs font-bold text-white">
                      {formatNumber(Math.round(space.exposure))} <span className="text-[10px] font-normal text-white/50">/hari</span>
                    </p>
                  </div>
                  <div>
                    <Eye className="mb-1 h-3.5 w-3.5 text-[#E31E2D]" />
                    <p className="text-[10px] text-white/50">Visibilitas</p>
                    <p className="mt-0.5 text-xs font-bold text-white">
                      {visibilityLabel(space.exposure)}
                    </p>
                  </div>
                  <div>
                    <CheckCircle2 className="mb-1 h-3.5 w-3.5 text-[#E31E2D]" />
                    <p className="text-[10px] text-white/50">Keunggulan</p>
                    <ul className="mt-0.5 space-y-0.5 text-[10px] font-medium text-white/75">
                      {highlights.map((item) => (
                        <li key={item} className="truncate">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Facilities (dengan bottom padding aman agar kotak tidak terpotong) */}
              <div className="pb-2">
                <p className="mb-2 text-xs font-bold text-white/70">Fasilitas Terdekat</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {nearbyFacilities.map((f) => (
                    <div
                      key={f.label}
                      className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-black/35 px-1 py-2 text-center"
                    >
                      <span className="flex size-6 items-center justify-center text-[#E31E2D]">
                        {f.icon}
                      </span>
                      <span className="text-[9px] font-medium leading-tight text-white/60">
                        {f.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Fixed Bottom Action Footer (Nempel ke bawah rapi tanpa celah) */}
            <div className="shrink-0 border-t border-white/10 bg-[#0F0F0F] p-4 flex gap-2">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("WHATSAPP_CLICK")}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#E31E2D]/45 bg-[#161616] px-3 text-xs font-semibold text-white transition hover:bg-[#1d1d1d] hover:border-[#E31E2D]"
              >
                <Phone className="h-3.5 w-3.5 text-[#E31E2D]" />
                WhatsApp Tim
              </a>
              <button
                type="button"
                onClick={handleDownloadSummary}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-[#161616] px-3 text-xs font-semibold text-white transition hover:bg-[#1d1d1d]"
              >
                <Download className="h-3.5 w-3.5 text-[#E31E2D]" />
                Unduh PDF
              </button>
            </div>
          </div>

        {/* ── RIGHT COLUMN: MULTI-PAGE STATE MACHINE (4 INTERNAL PAGES) ── */}
        <div
          className={cn(
            "flex flex-col h-full min-h-0 lg:flex",
            mobileTab === "action" ? "flex" : "hidden lg:flex"
          )}
        >
          {/* Progress Step Indicator (4 steps) */}
          <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-2 shrink-0">
            <div className="flex items-center justify-between text-[11px] font-semibold text-white/60 mb-1.5">
              <span>Alur Pengajuan Sewa</span>
              <span className="text-white/80">
                {page === "details" && "1 / 4 Spesifikasi"}
                {page === "form" && "2 / 4 Data Pengajuan"}
                {page === "review" && "3 / 4 Review"}
                {page === "success" && "4 / 4 Konfirmasi"}
              </span>
            </div>
            <div className="flex gap-1.5">
              <div className={cn("h-1.5 flex-1 rounded-full transition-all", page === "details" || page === "form" || page === "review" || page === "success" ? "bg-[#E31E2D]" : "bg-white/15")} />
              <div className={cn("h-1.5 flex-1 rounded-full transition-all", page === "form" || page === "review" || page === "success" ? "bg-[#E31E2D]" : "bg-white/15")} />
              <div className={cn("h-1.5 flex-1 rounded-full transition-all", page === "review" || page === "success" ? "bg-[#E31E2D]" : "bg-white/15")} />
              <div className={cn("h-1.5 flex-1 rounded-full transition-all", page === "success" ? "bg-emerald-500" : "bg-white/15")} />
            </div>
          </div>

          {/* ════════ PAGE 1: DETAILS ════════ */}
          {page === "details" && (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-2 pb-4 space-y-4 scrollbar-thin scrollbar-thumb-white/15 scrollbar-track-transparent">
                {/* Header bar with Clean Title & Status Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-white/10">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E31E2D]/40 bg-[#E31E2D]/15 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-[#FF6B75] uppercase">
                      Spesifikasi Ruang Komersial
                    </span>
                    <h2 className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-white">
                      Unit {space.name} — Stasiun {stationName}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm",
                        statusConfig.className
                      )}
                    >
                      <span className={cn("size-2 rounded-full", statusConfig.dot)} />
                      {statusConfig.label}
                    </span>
                  </div>
                </div>

                {/* Section 1: Space Specifications Grid (6 Explicit Labeled Cards with Icons) */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2.5 flex items-center gap-1.5">
                    <Layers className="size-3.5 text-[#E31E2D]" />
                    Space Specifications
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                    {/* Card 1: Space ID */}
                    <div className="col-span-1 sm:col-span-2 rounded-xl border border-white/10 bg-black/40 p-2.5 sm:p-3 hover:border-white/20 transition">
                      <div className="flex items-center gap-1.5 text-[#E31E2D]">
                        <Tag className="size-3.5" />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Space ID</p>
                      </div>
                      <p className="text-xs sm:text-sm font-extrabold text-white mt-1">{space.code}</p>
                    </div>

                    {/* Card 2: Location / Zona */}
                    <div className="col-span-1 sm:col-span-2 rounded-xl border border-white/10 bg-black/40 p-2.5 sm:p-3 hover:border-white/20 transition">
                      <div className="flex items-center gap-1.5 text-[#E31E2D]">
                        <MapPin className="size-3.5" />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Location / Zona</p>
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-white mt-1 truncate" title={space.location || `Lantai ${space.floor}`}>
                        {space.location || `Lantai ${space.floor}`}
                      </p>
                    </div>

                    {/* Card 3: Leasable Area */}
                    <div className="col-span-1 sm:col-span-2 rounded-xl border border-white/10 bg-black/40 p-2.5 sm:p-3 hover:border-white/20 transition">
                      <div className="flex items-center gap-1.5 text-[#E31E2D]">
                        <Maximize2 className="size-3.5" />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Leasable Area</p>
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-white mt-1">
                        {space.leasableAreaDetail || `${space.area} m²`}
                      </p>
                    </div>

                    {/* Card 4: Space Type */}
                    <div className="col-span-1 sm:col-span-3 rounded-xl border border-white/10 bg-black/40 p-2.5 sm:p-3 hover:border-white/20 transition">
                      <div className="flex items-center gap-1.5 text-[#E31E2D]">
                        <Store className="size-3.5" />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Space Type</p>
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-white mt-1">
                        {TYPE_LABELS[space.type] ?? space.type}
                      </p>
                    </div>

                    {/* Card 5: Leasing Model */}
                    <div className="col-span-2 sm:col-span-3 rounded-xl border border-white/10 bg-black/40 p-2.5 sm:p-3 hover:border-white/20 transition">
                      <div className="flex items-center gap-1.5 text-[#E31E2D]">
                        <Building2 className="size-3.5" />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Leasing Model</p>
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-white mt-1 truncate" title={space.leasingModel || "Space-Only Leasing"}>
                        {space.leasingModel || "Space-Only Leasing"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 2: Technical & Leasing Information */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2 flex items-center gap-1.5">
                    <Zap className="size-3.5 text-[#E31E2D]" />
                    Technical & Utility Information
                  </h3>
                  <div className="rounded-xl border border-white/10 bg-black/30 px-3.5 divide-y divide-white/10">
                    <div className="flex items-center justify-between gap-4 py-2.5 text-xs sm:text-sm">
                      <span className="text-white/55">Electricity Supply</span>
                      <span className="font-semibold text-white text-right">{space.powerSupply || "Tenant-Provided"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-2.5 text-xs sm:text-sm">
                      <span className="text-white/55">Water Access</span>
                      <span className="font-semibold text-white text-right">{formatWaterAccess(space.waterAccess)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-2.5 text-xs sm:text-sm">
                      <span className="text-white/55">Air Conditioning & Ventilation</span>
                      <span className="font-semibold text-white text-right">{formatAirConditioning(space.airConditioning)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-2.5 text-xs sm:text-sm">
                      <span className="text-white/55">Fit-Out Terms</span>
                      <span className="font-semibold text-white text-right">{space.fitOutTerms || "By Tenant • Approval Required"}</span>
                    </div>
                  </div>
                </div>

                {/* Notice */}
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-[11px] sm:text-xs leading-relaxed text-white/60">
                  Spesifikasi di atas bersifat indikatif dari master data aset stasiun. Ketersediaan akhir, peruntukan usaha yang diizinkan, pengukuran detail, dan kesiapan instalasi teknis akan dikonfirmasi bersama Tim Komersial KAI.
                </div>
              </div>

              {/* Fixed Bottom Action Footer (Nempel rapi ke batas bawah) */}
              <div className="shrink-0 border-t border-white/10 bg-[#0F0F0F] p-4">
                {space.status === "TERSEDIA" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPage("form");
                      setMobileTab("action");
                    }}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#E31E2D] font-semibold text-white transition hover:brightness-110 shadow-lg"
                  >
                    <Tag className="size-4" />
                    Ajukan Minat Sewa Unit Ini →
                  </button>
                ) : (
                  <div className="flex items-center justify-between gap-3 h-11">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={cn("size-2 shrink-0 rounded-full", statusConfig.dot)} />
                      <p className="text-xs text-white/70 truncate">
                        Unit berstatus <strong className="text-white">{statusConfig.label}</strong> (tidak dapat disewa)
                      </p>
                    </div>
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#E31E2D]/45 bg-[#161616] px-4 text-xs font-semibold text-white transition hover:bg-[#1d1d1d] hover:border-[#E31E2D]"
                    >
                      <Phone className="size-3.5 text-[#E31E2D]" />
                      Tanya via WhatsApp
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════ PAGE 2: FORM ════════ */}
          {page === "form" && (
            <form onSubmit={handleProceedToReview} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-2 pb-4 space-y-3.5 scrollbar-thin scrollbar-thumb-white/15 scrollbar-track-transparent">
                <button
                  type="button"
                  onClick={() => setPage("details")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 hover:text-white transition w-fit mb-1"
                >
                  <ChevronLeft className="size-3.5" />
                  Kembali ke Spesifikasi Ruang
                </button>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-white/10">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">Formulir Pengajuan Minat</h2>
                    <p className="text-xs text-white/60 mt-0.5">
                      Unit: <strong className="text-white">{space.code}</strong> · {stationName} · {space.leasableAreaDetail || `${space.area} m²`}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                {/* Contact Person */}
                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1">
                    Nama Penanggung Jawab / Kontak <span className="text-[#E31E2D]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Budi Santoso"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    className="w-full rounded-xl border border-white/12 bg-black/45 px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-[#E31E2D] focus:outline-none focus:ring-2 focus:ring-[#E31E2D]/30"
                  />
                  {formErrors.contactName && <p className="text-[11px] text-[#FF4D57] mt-1">{formErrors.contactName}</p>}
                </div>

                {/* Company Name */}
                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1">
                    Nama Perusahaan / Brand <span className="text-[#E31E2D]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: PT Kopi Nusantara / Brand Kopi"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full rounded-xl border border-white/12 bg-black/45 px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-[#E31E2D] focus:outline-none focus:ring-2 focus:ring-[#E31E2D]/30"
                  />
                  {formErrors.companyName && <p className="text-[11px] text-[#FF4D57] mt-1">{formErrors.companyName}</p>}
                </div>

                {/* WhatsApp (1 Baris Penuh Terpisah) */}
                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1">
                    No. WhatsApp Aktif <span className="text-[#E31E2D]">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="08xxxxxxxxxx"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-xl border border-white/12 bg-black/45 px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-[#E31E2D] focus:outline-none focus:ring-2 focus:ring-[#E31E2D]/30"
                  />
                  {formErrors.phone && <p className="text-[11px] text-[#FF4D57] mt-1">{formErrors.phone}</p>}
                </div>

                {/* Seksi Email & Password: Ada garis pemisah jika belum login, garis hilang jika sudah login */}
                {!authUser ? (
                  <div className="pt-3 border-t border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold tracking-wider text-white/50 uppercase">
                        Akun Portal Mitra
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsLoginModalOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#E31E2D]/40 bg-[#E31E2D]/10 px-2.5 py-1 text-xs font-semibold text-[#FF4D57] transition hover:bg-[#E31E2D]/20 hover:text-white"
                      >
                        <LogIn className="size-3.5" />
                        <span>Sudah punya akun? Masuk</span>
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-white/80 mb-1">
                        Email Bisnis <span className="text-[#E31E2D]">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="name@company.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full rounded-xl border border-white/12 bg-black/45 px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-[#E31E2D] focus:outline-none focus:ring-2 focus:ring-[#E31E2D]/30"
                      />
                      {formErrors.email && <p className="text-[11px] text-[#FF4D57] mt-1">{formErrors.email}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-white/80 mb-1">
                        Password Akun Mitra <span className="text-[#E31E2D]">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          placeholder="Minimal 8 karakter"
                          value={formData.password}
                          onChange={(e) => {
                            setFormData({ ...formData, password: e.target.value });
                            if (formErrors.password) {
                              setFormErrors((prev) => {
                                const copy = { ...prev };
                                delete copy.password;
                                return copy;
                              });
                            }
                          }}
                          className={cn(
                            "w-full rounded-xl border bg-black/45 pl-3.5 pr-10 py-2.5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2",
                            formErrors.password
                              ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/30"
                              : "border-white/12 focus:border-[#E31E2D] focus:ring-[#E31E2D]/30"
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 hover:text-white transition p-1"
                          aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                        >
                          {showPassword ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </button>
                      </div>

                      {formErrors.password ? (
                        <div className="mt-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                          <div className="flex items-start gap-1.5">
                            <AlertCircle className="size-3.5 shrink-0 text-rose-400 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-medium leading-relaxed">{formErrors.password}</p>
                              <button
                                type="button"
                                onClick={() => setIsLoginModalOpen(true)}
                                className="mt-1.5 inline-flex items-center gap-1 font-bold text-white underline hover:text-[#FF4D57] transition"
                              >
                                <LogIn className="size-3" />
                                Buka Pop-up Login
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-white/55 mt-1.5 leading-relaxed">
                          Jika belum punya akun, akun baru akan dibuatkan otomatis. Jika email sudah terdaftar, masukkan password akun Anda untuk langsung menautkan pengajuan sewa ini.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Sudah login: garis hilang, email read-only, password hilang */
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-white/80">
                        Email Bisnis <span className="text-[#E31E2D]">*</span>
                      </label>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                        <CheckCircle2 className="size-3.5 text-emerald-400" />
                        Akun Mitra Aktif: {authUser.name}
                      </span>
                    </div>
                    <input
                      type="email"
                      readOnly
                      value={formData.email}
                      className="w-full rounded-xl border border-white/12 bg-black/45 px-3.5 py-2.5 text-sm text-white/80 opacity-75 cursor-not-allowed"
                    />
                  </div>
                )}

                {/* Proposed Business Use */}
                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1">
                    Peruntukan Usaha / Proposed Business Use <span className="text-[#E31E2D]">*</span>
                  </label>
                  <select
                    value={formData.businessUse}
                    onChange={(e) => setFormData({ ...formData, businessUse: e.target.value })}
                    className="w-full rounded-xl border border-white/12 bg-black/75 px-3.5 py-2.5 text-sm text-white focus:border-[#E31E2D] focus:outline-none focus:ring-2 focus:ring-[#E31E2D]/30"
                  >
                    {BUSINESS_USE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt} className="bg-[#1C1C1E] text-white">
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.businessUse === "Other" && (
                  <div>
                    <label className="block text-xs font-semibold text-white/80 mb-1">
                      Sebutkan Jenis Usaha Anda <span className="text-[#E31E2D]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Tuliskan kategori usaha Anda..."
                      value={formData.customBusinessUse}
                      onChange={(e) => setFormData({ ...formData, customBusinessUse: e.target.value })}
                      className="w-full rounded-xl border border-white/12 bg-black/45 px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-[#E31E2D] focus:outline-none focus:ring-2 focus:ring-[#E31E2D]/30"
                    />
                    {formErrors.customBusinessUse && (
                      <p className="text-[11px] text-[#FF4D57] mt-1">{formErrors.customBusinessUse}</p>
                    )}
                  </div>
                )}

                {/* Additional Notes */}
                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1">
                    Catatan Kebutuhan Khusus / Konsep Usaha <span className="text-white/40">(Opsional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Sebutkan perkiraan daya listrik tambahan, jadwal operasional, atau kebutuhan layout khusus..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full rounded-xl border border-white/12 bg-black/45 px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-white/35 focus:border-[#E31E2D] focus:outline-none focus:ring-2 focus:ring-[#E31E2D]/30 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Fixed Bottom Action Footer */}
            <div className="shrink-0 border-t border-white/10 bg-[#0F0F0F] p-4">
              <button
                type="submit"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#E31E2D] font-semibold text-white transition hover:brightness-110 shadow-lg"
              >
                Review Pengajuan Anda →
              </button>
            </div>
          </form>
        )}

          {/* ════════ PAGE 3: REVIEW ════════ */}
          {page === "review" && (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-2 pb-4 space-y-4 scrollbar-thin scrollbar-thumb-white/15 scrollbar-track-transparent">
                <button
                  type="button"
                  onClick={() => setPage("form")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 hover:text-white transition w-fit mb-1"
                >
                  <ChevronLeft className="size-3.5" />
                  Edit Data Pengajuan
                </button>

                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">Review Pengajuan Anda</h2>
                  <p className="text-xs text-white/60 mt-0.5">
                    Pastikan seluruh informasi di bawah ini sudah benar sebelum dikirim ke Tim Komersial.
                  </p>
                </div>

              {submitError && (
                <div className="mt-3 rounded-xl border border-[#E31E2D]/40 bg-[#E31E2D]/15 p-3 flex items-start gap-2 text-xs text-[#FF858D]">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Review 2-Col Grid */}
              <div className="mt-4 rounded-xl border border-white/10 bg-black/35 p-3.5 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-white/50 block text-[11px]">Unit Terpilih</span>
                    <strong className="text-white font-bold text-sm">{space.code} ({space.name})</strong>
                  </div>
                  <div>
                    <span className="text-white/50 block text-[11px]">Stasiun & Lokasi</span>
                    <span className="text-white font-semibold">{stationName} · {space.location || `Lantai ${space.floor}`}</span>
                  </div>
                  <div>
                    <span className="text-white/50 block text-[11px]">Kontak Penanggung Jawab</span>
                    <span className="text-white font-semibold">{formData.contactName}</span>
                  </div>
                  <div>
                    <span className="text-white/50 block text-[11px]">Nama Perusahaan / Brand</span>
                    <span className="text-white font-semibold">{formData.companyName}</span>
                  </div>
                  <div>
                    <span className="text-white/50 block text-[11px]">Nomor WhatsApp</span>
                    <span className="text-white font-semibold">{formData.phone}</span>
                  </div>
                  <div>
                    <span className="text-white/50 block text-[11px]">Email Bisnis</span>
                    <span className="text-white font-semibold">{formData.email}</span>
                  </div>
                  <div>
                    <span className="text-white/50 block text-[11px]">Peruntukan Usaha</span>
                    <span className="text-white font-semibold">
                      {formData.businessUse === "Other" ? formData.customBusinessUse : formData.businessUse}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/50 block text-[11px]">Luas Sewa</span>
                    <span className="text-white font-semibold">{space.leasableAreaDetail || `${space.area} m²`}</span>
                  </div>
                </div>

                {formData.message && (
                  <div className="pt-2.5 border-t border-white/10">
                    <span className="text-white/50 block text-[11px] mb-1">Catatan Kebutuhan:</span>
                    <p className="text-xs text-white/80 leading-relaxed italic bg-black/30 p-2.5 rounded-lg border border-white/5">
                      &ldquo;{formData.message}&rdquo;
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs leading-relaxed text-white/60">
                Dengan menekan tombol di bawah, Anda secara resmi menyampaikan pernyataan minat sewa (expression of interest). Tim Komersial LRT Jabodebek akan menindaklanjuti untuk kualifikasi dan penerbitan surat penawaran resmi.
              </div>

              </div>

              {/* Fixed Bottom Action Footer */}
              <div className="shrink-0 border-t border-white/10 bg-[#0F0F0F] p-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage("form")}
                  disabled={isSubmitting}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-white/12 bg-[#161616] px-4 text-xs font-semibold text-white transition hover:bg-[#1d1d1d] disabled:opacity-50"
                >
                  Ubah Data
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSubmit}
                  disabled={isSubmitting}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#E31E2D] font-semibold text-white transition hover:brightness-110 shadow-lg disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Memproses Pengajuan...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      Konfirmasi & Kirim Pengajuan
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ════════ PAGE 4: SUCCESS + WHAT HAPPENS NEXT (DYNAMIC FROM DB) ════════ */}
          {page === "success" && (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-2 pb-4 space-y-4 scrollbar-thin scrollbar-thumb-white/15 scrollbar-track-transparent">
                {/* Green Success Badge */}
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-400/40">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <h2 className="mt-2 text-lg sm:text-xl font-bold text-white">Pengajuan Minat Tercatat!</h2>
                  <div className="mt-1.5 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-3 py-1">
                    <span className="text-[11px] text-emerald-300">Kode Pengajuan:</span>
                    <span className="font-mono text-xs font-bold text-emerald-200">
                      {submittedLead?.inquiryCode}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-white/70 max-w-md mx-auto">
                    Pengajuan sewa untuk unit <strong className="text-white">{space.code}</strong> di Stasiun <strong className="text-white">{stationName}</strong> telah diterima dan otomatis terdaftar di Portal Mitra Anda.
                  </p>
                </div>

                {/* "What happens next?" Timeline (Dynamic from DB) */}
                <div className="mt-4 flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-[#E31E2D]" />
                      What happens next?
                    </h3>
                    <span className="text-[10px] text-white/50">Standar Alur KAI LRT</span>
                  </div>

                  {isLoadingWorkflow ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-xs text-white/50">
                      <Loader2 className="size-4 animate-spin" />
                      Memuat tahapan alur leasing...
                    </div>
                  ) : workflowSteps.length > 0 ? (
                    <div className="mt-4 space-y-0 pr-1">
                      {workflowSteps.map((step, idx) => {
                        const isCurrentStep = step.stepOrder === 1;
                        const isLastStep = idx === workflowSteps.length - 1;
                        return (
                          <div
                            key={step.id || step.stepOrder}
                            className="relative flex items-start gap-3.5"
                          >
                            {/* Left Column: Number Node & Vertical Connecting Line */}
                            <div className="flex flex-col items-center shrink-0 self-stretch">
                              <span
                                className={cn(
                                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold z-10 transition-colors",
                                  isCurrentStep
                                    ? "border-2 border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.35)]"
                                    : "border border-white/20 bg-[#161616] text-white/60"
                                )}
                              >
                                {step.stepOrder}
                              </span>
                              {!isLastStep && (
                                <div className="w-[2px] flex-1 min-h-[28px] my-1 bg-white/15" />
                              )}
                            </div>

                            {/* Right Column: Step Detail Card */}
                            <div
                              className={cn(
                                "flex-1 mb-3.5 rounded-xl border p-3.5 transition",
                                isCurrentStep
                                  ? "border-emerald-400/40 bg-emerald-500/[0.08] shadow-[0_0_16px_rgba(52,211,153,0.06)]"
                                  : "border-white/10 bg-black/35 hover:border-white/20"
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="text-xs sm:text-sm font-bold text-white leading-tight">
                                  {step.title}
                                </h4>
                                {isCurrentStep && (
                                  <span className="shrink-0 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300 border border-emerald-400/30">
                                    Tahap Saat Ini
                                  </span>
                                )}
                              </div>
                              <p className="mt-1.5 text-[11px] sm:text-xs leading-relaxed text-white/65">
                                {step.description || step.publicMessage}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/60">
                      Tim Komersial LRT Jabodebek akan segera menghubungi nomor WhatsApp Anda untuk kualifikasi dan penawaran resmi.
                    </div>
                  )}
                </div>
              </div>

              {/* Fixed Bottom Action Footer */}
              <div className="shrink-0 border-t border-white/10 bg-[#0F0F0F] p-4 flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-white/12 bg-[#161616] px-4 text-xs font-semibold text-white transition hover:bg-[#1d1d1d]"
                >
                  Selesai / Tutup
                </button>
                <Link
                  href={submittedLead?.id && submittedLead.id !== "preview-id" ? `/partner/inquiries/${submittedLead.id}` : "/partner"}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#E31E2D] text-xs sm:text-sm font-semibold text-white transition hover:brightness-110 shadow-lg"
                >
                  Pantau di Portal Mitra →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Pop-up Login Asli yang Muncul Menimpa di Atas Modal */}
    <LoginModal
      open={isLoginModalOpen}
      onClose={() => setIsLoginModalOpen(false)}
      onSuccess={(user) => {
        setAuthUser(user);
        setFormData((prev) => ({
          ...prev,
          email: user.email || prev.email,
          contactName: user.name || prev.contactName,
          password: "",
        }));
        setFormErrors((prev) => {
          const copy = { ...prev };
          delete copy.password;
          return copy;
        });
      }}
    />
  </div>,
    document.body
  );
}
