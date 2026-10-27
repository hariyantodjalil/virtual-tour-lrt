/*
  THESIS: Chrome tour sebagai cockpit maroon LRT — panorama memimpin, UI brand-coherent; tolak HUD hitam generik.
  OWN-WORLD: void #1C0A0E, panel #3A161C, signal #E31E2D, glass hairline hangat, Chakra Petch.
  STORY: Mitra jelajah 360°, putar rute otomatis, cek unit, hubungi tim.
  FIRST VIEWPORT: Panorama full-bleed; chip stasiun; rail tool; nav / guided autopilot bar bawah.
  FORM: Perluasan Void Portal (Experience) — bukan dunia visual baru.
*/
"use client";

import { useState, useCallback, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Grid3X3,
  Home,
  Info,
  MapPin,
  MapPinned,
  Pause,
  Play,
  Route,
  TrainFront,
  X,
} from "lucide-react";
import InTourSpacePopup from "@/components/tour/InTourSpacePopup";
import InTourAdPopup from "@/components/tour/InTourAdPopup";
import InTourInfoPopup from "@/components/tour/InTourInfoPopup";
import StationPickerModal, {
  type StationPickerItem,
} from "@/components/tour/StationPickerModal";
import VirtualTourViewer from "@/components/tour/VirtualTourViewer";
import ContactPersonFab from "@/components/tour/ContactPersonFab";
import FacilityLegend from "@/components/tour/FacilityLegend";
import TourLeftPanel from "@/components/tour/TourLeftPanel";
import TourUnitsPanel from "@/components/tour/TourUnitsPanel";
import { GuidedRouteBar } from "@/components/tour/GuidedRouteBar";
import { getWhatsAppUrl } from "@/lib/utils";
import type { StationInfo } from "@/lib/stations-data";
import type { AdHotspotPayload } from "@/lib/pannellum-tour-config";
import {
  findScenePlacement,
  firstSceneIdInLevel,
} from "@/lib/public-tour-structure";
import { findSpaceHotspotPlacement } from "@/lib/space-hotspot-locate";
import { findFacilityHotspotPlacement } from "@/lib/facility-hotspot-locate";
import type { FacilityIconId } from "@/lib/facility-icons";
import type { SpaceAvailabilityStatus } from "@/lib/space-availability";
import { useCommercialProfile } from "@/components/commercial/CommercialProfileProvider";

type Space = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: SpaceAvailabilityStatus;
  area: number;
  monthlyRent?: number;
  deposit: number;
  floor: string;
  location: string;
  nearestExit: string | null;
  nearbyFacilities?: string[];
  exposure: number;
  powerSupply: string | null;
  waterAccess: boolean;
  airConditioning: boolean;
  description: string | null;
  panoramaUrl?: string | null;
  tenantBrand?: string | null;
};

type Props = {
  stationInfo: StationInfo;
  spaces: Space[];
  pickerStations: StationPickerItem[];
};

const TYPE_LABELS: Record<string, string> = {
  KIOS: "Kios",
  RUKO: "Ruko",
  ATM: "ATM",
  VENDING: "Vending",
  MEDIA_IKLAN: "Iklan",
  AREA_PROMOSI: "Promosi",
};

function buildRoute(sceneIds: string[], from: string, to: string) {
  const fi = sceneIds.indexOf(from);
  const ti = sceneIds.indexOf(to);
  if (fi < 0 || ti < 0) return sceneIds.slice(0, 1);
  return fi <= ti ? sceneIds.slice(fi, ti + 1) : sceneIds.slice(ti, fi + 1).reverse();
}

