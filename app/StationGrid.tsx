"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import StationCard from "@/components/StationCard";

type StationData = {
  id: string;
  name: string;
  slug: string;
  line: string;
  address: string;
  location?: string | null;
  dailyPassengers: number;
  order: number;
  imageUrl?: string | null;
  spaceStats: { total: number; available: number; occupied: number };
};

export default function StationGrid({ stations }: { stations: StationData[] }) {
  const [search, setSearch] = useState("");

  const filtered = stations.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.address.toLowerCase().includes(q) ||
      (s.location?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div>
      <div className="mb-8 max-w-md">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#6a7282]" />
          <input
            placeholder="Cari stasiun atau area..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-xl border border-[#e5e7eb] bg-white pl-9 pr-4 text-sm text-[#101828] placeholder:text-[#9ca3af] outline-none transition focus:border-[#d32f2f] focus:ring-2 focus:ring-[#d32f2f]/20"
          />
        </div>
      </div>

      {search && (
        <p className="mb-4 text-sm text-[#6a7282]">
          Menampilkan {filtered.length} dari {stations.length} stasiun
        </p>
      )}

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((station) => (
            <StationCard key={station.id} {...station} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-[#d1d5db] bg-white px-6 py-12 text-center text-sm text-[#6a7282]">
          Tidak ada stasiun yang cocok dengan pencarian.
        </p>
      )}
    </div>
  );
}
