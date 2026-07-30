"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Home,
  MapPin,
  Maximize2,
  TrainFront,
} from "lucide-react";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import type { SpaceAvailabilityStatus } from "@/lib/space-availability";

type SpaceItem = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: SpaceAvailabilityStatus;
  panoramaUrl?: string | null;
  tenantBrand?: string | null;
};

type Props = {
  open: boolean;
  onToggle: () => void;
  stationName: string;
  spaces: SpaceItem[];
  typeLabels: Record<string, string>;
  onPickStation: () => void;
  onSelectSpace: (space: SpaceItem) => void;
  onViewAll: () => void;
  /** Tombol clear UI — ditaruh di bawah mini map */
  clearUiControl?: ReactNode;
};

const STATUS_BADGE: Record<SpaceItem["status"], string> = {
  TERSEDIA: "bg-[#ec4899] text-white",
  RESERVED: "bg-indigo-500 text-white",
  FIT_OUT: "bg-violet-500 text-white",
  TERISI: "bg-[#E31E2D] text-white",
  MAINTENANCE: "bg-amber-500 text-white",
};

const STATUS_LABEL: Record<SpaceItem["status"], string> = {
  TERSEDIA: "TERSEDIA",
  RESERVED: "RSV",
  FIT_OUT: "FIT-OUT",
  TERISI: "TERISI",
  MAINTENANCE: "MTN",
};

function coverSrc(url?: string | null) {
  if (!url) return "/brand/landing/space-card.jpg";
  if (url.startsWith("http") || url.startsWith("/api/") || url.startsWith("data:")) return url;
  return getS3ProxyUrl(url);
}

/**
 * Panel kiri virtual tour — kartu maroon mengambang di atas background merah.
 */
