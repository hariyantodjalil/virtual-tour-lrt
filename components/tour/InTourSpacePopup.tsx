"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Download,
  Eye,
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
} from "lucide-react";
import { formatNumber, formatRupiah, getWhatsAppUrl } from "@/lib/utils";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import {
  isFavoriteSpace,
  toggleFavoriteSpace,
} from "@/lib/favorite-spaces";
import { FACILITY_ICONS, isFacilityIconId } from "@/lib/facility-icons";
import TenantInterestForm from "./TenantInterestForm";
import type { SpaceAvailabilityStatus } from "@/lib/space-availability";

type CommercialSpace = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: SpaceAvailabilityStatus;
  area: number;
  monthlyRent?: number;
  deposit: number;
  floor: string;
  location: string;
  nearestExit: string | null;
  nearbyFacilities?: string[];
  exposure: number;
  powerSupply: string | null;
  waterAccess: boolean;
  airConditioning: boolean;
  description: string | null;
  panoramaUrl?: string | null;
  tenantBrand?: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  KIOS: "Kios",
  RUKO: "Ruko",
  ATM: "ATM",
  VENDING: "Vending Machine",
  MEDIA_IKLAN: "Media Iklan",
  AREA_PROMOSI: "Area Promosi",
};

const MEDIA_TYPES = new Set(["MEDIA_IKLAN", "AREA_PROMOSI"]);

type Props = {
  space: CommercialSpace;
  stationName: string;
  stationSlug?: string;
  contactPhone?: string;
  onClose: () => void;
  returnToList?: boolean;
};

function visibilityLabel(exposure: number) {
  if (exposure >= 4000) return "Tinggi";
  if (exposure >= 1500) return "Sedang";
  return "Rendah";
}

