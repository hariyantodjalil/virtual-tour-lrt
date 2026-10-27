"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Copy,
  MapPin,
  Maximize2,
  MessageSquare,
  Store,
  Users,
  Wrench,
  X,
  Zap,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronLeft,
} from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { getS3ProxyUrl } from "@/lib/s3-utils";
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

type SpecRow = {
  id: string;
  label: string;
  value: string;
  hint?: string | null;
  icon: ReactNode;
};

type Props = {
  space: CommercialSpace;
  stationName: string;
  stationSlug?: string;
  contactPhone?: string;
  onClose: () => void;
  returnToList?: boolean;
};

export default function InTourSpacePopup({
  space,
  stationName,
  stationSlug,
  onClose,
  returnToList = false,
}: Props) {
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const occupiedTenant =
    space.status === "TERISI" ? space.tenantBrand?.trim() : "";
  const typeLabel = TYPE_LABELS[space.type] ?? space.type;

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
  }[space.status];

  const locationValue = space.location?.trim() || space.floor?.trim() || "-";
  const locationHint =
    space.location?.trim() &&
    space.floor?.trim() &&
    space.location.trim() !== space.floor.trim()
      ? space.floor.trim()
      : space.nearestExit?.trim()
        ? `Exit terdekat: ${space.nearestExit.trim()}`
        : null;

  const utilityValue = [
    space.waterAccess ? "Air" : null,
    space.airConditioning ? "AC / ventilasi" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const facilitiesHint =
    space.nearbyFacilities && space.nearbyFacilities.length > 0
      ? space.nearbyFacilities.join(" · ")
      : null;

  const breadcrumb = [stationName, space.floor, space.location]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" | ");

  const rows: SpecRow[] = [
    {
      id: "area",
      label: "Luas Lantai",
      value: `${space.area} m²`,
      hint: null,
      icon: <Maximize2 className="size-[18px]" strokeWidth={1.8} />,
    },
    {
      id: "location",
      label: "Lokasi Toko",
      value: locationValue,
      hint: locationHint,
      icon: <MapPin className="size-[18px]" strokeWidth={1.8} />,
    },
    {
      id: "type",
      label: "Jenis Ruang",
      value: typeLabel,
      hint: space.description?.trim() || null,
      icon: <Store className="size-[18px]" strokeWidth={1.8} />,
    },
    {
      id: "power",
      label: "Pasokan Listrik",
      value: space.powerSupply?.trim() || "-",
      hint: null,
      icon: <Zap className="size-[18px]" strokeWidth={1.8} />,
    },
    {
      id: "utilities",
      label: "Utilitas",
      value: utilityValue || "-",
      hint: facilitiesHint,
      icon: <Wrench className="size-[18px]" strokeWidth={1.8} />,
    },
    {
      id: "availability",
      label: "Ketersediaan",
      value: statusConfig.label,
      hint: occupiedTenant ? `Penyewa: ${occupiedTenant}` : null,
      icon: <CalendarDays className="size-[18px]" strokeWidth={1.8} />,
    },
  ];

  const trackEvent = async (eventType: string) => {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, spaceId: space.id }),
    }).catch(() => null);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(space.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  useEffect(() => {
    trackEvent("SPACE_VIEW");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space.id]);

  useEffect(() => {
    const blockTourKeys = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "PageUp" ||
        event.key === "PageDown" ||
        event.key === " "
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", blockTourKeys, true);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", blockTourKeys, true);
  }, []);

  return (
    <div
      className="absolute inset-0 z-[80] flex items-center justify-center bg-[#1C0A0E]/72 p-3 backdrop-blur-[2px] sm:p-5 lg:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-space-popup-title"
    >
      <div className="tour-glass-panel tour-panel-in flex max-h-full min-h-0 w-full max-w-[440px] flex-col overflow-hidden rounded-2xl text-[#F8ECEE] lg:h-[min(88%,820px)] lg:max-w-[min(100%,1360px)]">
        <div className="flex shrink-0 items-center justify-end gap-1 border-b border-[rgba(255,214,218,0.14)] px-4 py-3 sm:px-5 lg:px-8 lg:py-4">
          {returnToList ? (
            <button
              type="button"
              onClick={onClose}
              className="mr-auto inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-left text-xs font-medium text-[#F8ECEE] transition hover:bg-white/5"
            >
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-[#E31E2D]/55 bg-[#261015]">
                <ChevronLeft className="size-4 text-[#E31E2D]" strokeWidth={2.4} />
              </span>
              Kembali ke Daftar Unit
            </button>
          ) : null}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex size-11 items-center justify-center rounded-full text-[#C4A8AD] transition hover:bg-white/10 hover:text-[#F8ECEE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D]"
            aria-label="Tutup detail unit"
          >
            <X className="size-4" strokeWidth={2.2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
          <div className="lg:grid lg:h-full lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)_auto] lg:overflow-hidden">
            <div className="px-5 pt-5 sm:px-6 lg:overflow-y-auto lg:px-10 lg:pt-10 lg:pr-8">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-[#C4A8AD] uppercase lg:text-xs">
                Ruang Komersial
              </p>
              <div className="mt-3 flex min-w-0 items-center gap-2.5 lg:mt-5">
                <h3
                  id="tour-space-popup-title"
                  className="font-display truncate text-2xl leading-tight font-semibold tracking-[-0.02em] text-[#F8ECEE] lg:text-[2.65rem]"
                >
                  {space.code}
                </h3>
                <button
                  type="button"
                  onClick={copyCode}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-[#FF6B4A] transition hover:bg-[#E31E2D]/15 hover:text-[#FF8A70] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D] lg:size-10"
                  aria-label={copied ? "Kode disalin" : "Salin kode unit"}
                  title={copied ? "Disalin" : "Salin kode"}
                >
                  {copied ? (
                    <Check className="size-4 lg:size-5" strokeWidth={2.4} />
                  ) : (
                    <Copy className="size-4 lg:size-5" strokeWidth={2} />
                  )}
                </button>
              </div>
              {breadcrumb ? (
                <p className="mt-2 text-sm leading-snug text-[#C4A8AD] lg:mt-3 lg:text-base">
                  {breadcrumb}
                </p>
              ) : null}
              {occupiedTenant ? (
                <p className="mt-3 text-sm font-semibold text-[#FF6B4A] lg:text-base">
                  Penyewa saat ini: {occupiedTenant}
                </p>
              ) : null}
            </div>

            <div className="mt-4 border-t border-[rgba(255,214,218,0.14)] px-5 pt-2 sm:px-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:overflow-y-auto lg:border-t-0 lg:border-l lg:border-[rgba(255,214,218,0.14)] lg:px-10 lg:pt-10 lg:pb-8">
              <ul className="divide-y divide-[rgba(255,214,218,0.10)]">
                {rows.map((row, index) => (
                  <li
                    key={row.id}
                    className="tour-spec-row flex items-start gap-3.5 py-3.5 lg:gap-4 lg:py-4"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-[#E31E2D]/28 bg-[#E31E2D]/12 text-[#FF6B4A] lg:size-11">
                      {row.icon}
                    </span>
                    <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] items-start gap-2 lg:gap-4">
                      <p className="pt-2 text-sm text-[#C4A8AD] lg:text-base">{row.label}</p>
                      <div className="min-w-0 text-right lg:text-left">
                        <p className="text-sm font-semibold text-[#F8ECEE] lg:text-lg">
                          {row.value}
                        </p>
                        {row.hint ? (
                          <p className="mt-0.5 text-xs leading-snug text-[#C4A8AD]/90 lg:text-sm">
                            {row.hint}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="hidden px-10 pt-2 pb-8 lg:block">
              <button
                type="button"
                onClick={() => setShowInterestModal(true)}
                disabled={space.status !== "TERSEDIA"}
                className="inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-[#E31E2D] px-4 text-base font-bold text-white shadow-[0_10px_28px_rgba(227,30,45,0.28)] transition hover:bg-[#c41926] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6B4A] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                <MessageSquare className="size-4" strokeWidth={2.2} />
                {space.status === "TERSEDIA" ? "Ajukan Minat Sewa" : "Ruang belum tersedia"}
              </button>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-[rgba(255,214,218,0.14)] px-5 pt-4 pb-5 sm:px-6 lg:hidden">
          <button
            type="button"
            onClick={() => setShowInterestModal(true)}
            disabled={space.status !== "TERSEDIA"}
            className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#E31E2D] px-4 text-sm font-bold text-white shadow-[0_10px_28px_rgba(227,30,45,0.28)] transition hover:bg-[#c41926] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6B4A] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            <MessageSquare className="size-4" strokeWidth={2.2} />
            {space.status === "TERSEDIA" ? "Ajukan Minat Sewa" : "Ruang belum tersedia"}
          </button>
        </div>
      </div>

      {showInterestModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6">
            <div className="relative grid max-h-[min(920px,calc(100vh-24px))] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl md:grid-cols-[minmax(300px,0.95fr)_minmax(0,1.15fr)]">
              <div className="relative hidden overflow-y-auto bg-[#111111] text-white md:block">
                <div className="flex min-h-full flex-col p-5 pb-7 lg:p-6 lg:pb-8">
                  <div
                    className={`mb-4 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusConfig.className}`}
                  >
                    <span className={`size-1.5 rounded-full ${statusConfig.dot}`} />
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
                    <div className="rounded-xl bg-white/5 p-3 ring-1 ring-[#E31E2D]/40">
                      <Users className="mb-2 size-3.5 text-[#E31E2D]" />
                      <p className="text-[10px] font-medium text-white/60">Eksposur</p>
                      <p className="mt-1 text-[15px] leading-none font-bold text-white">
                        {formatNumber(Math.round(space.exposure))}
                      </p>
                      <p className="mt-1 text-[10px] text-white/55">orang/hari</p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3 ring-1 ring-[#E31E2D]/40">
                      <MapPin className="mb-2 size-3.5 text-[#E31E2D]" />
                      <p className="text-[10px] font-medium text-white/60">Lokasi</p>
                      <p className="mt-1 truncate text-[15px] leading-none font-bold text-white">
                        {space.location || space.floor}
                      </p>
                      <p className="mt-1 truncate text-[10px] text-white/55">
                        Stasiun {stationName}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3 ring-1 ring-[#E31E2D]/40">
                      <Maximize2 className="mb-2 size-3.5 text-[#E31E2D]" />
                      <p className="text-[10px] font-medium text-white/60">Luas</p>
                      <p className="mt-1 text-[15px] font-bold text-white">{space.area} m²</p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3 ring-1 ring-[#E31E2D]/40">
                      <Store className="mb-2 size-3.5 text-[#E31E2D]" />
                      <p className="text-[10px] font-medium text-white/60">Status</p>
                      <span
                        className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusConfig.className}`}
                      >
                        <span className={`size-1.5 rounded-full ${statusConfig.dot}`} />
                        {statusConfig.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

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
