"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import StationPickerCard from "@/components/tour/StationPickerCard";

export type StationPickerItem = {
  slug: string;
  name: string;
  order: number;
  line: string;
  address?: string;
  location?: string | null;
  dailyPassengers?: number;
  imageUrl?: string | null;
};

type Props = {
  stations: StationPickerItem[];
  currentSlug: string;
  onSelect: (slug: string) => void;
  onClose: () => void;
};

const MODAL_W = 920;
const MODAL_H = 720;
const HEADER_H = 56;

export default function StationPickerModal({
  stations,
  currentSlug,
  onSelect,
  onClose,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const search = query.trim().toLocaleLowerCase("id-ID");
  const filteredStations = stations.filter(station =>
    station.name.toLocaleLowerCase("id-ID").includes(search)
  );

  function updateSearch(value: string) {
    setQuery(value);
    scrollRef.current?.scrollTo({ top: 0 });
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-label="Tutup pilih stasiun"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pilih-stasiun-title"
        className="relative z-10 flex flex-col overflow-hidden rounded-2xl bg-[#f3f4f6] shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
        style={{
          width: `min(100%, ${MODAL_W}px)`,
          height: `min(92dvh, ${MODAL_H}px)`,
        }}
      >
        <div
          className="flex shrink-0 items-center justify-between bg-[#7a1424] px-5 text-white"
          style={{ height: HEADER_H }}
        >
          <h2 id="pilih-stasiun-title" className="font-display text-lg font-bold md:text-xl">
            Pilih Stasiun
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-white transition hover:bg-white/10"
            aria-label="Tutup"
          >
            <X className="size-6" strokeWidth={2.5} />
          </button>
        </div>

        <div className="shrink-0 px-4 pt-4 sm:px-5">
          <label htmlFor="station-picker-search" className="sr-only">Cari stasiun</label>
          <div className="flex items-center rounded-xl border border-slate-300 bg-white px-3 focus-within:border-[#7a1424] focus-within:ring-2 focus-within:ring-[#7a1424]/20">
            <Search aria-hidden="true" className="size-5 shrink-0 text-slate-500" />
            <input
              ref={searchRef}
              id="station-picker-search"
              type="search"
              autoComplete="off"
              placeholder="Cari stasiun…"
              value={query}
              onChange={event => updateSearch(event.target.value)}
              className="h-11 min-w-0 flex-1 bg-transparent px-3 text-base text-slate-900 outline-none placeholder:text-slate-500 [&::-webkit-search-cancel-button]:appearance-none"
            />
            {query && <button type="button" aria-label="Hapus pencarian" onClick={() => { updateSearch(""); searchRef.current?.focus(); }} className="flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[#7a1424]"><X aria-hidden="true" className="size-4" /></button>}
          </div>
          <p role="status" aria-atomic="true" className="sr-only">{filteredStations.length} stasiun ditemukan</p>
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredStations.map((station) => (
              <button
                key={station.slug}
                type="button"
                onClick={() => onSelect(station.slug)}
                className="text-left"
              >
                <StationPickerCard
                  station={station}
                  active={station.slug === currentSlug}
                  variant="light"
                />
              </button>
            ))}
          </div>

          {stations.length === 0 && (
            <p className="py-10 text-center text-sm text-[#667085]">
              Belum ada stasiun dengan virtual tour.
            </p>
          )}
          {stations.length > 0 && filteredStations.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-600">Stasiun tidak ditemukan.</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
