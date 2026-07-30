"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, MapPin, Train } from "lucide-react";
import { getStationImage } from "@/lib/station-images";
import {
  FAVORITES_UPDATED_EVENT,
  isFavoriteSpace,
  toggleFavoriteSpace,
} from "@/lib/favorite-spaces";
import { formatRupiah } from "@/lib/utils";

export type SpaceListing = {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  area: number;
  monthlyRent: number;
  stationName: string;
  stationSlug: string;
  stationOrder: number;
  stationLine: string;
  tenantBrand?: string | null;
};

const FILTERS = [
  { value: "all", label: "Semua", icon: "/brand/landing/icons/filter-semua.svg" },
  { value: "KIOS", label: "Kios", icon: "/brand/landing/icons/filter-kios.svg" },
  { value: "RUKO", label: "Ruko", icon: "/brand/landing/icons/filter-ruko.svg" },
  { value: "ATM", label: "ATM", icon: "/brand/landing/icons/filter-atm.svg" },
  { value: "VENDING", label: "Vending machine", icon: "/brand/landing/icons/filter-vending.svg" },
  { value: "MEDIA_IKLAN", label: "Iklan", icon: "/brand/landing/icons/filter-iklan.svg" },
  { value: "AREA_PROMOSI", label: "Area Promosi", icon: "/brand/landing/icons/filter-promosi.svg" },
] as const;

const TYPE_META: Record<string, { label: string; className: string }> = {
  KIOS: { label: "Kios", className: "bg-[#f97316]" },
  RUKO: { label: "Ruko", className: "bg-[#3b82f6]" },
  ATM: { label: "ATM", className: "bg-[#06b6d4]" },
  VENDING: { label: "Vending", className: "bg-[#8b5cf6]" },
  MEDIA_IKLAN: { label: "Iklan", className: "bg-[#ec4899]" },
  AREA_PROMOSI: { label: "Area Promosi", className: "bg-[#14b8a6]" },
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  TERSEDIA: { label: "Tersedia", className: "bg-[#22c55e]" },
  RESERVED: { label: "Reserved", className: "bg-[#6366f1]" },
  FIT_OUT: { label: "Fit-Out", className: "bg-[#8b5cf6]" },
  TERISI: { label: "Terisi", className: "bg-[#d32f2f]" },
  MAINTENANCE: { label: "Maintenance", className: "bg-[#f59e0b]" },
};

function lineLabel(line: string): string {
  const trimmed = line.trim() || "Jabodebek";
  return /line/i.test(trimmed) ? trimmed : `${trimmed} Line`;
}

function priceLabel(monthlyRent: number): string {
  if (monthlyRent > 0) return formatRupiah(monthlyRent);
  return "Hubungi tim";
}

