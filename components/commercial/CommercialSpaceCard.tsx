"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, MapPin, Train } from "lucide-react";
import { getStationImage } from "@/lib/station-images";
import type { SpaceListing } from "@/app/CommercialSpaceGrid";

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

type Props = {
  space: SpaceListing;
  favorited: boolean;
  onFavorite: (e: React.MouseEvent, space: SpaceListing) => void;
};

export default function CommercialSpaceCard({ space, favorited, onFavorite }: Props) {
  const occupiedTenant = space.status === "TERISI" ? space.tenantBrand?.trim() : "";
  const statusMeta = STATUS_META[space.status] ?? {
    label: space.status,
    className: "bg-[#64748b]",
  };
  const typeMeta = TYPE_META[space.type] ?? {
    label: space.type,
    className: "bg-[#64748b]",
  };

  return (
    <Link
      href={`/station/${space.stationSlug}?unit=${space.id}`}
      className="group flex flex-col overflow-hidden rounded-xl bg-white shadow-[0_2px_12px_rgba(16,24,40,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(16,24,40,0.14)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={getStationImage(space.stationSlug, space.stationOrder)}
          alt={`${space.name} di ${space.stationName}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 33vw, 20vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />

        <div className="absolute top-2 left-2 flex max-w-[calc(100%-2.5rem)] flex-wrap gap-1">
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold text-white ${statusMeta.className}`}
          >
            {statusMeta.label}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold text-white ${typeMeta.className}`}
          >
            {typeMeta.label}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => onFavorite(e, space)}
          aria-label={favorited ? "Hapus dari favorit" : "Tambah ke favorit"}
          className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-full bg-white/90 text-[#98a2b3] shadow-sm transition hover:text-[#d32f2f]"
        >
          <Heart
            className={`size-3.5 ${favorited ? "fill-[#d32f2f] text-[#d32f2f]" : ""}`}
            strokeWidth={2}
          />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-3 pt-2.5 pb-3">
        <h3 className="truncate text-[13px] font-bold leading-tight text-[#101828]">
          {occupiedTenant || space.code || space.name}
        </h3>
        {occupiedTenant && (
          <p className="-mt-0.5 truncate text-[9px] font-medium text-[#98a2b3]">
            Unit {space.code} · {space.name}
          </p>
        )}

        <p className="flex items-center gap-1 truncate text-[10px] text-[#667085]">
          <MapPin className="size-3 shrink-0 text-[#d32f2f]" strokeWidth={2.25} />
          <span className="truncate">Stasiun {space.stationName}</span>
        </p>

        <span className="inline-flex w-fit max-w-full items-center gap-1 rounded-full bg-[#fce8eb] px-2 py-0.5 text-[9px] font-medium text-[#d32f2f]">
          <Train className="size-3 shrink-0" strokeWidth={2.25} />
          <span className="truncate">{lineLabel(space.stationLine)}</span>
        </span>

        <div className="mt-auto flex items-end justify-between gap-1.5 border-t border-[#f2f4f7] pt-2">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] text-[#98a2b3]">Luas Area</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-[#101828]">
              <span
                className="inline-block size-3 shrink-0 rounded-[2px] border border-dashed border-[#98a2b3]"
                aria-hidden
              />
              {space.area > 0 ? `${space.area} m²` : "-"}
            </p>
          </div>

          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[#D81435] transition group-hover:bg-[#B8112D]">
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
      </div>
    </Link>
  );
}
