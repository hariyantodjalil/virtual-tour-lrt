"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { getStationImage } from "@/lib/station-images";

export type StationPickerItem = {
  slug: string;
  name: string;
  order: number;
  line: string;
};

type Props = {
  stations: StationPickerItem[];
  currentSlug: string;
  onSelect: (slug: string) => void;
  onClose: () => void;
};

/** Fixed size Figma 234:7240 — isi grid yang di-scroll */
const MODAL_W = 752;
const MODAL_H = 674;
const HEADER_H = 64;

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
        className="relative z-10 overflow-hidden rounded-[15px] bg-[rgba(0,0,0,0.6)] shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-sm"
        style={{
          width: `min(100%, ${MODAL_W}px)`,
          height: `min(90dvh, ${MODAL_H}px)`,
        }}
      >
        <div
          className="absolute inset-x-0 top-0 z-10 flex items-center justify-center px-4"
          style={{ height: HEADER_H }}
        >
          <h2
            id="pilih-stasiun-title"
            className="font-display text-xl font-bold text-white md:text-2xl"
          >
            Pilih Stasiun
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-1/2 right-4 -translate-y-1/2 rounded-full p-1 text-white transition hover:bg-white/10"
            aria-label="Tutup"
          >
            <X className="size-7" strokeWidth={2.5} />
          </button>
        </div>

        <div
          ref={scrollRef}
          className="absolute inset-x-0 bottom-0 overflow-y-auto overscroll-contain px-6 pb-5 sm:px-12"
          style={{ top: HEADER_H }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stations.map((station) => {
              const active = station.slug === currentSlug;
              return (
                <button
                  key={station.slug}
                  type="button"
                  onClick={() => onSelect(station.slug)}
                  className={`group flex w-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-md transition hover:-translate-y-0.5 hover:shadow-lg ${
                    active ? "ring-2 ring-[#c41230]" : ""
                  }`}
                >
                  <span className="relative block h-[160px] w-full shrink-0 overflow-hidden sm:h-[176px]">
                    <Image
                      src={getStationImage(station.slug, station.order)}
                      alt={`Stasiun ${station.name}`}
                      fill
                      sizes="220px"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                  </span>

                  <span className="flex items-center justify-between gap-2 border border-t-0 border-[#f3f4f6] px-4 py-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[#101828]">
                        {station.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[#6a7282]">
                        {station.line || "LRT Jabodebek"}
                      </span>
                    </span>
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[#c41230] transition group-hover:bg-[#a01028]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/brand/landing/icons/card-arrow.svg"
                        alt=""
                        width={14}
                        height={14}
                        className="size-3.5"
                      />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {stations.length === 0 && (
            <p className="py-10 text-center text-sm text-white/70">
              Belum ada stasiun dengan virtual tour.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
