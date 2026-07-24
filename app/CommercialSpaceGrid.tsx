"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getStationImage } from "@/lib/station-images";

export type SpaceListing = {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  stationName: string;
  stationSlug: string;
  stationOrder: number;
};

const FILTERS = [
  { value: "all", label: "Semua", icon: "/brand/landing/icons/filter-semua.svg" },
  { value: "KIOS", label: "Kios", icon: "/brand/landing/icons/filter-kios.svg" },
  { value: "VENDING", label: "Vending machine", icon: "/brand/landing/icons/filter-vending.svg" },
  { value: "MEDIA_IKLAN", label: "Iklan", icon: "/brand/landing/icons/filter-iklan.svg" },
] as const;

const TYPE_LABEL: Record<string, string> = {
  KIOS: "Tenant",
  RUKO: "Ruko",
  ATM: "ATM",
  VENDING: "Vending",
  MEDIA_IKLAN: "Iklan",
  AREA_PROMOSI: "Promosi",
};

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

  const filtered = useMemo(() => {
    if (filter === "all") return spaces;
    return spaces.filter((s) => s.type === filter);
  }, [spaces, filter]);

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

        {/* Stats — kartu putih sesuai Figma update */}
        <div className="flex w-full max-w-[565px] shrink-0 items-center gap-4 rounded-xl bg-white px-5 py-4 shadow-sm sm:gap-6 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="relative size-[56px] shrink-0 overflow-hidden rounded-full sm:size-[70px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/landing/icons/stats-spaces.png"
                alt=""
                className="size-full object-contain"
              />
            </span>
            <div className="min-w-0">
              <p className="font-display text-2xl font-bold leading-none text-[#d32f2f] sm:text-[32px]">
                {totalSpaces}+
              </p>
              <p className="mt-1 text-sm font-bold text-black sm:text-[16px]">Area Komersial</p>
              <p className="text-[13px] text-black/80">yang tersedia</p>
            </div>
          </div>

          <div className="h-[75px] w-px shrink-0 bg-[#d32f2f]/40" aria-hidden />

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="relative size-[56px] shrink-0 overflow-hidden rounded-full sm:size-[70px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/landing/icons/stats-spaces.png"
                alt=""
                className="size-full object-contain"
              />
            </span>
            <div className="min-w-0">
              <p className="font-display text-2xl font-bold leading-none text-[#d32f2f] sm:text-[32px]">
                {totalStations}
              </p>
              <p className="mt-1 text-sm font-bold text-black sm:text-[16px]">Stasiun</p>
              <p className="text-[13px] text-black/80">LRT Jabodebek</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((item) => {
          const active = filter === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`inline-flex h-[29px] items-center gap-2 rounded-[5px] px-4 text-xs font-medium transition ${
                active
                  ? "border border-white bg-transparent text-white"
                  : "bg-[#f8f8f8] text-black hover:bg-white"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.icon}
                alt=""
                width={16}
                height={16}
                className={`size-4 object-contain ${active ? "brightness-0 invert" : ""}`}
              />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((space) => {
          const available = space.status === "TERSEDIA";
          return (
            <Link
              key={space.id}
              href={`/station/${space.stationSlug}`}
              className="group overflow-hidden rounded-2xl bg-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="relative aspect-[200/176] overflow-hidden">
                <Image
                  src={getStationImage(space.stationSlug, space.stationOrder)}
                  alt={`${space.name} di ${space.stationName}`}
                  fill
                  sizes="(max-width: 640px) 100vw, 25vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold text-white ${
                      available ? "bg-[#00cc00]" : "bg-[#d32f2f]"
                    }`}
                  >
                    {available ? "Tersedia" : "Terisi"}
                  </span>
                  <span className="rounded-full bg-[#00cc00]/90 px-2.5 py-0.5 text-[9px] font-bold text-white">
                    {TYPE_LABEL[space.type] ?? space.type}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 border border-t-0 border-[#f3f4f6] px-4 py-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-[#101828]">
                    {space.code || space.name}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-[#6a7282]">Stasiun {space.stationName}</p>
                </div>
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[#c41230]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/brand/landing/icons/card-arrow.svg"
                    alt=""
                    width={14}
                    height={14}
                    className="size-3.5"
                  />
                </span>
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
