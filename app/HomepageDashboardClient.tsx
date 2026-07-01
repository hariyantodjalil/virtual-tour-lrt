"use client";

import { useState } from "react";
import { 
  Building2, MapPin, 
  Search, ShieldAlert, ArrowLeftRight, HelpCircle
} from "lucide-react";
import VirtualTourViewer from "@/components/tour/VirtualTourViewer";
import InTourSpacePopup from "@/components/tour/InTourSpacePopup";
import Navbar from "@/components/Navbar";
import { formatRupiah } from "@/lib/utils";
import type { Hotspot } from "@/lib/tour-types";

type Space = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: "TERSEDIA" | "TERISI" | "MAINTENANCE";
  area: number;
  monthlyRent: number;
  deposit: number;
  floor: string;
  location: string;
  nearestExit: string | null;
  exposure: number;
  powerSupply: string | null;
  waterAccess: boolean;
  airConditioning: boolean;
  description: string | null;
};

type Scene = {
  id: string;
  title: string;
  panoramaUrl: string;
  hotspots: Hotspot[];
};

type StationWithDetails = {
  id: string;
  name: string;
  slug: string;
  line: string;
  address: string;
  dailyPassengers: number;
  order: number;
  description: string | null;
  scenes: Scene[];
  spaces: Space[];
};

interface Props {
  stations: StationWithDetails[];
}

