"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
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

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stations.map((station) => (
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
        </div>
      </div>
    </div>,
    document.body
  );
}
