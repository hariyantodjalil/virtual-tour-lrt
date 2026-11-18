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
  ChevronDown,
  Eye,
  EyeOff,
  Grid3X3,
  Home,
  Info,
  MapPin,
  MapPinned,
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
import MobileTourPanels, { type MobileTourPanel, type TourUnitListView } from "@/components/tour/MobileTourPanels";
import TourRouteStopPicker from "@/components/tour/TourRouteStopPicker";
import { useMobileTour } from "@/lib/use-mobile-tour";
import { getWhatsAppUrl } from "@/lib/utils";
import type { StationInfo } from "@/lib/stations-data";
import type { AdHotspotPayload } from "@/lib/pannellum-tour-config";
import {
  findScenePlacement,
  firstSceneIdInLevel,
} from "@/lib/public-tour-structure";
import {
  ROUTE_ORIGIN_CURRENT,
  buildTourRoute,
  collapseRouteToWaypoints,
  currentPositionStop,
  defaultRouteDestination,
  isRouteOriginCurrent,
  isWaypointActive,
  listRouteStops,
  resolveRouteStopAnchor,
} from "@/lib/tour-route-waypoints";
import { findSpaceHotspotPlacement } from "@/lib/space-hotspot-locate";
import { findFacilityHotspotPlacement } from "@/lib/facility-hotspot-locate";
import { FACILITY_ICONS, type FacilityIconId } from "@/lib/facility-icons";
import type { SpaceAvailabilityStatus } from "@/lib/space-availability";
import { useCommercialProfile } from "@/components/commercial/CommercialProfileProvider";
import { getTourLocationBreadcrumb } from "@/lib/tour-location-breadcrumb";

