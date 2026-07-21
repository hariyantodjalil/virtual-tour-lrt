"use client";

import { useMemo } from "react";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HotspotItem } from "@/lib/hotspot-types";

type SceneNode = {
  sceneId: string;
  title: string;
  hotspots: Omit<HotspotItem, "_id">[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  scenes: SceneNode[];
  currentHotspots: HotspotItem[];
  currentSceneId: string | null;
  activeSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
};

type Edge = {
  from: string;
  to: string;
  broken: boolean;
};

export function ConnectionMapDialog({
  open,
  onClose,
  scenes,
  currentHotspots,
  currentSceneId,
  activeSceneId,
  onSelectScene,
}: Props) {
  const graph = useMemo(() => {
    const ids = new Set(scenes.map((s) => s.sceneId));
    const edges: Edge[] = [];
    const incoming = new Map<string, number>();
    for (const id of ids) incoming.set(id, 0);

    for (const scene of scenes) {
      const list =
        scene.sceneId === currentSceneId
          ? currentHotspots.map(({ _id: _, ...rest }) => rest)
          : scene.hotspots;
      for (const h of list) {
        if (h.type !== "scene" || !h.sceneId) continue;
        const broken = !ids.has(h.sceneId);
        edges.push({ from: scene.sceneId, to: h.sceneId, broken });
        if (!broken) incoming.set(h.sceneId, (incoming.get(h.sceneId) ?? 0) + 1);
      }
    }

    const orphans = scenes.filter((s) => (incoming.get(s.sceneId) ?? 0) === 0);
    const brokenCount = edges.filter((e) => e.broken).length;
    return { edges, incoming, orphans, brokenCount };
  }, [scenes, currentHotspots, currentSceneId]);

  if (!open) return null;

  const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(scenes.length))));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Peta Koneksi Scene</h2>
            <p className="text-[11px] text-slate-500">
              {graph.edges.length} tautan · {graph.orphans.length} tanpa incoming
              {graph.brokenCount > 0 ? ` · ${graph.brokenCount} rusak` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {scenes.map((scene) => {
              const out = graph.edges.filter((e) => e.from === scene.sceneId);
              const isActive = scene.sceneId === activeSceneId;
              const isOrphan = graph.orphans.some((o) => o.sceneId === scene.sceneId);
              const hasBroken = out.some((e) => e.broken);

              return (
                <button
                  key={scene.sceneId}
                  type="button"
                  onClick={() => {
                    onSelectScene(scene.sceneId);
                    onClose();
                  }}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    isActive
                      ? "border-emerald-500 bg-emerald-950/40"
                      : "border-slate-700 bg-slate-850 hover:border-slate-500 hover:bg-slate-800"
                  }`}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-100">{scene.title}</p>
                    {isOrphan && (
                      <span className="shrink-0 rounded bg-amber-950 px-1.5 py-0.5 text-[9px] text-amber-300">
                        orphan
                      </span>
                    )}
                  </div>
                  <p className="mb-2 font-mono text-[10px] text-slate-500">{scene.sceneId}</p>
                  <p className="text-[10px] text-slate-400">
                    in {graph.incoming.get(scene.sceneId) ?? 0} · out {out.length}
                  </p>
                  {out.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {out.map((e, i) => {
                        const target = scenes.find((s) => s.sceneId === e.to);
                        return (
                          <li
                            key={`${e.from}-${e.to}-${i}`}
                            className={`truncate text-[10px] ${
                              e.broken ? "text-red-400" : "text-slate-500"
                            }`}
                          >
                            → {target?.title ?? e.to}
                            {e.broken ? " (rusak)" : ""}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {hasBroken && (
                    <p className="mt-2 flex items-center gap-1 text-[10px] text-red-400">
                      <AlertTriangle className="h-3 w-3" /> Target tidak valid
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-800 px-4 py-3">
          <Button variant="outline" size="sm" onClick={onClose} className="border-slate-600">
            Tutup
          </Button>
        </div>
      </div>
    </div>
  );
}
