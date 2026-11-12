"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Info, List } from "lucide-react";
import VirtualTourViewer from "@/components/tour/VirtualTourViewer";
import TourLeftPanel from "@/components/tour/TourLeftPanel";
import TrainFormationMap from "@/components/tour/TrainFormationMap";
import ContactPersonFab from "@/components/tour/ContactPersonFab";
import InTourInfoPopup from "@/components/tour/InTourInfoPopup";
import TrainRentalSpaceDetail from "@/components/train/TrainRentalSpaceDetail";
import TrainTourPanel from "@/components/train/TrainTourPanel";
import { TourSheetAction } from "@/components/tour/MobileTourSheet";
import type { TrainInfo } from "@/lib/trains-data";
import type { TrainRentalSpacePublic } from "@/lib/train-rental-spaces-shared";
import { trainRentalStatusToSpaceStatus, TRAIN_RENTAL_STATUS_LABELS } from "@/lib/train-rental-sales";
import { getTourLocationBreadcrumb } from "@/lib/tour-location-breadcrumb";
import { VIRTUAL_TOUR_LANDING, TRAIN_TOUR_LANDING } from "@/lib/tour-nav";
import { findScenePlacement, firstSceneIdInLevel, defaultAreaForLevel } from "@/lib/public-train-tour-structure";

type Props = { trainInfo: TrainInfo; rentalSpaces: TrainRentalSpacePublic[] };
const toolClass = "flex size-11 items-center justify-center rounded-full border border-white/12 bg-[#1c1c1e]/78 text-white backdrop-blur-md transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white";

