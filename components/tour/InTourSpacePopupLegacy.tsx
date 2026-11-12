"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Check,
  Copy,
  MapPin,
  Maximize2,
  MessageSquare,
  Store,
  Wrench,
  X,
  Zap,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronLeft,
} from "lucide-react";
import TenantInterestForm from "./TenantInterestForm";
import type { SpaceAvailabilityStatus } from "@/lib/space-availability";
import { cn } from "@/lib/utils";

/** Temporary A/B: "light" frost white vs "dark" black glass. Flip to compare. */
const PANEL_TONE: "dark" | "light" = "light";

const PANEL_UI = {
  dark: {
    panel: "tour-glass-panel text-white backdrop-blur-[48px] backdrop-saturate-[1.8]",
    hairline: "border-white/10",
    hairlineStrong: "border-white/15",
    text: "text-white",
    muted: "text-white/55",
    faint: "text-white/50",
    soft: "text-white/60",
    softHover: "hover:bg-white/10 hover:text-white",
    chip: "border-white/15 bg-white/5",
    chipHover: "hover:bg-white/5",
    iconRing: "border-white/12 bg-white/8 text-white/85",
    accentLabel: "text-[#FF5A66]",
    occupied: "text-[#FF8A8A]",
    backLabel: "text-white/90",
  },
  light: {
    panel:
      "border border-black/8 bg-[#F7F8FA] text-[#0B1220] shadow-[0_24px_64px_rgba(15,23,42,0.22),0_4px_16px_rgba(15,23,42,0.08)]",
    hairline: "border-black/10",
    hairlineStrong: "border-black/12",
    text: "text-[#0B1220]",
    muted: "text-slate-600",
    faint: "text-slate-500",
    soft: "text-slate-600",
    softHover: "hover:bg-black/5 hover:text-[#101828]",
    chip: "border-black/10 bg-white shadow-sm shadow-black/5",
    chipHover: "hover:bg-white",
    iconRing: "border-black/10 bg-white text-slate-700 shadow-sm shadow-black/5",
    accentLabel: "text-[#E31E2D]",
    occupied: "text-[#C41926]",
    backLabel: "text-[#101828]",
  },
} as const;

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
  onClose,
  returnToList = false,
}: Props) {
  const [view, setView] = useState<"detail" | "form">("detail");
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const formHeadingRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [hasSwitched, setHasSwitched] = useState(false);
  const [lockedHeight, setLockedHeight] = useState<number | null>(null);
  const isForm = view === "form";
  const canApply = space.status === "TERSEDIA";
  const ui = PANEL_UI[PANEL_TONE];
  const occupiedTenant =
    space.status === "TERISI" ? space.tenantBrand?.trim() : "";
  const typeLabel = TYPE_LABELS[space.type] ?? space.type;

  const statusConfig = {
    TERSEDIA: {
      label: "Tersedia",
      className:
        PANEL_TONE === "light"
          ? "border-emerald-600/25 bg-emerald-500/10 text-emerald-700"
          : "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
      dot: PANEL_TONE === "light" ? "bg-emerald-600" : "bg-emerald-400",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    },
    TERISI: {
      label: "Terisi",
      className:
        PANEL_TONE === "light"
          ? "border-[#E31E2D]/30 bg-[#E31E2D]/8 text-[#C41926]"
          : "border-[#E31E2D]/40 bg-[#E31E2D]/12 text-[#FF4D57]",
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

  useEffect(() => {
    if (!hasSwitched) return;
    if (isForm) {
      formHeadingRef.current?.focus({ preventScroll: true });
      return;
    }
    const cta = Array.from(
      panelRef.current?.querySelectorAll<HTMLButtonElement>("[data-apply-cta]") ?? []
    ).find((button) => button.offsetParent !== null);
    cta?.focus({ preventScroll: true });
  }, [isForm, hasSwitched]);

  useEffect(() => {
    if (!isForm) return;
    const backOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setView("detail");
    };
    window.addEventListener("keydown", backOnEscape, true);
    return () => window.removeEventListener("keydown", backOnEscape, true);
  }, [isForm]);

  const switchView = (next: "detail" | "form") => {
    setLockedHeight(next === "form" ? (panelRef.current?.offsetHeight ?? null) : null);
    setHasSwitched(true);
    setView(next);
  };

  return (
    <div
      className={cn(
        "absolute inset-0 z-[80] flex items-center justify-center overflow-hidden p-3 sm:p-5 lg:p-8",
        PANEL_TONE === "light"
          ? "bg-black/25 backdrop-blur-[2px]"
          : "bg-black/45 backdrop-blur-md"
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={isForm ? "tour-space-form-title" : "tour-space-popup-title"}
    >
      <div
        ref={panelRef}
        className={cn(ui.panel, "tour-panel-in flex max-h-full w-full max-w-[440px] flex-col overflow-hidden rounded-2xl lg:max-w-[min(100%,1200px)]")}
        style={isForm && lockedHeight ? { height: lockedHeight } : undefined}
      >
        <div className={cn("flex shrink-0 items-center justify-end gap-1 border-b px-4 py-3 sm:px-5 lg:px-8 lg:py-4", ui.hairline)}>
          {isForm ? (
            <button
              type="button"
              onClick={() => switchView("detail")}
              className={cn("mr-auto inline-flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-1 text-left text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D]", ui.backLabel, ui.chipHover)}
            >
              <span className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-lg border", ui.chip)}>
                <ChevronLeft className={cn("size-4", ui.text)} strokeWidth={2.4} />
              </span>
              <span className="min-w-0">
                <span className="block">Kembali ke detail</span>
                <span className={cn("block truncate text-[11px]", ui.faint)}>{space.code}</span>
              </span>
            </button>
          ) : returnToList ? (
            <button
              type="button"
              onClick={onClose}
              className={cn("mr-auto inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-left text-xs font-medium transition", ui.backLabel, ui.chipHover)}
            >
              <span className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-lg border", ui.chip)}>
                <ChevronLeft className={cn("size-4", ui.text)} strokeWidth={2.4} />
              </span>
              Kembali ke Daftar Unit
            </button>
          ) : null}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className={cn("inline-flex size-11 items-center justify-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D]", ui.soft, ui.softHover)}
            aria-label={isForm ? "Tutup formulir" : "Tutup detail unit"}
          >
            <X className="size-4" strokeWidth={2.2} />
          </button>
        </div>

        {isForm ? (
          <div key="form" className="tour-drawer-in flex min-h-0 flex-1 flex-col">
            <TenantInterestForm
              spaceId={space.id}
              spaceCode={space.code}
              stationName={stationName}
              variant="modal"
              tone={PANEL_TONE}
              layout="ledger"
              aside={
                <div className="@container">
                  <p className={cn("text-[11px] font-semibold tracking-[0.16em] uppercase lg:text-xs", ui.accentLabel)}>
                    Ajukan Minat Sewa
                  </p>
                  <h3
                    id="tour-space-form-title"
                    ref={formHeadingRef}
                    tabIndex={-1}
                    className={cn("font-display mt-3 text-[clamp(1.375rem,7cqi,2.5rem)] leading-[1.1] font-semibold tracking-[-0.02em] outline-none lg:mt-5", ui.text)}
                  >
                    Data Calon Tenant
                  </h3>
                  <p className={cn("mt-2 text-sm leading-snug lg:mt-3 lg:text-base", ui.muted)}>
                    Unit <span className={cn("font-semibold", ui.text)}>{space.code}</span>
                    {breadcrumb ? (
                      <span className="hidden sm:inline"> · {breadcrumb}</span>
                    ) : null}
                  </p>
                </div>
              }
            />
          </div>
        ) : (
        <div
          key="detail"
          className={`grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-2 ${
            hasSwitched ? "tour-drawer-in-left" : ""
          }`}
        >
          <div className={cn("flex shrink-0 flex-col justify-between gap-6 border-b px-5 py-5 sm:px-6 lg:border-r lg:border-b-0 lg:px-10 lg:pt-10 lg:pb-8", ui.hairline)}>
            <div className="@container">
              <p className={cn("text-[11px] font-semibold tracking-[0.16em] uppercase lg:text-xs", ui.muted)}>
                Ruang Komersial
              </p>
              <div className="mt-3 flex min-w-0 items-start gap-2.5 lg:mt-5">
                <h3
                  id="tour-space-popup-title"
                  className={cn("font-display min-w-0 text-[clamp(1.25rem,6.8cqi,2.5rem)] leading-[1.1] font-semibold tracking-[-0.02em] [overflow-wrap:anywhere]", ui.text)}
                >
                  {space.code}
                </h3>
                <button
                  type="button"
                  onClick={copyCode}
                  className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D] lg:size-10", ui.soft, ui.softHover)}
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
                <p className={cn("mt-2 text-sm leading-snug lg:mt-3 lg:text-base", ui.muted)}>
                  {breadcrumb}
                </p>
              ) : null}
              {occupiedTenant ? (
                <p className={cn("mt-3 text-sm font-semibold lg:text-base", ui.occupied)}>
                  Penyewa saat ini: {occupiedTenant}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              data-apply-cta
              onClick={() => switchView("form")}
              disabled={!canApply}
              className="hidden h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-[#E31E2D] px-4 text-base font-bold text-white shadow-[0_10px_28px_rgba(227,30,45,0.28)] transition hover:bg-[#c41926] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6B4A] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none lg:inline-flex"
            >
              <MessageSquare className="size-4" strokeWidth={2.2} />
              {canApply ? "Ajukan Minat Sewa" : "Ruang belum tersedia"}
            </button>
          </div>

          <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 lg:px-10 lg:pt-10 lg:pb-8">
            <ul className={cn("divide-y", PANEL_TONE === "light" ? "divide-black/10" : "divide-white/10")}>
              {rows.map((row, index) => (
                <li
                  key={row.id}
                  className="tour-spec-row flex items-start gap-3.5 py-3.5 lg:gap-4 lg:py-4"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <span className={cn("mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full border lg:size-11", ui.iconRing)}>
                    {row.icon}
                  </span>
                  <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] items-start gap-2 lg:gap-4">
                    <p className={cn("pt-2 text-sm lg:text-base", ui.muted)}>{row.label}</p>
                    <div className="min-w-0 text-right lg:text-left">
                      <p className={cn("text-sm font-semibold break-words lg:text-lg", ui.text)}>
                        {row.value}
                      </p>
                      {row.hint ? (
                        <p className={cn("mt-0.5 text-xs leading-snug break-words lg:text-sm", ui.muted)}>
                          {row.hint}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        )}

        {!isForm ? (
        <div className={cn("shrink-0 border-t px-5 pt-4 pb-5 sm:px-6 lg:hidden", ui.hairline)}>
          <button
            type="button"
            data-apply-cta
            onClick={() => switchView("form")}
            disabled={!canApply}
            className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#E31E2D] px-4 text-sm font-bold text-white shadow-[0_10px_28px_rgba(227,30,45,0.28)] transition hover:bg-[#c41926] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6B4A] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            <MessageSquare className="size-4" strokeWidth={2.2} />
            {canApply ? "Ajukan Minat Sewa" : "Ruang belum tersedia"}
          </button>
        </div>
        ) : null}
      </div>

    </div>
  );
}
