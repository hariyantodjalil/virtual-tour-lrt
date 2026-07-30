"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";
import Image from "next/image";
import { MapPin, Train, Users, X } from "lucide-react";
import { getStationImage } from "@/lib/station-images";

export type StationPickerItem = {
  slug: string;
  name: string;
  order: number;
  line: string;
  address?: string;
  location?: string | null;
  dailyPassengers?: number;
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

function formatPassengersPerDay(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    const label = Number.isInteger(k) ? String(k) : k.toFixed(1).replace(/\.0$/, "");
    return `${label}K / hari`;
  }
  return `${n} / hari`;
}

function splitLocation(station: StationPickerItem): { area: string; city: string } {
  const location = station.location?.trim() || "";
  const address = station.address?.trim() || "";

  if (address.includes(",")) {
    const [area, ...rest] = address.split(",").map((p) => p.trim());
    return {
      area: area || location || "LRT Jabodebek",
      city: rest.join(", ") || location || "",
    };
  }

  if (address && location && address !== location) {
    return { area: address, city: location };
  }

  return {
    area: address || location || "LRT Jabodebek",
    city: location && location !== address ? location : "",
  };
}

function lineLabel(line: string): string {
  const trimmed = line.trim() || "Jabodebek";
  return /line/i.test(trimmed) ? trimmed : `${trimmed} Line`;
}

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
            {stations.map((station) => {
              const active = station.slug === currentSlug;
              const { area, city } = splitLocation(station);
              const passengers = station.dailyPassengers ?? 0;

              return (
                <button
                  key={station.slug}
                  type="button"
                  onClick={() => onSelect(station.slug)}
                  className={`group flex w-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-[0_2px_12px_rgba(16,24,40,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(16,24,40,0.14)] ${
                    active ? "ring-2 ring-[#D81435]" : ""
                  }`}
                >
                  <span className="relative block h-[140px] w-full shrink-0 overflow-hidden sm:h-[150px]">
                    <Image
                      src={getStationImage(station.slug, station.order)}
                      alt={`Stasiun ${station.name}`}
                      fill
                      sizes="280px"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                  </span>

                  <span className="flex flex-1 flex-col gap-2.5 px-3.5 pt-3 pb-3.5">
                    <span className="block text-[15px] leading-snug font-bold text-[#101828]">
                      {station.name}
                    </span>

                    <span className="flex items-start gap-1.5 text-[11px] leading-4 text-[#667085]">
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-[#D81435]" strokeWidth={2.25} />
                      <span className="min-w-0">
                        <span className="block truncate">{area}</span>
                        {city ? <span className="block truncate">{city}</span> : null}
                      </span>
                    </span>

                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#e8f5e9] px-2.5 py-1 text-[11px] font-medium text-[#2e7d32]">
                      <Train className="size-3.5 shrink-0" strokeWidth={2.25} />
                      {lineLabel(station.line)}
                    </span>

                    <span className="mt-auto flex items-end justify-between gap-2 pt-1">
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-[10px] text-[#98a2b3]">
                          <Users className="size-3.5 shrink-0" strokeWidth={2.25} />
                          Rata-rata Penumpang
                        </span>
                        <span className="mt-0.5 block text-sm font-bold text-[#D81435]">
                          {formatPassengersPerDay(passengers)}
                        </span>
                      </span>

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
                    </span>
                  </span>
                </button>
              );
            })}
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