export default function TourLeftPanel({
  open,
  onToggle,
  stationName,
  spaces,
  typeLabels,
  onPickStation,
  onSelectSpace,
  onViewAll,
  clearUiControl,
}: Props) {
  const nearby = [...spaces]
    .sort((a, b) => {
      if (a.status === "TERSEDIA" && b.status !== "TERSEDIA") return -1;
      if (b.status === "TERSEDIA" && a.status !== "TERSEDIA") return 1;
      return a.code.localeCompare(b.code);
    })
    .slice(0, 3);

  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 z-[58] flex items-stretch">
      {open ? (
        <div className="tour-panel-in pointer-events-auto flex h-full w-[min(100vw,260px)] flex-col gap-1.5 overflow-y-auto bg-transparent p-2 [scrollbar-width:none] sm:w-[280px] sm:p-2.5 [&::-webkit-scrollbar]:hidden">
          {/* Home + Pilih Stasiun */}
          <div className="flex items-center gap-1.5">
            <Link
              href="/"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-black/60 text-white shadow-md backdrop-blur-sm transition hover:brightness-110"
              aria-label="Beranda"
            >
              <Home className="size-3.5" strokeWidth={2.25} />
            </Link>
            <button
              type="button"
              onClick={onPickStation}
              className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-full bg-black/60 px-3 text-left text-xs font-semibold text-white shadow-md backdrop-blur-sm transition hover:brightness-110"
            >
              <TrainFront className="size-3.5 shrink-0 opacity-90" />
              <span className="flex-1 truncate font-display">Pilih Stasiun</span>
            </button>
          </div>

          {/* Lokasi Saat Ini */}
          <section className="rounded-xl bg-black/60 px-3 py-2.5 shadow-md backdrop-blur-sm">
            <div className="flex items-center gap-1.5 text-white">
              <MapPin className="size-3.5 shrink-0" strokeWidth={2.25} />
              <p className="text-xs font-medium">Lokasi Saat Ini</p>
            </div>
            <div className="mt-1.5 border-t border-white/25 pt-1.5">
              <p className="font-display text-xl leading-none font-bold text-white">
                {stationName}
              </p>
            </div>
          </section>

          {/* Informasi Tenant Terdekat */}
          <section className="rounded-xl bg-black/60 p-2.5 shadow-md backdrop-blur-sm">
            <div className="mb-1.5 border-b border-white/25 pb-1.5">
              <h2 className="font-display text-xs font-bold text-white">
                Informasi Tenant Terdekat
              </h2>
            </div>

            <ul className="mt-2 space-y-1.5">
              {nearby.map((space) => (
                <li key={space.id}>
                  <button
                    type="button"
                    onClick={() => onSelectSpace(space)}
                    className="flex w-full items-center gap-2 rounded-lg bg-[#E31E2D]/85 p-1.5 text-left transition hover:brightness-110"
                  >
                    <div className="relative size-9 shrink-0 overflow-hidden rounded-md bg-[#3a3a3a]">
                      <Image
                        src={coverSrc(space.panoramaUrl)}
                        alt=""
                        fill
                        sizes="36px"
                        className="object-cover"
                        unoptimized={
                          Boolean(space.panoramaUrl?.startsWith("http")) ||
                          Boolean(space.panoramaUrl?.includes("/api/"))
                        }
                      />
                      <span
                        className={`absolute top-0.5 left-0.5 rounded px-1 py-px text-[6px] font-bold tracking-wide ${STATUS_BADGE[space.status]}`}
                      >
                        {STATUS_LABEL[space.status]}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 truncate text-[11px] font-bold text-white">
                        <MapPin className="size-2.5 shrink-0 text-white" />
                        {space.status === "TERISI" && space.tenantBrand
                          ? space.tenantBrand
                          : space.name}
                      </p>
                      <p className="mt-0.5 truncate text-[9px] text-white/75">
                        {space.status === "TERISI" && space.tenantBrand
                          ? `${space.code} · ${space.name}`
                          : typeLabels[space.type] ?? space.type}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
              {nearby.length === 0 && (
                <p className="py-2 text-center text-[10px] text-white/70">
                  Belum ada unit di stasiun ini.
                </p>
              )}
            </ul>

            <button
              type="button"
              onClick={onViewAll}
              className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-full bg-[#E31E2D] text-[11px] font-semibold text-white transition hover:brightness-110"
            >
              <Building2 className="size-3" />
              Lihat semua Tenant
            </button>
          </section>

          {/* Mini Map */}
          <section className="rounded-xl bg-black/60 p-2.5 shadow-md backdrop-blur-sm">
            <div className="mb-1.5 flex items-center justify-between">
              <h2 className="font-display text-xs font-bold text-white">Mini Map</h2>
              <button
                type="button"
                onClick={onViewAll}
                className="rounded-md p-0.5 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Lihat semua unit di denah"
                title="Lihat semua unit"
              >
                <Maximize2 className="size-3.5" />
              </button>
            </div>

            <div className="overflow-hidden rounded-lg bg-[#d4d4d4] p-1.5">
              <svg viewBox="0 0 240 100" className="h-auto w-full" aria-hidden>
                <line
                  x1="80"
                  y1="6"
                  x2="80"
                  y2="94"
                  stroke="#111"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <line
                  x1="160"
                  y1="6"
                  x2="160"
                  y2="94"
                  stroke="#111"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <rect x="18" y="16" width="48" height="36" rx="6" fill="#2563eb" />
                <rect x="174" y="16" width="48" height="36" rx="6" fill="#2563eb" />
                <rect x="22" y="68" width="18" height="8" rx="2" fill="#2563eb" />
                <rect x="44" y="68" width="18" height="8" rx="2" fill="#2563eb" />
                <rect x="174" y="68" width="18" height="8" rx="2" fill="#2563eb" />
                <rect x="196" y="68" width="18" height="8" rx="2" fill="#2563eb" />
                <circle cx="120" cy="22" r="5" fill="#E31E2D" />
                <circle cx="120" cy="80" r="5" fill="#2563eb" />
                <circle cx="200" cy="84" r="5" fill="#22c55e" />
              </svg>
            </div>
          </section>

          {clearUiControl ? (
            <div className="pointer-events-auto flex justify-start pt-0.5">
              {clearUiControl}
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onToggle}
        className="pointer-events-auto my-auto ml-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm transition hover:brightness-110"
        aria-label={open ? "Sembunyikan panel" : "Tampilkan panel"}
        aria-expanded={open}
      >
        {open ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}
      </button>
    </div>
  );
}