/** Urutan rute tetap, tapi tampilan dikelompokkan per level (Ground, Concourse, Peron). */
function groupRouteByLevel(
  route: string[],
  levels: StationInfo["levels"],
  scenes: StationInfo["scenes"]
) {
  const titleById = new Map(scenes.map((scene) => [scene.id, scene.title]));
  const levelByScene = new Map<string, { id: string; label: string; order: number }>();

  for (const level of levels) {
    const sceneIds = new Set([
      ...level.sceneIds,
      ...level.areas.flatMap((area) => area.sceneIds),
    ]);
    for (const sceneId of sceneIds) {
      levelByScene.set(sceneId, {
        id: level.id,
        label: level.label.trim() || "Level",
        order: level.order,
      });
    }
  }

  const groups: Array<{
    key: string;
    label: string;
    order: number;
    items: Array<{ sceneId: string; title: string; index: number }>;
  }> = [];
  const byKey = new Map<string, (typeof groups)[number]>();

  route.forEach((sceneId, index) => {
    const level = levelByScene.get(sceneId);
    const key = level?.id ?? "unassigned";
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        label: level?.label ?? "Lainnya",
        order: level?.order ?? 9999,
        items: [],
      };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push({
      sceneId,
      title: titleById.get(sceneId) ?? sceneId,
      index,
    });
  });

  return groups.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

function ToolButton({
  active,
  onClick,
  title,
  label,
  badge,
  children,
  delayMs = 0,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  label: string;
  badge?: number;
  children: ReactNode;
  delayMs?: number;
}) {
  return (
    <div
      className="tour-rail-pop pointer-events-auto group relative flex items-center justify-start"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-pressed={active}
        className={`tour-tool-btn pointer-events-auto relative ${active ? "tour-tool-btn--active" : ""}`}
      >
        {children}
        {badge != null && badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 font-display text-[9px] font-bold text-[#E31E2D]">
            {badge}
          </span>
        )}
      </button>
      <span className="pointer-events-none ml-2 hidden -translate-x-1 rounded-full border border-white/12 bg-[#1c1c1e]/85 px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80 opacity-0 backdrop-blur-md transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 sm:block">
        {label}
      </span>
    </div>
  );
}

