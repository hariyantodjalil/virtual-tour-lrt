"use client";

import { useState } from "react";
import StationTourClient from "./StationTourClient";
import { formatNumber } from "@/lib/utils";
import { MapPin, Search, ChevronRight, Store, MoveRight, Users, Eye } from "lucide-react";
import type { CommercialSpace } from "@prisma/client";
import type { StationInfo } from "@/lib/stations-data";

type StationSummary = {
  id: string;
  name: string;
  slug: string;
  line: string;
  dailyPassengers: number;
  spaces: CommercialSpace[];
};

interface Props {
  stations: StationSummary[];
  tourDataMap: Record<string, StationInfo>;
}

export default function RetailLookbookClient({ stations = [], tourDataMap = {} }: Props) {
  const initialSlug = stations && stations.length > 0 ? stations[0].slug : "";
  const [activeSlug, setActiveSlug] = useState(initialSlug);
  const [search, setSearch] = useState("");

  // State for immersive 360 mode
  const [isImmersiveTour, setIsImmersiveTour] = useState(false);

  const activeStation = (stations || []).find((s) => s.slug === activeSlug);
  const activeTourData = activeSlug ? tourDataMap[activeSlug] : null;

  const filteredStations = (stations || []).filter(s =>
    s.name && s.name.toLowerCase().includes(search.toLowerCase())
  );

  // If immersive mode is active, take over the entire screen!
  if (isImmersiveTour && activeTourData) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col w-full h-full bg-black animate-in fade-in duration-500">
        <div className="absolute top-5 left-5 z-[60] pointer-events-auto">
           <button
             onClick={() => setIsImmersiveTour(false)}
             className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-900 font-bold text-xs uppercase tracking-widest rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.2)] hover:bg-gray-100 transition-all hover:scale-105"
           >
             <span className="w-2 h-2 rounded-full bg-[#E31E2D] animate-pulse" />
             KEMBALI KE DIREKTORI
           </button>
        </div>
        <StationTourClient stationInfo={activeTourData} spaces={activeStation?.spaces || []} />
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen bg-[#F0F2F5] text-slate-900 font-sans overflow-hidden">

      {/* ── LEFT PANE: STATION DIRECTORY ── */}
      <div className="w-[340px] bg-white shadow-[8px_0_30px_rgba(0,0,0,0.03)] flex flex-col z-20 relative">

        {/* Premium Brand Header */}
        <div className="p-8 pb-6 bg-white relative z-10 border-b border-gray-100">
          <div className="flex items-center gap-4 mb-6">
            <img src="/logo-lrt-red.png" alt="Logo LRT" className="h-10 w-auto object-contain" />
            <div className="flex flex-col border-l-2 border-gray-200 pl-4 py-0.5">
              <span className="text-[10px] font-black tracking-[0.15em] text-[#E31E2D] uppercase leading-none mb-1.5">Virtual Tour</span>
              <span className="text-sm font-bold text-slate-900 tracking-tight leading-none">LRT Jabodebek</span>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari stasiun..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F4F6F8] border border-transparent rounded-2xl pl-11 pr-4 py-3.5 text-sm text-slate-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-[#E31E2D] focus:ring-4 focus:ring-red-500/10 transition-all font-medium"
            />
          </div>
        </div>

        {/* Elegant Station List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2 custom-scrollbar">
          {filteredStations.map((station) => {
            const isActive = activeSlug === station.slug;
            const availCount = station.spaces ? station.spaces.filter(s => s.status === "TERSEDIA").length : 0;

            return (
              <button
                key={station.id}
                onClick={() => setActiveSlug(station.slug)}
                className={`w-full text-left px-5 py-4 rounded-2xl transition-all duration-300 flex flex-col gap-2 relative overflow-hidden ${
                  isActive
                    ? "bg-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.15)] scale-[1.02]"
                    : "bg-white border border-gray-100 hover:border-gray-300 hover:shadow-md"
                }`}
              >
                {isActive && <div className="absolute top-0 left-0 w-1 h-full bg-[#E31E2D]" />}
                <div className="flex justify-between items-center w-full">
                  <span className={`text-[15px] font-bold ${isActive ? "text-white" : "text-slate-800"}`}>
                    {station.name}
                  </span>
                  {isActive && <ChevronRight className="h-4 w-4 text-white/50" />}
                </div>
                <div className="flex justify-between items-center w-full text-[11px] font-semibold">
                  <span className={isActive ? "text-slate-400 uppercase tracking-widest" : "text-gray-400 uppercase tracking-widest"}>
                    {station.line}
                  </span>
                  {availCount > 0 && (
                    <span className={`px-2 py-0.5 rounded-full ${isActive ? "bg-emerald-500/20 text-emerald-300" : "text-emerald-600 bg-emerald-50"}`}>
                      {availCount} Unit Tersedia
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT PANE: THE LOOKBOOK ── */}
      <div className="flex-1 flex flex-col bg-[#F0F2F5] relative overflow-y-auto custom-scrollbar">

        {activeStation ? (
          <div className="w-full relative z-10 pb-20">

            {/* ── STUNNING HERO SECTION ── */}
            <div className="relative w-full h-[450px] bg-slate-900 flex items-end justify-center pt-20 pb-16 px-12 overflow-hidden">
              {/* Generated Architectural Background */}
              <div
                className="absolute inset-0 opacity-40 bg-cover bg-center mix-blend-luminosity"
                style={{ backgroundImage: "url('/station_hero_bg.png')" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#F0F2F5] via-[#F0F2F5]/80 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent mix-blend-overlay" />

              <div className="relative z-10 max-w-6xl w-full flex justify-between items-end">
                <div>
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/80 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-slate-900 mb-4 shadow-sm">
                    <MapPin className="h-3 w-3 text-[#E31E2D]" />
                    {activeStation.line}
                  </div>
                  <h1 className="text-6xl lg:text-[80px] font-black text-slate-900 tracking-tighter leading-[0.9]">
                    {activeStation.name}
                  </h1>
                </div>

                {/* 360 Action Button */}
                {activeTourData && (
                  <button
                    onClick={() => setIsImmersiveTour(true)}
                    className="group flex items-center gap-5 bg-white/90 backdrop-blur-xl border border-white/40 text-slate-900 px-8 py-5 rounded-3xl hover:bg-white hover:scale-105 transition-all duration-300 shadow-[0_20px_50px_rgba(0,0,0,0.1)] hover:shadow-[0_20px_50px_rgba(227,30,45,0.15)]"
                  >
                    <div className="flex flex-col text-left">
                      <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">Pintu Masuk</span>
                      <span className="text-base font-black">Virtual Tour 360°</span>
                    </div>
                    <div className="w-12 h-12 bg-[#E31E2D] rounded-full flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(227,30,45,0.4)]">
                      <Eye className="h-5 w-5" />
                    </div>
                  </button>
                )}
              </div>
            </div>

            <div className="max-w-6xl mx-auto w-full px-12 -mt-8 relative z-20">
              {/* Floating Glassmorphism Metrics */}
              <div className="flex gap-4 mb-16">
                <div className="bg-white/70 backdrop-blur-xl border border-white p-6 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.04)] min-w-[200px]">
                  <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                    <Users className="h-3 w-3 text-[#E31E2D]" /> Footfall Harian
                  </div>
                  <div className="text-4xl font-black text-slate-900">{formatNumber(activeStation.dailyPassengers)}</div>
                </div>
                <div className="bg-white/70 backdrop-blur-xl border border-white p-6 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.04)] min-w-[200px]">
                  <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                    <Store className="h-3 w-3 text-[#E31E2D]" /> Total Unit
                  </div>
                  <div className="text-4xl font-black text-slate-900">{activeStation.spaces ? activeStation.spaces.length : 0}</div>
                </div>
              </div>

              {/* ── RETAIL CATALOG GRID ── */}
              <div>
                <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-4">
                  Katalog Ruang Komersial
                  <div className="flex-1 h-px bg-gray-200" />
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                  {(!activeStation.spaces || activeStation.spaces.length === 0) ? (
                    <div className="col-span-full py-24 text-center bg-white/50 border-2 border-dashed border-gray-200 rounded-[40px]">
                      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Store className="h-6 w-6 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-bold text-lg">Belum ada ruang ritel yang dipublikasikan.</p>
                    </div>
                  ) : (
                    activeStation.spaces.map((space) => {
                      const isAvail = space.status === "TERSEDIA";
                      return (
                        <div
                          key={space.id}
                          className="bg-white rounded-[32px] overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.03)] border border-gray-100 hover:shadow-[0_20px_60px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 flex flex-col group cursor-pointer"
                          onClick={() => {
                             if(activeTourData) setIsImmersiveTour(true);
                          }}
                        >
                          {/* Property Card Cover (Abstract Gradient) */}
                          <div className={`h-32 w-full p-5 flex items-start justify-between relative overflow-hidden ${
                            isAvail ? "bg-gradient-to-br from-emerald-50 to-emerald-100/50" : "bg-gradient-to-br from-gray-50 to-gray-100"
                          }`}>
                            <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/40 rounded-full blur-2xl" />
                            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase shadow-sm backdrop-blur-md ${
                              isAvail ? "bg-emerald-500 text-white" : "bg-white text-gray-500"
                            }`}>
                              {space.status}
                            </div>
                            <span className="font-mono text-xs font-bold text-slate-400 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-sm">
                              {space.code || `UNIT-${space.id.slice(0,4)}`}
                            </span>
                          </div>

                          {/* Card Content */}
                          <div className="p-6 relative">
                            <h4 className="text-2xl font-black text-slate-900 mb-2 group-hover:text-[#E31E2D] transition-colors leading-tight">
                              {space.name}
                            </h4>
                            <div className="text-sm font-bold text-slate-500 mb-8 flex items-center gap-3">
                              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Lantai {space.floor || "G"}</span>
                              <div className="w-1 h-1 rounded-full bg-gray-300" />
                              <span>{space.area} m²</span>
                            </div>

                            <div className="pt-5 border-t border-gray-100 flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Estimasi Sewa</span>
                                {isAvail ? (
                                  <span className="text-xl font-black text-slate-900">
                                    Rp {space.monthlyRent.toLocaleString('id-ID')}
                                  </span>
                                ) : (
                                  <span className="text-xl font-black text-gray-300">Hubungi Kami</span>
                                )}
                              </div>
                              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-[#E31E2D] group-hover:text-white transition-colors text-slate-400">
                                <MoveRight className="h-4 w-4" />
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-24 h-24 bg-white shadow-xl rounded-full flex items-center justify-center mb-6">
              <Store className="h-10 w-10 text-gray-300" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-2">Pilih Stasiun LRT</h2>
            <p className="text-gray-500 font-medium">Jelajahi portofolio ruang ritel premium kami.</p>
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
      `}</style>
    </div>
  );
}
