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
  dailyPassengers: number;
  order: number;
  spaceStats: { total: number; available: number; occupied: number };
};

export default function StationGrid({ stations }: { stations: StationData[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "available" | "occupied">("all");

  const filtered = stations.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.address.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ||
      (filter === "available" && s.spaceStats.available > 0) ||
      (filter === "occupied" && s.spaceStats.available === 0);
    return matchSearch && matchFilter;
  });

  return (
    <div>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            placeholder="Cari stasiun atau area..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-full border border-white/10 bg-white/5 pl-9 pr-4 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-[#E31E2D]/50 focus:ring-2 focus:ring-[#E31E2D]/20"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "all", label: "Semua stasiun" },
            { value: "available", label: "Ada unit tersedia" },
            { value: "occupied", label: "Penuh" },
          ].map((opt) => {
            const active = filter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilter(opt.value as typeof filter)}
                className={`rounded-full px-4 py-2.5 font-display text-sm font-semibold transition ${
                  active
                    ? "bg-white text-black"
                    : "border border-white/10 text-white/50 hover:border-white/25 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {search && (
        <p className="mb-4 text-sm text-white/40">
          Menampilkan {filtered.length} dari {stations.length} stasiun
        </p>
      )}

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((station) => (
            <StationCard key={station.id} {...station} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-[color:rgb(255_214_218_/_0.14)] bg-[#3A161C] px-6 py-16 text-center">
          <p className="font-display text-lg font-semibold text-white">Stasiun tidak ditemukan</p>
          <p className="mt-1 text-sm text-white/40">Coba kata kunci lain atau reset filter ketersediaan.</p>
        </div>
      )}
    </div>
  );
}