export default function InTourSpacePopup({
  space,
  stationName,
  stationSlug,
  contactPhone = "628118012012",
  onClose,
  returnToList = false,
}: Props) {
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [favorited, setFavorited] = useState(() => isFavoriteSpace(space.id));

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

  const waMessage = `Halo, saya tertarik dengan unit komersial ${space.code} (${space.name}) di Stasiun ${stationName}. Mohon informasi lebih lanjut.`;
  const waUrl = getWhatsAppUrl(contactPhone, waMessage);
  const isMedia = MEDIA_TYPES.has(space.type);
  const occupiedTenant =
    space.status === "TERISI" ? space.tenantBrand?.trim() : "";
  const categoryLabel = isMedia ? "Media" : "Tenant";
  const priceValue =
    space.monthlyRent && space.monthlyRent > 0
      ? `${formatRupiah(space.monthlyRent)} / bulan`
      : space.deposit > 0
        ? `Deposit ${formatRupiah(space.deposit)}`
        : "Hubungi tim";

  const coverSrc = space.panoramaUrl
    ? getS3ProxyUrl(space.panoramaUrl)
    : "/brand/landing/space-card.jpg";

  const statusConfig = {
    TERSEDIA: {
      label: "Tersedia",
      className: "bg-emerald-50 text-emerald-700",
      dot: "bg-emerald-500",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    },
    TERISI: {
      label: "Terisi",
      className: "bg-red-50 text-red-700",
      dot: "bg-red-500",
      icon: <XCircle className="h-3.5 w-3.5" />,
    },
    RESERVED: {
      label: "Reserved",
      className: "bg-indigo-50 text-indigo-700",
      dot: "bg-indigo-500",
      icon: <AlertCircle className="h-3.5 w-3.5" />,
    },
    FIT_OUT: {
      label: "Fit-Out",
      className: "bg-violet-50 text-violet-700",
      dot: "bg-violet-500",
      icon: <AlertCircle className="h-3.5 w-3.5" />,
    },
    MAINTENANCE: {
      label: "Maintenance",
      className: "bg-amber-50 text-amber-700",
      dot: "bg-amber-500",
      icon: <AlertCircle className="h-3.5 w-3.5" />,
    },
  }[space.status];

  const highlights = useMemo(() => {
    const items: string[] = [];
    if (space.nearestExit) items.push(`Dekat ${space.nearestExit}`);
    if (space.floor) items.push(`Area ${space.floor}`);
    if (space.location) items.push(space.location.split(",")[0]?.trim() || space.location);
    if (items.length < 3 && space.exposure > 0) items.push("Mudah Terlihat");
    return items.slice(0, 3);
  }, [space.nearestExit, space.floor, space.location, space.exposure]);

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
  }, [
    space.nearbyFacilities,
    space.powerSupply,
    space.waterAccess,
    space.airConditioning,
  ]);

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
            .brand { color: #D81435; font-weight: 800; letter-spacing: .08em; font-size: 12px; text-transform: uppercase; }
            h1 { margin: 8px 0 4px; font-size: 30px; color: #17355f; }
            .muted { color: #6b7280; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin: 24px 0; }
            .box { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; }
            .label { color: #6b7280; font-size: 12px; margin-bottom: 4px; }
            .value { font-size: 18px; font-weight: 800; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            td { border-bottom: 1px solid #e5e7eb; padding: 10px 0; }
            td:first-child { color: #6b7280; width: 38%; }
            .cta { margin-top: 28px; padding: 18px; background: #17355f; color: white; border-radius: 14px; }
          </style>
        </head>
        <body>
          <div class="brand">LRT Jabodebek - Virtual Tour Komersial</div>
          <h1>${space.name}</h1>
          <div class="muted">${space.code} - Stasiun ${stationName} - ${TYPE_LABELS[space.type] ?? space.type}</div>
          <div class="grid">
            <div class="box"><div class="label">Status</div><div class="value">${statusConfig.label}</div></div>
            <div class="box"><div class="label">Luas</div><div class="value">${space.area} m²</div></div>
            <div class="box"><div class="label">Harga</div><div class="value">${priceValue}</div></div>
            <div class="box"><div class="label">Eksposur</div><div class="value">${formatNumber(Math.round(space.exposure))} orang/hari</div></div>
          </div>
          <table>
            <tr><td>Lokasi</td><td>${space.location}</td></tr>
            <tr><td>Lantai</td><td>${space.floor}</td></tr>
            <tr><td>Exit Terdekat</td><td>${space.nearestExit ?? "-"}</td></tr>
            <tr><td>Deposit</td><td>${formatRupiah(space.deposit)}</td></tr>
            <tr><td>Daya Listrik</td><td>${space.powerSupply ?? "-"}</td></tr>
            <tr><td>Air Bersih</td><td>${space.waterAccess ? "Tersedia" : "Tidak tersedia"}</td></tr>
            <tr><td>AC</td><td>${space.airConditioning ? "Tersedia" : "Tidak tersedia"}</td></tr>
            <tr><td>Catatan</td><td>${space.description ?? "Unit siap dievaluasi melalui virtual tour 360."}</td></tr>
          </table>
          <div class="cta">Hubungi tim komersial: ${contactPhone}. Ringkasan ini dibuat otomatis dari data aset virtual tour.</div>
          <script>window.onload = () => setTimeout(() => window.print(), 250);</script>
        </body>
      </html>
    `);
    popup.document.close();
  };

  return (
    <div className="pointer-events-auto absolute inset-x-3 bottom-4 top-20 z-50 overflow-hidden rounded-2xl border border-[color:rgb(255_214_218_/_0.14)] bg-white shadow-[0_24px_60px_rgba(28,10,14,0.5)] backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:top-24 sm:bottom-6 sm:w-[410px] lg:w-[420px]">
      <div className="flex h-full max-h-[inherit] flex-col">
        {/* Header merah — Figma */}
        <div className="flex shrink-0 items-center justify-between bg-[#D81435] px-4 py-3 text-white">
          <div className="flex min-w-0 items-center gap-2">
            {returnToList ? (
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1.5 text-xs font-semibold text-white/90 transition hover:text-white"
              >
                <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                Kembali ke Daftar Unit
              </button>
            ) : (
              <>
                <span className="flex size-7 items-center justify-center rounded-full bg-white/15">
                  <Info className="h-4 w-4" />
                </span>
                <span className="font-display text-sm font-semibold">Informasi</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
            aria-label="Tutup detail unit"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Cover + Favorit */}
          <div className="relative aspect-[16/9] w-full bg-slate-200">
            <Image
              src={coverSrc}
              alt={space.name}
              fill
              sizes="420px"
              className="object-cover"
              unoptimized={coverSrc.startsWith("/api/")}
            />
            <button
              type="button"
              onClick={handleToggleFavorite}
              disabled={!stationSlug}
              className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-md transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Heart
                className={`h-3.5 w-3.5 ${favorited ? "fill-[#D81435] text-[#D81435]" : "text-[#D81435]"}`}
              />
              Favorit
            </button>
          </div>

          <div className="space-y-4 p-4">
            {/* Title + badges */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-xl font-bold tracking-tight text-[#101828] uppercase">
                  {occupiedTenant || space.code}
                </h3>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">
                    {space.location || space.floor}, Stasiun {stationName}
                  </span>
                </p>
                {occupiedTenant && (
                  <p className="mt-1 text-sm font-semibold text-[#D81435]">
                    Unit {space.code} · {space.name}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusConfig.className}`}
                >
                  <span className={`size-1.5 rounded-full ${statusConfig.dot}`} />
                  {statusConfig.label}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                  <Store className="h-3 w-3" />
                  {categoryLabel}
                </span>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-slate-600">
              {space.description?.trim() ||
                `Area komersial strategis dengan mobilitas penumpang yang tinggi. Cocok untuk ${
                  isMedia ? "media iklan maupun promosi." : "retail maupun food & beverage."
                }`}
            </p>

            {/* Harga / Lokasi / Luas */}
            <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200">
              <div className="px-2.5 py-3">
                <Tag className="mb-1.5 h-4 w-4 text-[#D81435]" />
                <p className="text-[11px] font-semibold text-slate-800">Harga</p>
                <p className="mt-0.5 text-xs font-bold leading-snug text-slate-700">{priceValue}</p>
              </div>
              <div className="px-2.5 py-3">
                <MapPin className="mb-1.5 h-4 w-4 text-[#D81435]" />
                <p className="text-[11px] font-semibold text-slate-800">Lokasi</p>
                <p className="mt-0.5 text-xs font-bold leading-snug text-slate-700">
                  {space.location || `Lantai ${space.floor}`}
                </p>
              </div>
              <div className="px-2.5 py-3">
                <Maximize2 className="mb-1.5 h-4 w-4 text-[#D81435]" />
                <p className="text-[11px] font-semibold text-slate-800">Luas</p>
                <p className="mt-0.5 text-xs font-bold leading-snug text-slate-700">
                  {space.area} m²
                </p>
              </div>
            </div>

            {/* Potensi Area */}
            <div className="overflow-hidden rounded-xl bg-[#f8e9ea]">
              <div className="flex items-center gap-2 px-3.5 pt-3 pb-2">
                <BarChart3 className="h-4 w-4 text-[#D81435]" />
                <p className="text-sm font-bold text-[#D81435]">Potensi Area</p>
              </div>
              <div className="grid grid-cols-3 gap-2 px-3.5 pb-3.5">
                <div>
                  <Users className="mb-1 h-4 w-4 text-[#D81435]" />
                  <p className="text-[10px] leading-tight text-slate-600">Mobilitas Penumpang</p>
                  <p className="mt-1 text-xs font-bold text-slate-900">
                    {formatNumber(Math.round(space.exposure))} orang/hari
                  </p>
                </div>
                <div>
                  <Eye className="mb-1 h-4 w-4 text-[#D81435]" />
                  <p className="text-[10px] leading-tight text-slate-600">Visibilitas</p>
                  <p className="mt-1 text-xs font-bold text-slate-900">
                    {visibilityLabel(space.exposure)}
                  </p>
                </div>
                <div>
                  <CheckCircle2 className="mb-1 h-4 w-4 text-[#D81435]" />
                  <p className="text-[10px] leading-tight text-slate-600">Keunggulan</p>
                  <ul className="mt-1 space-y-0.5 text-[11px] font-semibold text-slate-900">
                    {highlights.map((item) => (
                      <li key={item} className="flex gap-1">
                        <span className="text-[#D81435]">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Fasilitas Terdekat */}
            <div>
              <p className="mb-2 text-sm font-bold text-[#101828]">Fasilitas Terdekat</p>
              <div className="grid grid-cols-5 gap-1.5">
                {nearbyFacilities.map((f) => (
                  <div
                    key={f.label}
                    className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white px-1 py-2 text-center"
                  >
                    <span className="flex size-7 items-center justify-center text-[#D81435]">
                      {f.icon}
                    </span>
                    <span className="text-[9px] font-medium leading-tight text-slate-500">
                      {f.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="shrink-0 border-t border-slate-100 bg-white p-3">
          {space.status === "TERSEDIA" ? (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setShowInterestModal(true)}
                className="col-span-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#D81435] px-2 py-2.5 text-xs font-bold text-white transition hover:brightness-110"
              >
                <Tag className="h-3.5 w-3.5 shrink-0" />
                Sewa Tenant
              </button>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("WHATSAPP_CLICK")}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-xs font-bold text-slate-800 transition hover:bg-slate-50"
              >
                <Phone className="h-3.5 w-3.5 shrink-0 text-[#D81435]" />
                Hubungi
              </a>
              <button
                type="button"
                onClick={handleDownloadSummary}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-xs font-bold text-slate-800 transition hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5 shrink-0 text-[#D81435]" />
                Unduh PDF
              </button>
            </div>
          ) : (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
            >
              <Phone className="h-4 w-4 text-[#D81435]" />
              Tanya Tim Komersial
            </a>
          )}
        </div>
      </div>

      {showInterestModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6">
            <div className="relative grid max-h-[min(920px,calc(100vh-24px))] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl md:grid-cols-[minmax(300px,0.95fr)_minmax(0,1.15fr)]">
              {/* Left — detail unit */}
              <div className="relative hidden overflow-y-auto bg-[#D81435] text-white md:block">
                <div className="flex min-h-full flex-col p-5 pb-7 lg:p-6 lg:pb-8">
                <div className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-[#22c55e] px-2.5 py-1 text-[11px] font-semibold text-white">
                  {statusConfig.icon}
                  {statusConfig.label}
                </div>

                <div className="relative mb-5 aspect-[16/10] overflow-hidden rounded-xl">
                  <Image
                    src={coverSrc}
                    alt={space.name}
                    fill
                    sizes="420px"
                    className="object-cover"
                    unoptimized={coverSrc.startsWith("http") || coverSrc.includes("/api/")}
                  />
                  {stationSlug ? (
                    <a
                      href={`/station/${stationSlug}?unit=${space.id}`}
                      className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg bg-black/65 px-3 py-2 text-[11px] font-semibold text-white backdrop-blur-sm transition hover:bg-black/80"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/brand/landing/icons/tour-360.svg"
                        alt=""
                        width={14}
                        height={14}
                        className="size-3.5 brightness-0 invert"
                      />
                      Lihat Virtual Tour
                      <ArrowRight className="size-3" />
                    </a>
                  ) : null}
                </div>

                <p className="text-[10px] font-semibold tracking-[0.18em] text-white/55 uppercase">
                  Formulir Tenant
                </p>
                <h2 className="mt-1.5 text-2xl leading-tight font-bold lg:text-[28px]">
                  {space.name}
                </h2>
                <p className="mt-1 text-sm text-white/70">
                  {space.code} - Stasiun {stationName}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl bg-black/30 p-3 shadow-sm ring-1 ring-white/20">
                    <Users className="mb-2 size-3.5 text-white/80" />
                    <p className="text-[10px] font-medium text-white/70">Eksposur</p>
                    <p className="mt-1 text-[15px] leading-none font-bold text-white">
                      {formatNumber(Math.round(space.exposure))}
                    </p>
                    <p className="mt-1 text-[10px] text-white/65">orang/hari</p>
                  </div>
                  <div className="rounded-xl bg-black/30 p-3 shadow-sm ring-1 ring-white/20">
                    <MapPin className="mb-2 size-3.5 text-white/80" />
                    <p className="text-[10px] font-medium text-white/70">Lokasi</p>
                    <p className="mt-1 truncate text-[15px] leading-none font-bold text-white">
                      {space.location || space.floor}
                    </p>
                    <p className="mt-1 truncate text-[10px] text-white/65">
                      Stasiun {stationName}
                    </p>
                  </div>
                  <div className="rounded-xl bg-black/30 p-3 shadow-sm ring-1 ring-white/20">
                    <Maximize2 className="mb-2 size-3.5 text-white/80" />
                    <p className="text-[10px] font-medium text-white/70">Luas</p>
                    <p className="mt-1 text-[15px] font-bold text-white">{space.area} m²</p>
                  </div>
                  <div className="rounded-xl bg-black/30 p-3 shadow-sm ring-1 ring-white/20">
                    <Store className="mb-2 size-3.5 text-white/80" />
                    <p className="text-[10px] font-medium text-white/70">Status</p>
                    <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 ring-1 ring-emerald-300/40">
                      <span className={`size-1.5 rounded-full ${statusConfig.dot}`} />
                      {statusConfig.label}
                    </span>
                  </div>
                </div>
                </div>
              </div>

              {/* Right — form */}
              <div className="relative max-h-[min(920px,calc(100vh-24px))] overflow-y-auto bg-white p-5 sm:p-7 lg:p-8">
                <button
                  type="button"
                  onClick={() => setShowInterestModal(false)}
                  className="absolute top-4 right-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Tutup formulir minat"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="mb-5 pr-8">
                  <p className="text-[11px] font-bold tracking-[0.16em] text-[#D81435] uppercase">
                    Ajukan Minat Sewa
                  </p>
                  <h3 className="mt-1.5 text-2xl font-bold text-[#101828] sm:text-[28px]">
                    Data Calon Tenant
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    Form ini khusus untuk unit {space.code} di Stasiun {stationName}.
                  </p>
                </div>

                <TenantInterestForm
                  spaceId={space.id}
                  spaceCode={space.code}
                  stationName={stationName}
                  variant="modal"
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
