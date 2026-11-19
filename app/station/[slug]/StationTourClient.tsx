/*
  THESIS: Chrome tour sebagai cockpit maroon LRT — panorama memimpin, UI brand-coherent; tolak HUD hitam generik.
  OWN-WORLD: void #1C0A0E, panel #3A161C, signal #E31E2D, glass hairline hangat, Chakra Petch.
  STORY: Mitra jelajah 360°, cek unit, hubungi tim.
  FIRST VIEWPORT: Panorama full-bleed; chip stasiun; rail tool; nav bawah.
  FORM: Perluasan Void Portal (Experience) — bukan dunia visual baru.
*/
"use client";

import { TourLanguageToggle, useTourLanguage } from "@/components/tour/TourLanguageProvider";
import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  Eye,
  EyeOff,
  Grid3X3,
  Home,
  Info,
  Map,
  MapPin,
  MapPinned,
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
import MobileTourPanels, { type MobileTourPanel, type TourUnitListView } from "@/components/tour/MobileTourPanels";
import { useMobileTour } from "@/lib/use-mobile-tour";
import FloorPlanMap from "@/components/tour/FloorPlanMap";
import StationMinimap from "@/components/tour/StationMinimap";
import type { StationMinimapData } from "@/lib/station-minimap";
import TourEditorLink from "@/components/tour/TourEditorLink";
import type { ConcourseLayout, ConcourseSlot } from "@/lib/concourse-plan";
import type { StationFloorplanData } from "@/lib/station-floorplan";
import { getWhatsAppUrl } from "@/lib/utils";
import type { StationInfo } from "@/lib/stations-data";
import type { AdHotspotPayload } from "@/lib/pannellum-tour-config";
import {
  findScenePlacement,
  firstSceneIdInLevel,
} from "@/lib/public-tour-structure";
import { findSpaceHotspotPlacement, type SpaceHotspotTarget } from "@/lib/space-hotspot-locate";
import type { PrimaryUnitHotspot } from "@/lib/primary-unit-hotspot";
import { findFacilityHotspotPlacement } from "@/lib/facility-hotspot-locate";
import { FACILITY_ICONS, type FacilityIconId } from "@/lib/facility-icons";
import type { SpaceAvailabilityStatus } from "@/lib/space-availability";
import { useCommercialProfile } from "@/components/commercial/CommercialProfileProvider";
import { getTourLocationBreadcrumb } from "@/lib/tour-location-breadcrumb";

type Space = {
  id: string;
  code: string;
  assetCode?: string;
  primaryHotspot?: PrimaryUnitHotspot | null;
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
  tenantLogoUrl?: string | null;
};

type Props = {
  stationInfo: StationInfo;
  spaces: Space[];
  pickerStations: StationPickerItem[];
  editorHref?: string;
  minimaps: Record<string, StationMinimapData>;
  concourse: { layout: ConcourseLayout | null; prefix: string; slots: ConcourseSlot[] };
  floorplan?: StationFloorplanData | null;
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
      <span className="tour-chrome-pill pointer-events-none ml-2 hidden -translate-x-1 rounded-full px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/80 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 sm:block [@media(max-height:480px)]:hidden">
        {label}
      </span>
    </div>
  );
}