export default function TrainTourClient({ trainInfo, rentalSpaces }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firstScene = trainInfo.levels[0]?.areas[0]?.sceneIds[0] ?? trainInfo.levels[0]?.sceneIds[0] ?? trainInfo.scenes[0]?.id;
  const [activeLevelId, setActiveLevelId] = useState(trainInfo.levels[0]?.id ?? "");
  const [activeSceneId, setActiveSceneId] = useState(firstScene ?? "");
  const [infoPopup, setInfoPopup] = useState<{ title: string; description: string } | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<TrainRentalSpacePublic | null>(() => {
    const code = searchParams.get("space");
    return rentalSpaces.find(item => item.displayNumber === code || item.id === code) ?? null;
  });
  const [panel, setPanel] = useState<"info" | "media" | null>(null);
  const [uiCleared, setUiCleared] = useState(false);
  const [autoRotateControlContainer, setAutoRotateControlContainer] = useState<HTMLDivElement | null>(null);
  const currentCar = trainInfo.levels.find(level => level.id === activeLevelId) ?? trainInfo.levels[0];
  const currentCarLabel = currentCar?.label?.trim() || "Gerbong";
  const chromeVisible = !uiCleared && !infoPopup && !selectedSpace && !panel;
  const breadcrumb = getTourLocationBreadcrumb(trainInfo, activeSceneId);

  const handleSelectCar = useCallback((carId: string) => {
    const level = trainInfo.levels.find(item => item.id === carId);
    if (!level) return;
    const area = defaultAreaForLevel(level);
    const sceneId = area?.sceneIds[0] ?? firstSceneIdInLevel(level) ?? activeSceneId;
    setActiveLevelId(carId);
    if (sceneId) setActiveSceneId(sceneId);
  }, [trainInfo.levels, activeSceneId]);

  const handleSceneChange = useCallback((sceneId: string) => {
    setActiveSceneId(sceneId);
    const placement = findScenePlacement(trainInfo.levels, sceneId);
    if (placement) setActiveLevelId(placement.level.id);
  }, [trainInfo.levels]);

  function openMedia(code: string) {
    const space = rentalSpaces.find(item => item.displayNumber === code || item.id === code);
    if (space) { setSelectedSpace(space); setPanel(null); }
  }

  return <div className="tour-shell relative h-[100dvh] w-full overflow-hidden">
    <VirtualTourViewer scenes={trainInfo.scenes} stationName={trainInfo.name} initialScene={activeSceneId}
      selectedSceneId={activeSceneId} onSceneChange={handleSceneChange}
      onInfoClick={(title, description) => setInfoPopup({ title, description })}
      onSpaceClick={openMedia} onAdClick={payload => { if (payload.spaceCode) openMedia(payload.spaceCode); }}
      spaces={rentalSpaces.map(space => ({ code: space.displayNumber, status: trainRentalStatusToSpaceStatus(space.status) }))}
      hideSceneBar spaceMarker="info-pin" autoRotateControlContainer={autoRotateControlContainer} chromeTone="maroon" />
    {chromeVisible && <>
      <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(to_bottom,rgba(28,10,14,.5)_0%,transparent_28%,transparent_65%,rgba(28,10,14,.5)_100%)]" />
      <TourLeftPanel stationName={trainInfo.name} locationBreadcrumb={breadcrumb} locationKind="Kereta"
        pickLabel="Pilih Tour" homeHref={VIRTUAL_TOUR_LANDING} onPickStation={() => router.push(TRAIN_TOUR_LANDING)}
        railClassName="[@media(max-height:480px)]:top-auto [@media(max-height:480px)]:bottom-24 [@media(max-height:480px)]:translate-y-0 [@media(max-height:480px)]:flex-row"
        clearUiControl={<button type="button" onClick={() => setUiCleared(true)} className={toolClass} aria-label="Sembunyikan UI" title="Sembunyikan UI"><EyeOff className="size-5" /></button>}
        tools={<>
          <button type="button" onClick={() => setPanel("info")} className={toolClass} aria-label="Info kereta" title="Info kereta"><Info className="size-5" /></button>
          <button type="button" onClick={() => setPanel("media")} className={toolClass} aria-label="Media iklan" title="Media iklan"><List className="size-5" /></button>
        </>} />
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-[60] px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
        <div className="relative flex items-end gap-2 md:min-h-[76px] md:justify-center">
          {trainInfo.levels.length > 0 && <div className="pointer-events-auto min-w-0 flex-1 rounded-2xl border border-white/12 bg-[#1c1c1e]/78 px-2 py-1.5 text-white backdrop-blur-md md:w-[min(52vw,390px)] md:flex-none">
            <p className="px-1 text-left text-xs font-semibold md:text-center">{currentCarLabel}</p>
            <TrainFormationMap touchTargets cars={trainInfo.levels.map(level => ({ id: level.id, label: level.label }))}
              activeCarId={activeLevelId} onSelectCar={handleSelectCar} className="w-full" />
          </div>}
          <div className="pointer-events-auto flex shrink-0 items-center gap-2 pb-1.5 md:absolute md:right-0 md:bottom-0">
            <div ref={setAutoRotateControlContainer} className="flex size-11 items-center justify-center" />
            <ContactPersonFab compact className="static" />
          </div>
        </div>
      </footer>
    </>}
    {uiCleared && <button type="button" onClick={() => setUiCleared(false)} className={toolClass + " absolute bottom-5 left-3 z-[70] sm:left-5"} aria-label="Tampilkan UI" title="Tampilkan UI"><Eye className="size-5" /></button>}
    {panel === "info" && <TrainTourPanel title="Informasi kereta" compact onClose={() => setPanel(null)}>
      <div className="min-h-0 overflow-y-auto p-5"><h2 className="text-lg font-semibold">{trainInfo.name}</h2>
        {trainInfo.formation && <p className="mt-2 text-sm text-slate-600">{trainInfo.formation}</p>}
        {trainInfo.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{trainInfo.description}</p>}
      </div>
    </TrainTourPanel>}
    {panel === "media" && <TrainTourPanel title="Media iklan" onClose={() => setPanel(null)}>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {rentalSpaces.map(space => <TourSheetAction key={space.id} afterClose={() => openMedia(space.id)} className="flex min-h-16 w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#E31E2D]">
          <span className="text-sm font-semibold text-slate-500">{space.displayNumber}</span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{space.title}</span><span className="mt-1 block text-xs text-slate-600">{TRAIN_RENTAL_STATUS_LABELS[space.status]}</span></span>
        </TourSheetAction>)}
        {!rentalSpaces.length && <p className="p-3 text-sm text-slate-600">Belum ada media iklan.</p>}
      </div>
    </TrainTourPanel>}
    {infoPopup && <InTourInfoPopup title={infoPopup.title} description={infoPopup.description} onClose={() => setInfoPopup(null)} />}
    {selectedSpace && <TrainRentalSpaceDetail key={selectedSpace.id} space={selectedSpace} onClose={() => setSelectedSpace(null)} backLabel="Kembali ke Tour" initialCarSlug={currentCar?.slug} />}
  </div>;
}
