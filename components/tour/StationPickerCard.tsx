import Image from "next/image";
import { MapPin, Train } from "lucide-react";
import { getStationImage } from "@/lib/station-images";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import type { StationPickerItem } from "@/components/tour/StationPickerModal";
import { splitStationLocation, stationLineLabel } from "@/lib/station-picker-utils";

type Props = {
  station: StationPickerItem;
  active?: boolean;
  variant?: "light" | "dark";
  className?: string;
};

export default function StationPickerCard({
  station,
  active = false,
  variant = "light",
  className = "",
}: Props) {
  const { area, city } = splitStationLocation(station);
  const isDark = variant === "dark";

  return (
    <article
      className={`group flex w-full flex-col overflow-hidden rounded-2xl text-left transition ${
        isDark
          ? `border border-white/15 bg-black/40 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm hover:border-[#d32f2f]/60 hover:bg-black/50 ${
              active ? "ring-2 ring-[#ff6b6b]" : ""
            }`
          : `bg-white shadow-[0_2px_12px_rgba(16,24,40,0.08)] hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(16,24,40,0.14)] ${
              active ? "ring-2 ring-[#D81435]" : ""
            }`
      } ${className}`}
    >
      <span className="relative block h-[140px] w-full shrink-0 overflow-hidden sm:h-[150px]">
        <Image
          src={
            station.imageUrl
              ? getS3ProxyUrl(station.imageUrl)
              : getStationImage(station.slug, station.order)
          }
          alt={`Stasiun ${station.name}`}
          fill
          sizes="(max-width: 640px) 100vw, 320px"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        {isDark ? (
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        ) : null}
      </span>

      <span className={`flex flex-1 flex-col gap-2.5 px-3.5 pt-3 pb-3.5 ${isDark ? "text-white" : ""}`}>
        <span
          className={`block text-[15px] font-bold leading-snug ${isDark ? "text-white" : "text-[#101828]"}`}
        >
          {station.name}
        </span>

        <span
          className={`flex items-start gap-1.5 text-[11px] leading-4 ${
            isDark ? "text-white/70" : "text-[#667085]"
          }`}
        >
          <MapPin
            className={`mt-0.5 size-3.5 shrink-0 ${isDark ? "text-[#ff8a8a]" : "text-[#D81435]"}`}
            strokeWidth={2.25}
          />
          <span className="min-w-0">
            <span className="block truncate">{area}</span>
            {city ? <span className="block truncate">{city}</span> : null}
          </span>
        </span>

        <span
          className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
            isDark ? "bg-emerald-500/15 text-emerald-300" : "bg-[#e8f5e9] text-[#2e7d32]"
          }`}
        >
          <Train className="size-3.5 shrink-0" strokeWidth={2.25} />
          {stationLineLabel(station.line)}
        </span>

        <span className="mt-auto flex items-end justify-end gap-2 pt-1">
          <span
            className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full transition ${
              isDark
                ? "bg-[#d32f2f] group-hover:bg-[#b71c1c]"
                : "bg-[#D81435] group-hover:bg-[#B8112D]"
            }`}
          >
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
    </article>
  );
}
