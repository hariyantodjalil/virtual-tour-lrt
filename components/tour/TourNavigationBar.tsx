"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Layers, MapPinned } from "lucide-react";
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
  offsetClassName?: string;
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
  offsetClassName = "",
}: Props) {
  const [sceneMenuOpen, setSceneMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const activeLevel = levels.find((l) => l.id === activeLevelId) ?? levels[0];
  const showAreaRow = (activeLevel?.areas.length ?? 0) >= 1;
  const sceneTitle = (id: string) => scenes.find((s) => s.id === id)?.title ?? id;
  const sceneIndex = Math.max(0, visibleSceneIds.indexOf(activeSceneId));
  const hasScenes = visibleSceneIds.length > 0;
  const canPrev = sceneIndex > 0;
  const canNext = sceneIndex >= 0 && sceneIndex < visibleSceneIds.length - 1;

  useEffect(() => {
    if (!sceneMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSceneMenuOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setSceneMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [sceneMenuOpen]);

  useEffect(() => {
    if (!sceneMenuOpen) return;
    const active = menuRef.current?.querySelector<HTMLElement>("[data-active-scene='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [sceneMenuOpen, activeSceneId]);

  if (levels.length === 0) return null;

  function goRelative(delta: number) {
    const next = visibleSceneIds[sceneIndex + delta];
    if (next) {
      setSceneMenuOpen(false);
      onSelectScene(next);
    }
  }

  function pickLevel(levelId: string) {
    setSceneMenuOpen(false);
    onSelectLevel(levelId);
  }

  function pickArea(areaId: string) {
    setSceneMenuOpen(false);
    onSelectArea(areaId);
  }

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-4 sm:px-5 tour-nav-rise ${offsetClassName}`}
    >
      <div
        ref={menuRef}
        className="pointer-events-auto relative w-full max-w-lg"
      >
        {/* Scene picker sheet — vertikal, bukan scroll horizontal */}
        {sceneMenuOpen && visibleSceneIds.length > 1 && (
          <div
            id={listId}
            role="listbox"
            aria-label="Pilih scene"
            className="tour-glass-panel absolute inset-x-0 bottom-[calc(100%+10px)] max-h-[min(42vh,20rem)] overflow-y-auto rounded-2xl p-2 shadow-[0_20px_50px_rgba(28,10,14,0.55)]"
          >
            <p className="px-2.5 pb-2 pt-1 font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C4A8AD]">
              Scene di area ini · {visibleSceneIds.length}
            </p>
            <div className="space-y-1">
              {visibleSceneIds.map((sceneId, idx) => {
                const isActive = sceneId === activeSceneId;
                return (
                  <button
                    key={sceneId}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    data-active-scene={isActive ? "true" : undefined}
                    onClick={() => {
                      onSelectScene(sceneId);
                      setSceneMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? "bg-[#E31E2D] text-white"
                        : "text-[#F8ECEE]/80 hover:bg-white/8 hover:text-white"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-display text-[11px] font-bold ${
                        isActive ? "bg-white/20" : "bg-[#1C0A0E]/55 text-[#C4A8AD]"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold">
                      {sceneTitle(sceneId)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="tour-glass rounded-2xl p-2 shadow-[0_18px_40px_rgba(28,10,14,0.45)]">
          {/* Level */}
          {levels.length >= 1 && (
            <div className="mb-1.5 flex items-center gap-2 px-1">
              <Layers className="h-3.5 w-3.5 shrink-0 text-[#C4A8AD]" aria-hidden />
              <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {levels.map((level) => {
                  const isActive = level.id === activeLevelId;
                  return (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => pickLevel(level.id)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-xs font-semibold transition-all duration-300 ${
                        isActive
                          ? "text-white"
                          : "text-[#F8ECEE]/60 hover:bg-white/8 hover:text-white"
                      }`}
                      style={
                        isActive
                          ? {
                              background: level.color || "#E31E2D",
                              boxShadow: `0 6px 16px ${(level.color || "#E31E2D")}44`,
                            }
                          : undefined
                      }
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: isActive ? "#fff" : level.color || "#E31E2D" }}
                      />
                      {level.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Area — select native jika banyak, chip jika sedikit */}
          {showAreaRow && activeLevel && (
            <div className="mb-1.5 flex items-center gap-2 px-1">
              <MapPinned className="h-3.5 w-3.5 shrink-0 text-[#C4A8AD]" aria-hidden />
              {activeLevel.areas.length > 4 ? (
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Pilih area</span>
                  <select
                    value={activeAreaId ?? activeLevel.areas[0]?.id ?? ""}
                    onChange={(e) => pickArea(e.target.value)}
                    className="h-9 w-full appearance-none rounded-xl border border-[color:rgb(255_214_218_/_0.14)] bg-[#1C0A0E]/55 py-1.5 pr-8 pl-3 font-display text-xs font-semibold text-[#F8ECEE] outline-none focus:border-[#E31E2D]/50"
                  >
                    {activeLevel.areas.map((area) => (
                      <option key={area.id} value={area.id} className="bg-[#1C0A0E]">
                        {area.label} ({area.sceneIds.length})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#C4A8AD]" />
                </label>
              ) : (
                <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {activeLevel.areas.map((area) => {
                    const isActive = area.id === activeAreaId;
                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => pickArea(area.id)}
                        className={`shrink-0 rounded-full px-3 py-1.5 font-display text-[11px] font-semibold transition-all duration-300 ${
                          isActive
                            ? "bg-white text-[#1C0A0E]"
                            : "text-[#F8ECEE]/60 hover:bg-white/8 hover:text-white"
                        }`}
                      >
                        {area.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Scene stepper — prev / current picker / next */}
          {hasScenes && (
            <div className="flex items-center gap-1.5 rounded-xl bg-[#1C0A0E]/45 p-1">
              <button
                type="button"
                disabled={!canPrev}
                onClick={() => goRelative(-1)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#F8ECEE] transition enabled:hover:bg-white/10 disabled:opacity-30"
                aria-label="Scene sebelumnya"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() =>
                  visibleSceneIds.length > 1 && setSceneMenuOpen((open) => !open)
                }
                aria-expanded={sceneMenuOpen}
                aria-controls={visibleSceneIds.length > 1 ? listId : undefined}
                className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-2 py-2 transition ${
                  visibleSceneIds.length > 1
                    ? "hover:bg-white/8"
                    : "cursor-default"
                } ${sceneMenuOpen ? "bg-white/10" : ""}`}
              >
                <span className="font-display text-[10px] font-bold text-[#E31E2D] tabular-nums">
                  {sceneIndex + 1}/{visibleSceneIds.length}
                </span>
                <span className="min-w-0 truncate font-display text-sm font-semibold text-[#F8ECEE]">
                  {sceneTitle(activeSceneId)}
                </span>
                {visibleSceneIds.length > 1 && (
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-[#C4A8AD] transition-transform ${
                      sceneMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                )}
              </button>

              <button
                type="button"
                disabled={!canNext}
                onClick={() => goRelative(1)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#F8ECEE] transition enabled:hover:bg-white/10 disabled:opacity-30"
                aria-label="Scene berikutnya"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
