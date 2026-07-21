"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Building2, CheckCircle2, ChevronDown, ChevronRight,
  Grid3X3, Info, MapPin, Play, Route, Users, X,
} from "lucide-react";
import InTourSpacePopup from "@/components/tour/InTourSpacePopup";
import InTourAdPopup from "@/components/tour/InTourAdPopup";
import InTourInfoPopup from "@/components/tour/InTourInfoPopup";
import VirtualTourViewer from "@/components/tour/VirtualTourViewer";
import { TourNavigationBar } from "@/components/tour/TourNavigationBar";
import { formatNumber, getWhatsAppUrl } from "@/lib/utils";
import type { StationInfo } from "@/lib/stations-data";
import type { AdHotspotPayload } from "@/lib/pannellum-tour-config";
import {
  findScenePlacement,
  firstSceneIdInLevel,
  scenesForNav,
  defaultAreaForLevel,
} from "@/lib/public-tour-structure";
import { findSpaceHotspotPlacement } from "@/lib/space-hotspot-locate";

type Space = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: "TERSEDIA" | "TERISI" | "MAINTENANCE";
  area: number;
  deposit: number;
  floor: string;
  location: string;
  nearestExit: string | null;
  exposure: number;
  powerSupply: string | null;
  waterAccess: boolean;
  airConditioning: boolean;
  description: string | null;
  tenantBrand?: string | null;
};

type Props = { stationInfo: StationInfo; spaces: Space[] };

const TYPE_LABELS: Record<string, string> = {
  KIOS: "Kios", RUKO: "Ruko", ATM: "ATM",
  VENDING: "Vending", MEDIA_IKLAN: "Iklan", AREA_PROMOSI: "Promosi",
};

const STATUS_DOT: Record<Space["status"], string> = {
  TERSEDIA: "bg-emerald-400",
  TERISI: "bg-red-400",
  MAINTENANCE: "bg-amber-400",
};

function buildRoute(sceneIds: string[], from: string, to: string) {
  const fi = sceneIds.indexOf(from), ti = sceneIds.indexOf(to);
  if (fi < 0 || ti < 0) return sceneIds.slice(0, 1);
  return fi <= ti ? sceneIds.slice(fi, ti + 1) : sceneIds.slice(ti, fi + 1).reverse();
}