export default function StationTourClient({
  stationInfo,
  spaces,
  pickerStations,
}: Props) {
  const commercialProfile = useCommercialProfile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPlacement = findScenePlacement(stationInfo.levels, stationInfo.scenes[0]?.id ?? "");
  const firstLevel = initialPlacement?.level ?? stationInfo.levels[0];
  const firstScene =
    stationInfo.scenes[0]?.id ??
    (firstLevel ? firstSceneIdInLevel(firstLevel) : undefined) ??
    "concourse";
  const lastScene = stationInfo.scenes.at(-1)?.id ?? firstScene;

  const [pickerOpen, setPickerOpen] = useState(
    () => searchParams.get("pilih") === "1" || searchParams.get("pilih") === "true"
  );
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(() => {
    const unitId = searchParams.get("unit");
    if (!unitId) return null;
    return spaces.find((item) => item.id === unitId) ?? null;
  });
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

  const [infoOpen, setInfoOpen] = useState(false);
  const [unitsOpen, setUnitsOpen] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const [facilityOpen, setFacilityOpen] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [uiCleared, setUiCleared] = useState(false);
  const [guidedActive, setGuidedActive] = useState(false);
  const [routeAutoplay, setRouteAutoplay] = useState(false);
  const [openedFromUnitsList, setOpenedFromUnitsList] = useState(false);
  const [cameraFocus, setCameraFocus] = useState<{
    yaw: number;
    pitch: number;
    hfov?: number;
  } | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const [activeFacilityId, setActiveFacilityId] = useState<FacilityIconId | null>(null);

  const availableCount = spaces.filter((s) => s.status === "TERSEDIA").length;
  const occupiedCount = spaces.filter((s) => s.status === "TERISI").length;
  const currentLevel =
    stationInfo.levels.find((l) => l.id === activeLevelId) ?? stationInfo.levels[0];
  const currentPlaceLabel = currentLevel?.label?.trim() || "Lokasi";
  const commercialContactPhone =
    stationInfo.commercialContactPhone || commercialProfile.whatsappNumber;
  const stationWaUrl = getWhatsAppUrl(
    commercialContactPhone,
    `Halo, saya tertarik dengan ruang komersial di Stasiun ${stationInfo.name}. Mohon informasi lebih lanjut.`
  );
  const sceneIds = stationInfo.scenes.map((s) => s.id);
  // Nav tetap terlihat saat unit drawer kanan terbuka; sembunyi hanya saat detail unit / clear UI
  const showTourNav = !selectedSpace && !uiCleared;

  function activateScene(sceneId: string) {
    const placement = findScenePlacement(stationInfo.levels, sceneId);
    setActiveSceneId(sceneId);
    if (placement) {
      setActiveLevelId(placement.level.id);
      setActiveAreaId(placement.area?.id ?? placement.level.areas[0]?.id ?? null);
    }
  }

  function clearCameraFocus() {
    setCameraFocus(null);
    setFocusToken(0);
  }

  const selectedRoute = buildRoute(sceneIds, routeFrom, routeTo);
  const groupedRoute = groupRouteByLevel(selectedRoute, stationInfo.levels, stationInfo.scenes);
  const routeIdx = selectedRoute.indexOf(activeSceneId);
  const safeRouteIdx = routeIdx >= 0 ? routeIdx : 0;
  const nextStep = routeIdx >= 0 ? selectedRoute[routeIdx + 1] : undefined;
  const prevStep = routeIdx > 0 ? selectedRoute[routeIdx - 1] : undefined;
  const routeFinished = guidedActive && routeIdx >= 0 && routeIdx >= selectedRoute.length - 1;
  const routeFromTitle =
    stationInfo.scenes.find((s) => s.id === routeFrom)?.title ?? "Awal";
  const routeToTitle = stationInfo.scenes.find((s) => s.id === routeTo)?.title ?? "Tujuan";
  const popupBlocksAutoplay = Boolean(selectedSpace || selectedAd || infoPopup);

  function handleSceneChange(sceneId: string) {
    clearCameraFocus();
    activateScene(sceneId);
  }

  function startGuidedRoute(opts?: { autoplay?: boolean }) {
    setGuidedActive(true);
    setRouteAutoplay(Boolean(opts?.autoplay));
    setRouteOpen(false);
    setInfoOpen(false);
    setUnitsOpen(false);
    setFacilityOpen(false);
    setSelectedSpace(null);
    setSelectedAd(null);
    handleSceneChange(routeFrom);
  }

  function exitGuidedRoute() {
    setGuidedActive(false);
    setRouteAutoplay(false);
  }

  function toggleRouteAutoplay() {
    if (routeFinished) {
      handleSceneChange(routeFrom);
      setRouteAutoplay(true);
      return;
    }
    setRouteAutoplay((v) => !v);
  }

  useEffect(() => {
    if (!guidedActive || !routeAutoplay || popupBlocksAutoplay || !nextStep) {
      if (guidedActive && routeAutoplay && !popupBlocksAutoplay && !nextStep) {
        const timer = window.setTimeout(() => {
          setRouteAutoplay(false);
        }, 0);
        return () => window.clearTimeout(timer);
      }
      return;
    }

    const targetId = nextStep;
    const timer = window.setTimeout(() => {
      clearCameraFocus();
      activateScene(targetId);
    }, 4500);

    return () => window.clearTimeout(timer);
    // Intentionally omit activateScene/clearCameraFocus — recreated each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidedActive, routeAutoplay, nextStep, activeSceneId, popupBlocksAutoplay]);

  useEffect(() => {
    if (popupBlocksAutoplay) {
      const timer = window.setTimeout(() => {
        setRouteAutoplay((playing) => (playing ? false : playing));
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [popupBlocksAutoplay]);

  function focusOnSpaceHotspot(spaceCode: string) {
    const placement = findSpaceHotspotPlacement(stationInfo.scenes, spaceCode);
    if (!placement) return;
    activateScene(placement.sceneId);
    setCameraFocus({
      yaw: placement.yaw,
      pitch: placement.pitch,
      hfov: 78,
    });
    setFocusToken((token) => token + 1);
  }

  function focusOnFacility(facilityIcon: FacilityIconId) {
    const placement = findFacilityHotspotPlacement(
      stationInfo.scenes,
      facilityIcon,
      activeSceneId
    );
    if (!placement) {
      setActiveFacilityId(null);
      return;
    }

    setActiveFacilityId(facilityIcon);
    setInfoPopup(null);
    setSelectedSpace(null);
    setSelectedAd(null);
    setUnitsOpen(false);
    setRouteOpen(false);
    setInfoOpen(false);
    setFacilityOpen(false);

    activateScene(placement.sceneId);
    setCameraFocus({
      yaw: placement.yaw,
      pitch: placement.pitch,
      hfov: 78,
    });
    setFocusToken((token) => token + 1);
  }

  const openSpaceFromList = (space: Space) => {
    focusOnSpaceHotspot(space.code);
    setOpenedFromUnitsList(true);
    setSelectedSpace(space);
    setInfoOpen(false);
    setRouteOpen(false);
    setUnitsOpen(false);
  };

  const openSpaceFromHotspot = useCallback(
    (spaceCode: string) => {
      const space = spaces.find((s) => s.code === spaceCode);
      if (space) {
        setOpenedFromUnitsList(false);
        setSelectedAd(null);
        setSelectedSpace(space);
      }
    },
    [spaces]
  );

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

  const closeSidePanels = () => {
    setInfoOpen(false);
    setRouteOpen(false);
    setUnitsOpen(false);
    setFacilityOpen(false);
  };

  function closeStationPicker() {
    setPickerOpen(false);
    // Hapus query ?pilih agar refresh tidak buka ulang
    if (searchParams.get("pilih")) {
      router.replace(`/station/${stationInfo.slug}`, { scroll: false });
    }
  }

  function selectStation(slug: string) {
    if (slug === stationInfo.slug) {
      closeStationPicker();
      return;
    }
    router.push(`/station/${slug}`);
  }

  return (
    <div className="tour-shell relative flex h-full min-h-0 flex-1 overflow-hidden">
      {pickerOpen && pickerStations.length > 0 && (
        <StationPickerModal
          stations={pickerStations}
          currentSlug={stationInfo.slug}
          onSelect={selectStation}
          onClose={closeStationPicker}
        />
      )}

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
        chromeTone="maroon"
      />

      {guidedActive && showTourNav && (
        <GuidedRouteBar
          fromTitle={routeFromTitle}
          toTitle={routeToTitle}
          stepIndex={safeRouteIdx}
          stepTotal={selectedRoute.length}
          autoplay={routeAutoplay}
          canPrev={Boolean(prevStep)}
          canNext={Boolean(nextStep)}
          finished={routeFinished}
          onToggleAutoplay={toggleRouteAutoplay}
          onPrev={() => prevStep && handleSceneChange(prevStep)}
          onNext={() => nextStep && handleSceneChange(nextStep)}
          onExit={exitGuidedRoute}
        />
      )}

      {/* Vignette legibility — tinted maroon, not pure black */}
      {!uiCleared && (
        <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(to_bottom,rgba(28,10,14,.55)_0%,transparent_28%,transparent_62%,rgba(28,10,14,.62)_100%)]" />
      )}

      {/* TOP CHIP — kanan saja; aksi kiri ada di TourLeftPanel (atau compact Home+Pilih saat panel tertutup) */}
      {!uiCleared && (
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[60] px-3 pt-4 sm:px-5 sm:pt-5">
        <div className="flex items-center justify-end gap-3">
          {!leftPanelOpen && (
            <div className="pointer-events-auto mr-auto flex w-[min(calc(100vw-1rem),220px)] items-center gap-1.5 sm:w-[236px]">
              <Link
                href="/"
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/12 bg-[#1c1c1e]/78 text-white backdrop-blur-md transition hover:bg-white/10"
                aria-label="Beranda"
              >
                <Home className="size-3.5" strokeWidth={2.25} />
              </Link>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-full border border-white/12 bg-[#1c1c1e]/78 px-2.5 text-left text-[11px] font-semibold text-white backdrop-blur-md transition hover:bg-white/10"
                aria-label="Pilih stasiun"
              >
                <TrainFront className="size-3.5 shrink-0 opacity-90" />
                <span className="min-w-0 flex-1 truncate font-display">Pilih Stasiun</span>
                <ChevronDown className="size-3.5 shrink-0 opacity-70" strokeWidth={2.5} />
              </button>
            </div>
          )}

          <div className="pointer-events-none flex items-center gap-2">
            <div className="tour-glass inline-flex items-center gap-2 rounded-full px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-[#34d399]" />
              <span className="font-display text-xs font-semibold text-white">
                {currentPlaceLabel}
              </span>
            </div>
            {availableCount > 0 && (
              <div className="tour-glass inline-flex items-center gap-2 rounded-full px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-[#34d399]" />
                <span className="font-display text-xs font-semibold text-white">
                  {availableCount} unit tersedia
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {!uiCleared && !selectedSpace && !selectedAd && !unitsOpen && (
        <TourLeftPanel
          stationName={stationInfo.name}
          onPickStation={() => setPickerOpen(true)}
          clearUiControl={
            leftPanelOpen ? (
              <button
                type="button"
                onClick={() => {
                  setInfoOpen(false);
                  setRouteOpen(false);
                  setUnitsOpen(false);
                  setFacilityOpen(false);
                  setUiCleared(true);
                }}
                className="flex size-11 items-center justify-center rounded-full border border-white/12 bg-[#1c1c1e]/78 text-white backdrop-blur-md transition hover:bg-white/10"
                aria-label="Sembunyikan UI"
                title="Sembunyikan UI"
              >
                <EyeOff className="size-5" />
              </button>
            ) : undefined
          }
          tools={
            <>
              <ToolButton
                active={infoOpen}
                label="Info"
                title="Info stasiun"
                delayMs={40}
                onClick={() => {
                  setInfoOpen((v) => !v);
                  setRouteOpen(false);
                  setUnitsOpen(false);
                  setFacilityOpen(false);
                }}
              >
                <Info className="h-5 w-5" />
              </ToolButton>

              {stationInfo.scenes.length > 1 && (
                <ToolButton
                  active={routeOpen || guidedActive}
                  label="Rute"
                  title="Guided route"
                  delayMs={90}
                  onClick={() => {
                    if (guidedActive) {
                      exitGuidedRoute();
                      setRouteOpen(true);
                      setInfoOpen(false);
                      setUnitsOpen(false);
                      setFacilityOpen(false);
                      return;
                    }
                    setRouteOpen((v) => !v);
                    setInfoOpen(false);
                    setUnitsOpen(false);
                    setFacilityOpen(false);
                  }}
                >
                  <Route className="h-5 w-5" />
                </ToolButton>
              )}

              <ToolButton
                active={unitsOpen}
                label="Unit"
                title="Daftar unit"
                badge={availableCount}
                delayMs={140}
                onClick={() => {
                  setUnitsOpen((v) => !v);
                  setInfoOpen(false);
                  setRouteOpen(false);
                  setFacilityOpen(false);
                  if (unitsOpen) {
                    setSelectedSpace(null);
                    setOpenedFromUnitsList(false);
                  }
                }}
              >
                <Grid3X3 className="h-5 w-5" />
              </ToolButton>

              <ToolButton
                active={facilityOpen}
                label="Fasilitas"
                title="Fasilitas stasiun"
                delayMs={190}
                onClick={() => {
                  setFacilityOpen((v) => !v);
                  setInfoOpen(false);
                  setRouteOpen(false);
                  setUnitsOpen(false);
                }}
              >
                <MapPinned className="h-5 w-5" />
              </ToolButton>
            </>
          }
        />
      )}

      {/* Panel fasilitas — muncul di samping rail saat tombol diklik */}
      {!uiCleared && facilityOpen && !selectedSpace && !selectedAd && !unitsOpen && (
        <div className="pointer-events-auto absolute top-1/2 left-14 z-[65] -translate-y-1/2 sm:left-16">
          <FacilityLegend
            activeFacilityId={activeFacilityId}
            onSelectFacility={focusOnFacility}
          />
        </div>
      )}

      {/* Backdrop soft close for side panels */}
      {!uiCleared && (infoOpen || routeOpen || facilityOpen) && !selectedSpace && (
        <button
          type="button"
          aria-label="Tutup panel"
          className="pointer-events-auto absolute inset-0 z-[55] bg-[#1C0A0E]/25 backdrop-blur-[1px]"
          onClick={closeSidePanels}
        />
      )}

      {/* INFO PANEL — kiri, di samping rail */}
      {!uiCleared && infoOpen && !selectedSpace && (
        <aside
          className={`tour-glass-panel tour-panel-in pointer-events-auto absolute top-1/2 z-[65] w-[min(18.5rem,calc(100vw-5.5rem))] -translate-y-1/2 overflow-hidden rounded-2xl text-[#F8ECEE] ${
            leftPanelOpen
              ? "left-14 sm:left-16"
              : "left-4 sm:left-5"
          }`}
        >
          <div className="flex items-center justify-between border-b border-[color:rgb(255_214_218_/_0.12)] px-4 py-3">
            <h2 className="font-display text-base font-semibold tracking-tight">{stationInfo.name}</h2>
            <button
              type="button"
              onClick={() => setInfoOpen(false)}
              className="rounded-full p-1.5 transition-colors hover:bg-white/10"
            >
              <X className="h-4 w-4 text-[#F8ECEE]/60" />
            </button>
          </div>
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-[#1C0A0E]/55 py-2.5">
                <p className="font-display text-base font-semibold text-[#34d399]">{availableCount}</p>
                <p className="text-[10px] text-[#C4A8AD]">Tersedia</p>
              </div>
              <div className="rounded-xl bg-[#1C0A0E]/55 py-2.5">
                <p className="font-display text-base font-semibold text-[#ff8a93]">{occupiedCount}</p>
                <p className="text-[10px] text-[#C4A8AD]">Terisi</p>
              </div>
              <div className="rounded-xl bg-[#1C0A0E]/55 py-2.5">
                <p className="font-display text-base font-semibold">{spaces.length}</p>
                <p className="text-[10px] text-[#C4A8AD]">Total</p>
              </div>
            </div>
            <div className="space-y-2 text-xs text-[#F8ECEE]/75">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C4A8AD]" />
                <span>{stationInfo.address}</span>
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[10px] text-[#C4A8AD]">
                <span>Tingkat hunian</span>
                <span>
                  {spaces.length > 0 ? Math.round((occupiedCount / spaces.length) * 100) : 0}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#1C0A0E]/70">
                <div
                  className="h-full rounded-full bg-[#E31E2D] transition-all duration-500"
                  style={{
                    width: `${spaces.length > 0 ? (occupiedCount / spaces.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <a
              href={stationWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-2.5 font-display text-xs font-bold text-white transition hover:bg-[#1DA851]"
            >
              Hubungi Tim Komersial
            </a>
          </div>
        </aside>
      )}

      {/* ROUTE PANEL */}
      {!uiCleared && routeOpen && !selectedSpace && stationInfo.scenes.length > 1 && (
        <aside
          className={`tour-glass-panel tour-panel-in pointer-events-auto absolute top-1/2 z-[65] w-[min(18.5rem,calc(100vw-5.5rem))] -translate-y-1/2 overflow-hidden rounded-2xl text-[#F8ECEE] ${
            leftPanelOpen
              ? "left-14 sm:left-16"
              : "left-4 sm:left-5"
          }`}
        >
          <div className="flex items-center justify-between border-b border-[color:rgb(255_214_218_/_0.12)] px-4 py-3">
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-[#E31E2D]" />
              <p className="font-display text-sm font-semibold">Guided Route</p>
            </div>
            <button
              type="button"
              onClick={() => setRouteOpen(false)}
              className="rounded-full p-1.5 transition-colors hover:bg-white/10"
            >
              <X className="h-4 w-4 text-[#F8ECEE]/60" />
            </button>
          </div>
          <div className="max-h-[min(70vh,28rem)] space-y-3 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block font-display text-[10px] uppercase tracking-[0.12em] text-[#C4A8AD]">
                  Dari
                </label>
                <select
                  value={routeFrom}
                  onChange={(e) => setRouteFrom(e.target.value)}
                  className="h-9 w-full rounded-xl border border-[color:rgb(255_214_218_/_0.14)] bg-[#1C0A0E]/65 px-3 text-xs font-semibold text-white outline-none focus:border-[#E31E2D]/50"
                >
                  {stationInfo.levels.map((level) => (
                    <optgroup key={level.id} label={level.label}>
                      {(level.areas.length > 0
                        ? level.areas.flatMap((a) =>
                            a.sceneIds.map((id) => ({
                              id,
                              title: stationInfo.scenes.find((s) => s.id === id)?.title ?? id,
                            }))
                          )
                        : level.sceneIds.map((id) => ({
                            id,
                            title: stationInfo.scenes.find((s) => s.id === id)?.title ?? id,
                          }))
                      ).map((s) => (
                        <option key={s.id} value={s.id} className="bg-[#1C0A0E]">
                          {s.title}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-display text-[10px] uppercase tracking-[0.12em] text-[#C4A8AD]">
                  Ke
                </label>
                <select
                  value={routeTo}
                  onChange={(e) => setRouteTo(e.target.value)}
                  className="h-9 w-full rounded-xl border border-[color:rgb(255_214_218_/_0.14)] bg-[#1C0A0E]/65 px-3 text-xs font-semibold text-white outline-none focus:border-[#E31E2D]/50"
                >
                  {stationInfo.levels.map((level) => (
                    <optgroup key={level.id} label={level.label}>
                      {(level.areas.length > 0
                        ? level.areas.flatMap((a) =>
                            a.sceneIds.map((id) => ({
                              id,
                              title: stationInfo.scenes.find((s) => s.id === id)?.title ?? id,
                            }))
                          )
                        : level.sceneIds.map((id) => ({
                            id,
                            title: stationInfo.scenes.find((s) => s.id === id)?.title ?? id,
                          }))
                      ).map((s) => (
                        <option key={s.id} value={s.id} className="bg-[#1C0A0E]">
                          {s.title}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={() => startGuidedRoute({ autoplay: true })}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#E31E2D] font-display text-xs font-bold text-white shadow-[0_12px_28px_rgba(227,30,45,0.3)] transition hover:bg-[#c41926]"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Putar otomatis
            </button>
            <button
              type="button"
              onClick={() => startGuidedRoute({ autoplay: false })}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[color:rgb(255_214_218_/_0.18)] bg-[#1C0A0E]/45 font-display text-xs font-bold text-[#F8ECEE] transition hover:bg-[#1C0A0E]/7"
            >
              <Route className="h-3.5 w-3.5" />
              Mulai rute manual
            </button>
            <div className="space-y-3 pt-1">
              {groupedRoute.map((group) => (
                <div key={group.key} className="space-y-1.5">
                  <p className="px-1 font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ff8a93]">
                    {group.label}
                  </p>
                  {group.items.map((item) => {
                    const isActive = item.sceneId === activeSceneId;
                    return (
                      <button
                        key={item.sceneId}
                        type="button"
                        onClick={() => handleSceneChange(item.sceneId)}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs transition-all duration-300 ${
                          isActive
                            ? "bg-white font-bold text-[#1C0A0E]"
                            : "bg-[#1C0A0E]/45 text-[#F8ECEE]/70 hover:bg-[#1C0A0E]/7"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-display text-[10px] font-bold ${
                            isActive ? "bg-[#E31E2D] text-white" : "bg-white/10 text-[#F8ECEE]/70"
                          }`}
                        >
                          {item.index + 1}
                        </span>
                        <span>{item.title}</span>
                        {isActive && (
                          <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-[#34d399]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {guidedActive && nextStep && (
              <button
                type="button"
                onClick={() => handleSceneChange(nextStep)}
                className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[#E31E2D]/40 bg-[#E31E2D]/15 font-display text-xs font-bold text-white transition hover:bg-[#E31E2D]/25"
              >
                Lanjut ke {stationInfo.scenes.find((s) => s.id === nextStep)?.title}
                <ChevronRight className="h-4 w-4" />
              </button>
            )}

            {guidedActive && (
              <button
                type="button"
                onClick={() => {
                  if (routeAutoplay) setRouteAutoplay(false);
                  else toggleRouteAutoplay();
                }}
                className="flex h-9 w-full items-center justify-center gap-2 rounded-full border border-[color:rgb(255_214_218_/_0.14)] bg-transparent font-display text-[11px] font-bold text-[#C4A8AD] transition hover:text-white"
              >
                {routeAutoplay ? (
                  <>
                    <Pause className="h-3.5 w-3.5" />
                    Jeda autoplay
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    Lanjut autoplay
                  </>
                )}
              </button>
            )}
          </div>
        </aside>
      )}

      {/* UNITS LEFT DRAWER — muncul dari "Lihat semua Tenant" */}
      {!uiCleared && unitsOpen && !selectedSpace && (
        <TourUnitsPanel
          spaces={spaces}
          typeLabels={TYPE_LABELS}
          onClose={() => setUnitsOpen(false)}
          onSelect={(space) => {
            const full = spaces.find((s) => s.id === space.id);
            if (full) openSpaceFromList(full);
          }}
          onViewMap={() => {
            setUnitsOpen(false);
            setLeftPanelOpen(true);
          }}
        />
      )}

      {selectedSpace && (
        <InTourSpacePopup
          key={selectedSpace.id}
          space={selectedSpace}
          stationName={stationInfo.name}
          stationSlug={stationInfo.slug}
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

      {!uiCleared && (
        <ContactPersonFab
          phone={commercialContactPhone}
          stationName={stationInfo.name}
        />
      )}

      {/* Clear / restore UI — di bawah mini map saat panel terbuka; floating saat UI disembunyikan / panel tertutup */}
      {(uiCleared || !leftPanelOpen || selectedAd || unitsOpen) && !selectedSpace && (
        <button
          type="button"
          onClick={() => {
            setUiCleared((v) => {
              if (!v) {
                setInfoOpen(false);
                setRouteOpen(false);
                setUnitsOpen(false);
                setFacilityOpen(false);
              }
              return !v;
            });
          }}
          className="pointer-events-auto absolute bottom-24 left-3 z-[70] flex size-11 items-center justify-center rounded-full border border-white/12 bg-[#1c1c1e]/78 text-white backdrop-blur-md transition hover:bg-white/10 sm:bottom-28 sm:left-5"
          aria-label={uiCleared ? "Tampilkan UI" : "Sembunyikan UI"}
          title={uiCleared ? "Tampilkan UI" : "Sembunyikan UI"}
        >
          {uiCleared ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
        </button>
      )}
    </div>
  );
}