const STATUS_COLOR_DARK: Record<Space["status"], string> = {
  TERSEDIA: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  TERISI: "text-slate-500 bg-white/[0.03] border-white/5",
  MAINTENANCE: "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

const STATUS_COLOR_LIGHT: Record<Space["status"], string> = {
  TERSEDIA: "text-emerald-700 bg-emerald-50 border-emerald-100",
  TERISI: "text-slate-400 bg-slate-100 border-slate-200/50",
  MAINTENANCE: "text-amber-700 bg-amber-50 border-amber-100",
};

export default function HomepageDashboardClient({ stations }: Props) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [activeStationIdx, setActiveStationIdx] = useState(0);
  const [activeSceneId, setActiveSceneId] = useState(() => stations[0]?.scenes[0]?.id ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLine, setFilterLine] = useState<"all" | "Bekasi" | "Cibubur">("all");
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  
  // HUD collapse state
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  const activeStation = stations[activeStationIdx];
  const isDark = theme === "dark";

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Filter stations
  const filteredStations = stations.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.address.toLowerCase().includes(searchQuery.toLowerCase());
    
    const isCibubur = s.order >= 9 && s.order <= 12;
    const isBekasi = s.order >= 13 && s.order <= 18;
    const isCore = s.order >= 1 && s.order <= 8;

    if (filterLine === "Bekasi") {
      return matchesSearch && (isBekasi || isCore);
    }
    if (filterLine === "Cibubur") {
      return matchesSearch && (isCibubur || isCore);
    }
    return matchesSearch;
  });

  const availableCount = activeStation?.spaces.filter((s) => s.status === "TERSEDIA").length ?? 0;
  const totalCount = activeStation?.spaces.length ?? 0;
  
  const handleSpaceClick = (spaceCode: string) => {
    const space = activeStation?.spaces.find((s) => s.code === spaceCode);
    if (space) {
      setSelectedSpace(space);
    }
  };

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden relative transition-colors duration-300 ${
      isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
    }`}>
      
      {/* ── NAVBAR (Floating Capsule Header) ── */}
      <Navbar variant={theme} onToggleTheme={toggleTheme} />

      {/* ── MAIN DASHBOARD VIEWPORT (Full-Screen VR Underneath) ── */}
      <div className="absolute inset-0 w-full h-full z-0">
        {activeStation && activeStation.scenes.length > 0 ? (
          <VirtualTourViewer
            key={`${activeStation.id}-${activeSceneId}`}
            scenes={activeStation.scenes.map((sc) => ({
              id: sc.id,
              title: sc.title,
              panoramaUrl: sc.panoramaUrl,
              hotspots: sc.hotspots,
            }))}
            stationName={activeStation.name}
            selectedSceneId={activeSceneId}
            onSceneChange={setActiveSceneId}
            onSpaceClick={handleSpaceClick}
            hideSceneBar={isPanelCollapsed}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white">
            <ShieldAlert className="h-10 w-10 text-red-500 mb-2 animate-bounce" />
            <p className="font-semibold text-sm">Tidak ada panorama yang tersedia di stasiun ini</p>
          </div>
        )}
      </div>

      {/* ── 1. LEFT PANEL: Station Command (Floating absolute sidebar) ── */}
      <div 
        className={`absolute left-4 top-1/2 -translate-y-1/2 z-20 w-80 md:w-88 h-[80vh] flex flex-col transition-all duration-500 ease-in-out ${
          isPanelCollapsed ? "-translate-x-[110%] opacity-0" : "translate-x-0 opacity-100"
        }`}
      >
        <div className={`flex-1 rounded-3xl border shadow-2xl p-5 flex flex-col overflow-hidden transition-all duration-300 ${
          isDark ? "bg-slate-950/60 border-white/5 backdrop-blur-xl text-white" : "bg-white/70 border-slate-200/50 backdrop-blur-xl text-slate-900"
        }`}>
          {/* Header */}
          <div className="mb-4 shrink-0">
            <h3 className={`text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 ${
              isDark ? "text-slate-500" : "text-slate-400"
            }`}>
              <MapPin className="h-3.5 w-3.5 text-red-500" />
              STATION COMMAND
            </h3>
          </div>

          {/* Search & Segmented Filter Control */}
          <div className="space-y-3 mb-5 shrink-0">
            <div className="relative">
              <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`} />
              <input
                type="text"
                placeholder="Cari stasiun..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full h-8 pl-8 rounded-lg text-xs outline-none border transition-all ${
                  isDark 
                    ? "bg-white/[0.03] border-white/5 text-white placeholder:text-slate-500 focus:border-white/10" 
                    : "bg-slate-100/60 border-slate-200/60 text-slate-900 placeholder:text-slate-400 focus:border-slate-300/80"
                }`}
              />
            </div>
            
            {/* Segmented Control Layout */}
            <div className={`p-0.5 rounded-lg flex border ${
              isDark ? "bg-white/[0.02] border-white/5" : "bg-slate-100/60 border-slate-200/60"
            }`}>
              {(["all", "Bekasi", "Cibubur"] as const).map((line) => (
                <button
                  key={line}
                  onClick={() => setFilterLine(line)}
                  className={`flex-1 h-7 rounded-md text-[9px] font-bold uppercase transition-all cursor-pointer ${
                    filterLine === line 
                      ? isDark
                        ? "bg-white/[0.08] text-white shadow-sm border border-white/5"
                        : "bg-white text-slate-900 shadow-sm border border-slate-200/30" 
                      : isDark
                        ? "text-slate-400 hover:text-slate-200"
                        : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {line === "all" ? "Semua" : line}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable list (Minimal flat rows) */}
          <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 scrollbar-none">
            {filteredStations.map((s) => {
              const isActive = s.slug === activeStation?.slug;
              const idx = stations.findIndex((st) => st.slug === s.slug);
              const freeCount = s.spaces.filter((sp) => sp.status === "TERSEDIA").length;

              const isCibubur = s.order >= 9 && s.order <= 12;
              const isBekasi = s.order >= 13 && s.order <= 18;
              const lineDotColor = isBekasi 
                ? "bg-rose-500" 
                : isCibubur 
                  ? "bg-blue-400" 
                  : "bg-emerald-400";

              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveStationIdx(idx);
                    setActiveSceneId(s.scenes[0]?.id ?? "");
                    setSelectedSpace(null);
                  }}
                  className={`w-full py-2 px-3 pl-6 rounded-lg transition-all flex items-center justify-between text-left cursor-pointer relative group ${
                    isActive 
                      ? isDark
                        ? "bg-white/[0.06] text-white font-bold"
                        : "bg-slate-100/80 text-slate-950 font-bold"
                      : isDark
                        ? "text-slate-400 hover:text-slate-200 hover:bg-white/[0.01]"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/30"
                  }`}
                >
                  {/* Selection Indicator Accent */}
                  {isActive && (
                    <span className="absolute left-2.5 top-2.5 bottom-2.5 w-0.5 rounded-full bg-red-500" />
                  )}

                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${lineDotColor}`} />
                    <span className="text-xs">{s.name}</span>
                  </div>
                  
                  <span className={`text-[9px] font-mono ${
                    freeCount > 0 
                      ? "text-emerald-500 font-bold"
                      : "text-slate-600"
                  }`}>
                    {freeCount > 0 ? `${freeCount} Kios` : "Full"}
                  </span>
                </button>
              );
            })}
            {filteredStations.length === 0 && (
              <div className="text-center py-10">
                <HelpCircle className={`h-6 w-6 mx-auto mb-2 animate-pulse ${isDark ? "text-slate-600" : "text-slate-400"}`} />
                <p className="text-[10px] font-bold text-slate-400">Stasiun tidak ditemukan</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. HUD CONTROL WIDGET: Station indicator overlay ── */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none w-full max-w-xs px-4">
        <div className={`pointer-events-auto flex items-center justify-between rounded-full border p-1.5 px-4 backdrop-blur-md shadow-2xl ${
          isDark 
            ? "border-white/10 bg-slate-950/80 text-white" 
            : "border-slate-200 bg-white/95 text-slate-900"
        }`}>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider">
              {activeStation?.name}
            </span>
          </div>

          <button
            onClick={() => setIsPanelCollapsed((prev) => !prev)}
            className={`flex h-7 items-center gap-1 rounded-full border px-3 text-[9px] font-extrabold uppercase tracking-wider transition-colors cursor-pointer ${
              isDark 
                ? "bg-white/5 border-white/10 text-white hover:bg-white/10" 
                : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <ArrowLeftRight className="h-3 w-3" />
            <span>{isPanelCollapsed ? "Panel" : "Full VR"}</span>
          </button>
        </div>
      </div>

      {/* ── 3. RIGHT PANEL: Commercial Hub (Floating absolute sidebar) ── */}
      <div 
        className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 w-80 md:w-88 h-[80vh] flex flex-col transition-all duration-500 ease-in-out ${
          isPanelCollapsed ? "translate-x-[110%] opacity-0" : "translate-x-0 opacity-100"
        }`}
      >
        <div className={`flex-1 rounded-3xl border shadow-2xl p-5 flex flex-col overflow-hidden transition-all duration-300 ${
          isDark ? "bg-slate-950/60 border-white/5 backdrop-blur-xl text-white" : "bg-white/70 border-slate-200/50 backdrop-blur-xl text-slate-900"
        }`}>
          {/* Header */}
          <div className="mb-4 shrink-0">
            <h3 className={`text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 ${
              isDark ? "text-slate-500" : "text-slate-400"
            }`}>
              <Building2 className="h-4 w-4 text-blue-500" />
              COMMERCIAL UNITS
            </h3>
          </div>

          {/* Quick Info Station - Flat Header design */}
          <div className={`pb-4 mb-4 text-xs space-y-2 shrink-0 border-b ${
            isDark ? "border-white/5" : "border-slate-150"
          }`}>
            <div className="flex items-center justify-between">
              <span className={isDark ? "text-slate-500 font-semibold" : "text-slate-500 font-bold"}>Okupansi Kios</span>
              <span className={`font-extrabold ${isDark ? "text-white" : "text-slate-950"}`}>{totalCount > 0 ? Math.round(((totalCount - availableCount) / totalCount) * 100) : 0}%</span>
            </div>
            <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/5" : "bg-slate-200"}`}>
              <div 
                className="h-full bg-red-600 rounded-full transition-all duration-500" 
                style={{ width: `${totalCount > 0 ? ((totalCount - availableCount) / totalCount) * 100 : 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[9px] font-bold text-slate-500">
              <span>{totalCount - availableCount} Terisi</span>
              <span>{availableCount} Tersedia dari {totalCount} Unit</span>
            </div>
          </div>

          {/* Scrollable list of spaces (Flat SaaS list rows) */}
          <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 scrollbar-none">
            {activeStation?.spaces.map((space) => {
              const isSelected = selectedSpace?.id === space.id;
              
              return (
                <button
                  key={space.id}
                  onClick={() => setSelectedSpace(space)}
                  className={`w-full py-2.5 px-3.5 pl-6 rounded-lg transition-all flex items-center justify-between text-left cursor-pointer border-b relative group ${
                    isDark ? "border-white/5" : "border-slate-100"
                  } ${
                    isSelected
                      ? isDark
                        ? "bg-white/[0.06] border-blue-500/30 shadow-lg shadow-blue-500/5 text-white font-bold"
                        : "bg-slate-100/80 text-slate-900 font-bold"
                      : isDark
                        ? "text-slate-400 hover:text-slate-200 hover:bg-white/[0.01]"
                        : "text-slate-600 hover:text-slate-950 hover:bg-slate-100/30"
                  }`}
                >
                  {/* Selection Indicator Accent */}
                  {isSelected && (
                    <span className="absolute left-2.5 top-2.5 bottom-2.5 w-0.5 rounded-full bg-blue-500" />
                  )}

                  <div className="flex flex-col gap-0.5">
                    <span className={`text-xs font-semibold ${
                      isSelected 
                        ? isDark ? "text-white" : "text-slate-900" 
                        : isDark ? "text-slate-300" : "text-slate-700"
                    }`}>{space.name}</span>
                    <span className="font-mono text-[9px] text-slate-500">{space.code} · {space.area} m²</span>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-extrabold text-emerald-500">{formatRupiah(space.monthlyRent)}/bln</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider uppercase border ${
                      isDark ? STATUS_COLOR_DARK[space.status] : STATUS_COLOR_LIGHT[space.status]
                    }`}>
                      {space.status}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── SPACE DETAIL DIALOG OVERLAY ── */}
      {selectedSpace && activeStation && (
        <InTourSpacePopup
          key={selectedSpace.id}
          space={selectedSpace}
          stationName={activeStation.name}
          onClose={() => setSelectedSpace(null)}
        />
      )}
    </div>
  );
}
