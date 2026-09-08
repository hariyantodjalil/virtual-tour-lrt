"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import VirtualTourViewer from "@/components/tour/VirtualTourViewer";
import TourLeftPanel from "@/components/tour/TourLeftPanel";
import TrainFormationMap from "@/components/tour/TrainFormationMap";
import ContactPersonFab from "@/components/tour/ContactPersonFab";
import InTourInfoPopup from "@/components/tour/InTourInfoPopup";
import TrainRentalSpaceDetail from "@/components/train/TrainRentalSpaceDetail";
import type { TrainInfo } from "@/lib/trains-data";
import type { TrainRentalSpacePublic } from "@/lib/train-rental-spaces-shared";
import { trainRentalStatusToSpaceStatus } from "@/lib/train-rental-sales";
import { VIRTUAL_TOUR_LANDING, TRAIN_TOUR_LANDING } from "@/lib/tour-nav";
import {
  findScenePlacement,
  firstSceneIdInLevel,
  defaultAreaForLevel,
} from "@/lib/public-train-tour-structure";

type Props = {
  trainInfo: TrainInfo;
  rentalSpaces: TrainRentalSpacePublic[];
};

export default function TrainTourClient({ trainInfo, rentalSpaces }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firstScene =
    trainInfo.levels[0]?.areas[0]?.sceneIds[0] ??
    trainInfo.levels[0]?.sceneIds[0] ??
    trainInfo.scenes[0]?.id;

  const [activeLevelId, setActiveLevelId] = useState(trainInfo.levels[0]?.id ?? "");
  const [activeAreaId, setActiveAreaId] = useState<string | null>(
    trainInfo.levels[0]?.areas[0]?.id ?? null
  );
  const [activeSceneId, setActiveSceneId] = useState(firstScene ?? "");
  const [infoPopup, setInfoPopup] = useState<{ title: string; description: string } | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<TrainRentalSpacePublic | null>(null);
  const [uiCleared, setUiCleared] = useState(false);
  const [spaceDeepLinkHandled, setSpaceDeepLinkHandled] = useState(false);

  useEffect(() => {
    if (spaceDeepLinkHandled) return;
    const code = searchParams.get("space");
    if (!code) return;
    const space = rentalSpaces.find(
      (item) => item.displayNumber === code || item.id === code
    );
    if (!space) return;
    setSelectedSpace(space);
    setSpaceDeepLinkHandled(true);
  }, [searchParams, rentalSpaces, spaceDeepLinkHandled]);

  const currentCar =
    trainInfo.levels.find((l) => l.id === activeLevelId) ?? trainInfo.levels[0];
  const currentCarLabel = currentCar?.label?.trim() || "Gerbong";

  const handleSelectCar = useCallback(
    (carId: string) => {
      const level = trainInfo.levels.find((l) => l.id === carId);
      if (!level) return;
      const area = defaultAreaForLevel(level);
      const sceneId = area?.sceneIds[0] ?? firstSceneIdInLevel(level) ?? activeSceneId;
      setActiveLevelId(carId);
      setActiveAreaId(area?.id ?? null);
      if (sceneId) setActiveSceneId(sceneId);
    },
    [trainInfo.levels, activeSceneId]
  );

  const handleSceneChange = useCallback(
    (sceneId: string) => {
      setActiveSceneId(sceneId);
      const placement = findScenePlacement(trainInfo.levels, sceneId);
      if (placement) {
        setActiveLevelId(placement.level.id);
        if (placement.area) setActiveAreaId(placement.area.id);
      }
    },
    [trainInfo.levels]
  );

  return (
    <div className="tour-shell relative h-[100dvh] w-full overflow-hidden">
      <VirtualTourViewer
        scenes={trainInfo.scenes}
        stationName={trainInfo.name}
        initialScene={activeSceneId}
        selectedSceneId={activeSceneId}
        onSceneChange={handleSceneChange}
        onInfoClick={(title, description) => setInfoPopup({ title, description })}
        onSpaceClick={(code) => {
          const space = rentalSpaces.find(
            (item) => item.displayNumber === code || item.id === code
          );
          if (space) setSelectedSpace(space);
        }}
        onAdClick={(payload) => {
          const code = payload.spaceCode;
          if (!code) return;
          const space = rentalSpaces.find(
            (item) => item.displayNumber === code || item.id === code
          );
          if (space) setSelectedSpace(space);
        }}
        spaces={rentalSpaces.map((space) => ({
          code: space.displayNumber,
          status: trainRentalStatusToSpaceStatus(space.status),
        }))}
        hideSceneBar
        chromeTone="maroon"
      />

      {!uiCleared && (
        <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(to_bottom,rgba(28,10,14,.55)_0%,transparent_28%,transparent_62%,rgba(28,10,14,.62)_100%)]" />
      )}

      {/* TOP CHIP — pill gerbong aktif (setara Concourse di station) */}
      {!uiCleared && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[60] px-3 pt-4 sm:px-5 sm:pt-5">
          <div className="flex items-center justify-end gap-3">
            <div className="tour-glass inline-flex items-center gap-2 rounded-full px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-[#34d399]" />
              <span className="font-display text-xs font-semibold text-white">
                {currentCarLabel}
              </span>
            </div>
          </div>
        </div>
      )}

      {!uiCleared && !infoPopup && (
        <TourLeftPanel
          stationName={currentCarLabel}
          pickLabel="Pilih Tour"
          homeHref={VIRTUAL_TOUR_LANDING}
          onPickStation={() => router.push(TRAIN_TOUR_LANDING)}
          clearUiControl={
            <button
              type="button"
              onClick={() => setUiCleared(true)}
              className="flex size-11 items-center justify-center rounded-full border border-white/12 bg-[#1c1c1e]/78 text-white backdrop-blur-md transition hover:bg-white/10"
              aria-label="Sembunyikan UI"
              title="Sembunyikan UI"
            >
              <EyeOff className="size-5" />
            </button>
          }
        />
      )}

      {/* Mini-map formasi — bawah kiri, Figma 51:861 */}
      {!uiCleared && trainInfo.levels.length > 0 && (
        <div className="pointer-events-none absolute bottom-0 left-0 z-[60] flex justify-start px-3 pb-5 sm:px-5 sm:pb-7">
          <TrainFormationMap
            cars={trainInfo.levels.map((l) => ({ id: l.id, label: l.label }))}
            activeCarId={activeLevelId}
            onSelectCar={handleSelectCar}
          />
        </div>
      )}

      {!uiCleared && (
        <ContactPersonFab className="absolute bottom-20 right-3 sm:bottom-24 sm:right-5" />
      )}

      {uiCleared && (
        <button
          type="button"
          onClick={() => setUiCleared(false)}
          className="pointer-events-auto absolute bottom-24 left-3 z-[70] flex size-11 items-center justify-center rounded-full border border-white/12 bg-[#1c1c1e]/78 text-white backdrop-blur-md transition hover:bg-white/10 sm:bottom-28 sm:left-5"
          aria-label="Tampilkan UI"
          title="Tampilkan UI"
        >
          <Eye className="size-5" />
        </button>
      )}

      {infoPopup && (
        <InTourInfoPopup
          title={infoPopup.title}
          description={infoPopup.description}
          onClose={() => setInfoPopup(null)}
        />
      )}
      {selectedSpace ? (
        <TrainRentalSpaceDetail
          key={selectedSpace.id}
          space={selectedSpace}
          onClose={() => setSelectedSpace(null)}
          backLabel="Kembali ke Tour"
          initialCarSlug={currentCar?.slug}
        />
      ) : null}
    </div>
  );
}
