"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import Image from "next/image";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Package,
  Link2,
  ArrowRightLeft,
  ImageIcon,
  MapPin,
  Route,
  Layers,
  ChevronsDownUp,
  ChevronsUpDown,
  GripVertical,
} from "lucide-react";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import type { TourArea, TourLevel } from "@/lib/virtual-tour-structure";
import type { HotspotItem } from "./PanoramaCanvas";

export type SidebarScene = {
  id: string;
  sceneId: string;
  title: string;
  level: string;
  levelId?: string | null;
  areaId?: string | null;
  panoramaUrl: string;
  thumbnailUrl?: string | null;
  order: number;
  hotspots: Omit<HotspotItem, "_id">[];
  isActive: boolean;
};

type Props = {
  levels: TourLevel[];
  scenes: SidebarScene[];
  selectedSceneIndex: number;
  incomingMap: Map<string, number>;
  onSelectScene: (index: number) => void;
  onMoveScene: (index: number, dir: "up" | "down") => void;
  onDeleteScene: (scene: SidebarScene) => void;
  onAddScene: (areaId: string, levelSlug: string) => void;
  onBulkImport: () => void;
  onManageLevels: () => void;
  onReorderLevels: (orderedLevelIds: string[]) => void;
  onAddArea: (levelId: string, levelLabel: string) => void;
  onEditArea: (area: TourArea, levelLabel: string) => void;
  onDeleteArea: (area: TourArea, levelLabel: string) => void;
  onAutoWalkPath: (areaId: string) => void;
};

const STORAGE_KEY = "vt-editor-tree-expanded";

function loadExpanded(): { levels: string[]; areas: string[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveExpanded(levels: Set<string>, areas: Set<string>) {
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ levels: [...levels], areas: [...areas] })
  );
}

