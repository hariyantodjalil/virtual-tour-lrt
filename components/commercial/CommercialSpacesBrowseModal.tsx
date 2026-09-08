"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { SpaceListing, StationFilterOption } from "@/app/CommercialSpaceGrid";
import CommercialSpaceCard from "./CommercialSpaceCard";

type FilterValue =
  | "all"
  | "KIOS"
  | "RUKO"
  | "ATM"
  | "VENDING"
  | "MEDIA_IKLAN"
  | "AREA_PROMOSI";

type Props = {
  open: boolean;
  onClose: () => void;
  spaces: SpaceListing[];
  stations: StationFilterOption[];
  filter: FilterValue;
  stationFilter: string;
  favoriteIds: Set<string>;
  onFavorite: (e: React.MouseEvent, space: SpaceListing) => void;
  totalCount: number;
};

export default function CommercialSpacesBrowseModal({
  open,
  onClose,
  spaces,
  stations,
  filter,
  stationFilter,
  favoriteIds,
  onFavorite,
  totalCount,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [open, filter, stationFilter]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const stationName =
    stationFilter !== "all"
      ? stations.find((s) => s.slug === stationFilter)?.name
      : null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-label="Tutup daftar area komersial"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="browse-spaces-title"
        className="relative z-10 flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-[#f3f4f6] shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 bg-[#7a1424] px-5 py-3.5 text-white">
          <div className="min-w-0">
            <h2 id="browse-spaces-title" className="font-display text-lg font-bold md:text-xl">
              Semua Area Komersial
            </h2>
            <p className="mt-0.5 text-xs text-white/80">
              {totalCount} unit
              {stationName ? ` · ${stationName}` : " · semua stasiun"}
              {filter !== "all" ? ` · filter aktif` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-1.5 transition hover:bg-white/10"
            aria-label="Tutup"
          >
            <X className="size-6" strokeWidth={2.5} />
          </button>
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
        >
          {spaces.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {spaces.map((space) => (
                <CommercialSpaceCard
                  key={space.id}
                  space={space}
                  favorited={favoriteIds.has(space.id)}
                  onFavorite={onFavorite}
                />
              ))}
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-[#667085]">
              Tidak ada unit untuk filter yang dipilih.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