type Space = {
  id: string;
  code: string;
  name: string;
  displayName?: string;
  type: string;
  status: SpaceAvailabilityStatus;
  area: number;
  monthlyRent?: number | null;
  deposit: number;
  floor: string;
  location: string;
  nearestExit: string | null;
  nearbyFacilities?: string[];
  exposure: number;
  powerSupply: string | null;
  preferredUses?: string[];
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

function ToolButton({
  active,
  onClick,
  title,
  label,
  badge,
  children,
  delayMs = 0,
  hero = false,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  label: string;
  badge?: number;
  children: ReactNode;
  delayMs?: number;
  hero?: boolean;
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
        aria-label={title}
        aria-pressed={active}
        className={`tour-tool-btn pointer-events-auto relative ${hero ? "tour-tool-btn--hero" : ""} ${active ? "tour-tool-btn--active" : ""}`}
      >
        {children}
        {badge != null && badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 font-display text-[9px] font-bold text-[#E31E2D]">
            {badge}
          </span>
        )}
      </button>
      <span className="tour-chrome-pill pointer-events-none ml-2 hidden -translate-x-1 rounded-full px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/80 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 sm:block">
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
  const isMobile = useMobileTour();
  const [unitListView, setUnitListView] = useState<TourUnitListView>({ scrollTop: 0, expanded: false });
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
  const [, setActiveLevelId] = useState(
    initialPlacement?.level.id ?? firstLevel?.id ?? ""
  );
  const [activeAreaId, setActiveAreaId] = useState<string | null>(
    initialPlacement?.area?.id ?? firstLevel?.areas[0]?.id ?? null
  );
  const routeStops = listRouteStops(stationInfo.levels);
  const [routeFrom, setRouteFrom] = useState(ROUTE_ORIGIN_CURRENT);
  const [routeTo, setRouteTo] = useState(() => {
    const stops = listRouteStops(stationInfo.levels);
    const destination =
      defaultRouteDestination(stationInfo.scenes, stationInfo.levels, stops, firstScene) ??
      lastScene;
    return resolveRouteStopAnchor(destination, stationInfo.levels, stops);
  });

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
  const mobilePanel: MobileTourPanel | null = unitsOpen ? "units" : infoOpen ? "info" : routeOpen ? "route" : null;
  const routeFromStops = [currentPositionStop(activeSceneId, stationInfo.levels), ...routeStops];
  const routeOriginExact = isRouteOriginCurrent(routeFrom);
  const routeOriginSceneId = routeOriginExact ? activeSceneId : routeFrom;

  const availableCount = spaces.filter((s) => s.status === "TERSEDIA").length;
  const occupiedCount = spaces.filter((s) => s.status === "TERISI").length;
  const commercialContactPhone =
    stationInfo.commercialContactPhone || commercialProfile.whatsappNumber;
  const stationWaUrl = getWhatsAppUrl(
    commercialContactPhone,
    `Halo, saya tertarik dengan ruang komersial di Stasiun ${stationInfo.name}. Mohon informasi lebih lanjut.`
  );
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

  const selectedRoute = buildTourRoute(
    stationInfo.scenes,
    stationInfo.levels,
    routeOriginSceneId,
    routeTo,
    { originExact: routeOriginExact }
  );
  const routeWaypoints = collapseRouteToWaypoints(selectedRoute, stationInfo.levels);
  const routeIdx = selectedRoute.indexOf(activeSceneId);
  const safeRouteIdx = routeIdx >= 0 ? routeIdx : 0;
  const nextStep = routeIdx >= 0 ? selectedRoute[routeIdx + 1] : undefined;
  const prevStep = routeIdx > 0 ? selectedRoute[routeIdx - 1] : undefined;
  const routeFinished = guidedActive && routeIdx >= 0 && routeIdx >= selectedRoute.length - 1;
  const routeFromStop = routeFromStops.find((stop) => stop.sceneId === routeFrom);
  const routeToStop = routeStops.find((stop) => stop.sceneId === routeTo);
  const routeFromTitle = routeOriginExact
    ? "Posisi saat ini"
    : routeFromStop?.label
      ?? stationInfo.scenes.find((s) => s.id === routeFrom)?.title
      ?? "Awal";
  const routeToTitle = routeToStop?.label
    ?? stationInfo.scenes.find((s) => s.id === routeTo)?.title
    ?? "Tujuan";
  const canOfferRoute = routeStops.length > 1;
  const popupBlocksAutoplay = Boolean(selectedSpace || selectedAd || infoPopup || (isMobile && (mobilePanel || facilityOpen)));

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
    // Dari posisi sekarang: lanjut dari scene aktif jika sudah di jalur; selain itu lompat ke awal jalur.
    if (routeOriginExact && selectedRoute.includes(activeSceneId)) return;
    handleSceneChange(selectedRoute[0] ?? routeOriginSceneId);
  }

  function exitGuidedRoute() {
    setGuidedActive(false);
    setRouteAutoplay(false);
  }

  function toggleRouteAutoplay() {
    if (routeFinished) {
      handleSceneChange(selectedRoute[0] ?? routeOriginSceneId);
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

  const openSpaceFromList = useCallback((space: Space) => {
    focusOnSpaceHotspot(space.code);
    setOpenedFromUnitsList(true);
    setSelectedSpace(space);
    setInfoOpen(false);
    setRouteOpen(false);
    setUnitsOpen(false);
  }, []);

  const openSpaceFromHotspot = useCallback(
    (spaceCode: string) => {
      const space = spaces.find((s) => s.code === spaceCode);
      if (space) {
        setOpenedFromUnitsList(false);
        setSelectedAd(null);
        setSelectedSpace(space);
      }
    },
    [spaces, setOpenedFromUnitsList]
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

  const closeSidePanels = useCallback(() => {
    setInfoOpen(false);
    setRouteOpen(false);
    setUnitsOpen(false);
    setFacilityOpen(false);
  }, [setInfoOpen, setRouteOpen, setUnitsOpen, setFacilityOpen]);

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

      {/* Compact station navigation when the side panel is closed. */}
      {!uiCleared && (
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[60] px-3 pt-4 sm:px-5 sm:pt-5">
        <div className="flex items-center justify-end gap-3">
          {!leftPanelOpen && (
            <div className="pointer-events-auto mr-auto flex w-[min(calc(100vw-1rem),220px)] items-center gap-1.5 sm:w-[236px]">
              <Link
                href="/"
                className="tour-chrome-pill flex size-8 shrink-0 items-center justify-center rounded-full"
                aria-label="Beranda"
              >
                <Home className="size-3.5" strokeWidth={2.25} />
              </Link>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="tour-chrome-pill flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-full px-2.5 text-left text-[11px] font-semibold"
                aria-label="Pilih stasiun"
              >
                <TrainFront className="size-3.5 shrink-0 opacity-90" />
                <span className="min-w-0 flex-1 truncate font-display">Pilih Stasiun</span>
                <ChevronDown className="size-3.5 shrink-0 opacity-70" strokeWidth={2.5} />
              </button>
            </div>
          )}

        </div>
      </div>
      )}

      {!uiCleared && !selectedSpace && !selectedAd && (!unitsOpen || isMobile) && (
        <TourLeftPanel
          stationName={stationInfo.name}
          locationBreadcrumb={getTourLocationBreadcrumb(stationInfo, activeSceneId)}
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
                className="tour-chrome-pill flex size-11 items-center justify-center rounded-full"
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
                active={unitsOpen}
                label="Unit"
                title="Daftar unit"
                badge={availableCount}
                delayMs={40}
                hero
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
                active={infoOpen}
                label="Info"
                title="Info stasiun"
                delayMs={90}
                onClick={() => {
                  setInfoOpen((v) => !v);
                  setRouteOpen(false);
                  setUnitsOpen(false);
                  setFacilityOpen(false);
                }}
              >
                <Info className="h-5 w-5" />
              </ToolButton>

              {canOfferRoute && (
                <ToolButton
                  active={routeOpen || guidedActive}
                  label="Rute"
                  title="Rute tur"
                  delayMs={140}
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
        <div className={`pointer-events-auto absolute left-14 z-[65] ${isMobile ? "bottom-[max(1rem,calc(50%-126px))]" : "top-1/2 -translate-y-1/2 sm:left-16"}`}>
          <FacilityLegend
            activeFacilityId={activeFacilityId}
            onSelectFacility={focusOnFacility}
            mobile={isMobile}
            onClose={isMobile ? closeSidePanels : undefined}
            availableIds={isMobile ? FACILITY_ICONS.filter(item => findFacilityHotspotPlacement(stationInfo.scenes, item.id)).map(item => item.id) : undefined}
          />
        </div>
      )}

      {/* Backdrop soft close for side panels */}
      {(!isMobile || facilityOpen) && !uiCleared && (infoOpen || routeOpen || facilityOpen) && !selectedSpace && (
        <button
          type="button"
          aria-label="Tutup panel"
          className="pointer-events-auto absolute inset-0 z-[55] bg-[#1C0A0E]/10 md:bg-[#1C0A0E]/25 md:backdrop-blur-[1px]"
          onClick={closeSidePanels}
        />
      )}

      {/* INFO PANEL — kiri, di samping rail */}
      {!isMobile && !uiCleared && infoOpen && !selectedSpace && (
        <aside
          className={`tour-glass-panel tour-panel-in pointer-events-auto absolute top-1/2 z-[65] w-[min(18.5rem,calc(100vw-5.5rem))] -translate-y-1/2 overflow-hidden rounded-2xl text-ink ${
            leftPanelOpen
              ? "left-14 sm:left-16"
              : "left-4 sm:left-5"
          }`}
        >
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--hairline)" }}>
            <h2 className="font-display text-base font-semibold tracking-tight">{stationInfo.name}</h2>
            <button
              type="button"
              onClick={() => setInfoOpen(false)}
              aria-label="Tutup informasi stasiun"
              className="rounded-full p-1.5 transition-colors hover:bg-white/10"
            >
              <X className="h-4 w-4 text-ink/60" />
            </button>
          </div>
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-void/55 py-2.5">
                <p className="font-display text-base font-semibold text-live">{availableCount}</p>
                <p className="text-[10px] text-fog">Tersedia</p>
              </div>
              <div className="rounded-xl bg-void/55 py-2.5">
                <p className="font-display text-base font-semibold text-tour-occupied">{occupiedCount}</p>
                <p className="text-[10px] text-fog">Terisi</p>
              </div>
              <div className="rounded-xl bg-void/55 py-2.5">
                <p className="font-display text-base font-semibold">{spaces.length}</p>
                <p className="text-[10px] text-fog">Total</p>
              </div>
            </div>
            <div className="space-y-2 text-xs text-ink/75">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fog" />
                <span>{stationInfo.address}</span>
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[10px] text-fog">
                <span>Tingkat hunian</span>
                <span>
                  {spaces.length > 0 ? Math.round((occupiedCount / spaces.length) * 100) : 0}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-void/70">
                <div
                  className="h-full rounded-full bg-signal transition-all duration-500"
                  style={{
                    width: `${spaces.length > 0 ? (occupiedCount / spaces.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            {availableCount === 0 && (
              <p className="rounded-xl bg-void/55 px-3 py-2 text-[11px] leading-relaxed text-fog">
                {spaces.length === 0
                  ? "Belum ada unit di inventori stasiun ini. Tanya tim komersial untuk opsi stasiun lain."
                  : "Semua unit di stasiun ini terisi. Tanya stok stasiun lain ke tim komersial."}
              </p>
            )}
            <a
              href={stationWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-signal py-2.5 font-display text-xs font-bold text-white transition hover:bg-signal-deep"
            >
              {availableCount === 0 ? "Tanya Ketersediaan" : "Hubungi Tim Komersial"}
            </a>
          </div>
        </aside>
      )}

      {/* ROUTE PANEL — tujuan area/level, bukan daftar tiap scene */}
      {!isMobile && !uiCleared && routeOpen && !selectedSpace && canOfferRoute && (
        <aside
          className={`tour-glass-panel tour-panel-in pointer-events-auto absolute top-1/2 z-[65] w-[min(18.5rem,calc(100vw-5.5rem))] -translate-y-1/2 overflow-visible rounded-2xl text-ink ${
            leftPanelOpen
              ? "left-14 sm:left-16"
              : "left-4 sm:left-5"
          }`}
        >
          <div className="flex items-center justify-between rounded-t-2xl border-b px-4 py-3" style={{ borderColor: "var(--hairline)" }}>
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-signal" />
              <p className="font-display text-sm font-semibold">Rute Tur</p>
            </div>
            <button
              type="button"
              onClick={() => setRouteOpen(false)}
              aria-label="Tutup rute"
              className="rounded-full p-1.5 transition-colors hover:bg-white/10"
            >
              <X className="h-4 w-4 text-ink/60" />
            </button>
          </div>
          <div className="space-y-4 p-4">
            <p className="text-xs leading-relaxed text-fog">
              Navigasi mengikuti pinpoint antar panorama — dari posisi sekarang atau titik ke titik.
            </p>
            <div className="space-y-3">
              <TourRouteStopPicker
                id="desktop-route-from"
                label="Dari"
                value={routeFrom}
                stops={routeFromStops}
                levels={stationInfo.levels}
                onChange={setRouteFrom}
              />
              <TourRouteStopPicker
                id="desktop-route-to"
                label="Ke"
                value={routeTo}
                stops={routeStops}
                levels={stationInfo.levels}
                onChange={setRouteTo}
              />
            </div>

            <div>
              <p className="mb-2 font-display text-[11px] font-semibold tracking-wide text-fog">Jalur</p>
              <ol className="space-y-0">
                {routeWaypoints.map((point, index) => {
                  const isCurrent = isWaypointActive(point, activeSceneId, stationInfo.levels);
                  return (
                    <li key={`${point.key}-${index}`} className="relative flex gap-3">
                      <div className="flex w-5 flex-col items-center">
                        <span className={`mt-1 size-2.5 shrink-0 rounded-full ${isCurrent ? "bg-signal" : "bg-fog/50"}`} />
                        {index < routeWaypoints.length - 1 && (
                          <span className="mt-1 w-px flex-1 bg-[color:rgb(255_214_218_/_0.22)]" aria-hidden="true" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSceneChange(point.sceneId)}
                        className={`mb-3 min-w-0 flex-1 rounded-lg px-2 py-1 text-left text-sm transition hover:bg-panel/80 focus-visible:outline-2 focus-visible:outline-signal ${
                          isCurrent ? "font-semibold text-ink" : "text-ink/80"
                        }`}
                      >
                        {point.label}
                      </button>
                    </li>
                  );
                })}
              </ol>
              <p className="text-[11px] text-fog">
                {routeWaypoints.length} tujuan · {selectedRoute.length} panorama di jalur
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => startGuidedRoute({ autoplay: true })}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-signal font-display text-sm font-bold text-white shadow-[0_12px_28px_rgba(227,30,45,0.3)] transition hover:bg-signal-deep"
              >
                <Play className="h-4 w-4 fill-current" />
                Putar otomatis
              </button>
              <button
                type="button"
                onClick={() => startGuidedRoute({ autoplay: false })}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full border bg-void/45 font-display text-sm font-bold text-ink transition hover:bg-void/70"
                style={{ borderColor: "var(--hairline-strong)" }}
              >
                <Route className="h-4 w-4" />
                Jelajah manual
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* UNITS LEFT DRAWER — muncul dari "Lihat semua Tenant" */}
      {isMobile && mobilePanel && !uiCleared && !selectedSpace && !selectedAd && (
        <MobileTourPanels key={mobilePanel} panel={mobilePanel} station={stationInfo} spaces={spaces}
          typeLabels={TYPE_LABELS} contactUrl={stationWaUrl ?? ""} activeSceneId={activeSceneId}
          unitListView={unitListView} onUnitListViewChange={setUnitListView} onClose={closeSidePanels}
          onSelectUnit={unit => { const full = spaces.find(space => space.id === unit.id); if (full) openSpaceFromList(full); }}
          onViewMap={() => { setUnitsOpen(false); setLeftPanelOpen(true); }}
          route={{ from: routeFrom, to: routeTo, onFromChange: setRouteFrom, onToChange: setRouteTo, fromStops: routeFromStops, stops: routeStops, waypoints: routeWaypoints, sceneCount: selectedRoute.length, onSelectScene: handleSceneChange, onStart: autoplay => startGuidedRoute({ autoplay }) }}
        />
      )}

      {!isMobile && !uiCleared && unitsOpen && !selectedSpace && (
        <TourUnitsPanel
          spaces={spaces}
          typeLabels={TYPE_LABELS}
          contactUrl={stationWaUrl ?? undefined}
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
          onExplore={() => {
            setSelectedSpace(null);
            setUnitsOpen(false);
            setOpenedFromUnitsList(false);
            clearCameraFocus();
          }}
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

      {!uiCleared && !(isMobile && (mobilePanel || facilityOpen || guidedActive || selectedSpace || selectedAd || pickerOpen)) && (
        <ContactPersonFab
          phone={commercialContactPhone}
          stationName={stationInfo.name}
        />
      )}

      {/* Clear / restore UI — di bawah mini map saat panel terbuka; floating saat UI disembunyikan / panel tertutup */}
      {(uiCleared || !leftPanelOpen || selectedAd || unitsOpen) && !selectedSpace && !(isMobile && mobilePanel) && (
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
          className="tour-chrome-pill pointer-events-auto absolute bottom-24 left-3 z-[70] flex size-11 items-center justify-center rounded-full sm:bottom-28 sm:left-5"
          aria-label={uiCleared ? "Tampilkan UI" : "Sembunyikan UI"}
          title={uiCleared ? "Tampilkan UI" : "Sembunyikan UI"}
        >
          {uiCleared ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
        </button>
      )}
    </div>
  );
}