export function TourStructureSidebar({
  levels,
  scenes,
  selectedSceneIndex,
  incomingMap,
  onSelectScene,
  onMoveScene,
  onDeleteScene,
  onAddScene,
  onBulkImport,
  onManageLevels,
  onReorderLevels,
  onAddArea,
  onEditArea,
  onDeleteArea,
  onAutoWalkPath,
}: Props) {
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [dragLevelId, setDragLevelId] = useState<string | null>(null);
  const [dropLevelId, setDropLevelId] = useState<string | null>(null);

  const scenesByArea = (areaId: string) =>
    scenes
      .map((scene, index) => ({ scene, index }))
      .filter(({ scene }) => scene.areaId === areaId)
      .sort((a, b) => a.scene.order - b.scene.order);

  const selectedScene = scenes[selectedSceneIndex] ?? null;

  const selectionPath = useMemo(() => {
    if (!selectedScene) return null;
    const level = levels.find((l) => l.id === selectedScene.levelId || l.slug === selectedScene.level);
    const area = level?.areas.find((a) => a.id === selectedScene.areaId);
    if (!level) return null;
    return { level, area };
  }, [selectedScene, levels]);

  // Hydrate expanded tree dari sessionStorage + buka path scene aktif (async agar tidak cascade render)
  useEffect(() => {
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      if (cancelled) return;
      const saved = loadExpanded();
      const levelIds = new Set(saved?.levels ?? []);
      const areaIds = new Set(saved?.areas ?? []);

      if (levelIds.size === 0 && levels[0]) {
        levelIds.add(levels[0].id);
        if (levels[0].areas[0]) areaIds.add(levels[0].areas[0].id);
      }

      const scene = scenes[selectedSceneIndex];
      if (scene?.levelId) levelIds.add(scene.levelId);
      if (scene?.areaId) areaIds.add(scene.areaId);

      setExpandedLevels(levelIds);
      setExpandedAreas(areaIds);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [levels, scenes, selectedSceneIndex]);

  useEffect(() => {
    if (!hydrated) return;
    saveExpanded(expandedLevels, expandedAreas);
  }, [expandedLevels, expandedAreas, hydrated]);

  function toggleLevel(levelId: string) {
    setExpandedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(levelId)) next.delete(levelId);
      else next.add(levelId);
      return next;
    });
  }

  function toggleArea(areaId: string, levelId: string) {
    setExpandedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
    setExpandedLevels((prev) => new Set(prev).add(levelId));
  }

  function expandAll() {
    setExpandedLevels(new Set(levels.map((l) => l.id)));
    setExpandedAreas(new Set(levels.flatMap((l) => l.areas.map((a) => a.id))));
  }

  function collapseAll() {
    setExpandedLevels(new Set());
    setExpandedAreas(new Set());
    if (selectedScene?.levelId) {
      setExpandedLevels(new Set([selectedScene.levelId]));
    }
    if (selectedScene?.areaId) {
      setExpandedAreas(new Set([selectedScene.areaId]));
    }
  }

  const allExpanded =
    levels.length > 0 &&
    levels.every((l) => expandedLevels.has(l.id)) &&
    levels.every((l) => l.areas.every((a) => expandedAreas.has(a.id)));

  function handleLevelDragStart(levelId: string) {
    setDragLevelId(levelId);
  }

  function handleLevelDragOver(e: DragEvent, levelId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragLevelId && dragLevelId !== levelId) {
      setDropLevelId(levelId);
    }
  }

  function handleLevelDrop(targetLevelId: string) {
    if (!dragLevelId || dragLevelId === targetLevelId) {
      setDragLevelId(null);
      setDropLevelId(null);
      return;
    }
    const ids = levels.map((l) => l.id);
    const from = ids.indexOf(dragLevelId);
    const to = ids.indexOf(targetLevelId);
    if (from < 0 || to < 0) {
      setDragLevelId(null);
      setDropLevelId(null);
      return;
    }
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, dragLevelId);
    setDragLevelId(null);
    setDropLevelId(null);
    onReorderLevels(next);
  }

  function handleLevelDragEnd() {
    setDragLevelId(null);
    setDropLevelId(null);
  }

  return (
    <aside className="flex w-72 flex-none flex-col overflow-hidden border-r border-slate-800 bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-800 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Struktur Tur</span>
            <span className="text-xs text-slate-600">({scenes.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={allExpanded ? collapseAll : expandAll}
              className="p-0.5 text-slate-500 transition-colors hover:text-slate-200"
              title={allExpanded ? "Tutup semua" : "Buka semua"}
            >
              {allExpanded ? (
                <ChevronsDownUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronsUpDown className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={onManageLevels}
              className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-emerald-700 hover:text-emerald-400"
              title="Tambah / edit / hapus level"
            >
              <Layers className="h-3 w-3" />
              Level
            </button>
            <button
              onClick={onBulkImport}
              className="p-0.5 text-slate-500 transition-colors hover:text-sky-400"
              title="Bulk import panorama"
            >
              <Package className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {selectionPath && (
          <div className="mt-2 rounded-md border border-slate-800 bg-slate-800/50 px-2 py-1.5">
            <p className="text-[9px] uppercase tracking-wider text-slate-500">Sedang diedit</p>
            <p className="mt-0.5 truncate text-[11px] font-medium text-slate-200">
              <span style={{ color: selectionPath.level.color }}>{selectionPath.level.label}</span>
              {selectionPath.area && (
                <>
                  <span className="text-slate-600"> › </span>
                  <span>{selectionPath.area.label}</span>
                </>
              )}
              {selectedScene && (
                <>
                  <span className="text-slate-600"> › </span>
                  <span className="text-emerald-400">{selectedScene.title}</span>
                </>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-1.5">
        {levels.map((level) => {
          const levelOpen = expandedLevels.has(level.id);
          const levelSceneCount = level.areas.reduce(
            (sum, area) => sum + scenesByArea(area.id).length,
            0
          );

          return (
            <div key={level.id} className="mb-1">
              {/* Level row — drag handle untuk urutan tab publik */}
              <div
                onDragOver={(e) => handleLevelDragOver(e, level.id)}
                onDrop={() => handleLevelDrop(level.id)}
                className={`flex items-center gap-0.5 rounded-lg pr-1 transition-colors hover:bg-slate-800/60 ${
                  selectedScene?.levelId === level.id ? "bg-slate-800/40" : ""
                } ${dragLevelId === level.id ? "opacity-40" : ""} ${
                  dropLevelId === level.id ? "ring-1 ring-emerald-500/70 bg-emerald-950/30" : ""
                }`}
              >
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", level.id);
                    handleLevelDragStart(level.id);
                  }}
                  onDragEnd={handleLevelDragEnd}
                  className="shrink-0 cursor-grab rounded p-1 text-slate-600 active:cursor-grabbing hover:bg-slate-700 hover:text-slate-300"
                  title="Drag untuk ubah urutan level (tab publik)"
                  aria-label={`Geser urutan level ${level.label}`}
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleLevel(level.id)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-2 text-left"
                  aria-expanded={levelOpen}
                >
                  {levelOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  )}
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: level.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-[11px] font-bold uppercase tracking-wide"
                      style={{ color: level.color }}
                    >
                      {level.label}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {level.areas.length} area · {levelSceneCount} scene
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => onAddArea(level.id, level.label)}
                  className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-700 hover:text-emerald-400"
                  title={`Tambah area di ${level.label}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Areas */}
              {levelOpen && (
                <div className="ml-3 border-l border-slate-800 pl-1">
                  {level.areas.map((area) => {
                    const areaOpen = expandedAreas.has(area.id);
                    const areaScenes = scenesByArea(area.id);

                    return (
                      <div key={area.id} className="mb-0.5">
                        {/* Area row */}
                        <div
                          className={`flex items-center gap-0.5 rounded-lg pr-0.5 transition-colors hover:bg-slate-800/50 ${
                            selectedScene?.areaId === area.id ? "bg-slate-800/30" : ""
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleArea(area.id, level.id)}
                            className="flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-1.5 text-left"
                            aria-expanded={areaOpen}
                          >
                            {areaOpen ? (
                              <ChevronDown className="h-3 w-3 shrink-0 text-slate-500" />
                            ) : (
                              <ChevronRight className="h-3 w-3 shrink-0 text-slate-500" />
                            )}
                            <MapPin className="h-3 w-3 shrink-0 text-slate-500" />
                            <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-300">
                              {area.label}
                            </span>
                            <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-500">
                              {areaScenes.length}
                            </span>
                          </button>
                          <div className="flex shrink-0 items-center">
                            {areaScenes.length >= 2 && (
                              <button
                                onClick={() => onAutoWalkPath(area.id)}
                                className="rounded p-1 text-slate-500 hover:text-sky-400"
                                title="Tautkan jalur jalan"
                              >
                                <Route className="h-3 w-3" />
                              </button>
                            )}
                            <button
                              onClick={() => onEditArea(area, level.label)}
                              className="rounded px-1 py-1 text-[9px] text-slate-500 hover:text-slate-300"
                              title="Edit area"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => onDeleteArea(area, level.label)}
                              className="rounded p-1 text-slate-600 hover:text-red-400"
                              title="Hapus area"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {/* Scenes */}
                        {areaOpen && (
                          <div className="ml-4 space-y-0.5 border-l border-slate-800/80 pl-2 py-0.5">
                            {areaScenes.map(({ scene, index }, posInArea) => {
                              const isSelected = index === selectedSceneIndex;
                              const incomingCount = incomingMap.get(scene.sceneId) ?? 0;
                              const outgoingCount = scene.hotspots.filter((h) => h.type === "scene").length;
                              const first = posInArea === 0;
                              const last = posInArea === areaScenes.length - 1;
                              const thumb = scene.thumbnailUrl || scene.panoramaUrl;

                              return (
                                <div
                                  key={scene.id}
                                  className={`group relative flex cursor-pointer items-center gap-2 rounded-md border px-1.5 py-1.5 transition-all ${
                                    isSelected
                                      ? "border-emerald-500/50 bg-emerald-600/15"
                                      : "border-transparent hover:border-slate-700 hover:bg-slate-800/80"
                                  }`}
                                  onClick={() => onSelectScene(index)}
                                >
                                  {thumb ? (
                                    <div className="relative h-8 w-10 shrink-0 overflow-hidden rounded bg-slate-800">
                                      <Image
                                        src={getS3ProxyUrl(thumb)}
                                        alt=""
                                        fill
                                        className="object-cover opacity-80"
                                        sizes="40px"
                                      />
                                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-center text-[8px] font-mono text-white/90">
                                        {posInArea + 1}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex h-8 w-10 shrink-0 flex-col items-center justify-center rounded bg-slate-800/80">
                                      <ImageIcon className="h-3 w-3 text-slate-600" />
                                      <span className="text-[8px] font-mono text-slate-500">{posInArea + 1}</span>
                                    </div>
                                  )}

                                  <div className="min-w-0 flex-1">
                                    <p className={`truncate text-[11px] font-medium leading-tight ${isSelected ? "text-white" : "text-slate-300"}`}>
                                      {scene.title}
                                    </p>
                                    <div className="flex items-center gap-2 text-[9px] text-slate-500">
                                      <span className="font-mono truncate">{scene.sceneId}</span>
                                      <span className="flex items-center gap-0.5">
                                        <ArrowRightLeft className="h-2 w-2" />
                                        {outgoingCount}
                                      </span>
                                      <span className="flex items-center gap-0.5">
                                        <Link2 className="h-2 w-2" />
                                        {incomingCount}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex shrink-0 flex-col gap-0 opacity-0 transition-opacity group-hover:opacity-100">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onMoveScene(index, "up");
                                      }}
                                      disabled={first}
                                      className="rounded p-0.5 text-slate-400 hover:text-white disabled:opacity-20"
                                    >
                                      <ChevronUp className="h-2.5 w-2.5" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onMoveScene(index, "down");
                                      }}
                                      disabled={last}
                                      className="rounded p-0.5 text-slate-400 hover:text-white disabled:opacity-20"
                                    >
                                      <ChevronDown className="h-2.5 w-2.5" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteScene(scene);
                                      }}
                                      className="rounded p-0.5 text-red-400 hover:text-red-300"
                                    >
                                      <Trash2 className="h-2.5 w-2.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}

                            <button
                              onClick={() => onAddScene(area.id, level.slug)}
                              className="flex w-full items-center gap-1 rounded-md border border-dashed border-slate-800 px-2 py-1.5 text-[10px] text-slate-600 transition-colors hover:border-emerald-800/60 hover:text-emerald-400"
                            >
                              <Plus className="h-3 w-3" />
                              Tambah scene
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {level.areas.length === 0 && (
                    <p className="px-2 py-2 text-[10px] text-slate-600">Belum ada area</p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {levels.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-600">
            <p>Belum ada level.</p>
            <button
              onClick={onManageLevels}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-emerald-400 hover:bg-emerald-900/30"
            >
              <Layers className="h-3.5 w-3.5" />
              Tambah Level Pertama
            </button>
          </div>
        )}
      </div>

      {/* Footer: kelola level */}
      {levels.length > 0 && (
        <div className="border-t border-slate-800 p-2">
          <button
            type="button"
            onClick={onManageLevels}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 py-2 text-[11px] font-medium text-slate-400 transition-colors hover:border-emerald-800 hover:text-emerald-400"
          >
            <Layers className="h-3.5 w-3.5" />
            Kelola Level (tambah / hapus)
          </button>
        </div>
      )}
    </aside>
  );
}