export default function StationTourClient({ stationInfo, spaces }: Props) {
  const initialPlacement = findScenePlacement(stationInfo.levels, stationInfo.scenes[0]?.id ?? "");
  const firstLevel = initialPlacement?.level ?? stationInfo.levels[0];
  const firstScene =
    stationInfo.scenes[0]?.id ??
    (firstLevel ? firstSceneIdInLevel(firstLevel) : undefined) ??
    "concourse";
  const lastScene = stationInfo.scenes.at(-1)?.id ?? firstScene;

  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [selectedAd, setSelectedAd] = useState<AdHotspotPayload | null>(null);
  const [infoPopup, setInfoPopup] = useState<{ title: string; description: string } | null>(null);
  const [activeSceneId, setActiveSceneId] = useState(firstScene);
  const [activeLevelId, setActiveLevelId] = useState(
    initialPlacement?.level.id ?? firstLevel?.id ?? ""
  );
  const [activeAreaId, setActiveAreaId] = useState<string | null>(
    initialPlacement?.area?.id ?? firstLevel?.areas[0]?.id ?? null
  );
  const [routeFrom, setRouteFrom] = useState(firstScene);
  const [routeTo, setRouteTo] = useState(lastScene);

  // Panel states — semua COLLAPSED by default
  const [infoOpen, setInfoOpen] = useState(false);
  const [unitsOpen, setUnitsOpen] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const [openedFromUnitsList, setOpenedFromUnitsList] = useState(false);
  const [cameraFocus, setCameraFocus] = useState<{
    yaw: number;
    pitch: number;
    hfov?: number;
  } | null>(null);
  const [focusToken, setFocusToken] = useState(0);

  const availableCount = spaces.filter((s) => s.status === "TERSEDIA").length;
  const occupiedCount = spaces.filter((s) => s.status === "TERISI").length;
  const commercialContactPhone = stationInfo.commercialContactPhone ?? "628118012012";
  const stationWaUrl = getWhatsAppUrl(
    commercialContactPhone,
    `Halo, saya tertarik dengan ruang komersial di Stasiun ${stationInfo.name}. Mohon informasi lebih lanjut.`
  );
  const sceneIds = stationInfo.scenes.map((s) => s.id);
  const navSceneIds = scenesForNav(
    stationInfo.levels,
    sceneIds,
    activeLevelId || stationInfo.levels[0]?.id,
    activeAreaId
  );
  const showTourNav = !unitsOpen && !selectedSpace && !routeOpen;

  // Sinkronkan tab level/area saat pindah scene lewat hotspot
  useEffect(() => {
    const placement = findScenePlacement(stationInfo.levels, activeSceneId);
    if (!placement) return;
    setActiveLevelId(placement.level.id);
    setActiveAreaId(placement.area?.id ?? placement.level.areas[0]?.id ?? null);
  }, [activeSceneId, stationInfo.levels]);

  function clearCameraFocus() {
    setCameraFocus(null);
    setFocusToken(0);
  }

  function selectLevel(levelId: string) {
    clearCameraFocus();
    const level = stationInfo.levels.find((l) => l.id === levelId);
    if (!level) return;
    const area = defaultAreaForLevel(level);
    const sceneId = area?.sceneIds[0] ?? firstSceneIdInLevel(level);
    setActiveLevelId(levelId);
    setActiveAreaId(area?.id ?? null);
    if (sceneId) setActiveSceneId(sceneId);
  }

  function selectArea(areaId: string) {
    clearCameraFocus();
    const level = stationInfo.levels.find((l) => l.id === activeLevelId);
    const area = level?.areas.find((a) => a.id === areaId);
    const sceneId = area?.sceneIds[0];
    setActiveAreaId(areaId);
    if (sceneId) setActiveSceneId(sceneId);
  }

  const selectedRoute = buildRoute(sceneIds, routeFrom, routeTo);
  const routeIdx = selectedRoute.indexOf(activeSceneId);
  const nextStep = routeIdx >= 0 ? selectedRoute[routeIdx + 1] : undefined;

  function handleSceneChange(sceneId: string) {
    clearCameraFocus();
    setActiveSceneId(sceneId);
  }

  function focusOnSpaceHotspot(spaceCode: string) {
    const placement = findSpaceHotspotPlacement(stationInfo.scenes, spaceCode);
    if (!placement) return;
    setActiveSceneId(placement.sceneId);
    setCameraFocus({
      yaw: placement.yaw,
      pitch: placement.pitch,
      hfov: 78,
    });
    setFocusToken(Date.now());
  }

  const openSpaceFromList = (space: Space) => {
    focusOnSpaceHotspot(space.code);
    setOpenedFromUnitsList(true);
    setSelectedSpace(space);
    setInfoOpen(false);
    setRouteOpen(false);
    setUnitsOpen(false);
  };

  const openSpaceFromHotspot = useCallback((spaceCode: string) => {
    const space = spaces.find((s) => s.code === spaceCode);
    if (space) {
      setOpenedFromUnitsList(false);
      setSelectedAd(null);
      setSelectedSpace(space);
    }
  }, [spaces]);

  const openAdFromHotspot = useCallback((payload: AdHotspotPayload) => {
    setSelectedSpace(null);
    setSelectedAd(payload);
  }, []);

  const handleInfoClick = useCallback((title: string, description: string) => {
    setInfoPopup({ title, description });
  }, []);

  const closeSpaceDetail = () => {
    setSelectedSpace(null);
    if (openedFromUnitsList) {
      clearCameraFocus();
      setUnitsOpen(true);
      setOpenedFromUnitsList(false);
    }
  };

  return (
    <div className="relative flex flex-1 overflow-hidden bg-gray-950">
      {/* ── 360° Viewer (full-bleed) ── */}
      <VirtualTourViewer
        scenes={stationInfo.scenes}
        spaces={spaces.map((s) => ({ code: s.code, status: s.status }))}
        onSpaceClick={openSpaceFromHotspot}
        onAdClick={openAdFromHotspot}
        onInfoClick={handleInfoClick}
        onSceneChange={handleSceneChange}
        selectedSceneId={activeSceneId}
        focusCamera={cameraFocus}
        focusToken={focusToken}
        stationName={stationInfo.name}
        hideSceneBar
      />

      {showTourNav && stationInfo.levels.length > 0 && (
        <TourNavigationBar
          levels={stationInfo.levels}
          scenes={stationInfo.scenes}
          activeLevelId={activeLevelId || stationInfo.levels[0].id}
          activeAreaId={activeAreaId}
          activeSceneId={activeSceneId}
          visibleSceneIds={navSceneIds}
          onSelectLevel={selectLevel}
          onSelectArea={selectArea}
          onSelectScene={handleSceneChange}
        />
      )}

      {/* subtle gradient overlay for text legibility */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(to_bottom,rgba(0,0,0,.45)_0%,transparent_30%,transparent_65%,rgba(0,0,0,.5)_100%)]" />

      {/* ── TOP BAR ── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-3 sm:px-5 sm:pt-4">
        <Link
          href="/"
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-md transition-colors hover:bg-black/70"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{stationInfo.name}</span>
        </Link>
      </div>

      {/* ── LEFT FLOATING CONTROLS ── */}
      <div className="pointer-events-none absolute left-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2 sm:left-5">
        {/* Info toggle */}
        <button
          onClick={() => { setInfoOpen((v) => !v); setRouteOpen(false); setUnitsOpen(false); }}
          className={`pointer-events-auto flex h-11 w-11 flex-col items-center justify-center rounded-2xl border shadow-lg backdrop-blur-md transition-all ${
            infoOpen
              ? "border-white/25 bg-white text-[#1B3A6B]"
              : "border-white/15 bg-black/55 text-white hover:bg-black/70"
          }`}
          title="Info Stasiun"
        >
          <Info className="h-5 w-5" />
        </button>

        {/* Route toggle */}
        {stationInfo.scenes.length > 1 && (
          <button
            onClick={() => { setRouteOpen((v) => !v); setInfoOpen(false); setUnitsOpen(false); }}
            className={`pointer-events-auto flex h-11 w-11 flex-col items-center justify-center rounded-2xl border shadow-lg backdrop-blur-md transition-all ${
              routeOpen
                ? "border-white/25 bg-white text-[#1B3A6B]"
                : "border-white/15 bg-black/55 text-white hover:bg-black/70"
            }`}
            title="Guided Route"
          >
            <Route className="h-5 w-5" />
          </button>
        )}

        {/* Units toggle */}
        <button
          onClick={() => { setUnitsOpen((v) => !v); setInfoOpen(false); setRouteOpen(false); if (unitsOpen) { setSelectedSpace(null); setOpenedFromUnitsList(false); } }}
          className={`pointer-events-auto relative flex h-11 w-11 flex-col items-center justify-center rounded-2xl border shadow-lg backdrop-blur-md transition-all ${
            unitsOpen
              ? "border-white/25 bg-white text-[#1B3A6B]"
              : "border-white/15 bg-black/55 text-white hover:bg-black/70"
          }`}
          title="Daftar Unit"
        >
          <Grid3X3 className="h-5 w-5" />
          {availableCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#E31E2D] text-[9px] font-black text-white">
              {availableCount}
            </span>
          )}
        </button>
      </div>

      {/* ── INFO PANEL (slides in from left) ── */}
      {infoOpen && !selectedSpace && (
        <div className="pointer-events-auto absolute left-16 top-1/2 z-30 w-72 -translate-y-1/2 rounded-2xl border border-white/15 bg-[#0d1f3c]/90 text-white shadow-2xl backdrop-blur-xl sm:left-20" style={{animation:"fadeSlideIn .18s ease"}}>
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h2 className="font-black">{stationInfo.name}</h2>
            <button onClick={() => setInfoOpen(false)} className="rounded-full p-1 hover:bg-white/10 transition-colors">
              <X className="h-4 w-4 text-white/60" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/8 py-2.5">
                <p className="text-base font-black text-emerald-300">{availableCount}</p>
                <p className="text-[10px] text-white/55">Tersedia</p>
              </div>
              <div className="rounded-xl bg-white/8 py-2.5">
                <p className="text-base font-black text-red-300">{occupiedCount}</p>
                <p className="text-[10px] text-white/55">Terisi</p>
              </div>
              <div className="rounded-xl bg-white/8 py-2.5">
                <p className="text-base font-black">{spaces.length}</p>
                <p className="text-[10px] text-white/55">Total</p>
              </div>
            </div>
            <div className="space-y-2 text-xs text-white/70">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/40" />
                <span>{stationInfo.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 shrink-0 text-[#ff4f5b]" />
                <span className="font-semibold text-white">{formatNumber(stationInfo.dailyPassengers)} penumpang/hari</span>
              </div>
            </div>
            {/* Occupancy bar */}
            <div>
              <div className="mb-1 flex justify-between text-[10px] text-white/50">
                <span>Tingkat hunian</span>
                <span>{spaces.length > 0 ? Math.round(occupiedCount / spaces.length * 100) : 0}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-[#E31E2D] rounded-full transition-all"
                  style={{ width: `${spaces.length > 0 ? occupiedCount / spaces.length * 100 : 0}%` }}
                />
              </div>
            </div>
            <a
              href={stationWaUrl}
              target="_blank" rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-2.5 text-xs font-black text-white hover:bg-[#1DA851] transition-colors"
            >
              Hubungi Tim Komersial
            </a>
          </div>
        </div>
      )}

      {/* ── ROUTE PANEL ── */}
      {routeOpen && !selectedSpace && stationInfo.scenes.length > 1 && (
        <div className="pointer-events-auto absolute left-16 top-1/2 z-30 w-72 -translate-y-1/2 rounded-2xl border border-white/15 bg-[#0d1f3c]/90 text-white shadow-2xl backdrop-blur-xl sm:left-20" style={{animation:"fadeSlideIn .18s ease"}}>
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-emerald-300" />
              <p className="font-black text-sm">Guided Route</p>
            </div>
            <button onClick={() => setRouteOpen(false)} className="rounded-full p-1 hover:bg-white/10 transition-colors">
              <X className="h-4 w-4 text-white/60" />
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-white/50 mb-1 block">Dari</label>
                <select
                  value={routeFrom}
                  onChange={(e) => setRouteFrom(e.target.value)}
                  className="w-full h-9 rounded-lg border border-white/10 bg-white/10 px-3 text-xs font-semibold text-white outline-none"
                >
                  {stationInfo.levels.map((level) => (
                    <optgroup key={level.id} label={level.label}>
                      {(level.areas.length > 0
                        ? level.areas.flatMap((a) =>
                            a.sceneIds.map((id) => ({ id, title: stationInfo.scenes.find((s) => s.id === id)?.title ?? id }))
                          )
                        : level.sceneIds.map((id) => ({
                            id,
                            title: stationInfo.scenes.find((s) => s.id === id)?.title ?? id,
                          }))
                      ).map((s) => (
                        <option key={s.id} value={s.id} className="bg-[#17355f]">
                          {s.title}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/50 mb-1 block">Ke</label>
                <select
                  value={routeTo}
                  onChange={(e) => setRouteTo(e.target.value)}
                  className="w-full h-9 rounded-lg border border-white/10 bg-white/10 px-3 text-xs font-semibold text-white outline-none"
                >
                  {stationInfo.levels.map((level) => (
                    <optgroup key={level.id} label={level.label}>
                      {(level.areas.length > 0
                        ? level.areas.flatMap((a) =>
                            a.sceneIds.map((id) => ({ id, title: stationInfo.scenes.find((s) => s.id === id)?.title ?? id }))
                          )
                        : level.sceneIds.map((id) => ({
                            id,
                            title: stationInfo.scenes.find((s) => s.id === id)?.title ?? id,
                          }))
                      ).map((s) => (
                        <option key={s.id} value={s.id} className="bg-[#17355f]">
                          {s.title}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={() => { handleSceneChange(routeFrom); setSelectedSpace(null); }}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 text-xs font-black text-[#0d1f3c] hover:bg-emerald-300 transition-colors"
            >
              <Play className="h-3.5 w-3.5" />
              Mulai Rute
            </button>
            <div className="space-y-1.5 pt-1">
              {selectedRoute.map((sceneId, idx) => {
                const scene = stationInfo.scenes.find((s) => s.id === sceneId);
                const isActive = sceneId === activeSceneId;
                return (
                  <button
                    key={sceneId}
                    onClick={() => handleSceneChange(sceneId)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                      isActive ? "bg-white text-[#17355f] font-bold" : "bg-white/8 text-white/70 hover:bg-white/12"
                    }`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${isActive ? "bg-[#E31E2D] text-white" : "bg-white/10 text-white/70"}`}>
                      {idx + 1}
                    </span>
                    <span>{scene?.title ?? sceneId}</span>
                    {isActive && <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {nextStep && (
              <button
                onClick={() => handleSceneChange(nextStep)}
                className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-400 text-xs font-black text-[#0d1f3c] transition-colors hover:bg-emerald-300"
              >
                Lanjut ke {stationInfo.scenes.find((s) => s.id === nextStep)?.title}
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── UNITS BOTTOM DRAWER ── */}
      {unitsOpen && !selectedSpace && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-40" style={{ animation: "slideUpIn .2s ease" }}>
          <div className="mx-3 mb-3 sm:mx-5 sm:mb-5 rounded-2xl border border-white/15 bg-[#080f1e]/90 shadow-2xl backdrop-blur-xl overflow-hidden">
            {/* Drawer header */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <Grid3X3 className="h-4 w-4 text-white/60" />
                <p className="text-sm font-black text-white">Unit Komersial</p>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/60">{spaces.length}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-emerald-400 font-semibold">{availableCount} tersedia</span>
                <button onClick={() => setUnitsOpen(false)} className="rounded-full p-1 hover:bg-white/10 transition-colors">
                  <ChevronDown className="h-4 w-4 text-white/60" />
                </button>
              </div>
            </div>
            {/* Scroll area */}
            <div className="overflow-x-auto">
              <div className="flex gap-2.5 p-3" style={{ minWidth: "max-content" }}>
                {spaces.map((space) => (
                  <button
                    key={space.id}
                    onClick={() => openSpaceFromList(space)}
                    className="w-48 shrink-0 rounded-xl border border-white/10 bg-white/5 p-3 text-left text-white transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 active:scale-[.98]"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-[11px] font-black text-white/60">{space.code}</span>
                      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[space.status]}`} />
                    </div>
                    <p className="mb-1 truncate text-sm font-bold">{space.name}</p>
                    <div className="flex items-center gap-1.5 text-[11px] text-white/50">
                      <Building2 className="h-3 w-3" />
                      <span>{TYPE_LABELS[space.type] ?? space.type}</span>
                      <span>·</span>
                      <span>{space.area} m²</span>
                    </div>
                    <p className="mt-1.5 text-xs text-white/50">{space.area} m²</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ── SPACE DETAIL POPUP ── */}
      {selectedSpace && (
        <InTourSpacePopup
          key={selectedSpace.id}
          space={selectedSpace}
          stationName={stationInfo.name}
          contactPhone={commercialContactPhone}
          returnToList={openedFromUnitsList}
          onClose={closeSpaceDetail}
        />
      )}

      {selectedAd && (
        <InTourAdPopup
          title={selectedAd.text}
          creativeTitle={selectedAd.creativeTitle}
          creativeUrl={selectedAd.creativeUrl}
          spaceCode={selectedAd.spaceCode}
          spaceName={spaces.find((s) => s.code === selectedAd.spaceCode)?.name}
          brandName={spaces.find((s) => s.code === selectedAd.spaceCode)?.tenantBrand ?? undefined}
          stationName={stationInfo.name}
          contactPhone={commercialContactPhone}
          onClose={() => setSelectedAd(null)}
        />
      )}

      {infoPopup && (
        <InTourInfoPopup
          title={infoPopup.title}
          description={infoPopup.description}
          onClose={() => setInfoPopup(null)}
        />
      )}
    </div>
  );
}
