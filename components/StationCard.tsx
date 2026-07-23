import Link from "next/link";
import { ArrowUpRight, Users } from "lucide-react";
import { formatNumber } from "@/lib/utils";

type SpaceStats = {
  total: number;
  available: number;
  occupied: number;
};

type StationCardProps = {
  name: string;
  slug: string;
  line: string;
  address: string;
  dailyPassengers: number;
  spaceStats?: SpaceStats;
  order: number;
};

export default function StationCard({
  name,
  slug,
  line,
  address,
  dailyPassengers,
  spaceStats,
  order,
}: StationCardProps) {
  const availableCount = spaceStats?.available ?? 0;
  const hasAvailable = availableCount > 0;

  return (
    <Link
      href={`/station/${slug}`}
      className="group relative flex aspect-[5/4] flex-col justify-between overflow-hidden rounded-3xl border border-[color:rgb(255_214_218_/_0.14)] bg-[#3A161C] p-7 transition duration-500 hover:border-[#E31E2D]/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 transition group-hover:scale-110">
          <ArrowUpRight className="h-5 w-5 -rotate-45 text-white" />
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 font-display text-xs font-medium text-white/50">
          {String(order).padStart(2, "0")}
        </span>
      </div>

      <div>
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
          {line}
        </p>
        <h3 className="mt-2 font-display text-3xl font-semibold leading-none tracking-tight text-white">
          {name}
        </h3>
        <p className="mt-3 line-clamp-1 text-sm text-white/40">{address}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-5 text-sm text-white/45">
        {hasAvailable ? (
          <span className="inline-flex items-center gap-1.5 text-[#34d399]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#34d399]" />
            {availableCount} tersedia
          </span>
        ) : (
          <span>Penuh</span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-[#E31E2D]" />
          {formatNumber(dailyPassengers)}/hari
        </span>
        {spaceStats && <span>{spaceStats.total} unit</span>}
        <span className="ml-auto font-display text-sm font-semibold text-white transition group-hover:text-[#E31E2D]">
          Masuk tour
        </span>
      </div>
    </Link>
  );
}
