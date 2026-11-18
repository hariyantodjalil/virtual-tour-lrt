"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import type { TrainInfo } from "@/lib/trains-data";
import type { TrainRentalSpacePublic } from "@/lib/train-rental-spaces-shared";
import { trainRentalStatusToSpaceStatus, TRAIN_RENTAL_STATUS_LABELS } from "@/lib/train-rental-sales";
import { getTourLocationBreadcrumb } from "@/lib/tour-location-breadcrumb";
import { VIRTUAL_TOUR_LANDING, TRAIN_TOUR_LANDING } from "@/lib/tour-nav";
import { findScenePlacement, firstSceneIdInLevel, defaultAreaForLevel } from "@/lib/public-train-tour-structure";
import { resolvePublicAssetUrl, shouldUnoptimizeImage } from "@/lib/s3-utils";

type Props = { trainInfo: TrainInfo; rentalSpaces: TrainRentalSpacePublic[] };
const toolClass = "tour-chrome-pill flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-white";

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
          {trainInfo.levels.length > 0 && <div className="tour-chrome-pill pointer-events-auto min-w-0 flex-1 rounded-2xl px-2 py-1.5 md:w-[min(52vw,390px)] md:flex-none">
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
    {panel === "info" && <TrainTourPanel title="Informasi kereta" centered compact onClose={() => setPanel(null)}>
      <div className="min-h-0 overflow-y-auto overscroll-contain">
        {trainInfo.imageUrl && <div className="relative aspect-[2/1] max-h-64 bg-slate-100">
          <Image src={resolvePublicAssetUrl(trainInfo.imageUrl)} alt={trainInfo.name} fill
            sizes="(max-width: 767px) 100vw, 640px" className="object-cover"
            unoptimized={shouldUnoptimizeImage(resolvePublicAssetUrl(trainInfo.imageUrl))} />
        </div>}
        <div className="px-5 py-6 sm:px-7 sm:py-7">
          <h2 className="text-xl font-semibold leading-tight text-slate-900 sm:text-2xl">{trainInfo.name}</h2>
          {trainInfo.formation && <dl className="mt-5 border-y border-slate-200 py-4">
            <dt className="text-sm text-slate-600">Formasi kereta</dt>
            <dd className="mt-1 break-words text-base font-semibold text-slate-900">{trainInfo.formation}</dd>
          </dl>}
          {trainInfo.description && <p className="mt-5 max-w-prose whitespace-pre-wrap break-words text-base leading-relaxed text-slate-700">{trainInfo.description}</p>}
        </div>
      </div>
    </TrainTourPanel>}
    {panel === "media" && <TrainTourPanel title="Media iklan" centered wide fitContent onClose={() => setPanel(null)}>
      <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-2 sm:px-6 sm:py-3">
        <ul className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
          {rentalSpaces.map(space => <li key={space.id} className="min-w-0 border-b border-slate-200 last:border-0 md:[&:nth-last-child(2):nth-child(odd)]:border-0">
            <TourSheetAction afterClose={() => openMedia(space.id)} className="group flex min-h-24 w-full items-center gap-3 rounded-lg py-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D] sm:gap-4">
              {space.image && <span className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:size-20">
                <Image src={resolvePublicAssetUrl(space.image)} alt="" fill sizes="80px" className="object-cover" style={{ objectPosition: space.objectPosition }}
                  unoptimized={shouldUnoptimizeImage(resolvePublicAssetUrl(space.image))} />
              </span>}
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-slate-500">Media {space.displayNumber}</span>
                <span className="mt-1 block break-words text-base font-semibold leading-snug text-slate-900">{space.title}</span>
                <span className={`mt-2 inline-flex items-center gap-1.5 text-xs font-medium ${space.status === "TERSEDIA" ? "text-emerald-700" : space.status === "TERBATAS" ? "text-amber-800" : "text-slate-600"}`}>
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{TRAIN_RENTAL_STATUS_LABELS[space.status]}
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-slate-400 group-hover:text-[#E31E2D]" />
            </TourSheetAction>
          </li>)}
        </ul>
        {!rentalSpaces.length && <p className="py-10 text-center text-base text-slate-600">Belum ada media iklan.</p>}
      </div>
    </TrainTourPanel>}
    {infoPopup && <InTourInfoPopup title={infoPopup.title} description={infoPopup.description} onClose={() => setInfoPopup(null)} />}
    {selectedSpace && <TrainRentalSpaceDetail key={selectedSpace.id} space={selectedSpace} onClose={() => setSelectedSpace(null)} backLabel="Kembali ke Tour" initialCarSlug={currentCar?.slug} />}
  </div>;
}
