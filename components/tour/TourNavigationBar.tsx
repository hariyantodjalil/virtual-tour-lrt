"use client";

import type { TourLevelPublic } from "@/lib/tour-types";
import type { PanoramaScene } from "@/lib/tour-types";

type Props = {
  levels: TourLevelPublic[];
  scenes: PanoramaScene[];
  activeLevelId: string;
  activeAreaId: string | null;
  activeSceneId: string;
  visibleSceneIds: string[];
  onSelectLevel: (levelId: string) => void;
  onSelectArea: (areaId: string) => void;
  onSelectScene: (sceneId: string) => void;
};

export function TourNavigationBar({
  levels,
  scenes,
  activeLevelId,
  activeAreaId,
  activeSceneId,
  visibleSceneIds,
  onSelectLevel,
  onSelectArea,
  onSelectScene,
}: Props) {
  const activeLevel = levels.find((l) => l.id === activeLevelId) ?? levels[0];
  const showAreaRow = (activeLevel?.areas.length ?? 0) >= 1;
  const sceneTitle = (id: string) => scenes.find((s) => s.id === id)?.title ?? id;

  if (levels.length === 0) return null;

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 px-3 pb-4 sm:px-5">
      {/* Level tabs — selalu tampil jika ada level */}
      {levels.length >= 1 && (
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/15 bg-black/70 px-2 py-1.5 shadow-2xl backdrop-blur-md">
          {levels.map((level) => {
            const isActive = level.id === activeLevelId;
            return (
              <button
                key={level.id}
                type="button"
                onClick={() => onSelectLevel(level.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                  isActive ? "text-white shadow-md" : "text-white/65 hover:bg-white/10 hover:text-white"
                }`}
                style={
                  isActive
                    ? { background: level.color, boxShadow: `0 4px 14px ${level.color}55` }
                    : undefined
                }
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: isActive ? "white" : level.color }}
                />
                {level.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Area tabs */}
      {showAreaRow && activeLevel && (
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-black/55 px-2 py-1 shadow-xl backdrop-blur-md">
          {activeLevel.areas.map((area) => {
            const isActive = area.id === activeAreaId;
            return (
              <button
                key={area.id}
                type="button"
                onClick={() => onSelectArea(area.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
                  isActive
                    ? "bg-white text-[#17355f]"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {area.label}
                <span className="ml-1 opacity-60">({area.sceneIds.length})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Scene pills */}
      {visibleSceneIds.length > 1 && (
        <div className="flex max-w-2xl items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-black/50 px-2 py-1.5 shadow-xl backdrop-blur-md">
          {visibleSceneIds.map((sceneId, idx) => {
            const isActive = sceneId === activeSceneId;
            return (
              <button
                key={sceneId}
                type="button"
                onClick={() => onSelectScene(sceneId)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                  isActive
                    ? "bg-[#E31E2D] text-white shadow-sm"
                    : "text-white/65 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="mr-1 font-mono text-[9px] opacity-70">{idx + 1}</span>
                {sceneTitle(sceneId)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