export default function CommercialSpaceGrid({
  spaces,
  totalSpaces,
  totalStations,
}: {
  spaces: SpaceListing[];
  totalSpaces: number;
  totalStations: number;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    function refreshFavorites() {
      setFavoriteIds(new Set(spaces.filter((s) => isFavoriteSpace(s.id)).map((s) => s.id)));
    }
    refreshFavorites();
    window.addEventListener(FAVORITES_UPDATED_EVENT, refreshFavorites);
    return () => window.removeEventListener(FAVORITES_UPDATED_EVENT, refreshFavorites);
  }, [spaces]);

  const filtered = useMemo(() => {
    if (filter === "all") return spaces;
    return spaces.filter((s) => s.type === filter);
  }, [spaces, filter]);

  function handleFavorite(
    e: React.MouseEvent,
    space: SpaceListing
  ) {
    e.preventDefault();
    e.stopPropagation();
    toggleFavoriteSpace({
      spaceId: space.id,
      code: space.code,
      name: space.name,
      type: space.type,
      status: space.status,
      area: space.area,
      monthlyRent: space.monthlyRent,
      stationSlug: space.stationSlug,
      stationName: space.stationName,
    });
  }

  return (
    <div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
        <div className="min-w-0 max-w-xl flex-1">
          <h2 className="font-display text-2xl font-bold leading-tight text-white md:text-[24px]">
            Temukan Area Komersial yang Sesuai dengan Kebutuhan Anda
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/90 md:mt-4 md:text-[15px]">
            Jelajahi berbagai pilihan area komersial dan media promosi yang tersedia di stasiun LRT
            Jabodebek. Temukan lokasi yang tepat untuk mendukung kebutuhan bisnis dan promosi Anda.
          </p>
        </div>

        <div className="flex w-full max-w-[565px] shrink-0 flex-col gap-3 sm:flex-row sm:gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-white px-4 py-3.5 shadow-sm">
            <span className="relative size-12 shrink-0 overflow-hidden rounded-full sm:size-14">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/landing/icons/stats-spaces.png"
                alt=""
                className="size-full object-contain"
              />
            </span>
            <p className="min-w-0 text-sm leading-snug font-semibold text-[#101828] sm:text-[15px]">
              <span className="text-[#d32f2f]">{totalSpaces}+</span> Area Komersial yang tersedia
            </p>
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-white px-4 py-3.5 shadow-sm">
            <span className="relative size-12 shrink-0 overflow-hidden rounded-full sm:size-14">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/landing/icons/stats-spaces.png"
                alt=""
                className="size-full object-contain"
              />
            </span>
            <p className="min-w-0 text-sm leading-snug font-semibold text-[#101828] sm:text-[15px]">
              <span className="text-[#d32f2f]">{totalStations}</span> Stasiun LRT Jabodebek
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2.5">
        {FILTERS.map((item) => {
          const active = filter === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-xs font-medium transition ${
                active
                  ? "bg-[#b71c1c] text-white shadow-sm"
                  : "border border-white/80 bg-white text-[#d32f2f] hover:bg-white/95"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.icon}
                alt=""
                width={16}
                height={16}
                className={`size-4 object-contain ${
                  active ? "brightness-0 invert" : "[filter:invert(18%)_sepia(90%)_saturate(2500%)_hue-rotate(340deg)]"
                }`}
              />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((space) => {
          const occupiedTenant =
            space.status === "TERISI" ? space.tenantBrand?.trim() : "";
          const statusMeta = STATUS_META[space.status] ?? {
            label: space.status,
            className: "bg-[#64748b]",
          };
          const typeMeta = TYPE_META[space.type] ?? {
            label: space.type,
            className: "bg-[#64748b]",
          };
          const favorited = favoriteIds.has(space.id);

          return (
            <Link
              key={space.id}
              href={`/station/${space.stationSlug}?unit=${space.id}`}
              className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(16,24,40,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(16,24,40,0.14)]"
            >
              <div className="relative aspect-[16/11] overflow-hidden">
                <Image
                  src={getStationImage(space.stationSlug, space.stationOrder)}
                  alt={`${space.name} di ${space.stationName}`}
                  fill
                  sizes="(max-width: 640px) 100vw, 25vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />

                <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white ${statusMeta.className}`}
                  >
                    {statusMeta.label}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white ${typeMeta.className}`}
                  >
                    {typeMeta.label}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleFavorite(e, space)}
                  aria-label={favorited ? "Hapus dari favorit" : "Tambah ke favorit"}
                  className="absolute top-2.5 right-2.5 inline-flex size-8 items-center justify-center rounded-full bg-white/90 text-[#98a2b3] shadow-sm transition hover:text-[#d32f2f]"
                >
                  <Heart
                    className={`size-4 ${favorited ? "fill-[#d32f2f] text-[#d32f2f]" : ""}`}
                    strokeWidth={2}
                  />
                </button>
              </div>

              <div className="flex flex-1 flex-col gap-2 px-3.5 pt-3 pb-3.5">
                <h3 className="truncate text-[15px] font-bold text-[#101828]">
                  {occupiedTenant || space.code || space.name}
                </h3>
                {occupiedTenant && (
                  <p className="-mt-1 truncate text-[10px] font-medium text-[#98a2b3]">
                    Unit {space.code} · {space.name}
                  </p>
                )}

                <p className="flex items-center gap-1.5 truncate text-xs text-[#667085]">
                  <MapPin className="size-3.5 shrink-0 text-[#d32f2f]" strokeWidth={2.25} />
                  <span className="truncate">Stasiun {space.stationName}</span>
                </p>

                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#fce8eb] px-2.5 py-1 text-[11px] font-medium text-[#d32f2f]">
                  <Train className="size-3.5 shrink-0" strokeWidth={2.25} />
                  {lineLabel(space.stationLine)}
                </span>

                <div className="mt-auto flex items-end justify-between gap-2 border-t border-[#f2f4f7] pt-3">
                  <div className="min-w-0">
                    <p className="text-[10px] text-[#98a2b3]">Luas Area</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-[#101828]">
                      <span
                        className="inline-block size-3.5 shrink-0 rounded-[2px] border border-dashed border-[#98a2b3]"
                        aria-hidden
                      />
                      {space.area > 0 ? `${space.area} m²` : "-"}
                    </p>
                  </div>

                  <div className="min-w-0 text-left">
                    <p className="text-[10px] text-[#98a2b3]">Harga</p>
                    <p className="mt-0.5 text-sm leading-tight font-bold text-[#d32f2f]">
                      {priceLabel(space.monthlyRent)}
                      {space.monthlyRent > 0 ? (
                        <span className="font-normal text-[#98a2b3]"> /bulan</span>
                      ) : null}
                    </p>
                  </div>

                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#D81435] transition group-hover:bg-[#B8112D]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/brand/landing/icons/card-arrow.svg"
                      alt=""
                      width={16}
                      height={16}
                      className="size-4"
                    />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="mt-8 rounded-2xl border border-dashed border-white/30 px-6 py-10 text-center text-sm text-white/80">
          Tidak ada unit untuk filter ini.
        </p>
      )}
    </div>
  );
}
