"use client";

import { useTourLanguage } from "@/components/tour/TourLanguageProvider";
import { useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { ChevronRight, Eye, EyeOff, Info, List } from "lucide-react";
import VirtualTourViewer from "@/components/tour/VirtualTourViewer";
import TourLeftPanel from "@/components/tour/TourLeftPanel";
import TrainFormationMap from "@/components/tour/TrainFormationMap";
import ContactPersonFab from "@/components/tour/ContactPersonFab";
import InTourInfoPopup from "@/components/tour/InTourInfoPopup";
import TrainRentalSpaceDetail from "@/components/train/TrainRentalSpaceDetail";
import TrainTourPanel from "@/components/train/TrainTourPanel";
import { TourSheetAction } from "@/components/tour/MobileTourSheet";
import type { Hotspot } from "@/lib/tour-types";
import type { TrainInfo } from "@/lib/trains-data";
import type { TrainRentalSpacePublic } from "@/lib/train-rental-spaces-shared";
import { trainRentalStatusToSpaceStatus, TRAIN_RENTAL_STATUS_LABELS, trainRentalStatusBadgeClass } from "@/lib/train-rental-sales";
import { getTourLocationBreadcrumb } from "@/lib/tour-location-breadcrumb";
import { findScenePlacement, firstSceneIdInLevel, defaultAreaForLevel } from "@/lib/public-train-tour-structure";
import { resolvePublicAssetUrl, shouldUnoptimizeImage } from "@/lib/s3-utils";

type Props = { trainInfo: TrainInfo; rentalSpaces: TrainRentalSpacePublic[]; editorHref?: string };
type MediaLocation = { sceneId: string; hotspot: Hotspot };
type MediaEditorTarget = { sceneId: string; yaw: number; pitch: number; kind: "space" | "ad"; code: string };

const toolClass = "tour-chrome-pill flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-white";

const mediaFilterClass = "min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#E31E2D] aria-pressed:border-slate-900 aria-pressed:bg-slate-900 aria-pressed:text-white aria-pressed:hover:bg-slate-900";

export default function TrainTourClient({ trainInfo, rentalSpaces, editorHref }: Props) {
  const { t, content } = useTourLanguage();
  const searchParams = useSearchParams();
  const firstScene = trainInfo.levels[0]?.areas[0]?.sceneIds[0] ?? trainInfo.levels[0]?.sceneIds[0] ?? trainInfo.scenes[0]?.id;
  const [activeLevelId, setActiveLevelId] = useState(trainInfo.levels[0]?.id ?? "");
  const [activeSceneId, setActiveSceneId] = useState(firstScene ?? "");
  const [infoPopup, setInfoPopup] = useState<{ title: string; description: string } | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<TrainRentalSpacePublic | null>(() => {
    const code = searchParams.get("space");
    return rentalSpaces.find(item => item.displayNumber === code || item.id === code) ?? null;
  });
  const [mediaEditorTarget, setMediaEditorTarget] = useState<MediaEditorTarget | null>(null);
  const [panel, setPanel] = useState<"info" | "media" | null>(null);
  const [mediaCarId, setMediaCarId] = useState<string | null>(null);
  const [mediaFocus, setMediaFocus] = useState<{ location: MediaLocation; token: number } | null>(null);
  const [uiCleared, setUiCleared] = useState(false);
  const [autoRotateControlContainer, setAutoRotateControlContainer] = useState<HTMLDivElement | null>(null);
  const currentCar = trainInfo.levels.find(level => level.id === activeLevelId) ?? trainInfo.levels[0];
  const currentCarLabel = currentCar?.label?.trim() || "Gerbong";
  const chromeVisible = !uiCleared && !infoPopup && !selectedSpace && !panel;
  const location = getTourLocationBreadcrumb(trainInfo, activeSceneId);
  const sceneNumber = location.sceneLabel?.toLowerCase() === activeSceneId.toLowerCase()
    ? /^gerbong-\d+-.+-(\d+)$/i.exec(activeSceneId)?.[1]
    : undefined;
  const breadcrumb = sceneNumber ? { ...location, sceneLabel: t("Titik {number}", { number: sceneNumber }) } : location;
  const mediaLocations = useMemo(() => {
    const spaceIds = new Map(rentalSpaces.flatMap(space => [[space.id, space.id], [space.displayNumber, space.id]] as const));
    const byCar = new Map<string, Map<string, MediaLocation>>();
    const located = new Set<string>();
    for (const scene of trainInfo.scenes) {
      if (!scene.panoramaUrl) continue;
      const car = findScenePlacement(trainInfo.levels, scene.id)?.level;
      if (!car) continue;
      for (const hotspot of scene.hotspots) {
        if ((hotspot.type !== "space" && hotspot.type !== "ad") || !hotspot.spaceCode) continue;
        const id = spaceIds.get(hotspot.spaceCode.trim());
        if (!id) continue;
        const locations = byCar.get(car.id) ?? new Map<string, MediaLocation>();
        if (!locations.has(id)) locations.set(id, { sceneId: scene.id, hotspot });
        byCar.set(car.id, locations);
        located.add(id);
      }
    }
    return { byCar, located };
  }, [rentalSpaces, trainInfo.levels, trainInfo.scenes]);

  const carMedia = mediaCarId ? mediaLocations.byCar.get(mediaCarId) : undefined;
  const visibleMedia = rentalSpaces.filter(space =>
    mediaCarId ? carMedia?.has(space.id) : !mediaLocations.located.has(space.id));

  const handleSelectCar = useCallback((carId: string) => {
    const level = trainInfo.levels.find(item => item.id === carId);
    if (!level) return;
    const area = defaultAreaForLevel(level);
    const sceneId = area?.sceneIds[0] ?? firstSceneIdInLevel(level) ?? activeSceneId;
    setMediaFocus(null);
    setActiveLevelId(carId);
    if (sceneId) setActiveSceneId(sceneId);
  }, [trainInfo.levels, activeSceneId]);

  const handleSceneChange = useCallback((sceneId: string) => {
    setMediaFocus(current => current?.location.sceneId === sceneId ? current : null);
    setActiveSceneId(sceneId);
    const placement = findScenePlacement(trainInfo.levels, sceneId);
    if (placement) setActiveLevelId(placement.level.id);
  }, [trainInfo.levels]);

  function openMedia(code: string, location?: MediaLocation, marker?: MediaEditorTarget) {
    const space = rentalSpaces.find(item => item.displayNumber === code || item.id === code);
    if (!space) return;
    if (location) {
      handleSceneChange(location.sceneId);
      setMediaFocus(current => ({ location, token: (current?.token ?? 0) + 1 }));
    }
    const hotspot = location?.hotspot;
    setMediaEditorTarget(location && hotspot && (hotspot.type === "space" || hotspot.type === "ad")
      ? { sceneId: location.sceneId, yaw: hotspot.yaw, pitch: hotspot.pitch, kind: hotspot.type, code: hotspot.spaceCode ?? code }
      : marker ?? null);
    setSelectedSpace(space);
    setPanel(null);
  }

  const mediaCarSlug = mediaEditorTarget ? findScenePlacement(trainInfo.levels, mediaEditorTarget.sceneId)?.level.slug : undefined;
  const editHotspotHref = editorHref && mediaEditorTarget ? `${editorHref}?${new URLSearchParams({
    scene: mediaEditorTarget.sceneId, media: mediaEditorTarget.code, kind: mediaEditorTarget.kind,
    yaw: String(mediaEditorTarget.yaw), pitch: String(mediaEditorTarget.pitch),
  })}` : undefined;

  return <div className="tour-shell relative h-[100dvh] w-full overflow-hidden">
    <VirtualTourViewer scenes={trainInfo.scenes} stationName={trainInfo.name} initialScene={activeSceneId}
      selectedSceneId={activeSceneId} onSceneChange={handleSceneChange}
      onInfoClick={(title, description) => setInfoPopup({ title, description })}
      focusCamera={mediaFocus?.location.sceneId === activeSceneId ? mediaFocus.location.hotspot : null}
      focusToken={mediaFocus?.token}
      onSpaceClick={(code, target) => openMedia(code, undefined,
        target && "yaw" in target ? { ...target, code, kind: "space" } : undefined)}
      onAdClick={({ spaceCode, target }) => {
        if (spaceCode) openMedia(spaceCode, undefined, target ? { ...target, code: spaceCode, kind: "ad" } : undefined);
      }}
      spaces={rentalSpaces.map(space => ({ code: space.displayNumber, status: trainRentalStatusToSpaceStatus(space.status) }))}
      hideSceneBar spaceMarker="info-pin" autoRotateControlContainer={autoRotateControlContainer} chromeTone="maroon" />
    {chromeVisible && <>
      <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(to_bottom,rgba(28,10,14,.5)_0%,transparent_28%,transparent_65%,rgba(28,10,14,.5)_100%)]" />
      <TourLeftPanel stationName={trainInfo.name} locationBreadcrumb={breadcrumb} hideTourNameOnCompact
        railClassName="[@media(max-height:480px)]:top-auto [@media(max-height:480px)]:bottom-24 [@media(max-height:480px)]:translate-y-0 [@media(max-height:480px)]:flex-row"
        clearUiControl={<button type="button" onClick={() => setUiCleared(true)} className={toolClass} aria-label={t("Sembunyikan UI")} title={t("Sembunyikan UI")}><EyeOff className="size-5" /></button>}
        tools={<>
          <button
            type="button"
            onClick={() => {
              setMediaCarId(mediaLocations.located.size ? currentCar?.id ?? null : null);
              setPanel("media");
            }}
            className="tour-tool-btn tour-tool-btn--hero focus-visible:outline-2 focus-visible:outline-white"
            aria-label={t("Media iklan")}
            title={t("Media iklan")}
          >
            <List aria-hidden="true" className="size-5" />
          </button>
          <button type="button" onClick={() => setPanel("info")} className={toolClass} aria-label={t("Info kereta")} title={t("Info kereta")}><Info className="size-5" /></button>
        </>} />
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-[60] px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
        <div className="relative flex items-end gap-2 md:min-h-[76px] md:justify-center">
          {trainInfo.levels.length > 0 && <div className="tour-chrome-pill pointer-events-auto min-w-0 flex-1 rounded-2xl px-2 py-1.5 md:w-[min(52vw,390px)] md:flex-none">
            <p className="px-1 text-left text-xs font-semibold md:text-center">{content(currentCarLabel)}</p>
            <TrainFormationMap touchTargets cars={trainInfo.levels.map(level => ({ id: level.id, label: content(level.label) }))}
              activeCarId={activeLevelId} onSelectCar={handleSelectCar} className="w-full" />
          </div>}
          <div className="pointer-events-auto flex shrink-0 items-center gap-2 pb-1.5 md:absolute md:right-0 md:bottom-0">
            <div ref={setAutoRotateControlContainer} className="flex size-11 items-center justify-center" />
            <ContactPersonFab compact className="static" />
          </div>
        </div>
      </footer>
    </>}
    {uiCleared && <button type="button" onClick={() => setUiCleared(false)} className={toolClass + " absolute bottom-5 left-3 z-[70] sm:left-5"} aria-label={t("Tampilkan UI")} title={t("Tampilkan UI")}><Eye className="size-5" /></button>}
    {panel === "info" && <TrainTourPanel title={t("Informasi kereta")} centered compact onClose={() => setPanel(null)}>
      <div className="min-h-0 overflow-y-auto overscroll-contain">
        {trainInfo.imageUrl && <div className="relative aspect-[2/1] max-h-64 bg-slate-100">
          <Image src={resolvePublicAssetUrl(trainInfo.imageUrl)} alt={trainInfo.name} fill
            sizes="(max-width: 767px) 100vw, 640px" className="object-cover"
            unoptimized={shouldUnoptimizeImage(resolvePublicAssetUrl(trainInfo.imageUrl))} />
        </div>}
        <div className="px-5 py-6 sm:px-7 sm:py-7">
          <h2 className="text-xl font-semibold leading-tight text-slate-900 sm:text-2xl">{content(trainInfo.name)}</h2>
          {trainInfo.formation && <dl className="mt-5 border-y border-slate-200 py-4">
            <dt className="text-sm text-slate-600">{t("Formasi kereta")}</dt>
            <dd className="mt-1 break-words text-base font-semibold text-slate-900">{content(trainInfo.formation)}</dd>
          </dl>}
          {trainInfo.description && <p className="mt-5 max-w-prose whitespace-pre-wrap break-words text-base leading-relaxed text-slate-700">{content(trainInfo.description)}</p>}
        </div>
      </div>
    </TrainTourPanel>}
    {panel === "media" && <TrainTourPanel title={t("Media iklan")} centered wide fitContent onClose={() => setPanel(null)}>
      {rentalSpaces.length > 0 && (
        <div role="group" aria-label={t("Gerbong media iklan")} className="flex shrink-0 flex-wrap gap-1.5 border-b border-slate-200 px-4 py-3 sm:px-6">
          {trainInfo.levels.map(car => (
            <button key={car.id} type="button" aria-pressed={mediaCarId === car.id} onClick={() => setMediaCarId(car.id)}
              className={mediaFilterClass}>
              {content(car.label)}
            </button>
          ))}
          {mediaLocations.located.size < rentalSpaces.length && (
            <button type="button" aria-pressed={mediaCarId === null} onClick={() => setMediaCarId(null)}
              className={mediaFilterClass}>
              {t("Media lain")}
            </button>
          )}
        </div>
      )}
      <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-2 sm:px-6 sm:py-3">
        <ul className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
          {visibleMedia.map(space => <li key={space.id} className="min-w-0 border-b border-slate-200 last:border-0 md:[&:nth-last-child(2):nth-child(odd)]:border-0">
            <TourSheetAction afterClose={() => openMedia(space.id, carMedia?.get(space.id))} className="group flex min-h-24 w-full items-center gap-3 rounded-lg py-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D] sm:gap-4">
              {space.image && <span className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:size-20">
                <Image src={resolvePublicAssetUrl(space.image)} alt="" fill sizes="80px" className="object-cover" style={{ objectPosition: space.objectPosition }}
                  unoptimized={shouldUnoptimizeImage(resolvePublicAssetUrl(space.image))} />
              </span>}
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-slate-500">Media {space.displayNumber}</span>
                <span className="mt-1 block break-words text-base font-semibold leading-snug text-slate-900">{content(space.title)}</span>
                <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${trainRentalStatusBadgeClass(space.status)}`}>
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{t(TRAIN_RENTAL_STATUS_LABELS[space.status])}
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-slate-400 group-hover:text-[#E31E2D]" />
            </TourSheetAction>
          </li>)}
        </ul>
        {!visibleMedia.length && <p className="py-8 text-center text-sm text-slate-600">
          {rentalSpaces.length ? t("Belum ada media bertanda di gerbong ini.") : t("Belum ada media iklan.")}
        </p>}
      </div>
    </TrainTourPanel>}
    {infoPopup && <InTourInfoPopup title={infoPopup.title} description={infoPopup.description} onClose={() => setInfoPopup(null)} />}
    {selectedSpace && <TrainRentalSpaceDetail key={selectedSpace.id} space={selectedSpace} editHotspotHref={editHotspotHref} onClose={() => { setSelectedSpace(null); setMediaEditorTarget(null); }} backLabel={t("Kembali ke Tour")} initialCarSlug={mediaCarSlug} />}
  </div>;
}
