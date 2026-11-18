"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Map as MapIcon, Maximize2, X } from "lucide-react";
import MinimapCanvas from "@/components/tour/MinimapCanvas";
import type { MinimapViewStore } from "@/lib/minimap-view-store";
import type { PanoramaScene, TourLevelPublic } from "@/lib/tour-types";

type Props = {
  levels: TourLevelPublic[];
  scenes: PanoramaScene[];
  activeSceneId: string;
  viewStore: MinimapViewStore;
  onSelectScene: (sceneId: string) => void;
  className?: string;
};

const noopSubscribe = () => () => {};

/**
 * Minimap tur publik: denah level aktif dengan posisi scene, kerucut arah pandang yang ikut kamera,
 * dan klik titik untuk berpindah scene. Tidak tampil bila level aktif belum punya denah.
 */
export default function TourMinimap({ levels, scenes, activeSceneId, viewStore, onSelectScene, className = "" }: Props) {
  const view = useSyncExternalStore(viewStore.subscribe, viewStore.get, viewStore.get);
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [pickedLevelId, setPickedLevelId] = useState<string | null>(null);

  const mapLevels = useMemo(() => levels.filter((level) => level.minimap), [levels]);
  const activeLevelId = useMemo(() => {
    const byPin = mapLevels.find((level) => level.minimap?.pins[activeSceneId]);
    if (byPin) return byPin.id;
    return scenes.find((scene) => scene.id === activeSceneId)?.levelId ?? null;
  }, [mapLevels, scenes, activeSceneId]);

  // Pilihan lantai manual dilepas saat pengunjung pindah scene, agar denah kembali ke posisinya.
  const [lastActiveSceneId, setLastActiveSceneId] = useState(activeSceneId);
  if (lastActiveSceneId !== activeSceneId) {
    setLastActiveSceneId(activeSceneId);
    setPickedLevelId(null);
  }

  const level = mapLevels.find((item) => item.id === (pickedLevelId ?? activeLevelId)) ?? null;

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  if (!level?.minimap) return null;
  const minimap = level.minimap;
  const sceneLabels = scenes.map((scene) => ({ sceneId: scene.id, title: scene.title }));
  const activeTitle = scenes.find((scene) => scene.id === activeSceneId)?.title;
  const isHere = Boolean(minimap.pins[activeSceneId]);

  const levelTabs =
    mapLevels.length > 1 ? (
      <div className="flex gap-1 overflow-x-auto">
        {mapLevels.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPickedLevelId(item.id)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              item.id === level.id ? "bg-[#c41230] text-white" : "bg-white/10 text-white/80 hover:bg-white/20"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    ) : null;

  const selectAndClose = (sceneId: string) => {
    onSelectScene(sceneId);
    setExpanded(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-[#1C0A0E]/80 px-3.5 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md transition hover:bg-[#1C0A0E] ${className}`}
        aria-label="Tampilkan denah"
      >
        <MapIcon className="size-4" /> Denah
      </button>
    );
  }

  return (
    <>
      <div
        className={`pointer-events-auto w-[min(17rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-white/15 bg-[#1C0A0E]/85 text-white shadow-2xl backdrop-blur-md ${className}`}
      >
        <div className="flex items-center gap-2 px-3 pb-2 pt-2.5">
          <MapIcon className="size-4 shrink-0 text-[#ff8a9a]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold">Denah {level.label}</p>
            <p className="truncate text-[10px] text-white/60">
              {isHere ? `Anda di: ${activeTitle ?? "-"}` : "Posisi Anda ada di lantai lain"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Perbesar denah"
            title="Perbesar"
          >
            <Maximize2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Sembunyikan denah"
            title="Sembunyikan"
          >
            <X className="size-3.5" />
          </button>
        </div>
        {levelTabs ? <div className="px-3 pb-2">{levelTabs}</div> : null}
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="block w-full bg-white"
          aria-label="Perbesar denah"
        >
          <MinimapCanvas minimap={minimap} scenes={sceneLabels} activeSceneId={activeSceneId} view={view} />
        </button>
      </div>

      {expanded && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-8" role="dialog" aria-modal="true" aria-label={`Denah ${level.label}`}>
              <button type="button" aria-label="Tutup denah" onClick={() => setExpanded(false)} className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />
              <div className="relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-[#101828]">Denah {level.label}</p>
                    <p className="text-xs text-slate-500">Klik titik untuk pindah ke lokasi tersebut.</p>
                  </div>
                  {mapLevels.length > 1 ? (
                    <div className="flex gap-1">
                      {mapLevels.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setPickedLevelId(item.id)}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                            item.id === level.id ? "bg-[#c41230] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <button type="button" onClick={() => setExpanded(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-[#101828]" aria-label="Tutup denah">
                    <X className="size-5" />
                  </button>
                </div>
                <div className="min-h-0 overflow-auto p-2 sm:p-4">
                  <MinimapCanvas
                    minimap={minimap}
                    scenes={sceneLabels}
                    activeSceneId={activeSceneId}
                    view={view}
                    onSelectScene={selectAndClose}
                    className="mx-auto max-h-[75vh]"
                  />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
