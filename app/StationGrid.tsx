"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import StationCard from "@/components/StationCard";
import { Input } from "@/components/ui/input";

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
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Cari stasiun atau area..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-900/40 border-white/5 text-slate-100 placeholder:text-slate-500 focus-visible:ring-red-500/30 focus-visible:border-red-500"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
          {[
            { value: "all", label: "Semua Stasiun" },
            { value: "available", label: "Kios Tersedia" },
            { value: "occupied", label: "Penuh" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value as typeof filter)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                filter === opt.value
                  ? "bg-red-600 text-white shadow-md shadow-red-500/20"
                  : "bg-slate-900/40 text-slate-300 border border-white/5 hover:border-white/10 hover:bg-slate-800/40"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      {search && (
        <p className="text-sm text-gray-500 mb-4">
          Menampilkan {filtered.length} dari {stations.length} stasiun
        </p>
      )}

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((station) => (
            <StationCard key={station.id} {...station} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg font-medium">Stasiun tidak ditemukan</p>
          <p className="text-gray-400 text-sm mt-1">Coba kata kunci lain</p>
        </div>
      )}
    </div>
  );
}