export default function StationTourClient({
  stationInfo,
  spaces,
  pickerStations,
  editorHref,
  minimaps,
  concourse,
  floorplan = null,
}: Props) {
  const { t, content } = useTourLanguage();
  const isMobile = useMobileTour();
  const [mapOpen, setMapOpen] = useState(false);
  const [minimapOpen, setMinimapOpen] = useState(false);
  const minimapRef = useRef<HTMLDivElement>(null);
  const [openedFromMap, setOpenedFromMap] = useState(false);
  const [clickedHotspot, setClickedHotspot] = useState<SpaceHotspotTarget>();
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
  const [activeAreaId, setActiveAreaId] = useState<string | null>(
    initialPlacement?.area?.id ?? firstLevel?.areas[0]?.id ?? null
  );

  const [infoOpen, setInfoOpen] = useState(false);
  const [unitsOpen, setUnitsOpen] = useState(false);
  const [facilityOpen, setFacilityOpen] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [uiCleared, setUiCleared] = useState(false);
  const [openedFromUnitsList, setOpenedFromUnitsList] = useState(false);
  const [cameraFocus, setCameraFocus] = useState<{
    yaw: number;
    pitch: number;
    hfov?: number;
  } | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const [activeFacilityId, setActiveFacilityId] = useState<FacilityIconId | null>(null);
  const mobilePanel: MobileTourPanel | null = unitsOpen ? "units" : infoOpen ? "info" : null;

  const availableCount = spaces.filter((s) => s.status === "TERSEDIA").length;
  const occupiedCount = spaces.filter((s) => s.status === "TERISI").length;
  const commercialContactPhone =
    stationInfo.commercialContactPhone || commercialProfile.whatsappNumber;
  const stationWaUrl = getWhatsAppUrl(
    commercialContactPhone,
    t("Halo, saya tertarik dengan ruang komersial di Stasiun {station}. Mohon informasi lebih lanjut.", { station: stationInfo.name })
  );
  // Nav tetap terlihat saat unit drawer kanan terbuka; sembunyi hanya saat detail unit / clear UI
  const showTourNav = !selectedSpace && !uiCleared;
  const activeScene = stationInfo.scenes.find(scene => scene.id === activeSceneId);
  const minimapLevel = findScenePlacement(stationInfo.levels, activeSceneId)?.level;
  const minimapLevelId = minimapLevel?.id ?? activeScene?.levelId;
  const activeMinimap = minimapLevelId ? minimaps[minimapLevelId] : undefined;
  const showMinimap = minimapOpen && !uiCleared && !mapOpen && !pickerOpen
    && !selectedSpace && !selectedAd && !infoPopup && !infoOpen && !unitsOpen;

  const updateMinimapYaw = useCallback((yaw: number, sceneId: string) => {
    const map = minimapRef.current;
    if (map?.dataset.sceneId === sceneId) map.style.setProperty("--minimap-yaw", `${yaw}deg`);
  }, []);

  const activateScene = useCallback((sceneId: string) => {
    const placement = findScenePlacement(stationInfo.levels, sceneId);
    setActiveSceneId(sceneId);
    if (placement) {
      setActiveAreaId(placement.area?.id ?? placement.level.areas[0]?.id ?? null);
    }
  }, [stationInfo.levels]);

  function clearCameraFocus() {
    setCameraFocus(null);
    setFocusToken(0);
  }


  function handleSceneChange(sceneId: string) {
    clearCameraFocus();
    activateScene(sceneId);
  }

  const focusOnSpaceHotspot = useCallback((space: Space) => {
    const placement = findSpaceHotspotPlacement(stationInfo.scenes, space.code, space.primaryHotspot);
    if (!placement) return;
    activateScene(placement.sceneId);
    setCameraFocus({
      yaw: placement.yaw,
      pitch: placement.pitch,
    });
    setFocusToken((token) => token + 1);
  }, [activateScene, stationInfo.scenes]);

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
    focusOnSpaceHotspot(space);
    setClickedHotspot(undefined);
    setOpenedFromUnitsList(true);
    setSelectedSpace(space);
    setInfoOpen(false);
    setUnitsOpen(false);
  }, [focusOnSpaceHotspot]);

  const openSpaceFromHotspot = useCallback(
    (spaceCode: string, target?: SpaceHotspotTarget) => {
      const space = spaces.find((s) => s.code === spaceCode);
      if (space) {
        setClickedHotspot(target);
        setOpenedFromUnitsList(false);
        setSelectedAd(null);
        setSelectedSpace(space);
      }
    },
    [spaces, setOpenedFromUnitsList]
  );

  function hotspotEditorHref(space: Space) {
    if (!editorHref) return;
    const target = clickedHotspot ?? findSpaceHotspotPlacement(stationInfo.scenes, space.code, space.primaryHotspot);
    if (!target) return;
    const query = new URLSearchParams({ scene: target.sceneId, unit: space.code });
    if ("spatialId" in target && target.spatialId) {
      query.set("spatial", target.spatialId);
    } else if ("yaw" in target) {
      query.set("yaw", String(target.yaw));
      query.set("pitch", String(target.pitch));
    }
    return `${editorHref}?${query}`;
  }

  const openAdFromHotspot = useCallback((payload: AdHotspotPayload) => {
    setSelectedSpace(null);
    setSelectedAd(payload);
  }, []);

  const handleInfoClick = useCallback((title: string, description: string) => {
    setInfoPopup({ title, description });
  }, []);

  const closeSpaceDetail = () => {
    setSelectedSpace(null);
    if (openedFromMap) {
      setOpenedFromMap(false);
      clearCameraFocus();
      setMapOpen(true);
      return;
    }
    if (openedFromUnitsList) {
      clearCameraFocus();
      setUnitsOpen(true);
      setOpenedFromUnitsList(false);
    }
  };

  const closeSidePanels = useCallback(() => {
    setInfoOpen(false);
    setUnitsOpen(false);
    setFacilityOpen(false);
  }, [setInfoOpen, setUnitsOpen, setFacilityOpen]);

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
        onViewYawChange={showMinimap && activeMinimap?.positions[activeSceneId] ? updateMinimapYaw : undefined}
        selectedSceneId={activeSceneId}
        focusCamera={cameraFocus}
        focusToken={focusToken}
        stationName={stationInfo.name}
        hideSceneBar
        chromeTone="maroon"
      />

      {showMinimap && (
        <StationMinimap data={activeMinimap} sceneId={activeSceneId}
          levelLabel={minimapLevel?.label} initialYaw={activeScene?.initialView?.yaw ?? 0}
          mapRef={minimapRef} onClose={() => setMinimapOpen(false)} />
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
            <div className="pointer-events-auto mr-auto flex max-w-full items-center gap-1.5">
              <Link
                href="/"
                className="tour-chrome-pill flex size-8 shrink-0 items-center justify-center rounded-full"
                aria-label={t("Beranda")}
              >
                <Home className="size-3.5" strokeWidth={2.25} />
              </Link>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="tour-chrome-pill flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-full px-2.5 text-left text-[11px] font-semibold"
                aria-label={t("Pilih stasiun")}
              >
                <TrainFront className="size-3.5 shrink-0 opacity-90" />
                <span className="min-w-0 flex-1 truncate font-display">{t("Pilih Stasiun")}</span>
                <ChevronDown className="size-3.5 shrink-0 opacity-70" strokeWidth={2.5} />
              </button>
              <TourLanguageToggle />
            </div>
          )}

        </div>
      </div>
      )}

      {!uiCleared && !selectedSpace && !selectedAd && (!unitsOpen || isMobile) && (
        <TourLeftPanel
          stationName={stationInfo.name}
          locationKind="Stasiun"
          railClassName="[@media(max-height:480px)]:top-auto [@media(max-height:480px)]:bottom-20 [@media(max-height:480px)]:translate-y-0 [@media(max-height:480px)]:flex-row [@media(max-height:480px)]:flex-wrap [@media(max-height:480px)_and_(min-width:580px)]:bottom-3 [@media(max-height:480px)_and_(min-width:580px)]:left-1/2 [@media(max-height:480px)_and_(min-width:580px)]:-translate-x-1/2 [@media(max-height:480px)_and_(min-width:580px)]:flex-nowrap"
          locationBreadcrumb={getTourLocationBreadcrumb(stationInfo, activeSceneId)}
          onPickStation={() => setPickerOpen(true)}
          clearUiControl={
            leftPanelOpen ? (
              <button
                type="button"
                onClick={() => {
                  setInfoOpen(false);
                  setUnitsOpen(false);
                  setFacilityOpen(false);
                  setUiCleared(true);
                }}
                className="tour-chrome-pill flex size-11 items-center justify-center rounded-full"
                aria-label={t("Sembunyikan UI")}
                title={t("Sembunyikan UI")}
              >
                <EyeOff className="size-5" />
              </button>
            ) : undefined
          }
          tools={
            <>
              <ToolButton
                active={unitsOpen}
                label={t("Unit")}
                title={t("Daftar unit")}
                badge={availableCount}
                delayMs={40}
                hero
                onClick={() => {
                  setUnitsOpen((v) => !v);
                  setInfoOpen(false);
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
                title={t("Info stasiun")}
                delayMs={90}
                onClick={() => {
                  setInfoOpen((v) => !v);
                  setUnitsOpen(false);
                  setFacilityOpen(false);
                }}
              >
                <Info className="h-5 w-5" />
              </ToolButton>


              <ToolButton
                active={facilityOpen}
                label={t("Fasilitas")}
                title={t("Fasilitas stasiun")}
                delayMs={190}
                onClick={() => {
                  setFacilityOpen((v) => !v);
                  setInfoOpen(false);
                  setUnitsOpen(false);
                }}
              >
                <MapPinned className="h-5 w-5" />
              </ToolButton>
              {Object.keys(minimaps).length > 0 && (
                <ToolButton active={minimapOpen} label={t("Denah")} title={t("Tampilkan atau sembunyikan minimap")}
                  delayMs={240} onClick={() => {
                    closeSidePanels();
                    setMinimapOpen(open => !open);
                  }}>
                  <Map className="size-5" />
                </ToolButton>
              )}
              {editorHref && activeSceneId && <TourEditorLink rail label={t("Edit scene di CMS")}
                href={`${editorHref}?scene=${encodeURIComponent(activeSceneId)}`} />}
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
      {(!isMobile || facilityOpen) && !uiCleared && (infoOpen || facilityOpen) && !selectedSpace && (
        <button
          type="button"
          aria-label={t("Tutup panel")}
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
              aria-label={t("Tutup informasi stasiun")}
              className="rounded-full p-1.5 transition-colors hover:bg-white/10"
            >
              <X className="h-4 w-4 text-ink/60" />
            </button>
          </div>
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-void/55 py-2.5">
                <p className="font-display text-base font-semibold text-live">{availableCount}</p>
                <p className="text-[10px] text-fog">{t("Tersedia")}</p>
              </div>
              <div className="rounded-xl bg-void/55 py-2.5">
                <p className="font-display text-base font-semibold text-tour-occupied">{occupiedCount}</p>
                <p className="text-[10px] text-fog">{t("Terisi")}</p>
              </div>
              <div className="rounded-xl bg-void/55 py-2.5">
                <p className="font-display text-base font-semibold">{spaces.length}</p>
                <p className="text-[10px] text-fog">Total</p>
              </div>
            </div>
            <div className="space-y-2 text-xs text-ink/75">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fog" />
                <span>{content(stationInfo.address ?? "")}</span>
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[10px] text-fog">
                <span>{t("Tingkat hunian")}</span>
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
                  ? t("Belum ada unit di inventori stasiun ini. Tanya tim komersial untuk opsi stasiun lain.")
                  : t("Semua unit di stasiun ini terisi. Tanya stok stasiun lain ke tim komersial.")}
              </p>
            )}
            <a
              href={stationWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-signal py-2.5 font-display text-xs font-bold text-white transition hover:bg-signal-deep"
            >
              {availableCount === 0 ? t("Tanya Ketersediaan") : t("Hubungi Tim Komersial")}
            </a>
          </div>
        </aside>
      )}


      {/* UNITS LEFT DRAWER — muncul dari "Lihat semua Tenant" */}
      {isMobile && mobilePanel && !uiCleared && !selectedSpace && !selectedAd && (
        <MobileTourPanels key={mobilePanel} panel={mobilePanel} station={stationInfo} spaces={spaces}
          typeLabels={TYPE_LABELS} contactUrl={stationWaUrl ?? ""}
          unitListView={unitListView} onUnitListViewChange={setUnitListView} onClose={closeSidePanels}
          onSelectUnit={unit => { const full = spaces.find(space => space.id === unit.id); if (full) openSpaceFromList(full); }}
          onViewMap={() => { setUnitsOpen(false); setMapOpen(true); }}
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
            setMapOpen(true);
          }}
        />
      )}

      {mapOpen && !uiCleared && <FloorPlanMap
        key={stationInfo.slug}
        stationName={stationInfo.name} layout={concourse.layout} prefix={concourse.prefix} slots={concourse.slots}
        spaces={spaces} floorplan={floorplan} mobile={isMobile}
        onClose={() => { setMapOpen(false); setLeftPanelOpen(true); setUnitsOpen(true); }}
        onSpaceSelect={spaceId => {
          const space = spaces.find(unit => unit.id === spaceId);
          if (!space) return;
          setMapOpen(false);
          focusOnSpaceHotspot(space);
          setClickedHotspot(undefined);
          setOpenedFromMap(true);
          setSelectedSpace(space);
        }}
      />}

      {selectedSpace && (
        <InTourSpacePopup
          key={selectedSpace.id}
          space={selectedSpace}
          stationName={stationInfo.name}
          stationSlug={stationInfo.slug}
          contactPhone={commercialContactPhone}
          returnToList={openedFromUnitsList}
          editHotspotHref={hotspotEditorHref(selectedSpace)}
          onClose={closeSpaceDetail}
          onExplore={() => {
            setSelectedSpace(null);
            setOpenedFromMap(false);
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

      {!uiCleared && !(isMobile && (mobilePanel || facilityOpen || selectedSpace || selectedAd || pickerOpen)) && (
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
                setUnitsOpen(false);
                setFacilityOpen(false);
              }
              return !v;
            });
          }}
          className="tour-chrome-pill pointer-events-auto absolute bottom-24 left-3 z-[70] flex size-11 items-center justify-center rounded-full sm:bottom-28 sm:left-5"
          aria-label={uiCleared ? t("Tampilkan UI") : t("Sembunyikan UI")}
          title={uiCleared ? t("Tampilkan UI") : t("Sembunyikan UI")}
        >
          {uiCleared ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
        </button>
      )}
    </div>
  );
}
