"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import CommercialSpaceCard from "@/components/commercial/CommercialSpaceCard";
import CommercialSpacesBrowseModal from "@/components/commercial/CommercialSpacesBrowseModal";
import {
  FAVORITES_UPDATED_EVENT,
  isFavoriteSpace,
  toggleFavoriteSpace,
} from "@/lib/favorite-spaces";

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

export type StationFilterOption = {
  slug: string;
  name: string;
  order: number;
};

const FILTERS = [
  { value: "all", label: "Semua" },
  { value: "KIOS", label: "Kios" },
  { value: "RUKO", label: "Ruko" },
  { value: "ATM", label: "ATM" },
  { value: "VENDING", label: "Vending machine" },
  { value: "MEDIA_IKLAN", label: "Iklan" },
  { value: "AREA_PROMOSI", label: "Area Promosi" },
] as const;

const PREVIEW_LIMIT = 10;

const STATUS_ORDER: Record<string, number> = {
  TERSEDIA: 0,
  RESERVED: 1,
  FIT_OUT: 2,
  MAINTENANCE: 3,
  TERISI: 4,
};

function sortByAvailability(spaces: SpaceListing[]): SpaceListing[] {
  return [...spaces].sort((a, b) => {
    const orderA = STATUS_ORDER[a.status] ?? 99;
    const orderB = STATUS_ORDER[b.status] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    if (a.stationOrder !== b.stationOrder) return a.stationOrder - b.stationOrder;
    return (a.code || a.name).localeCompare(b.code || b.name, "id");
  });
}

function buildPreview(spaces: SpaceListing[]): SpaceListing[] {
  const sorted = sortByAvailability(spaces);
  const available = sorted.filter((s) => s.status !== "TERISI");
  const pool = available.length > 0 ? available : sorted;
  return pool.slice(0, PREVIEW_LIMIT);
}

export default function CommercialSpaceGrid({
  spaces,
  stations,
  totalSpaces,
  totalStations,
}: {
  spaces: SpaceListing[];
  stations: StationFilterOption[];
  totalSpaces: number;
  totalStations: number;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [stationFilter, setStationFilter] = useState("all");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [browseOpen, setBrowseOpen] = useState(false);

  useEffect(() => {
    function refreshFavorites() {
      setFavoriteIds(new Set(spaces.filter((s) => isFavoriteSpace(s.id)).map((s) => s.id)));
    }
    refreshFavorites();
    window.addEventListener(FAVORITES_UPDATED_EVENT, refreshFavorites);
    return () => window.removeEventListener(FAVORITES_UPDATED_EVENT, refreshFavorites);
  }, [spaces]);

  const filtered = useMemo(() => {
    let list = spaces;
    if (stationFilter !== "all") {
      list = list.filter((s) => s.stationSlug === stationFilter);
    }
    if (filter !== "all") {
      list = list.filter((s) => s.type === filter);
    }
    return list;
  }, [spaces, filter, stationFilter]);

  const sortedFiltered = useMemo(() => sortByAvailability(filtered), [filtered]);
  const preview = useMemo(() => buildPreview(filtered), [filtered]);
  const hasMore = sortedFiltered.length > preview.length;

  function handleFavorite(e: React.MouseEvent, space: SpaceListing) {
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
            <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-[#d32f2f] sm:size-14">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/landing/icons/business.svg"
                alt=""
                width={22}
                height={26}
                className="size-5 sm:size-6"
              />
            </span>
            <p className="min-w-0 text-sm leading-snug font-semibold text-[#101828] sm:text-[15px]">
              <span className="text-[#d32f2f]">{totalStations}</span> Stasiun LRT Jabodebek
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-auto sm:min-w-[220px]">
          <label htmlFor="station-filter" className="sr-only">
            Filter stasiun
          </label>
          <select
            id="station-filter"
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="h-9 w-full appearance-none rounded-full border border-white/80 bg-white py-0 pr-9 pl-4 text-xs font-medium text-[#d32f2f] shadow-sm transition hover:bg-white/95 focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            <option value="all">Semua Stasiun</option>
            {stations.map((st) => (
              <option key={st.slug} value={st.slug}>
                {st.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[#d32f2f]"
            aria-hidden
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => {
            const active = filter === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`inline-flex h-9 items-center rounded-full px-4 text-xs font-medium transition ${
                  active
                    ? "bg-[#b71c1c] text-white shadow-sm"
                    : "border border-white/80 bg-white text-[#d32f2f] hover:bg-white/95"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {preview.length > 0 ? (
        <>
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {preview.map((space) => (
              <CommercialSpaceCard
                key={space.id}
                space={space}
                favorited={favoriteIds.has(space.id)}
                onFavorite={handleFavorite}
              />
            ))}
          </div>

          {hasMore && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setBrowseOpen(true)}
                className="inline-flex h-11 items-center rounded-full border border-white/80 bg-white px-6 text-sm font-semibold text-[#d32f2f] shadow-sm transition hover:bg-white/95"
              >
                Lihat semua area komersial
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="mt-8 rounded-2xl border border-dashed border-white/30 px-6 py-10 text-center text-sm text-white/80">
          Tidak ada unit untuk filter ini
          {stationFilter !== "all"
            ? ` di ${stations.find((s) => s.slug === stationFilter)?.name ?? "stasiun terpilih"}`
            : ""}
          .
        </p>
      )}

      <CommercialSpacesBrowseModal
        open={browseOpen}
        onClose={() => setBrowseOpen(false)}
        spaces={sortedFiltered}
        stations={stations}
        filter={filter}
        stationFilter={stationFilter}
        favoriteIds={favoriteIds}
        onFavorite={handleFavorite}
        totalCount={sortedFiltered.length}
      />
    </div>
  );
}
