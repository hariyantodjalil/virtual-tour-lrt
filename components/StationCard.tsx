import Image from "next/image";
import Link from "next/link";
import { getStationImage } from "@/lib/station-images";

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
  location?: string | null;
  dailyPassengers: number;
  spaceStats?: SpaceStats;
  order: number;
  imageUrl?: string | null;
};

export default function StationCard({
  name,
  slug,
  address,
  location,
  order,
  imageUrl,
}: StationCardProps) {
  const image = imageUrl || getStationImage(slug, order);
  const areaLabel = location?.trim() || address;

  return (
    <Link
      href={`/station/${slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(16,24,40,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(196,18,48,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d32f2f]"
    >
      <div className="relative aspect-[200/176] w-full overflow-hidden">
        <Image
          src={image}
          alt={`Stasiun ${name}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 200px"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
      </div>

      <div className="flex items-center justify-between gap-3 border border-t-0 border-[#f3f4f6] px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold leading-5 text-[#101828]">{name}</h3>
          <p className="mt-0.5 truncate text-xs leading-4 text-[#6a7282]">{areaLabel}</p>
        </div>

        <span
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[#c41230] transition group-hover:scale-110"
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/icon-arrow.svg" alt="" width={14} height={14} className="size-3.5" />
        </span>
      </div>
    </Link>
  );
}
