"use client";

import { useMemo, useState } from "react";
import { cmsFetch } from "@/lib/cms-fetch";
import { normalizeHotspots } from "@/lib/hotspot-normalize";
import { resolveSceneEntryView } from "@/lib/scene-entry-view";
import { extractInitialViewFromCanvasData } from "@/lib/scene-initial-view";
import type { Hotspot, SceneInitialView } from "@/lib/tour-types";
import { SceneEntryViewDialog, type SceneEntryViewSelection } from "./SceneEntryViewDialog";

type Scene = { sceneId: string; title: string; panoramaUrl: string; canvasData?: unknown; hotspots: Hotspot[] };

export function IncomingSceneViews({ destination, scenes, outgoingHotspots, endpoint, disabled, onSaved }: {
  destination: Scene;
  scenes: Scene[];
  outgoingHotspots: Hotspot[];
  endpoint: string;
  disabled: boolean;
  onSaved: (sourceId: string, hotspots: Hotspot[], hasOverride: boolean) => void;
}) {
  const [selection, setSelection] = useState<SceneEntryViewSelection | null>(null);
  const incoming = useMemo(() => scenes.flatMap(source => {
    if (source.sceneId === destination.sceneId) return [];
    const entries = normalizeHotspots(source.hotspots)
      .map((hotspot, index) => ({ hotspot, index }))
      .filter(({ hotspot }) => hotspot.type === "scene" && hotspot.sceneId === destination.sceneId);
    return entries.length ? [{ source, entries }] : [];
  }), [scenes, destination.sceneId]);

  const outgoingIds = new Set(outgoingHotspots.flatMap(hotspot =>
    hotspot.type === "scene" && hotspot.sceneId && hotspot.sceneId !== destination.sceneId ? [hotspot.sceneId] : []));
  const outgoing = scenes.filter(scene => outgoingIds.has(scene.sceneId));
  const arrowCount = incoming.reduce((total, group) => total + group.entries.length, 0);

  async function save(view: SceneInitialView | null) {
    if (!selection?.incoming) return;
    const response = await cmsFetch(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...selection.incoming, destinationId: selection.sceneId, view }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(result?.hotspots)) {
      throw new Error(result?.error ?? "Gagal menyimpan arah tiba.");
    }
    onSaved(selection.incoming.sourceId, result.hotspots, view !== null);
    setSelection(null);
  }

  if (!destination.panoramaUrl) return null;
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold text-[var(--work-text)]">Arah tiba dari scene lain</h4>
      <p className="text-xs text-[var(--work-muted)]">{incoming.length} scene asal · {arrowCount} panah masuk</p>
      {incoming.length > 0 && (
        <ul className="max-h-60 space-y-2 overflow-y-auto">
          {incoming.map(({ source, entries }) => (
            <li key={source.sceneId} className="rounded-lg border border-[var(--work-line)] bg-[var(--work-surface)] px-2.5 py-2">
              <p className="break-words text-xs font-medium">{source.title}</p>
              {entries.map(({ hotspot, index }, occurrence) => {
                const hotspotId = `hs-${source.sceneId}-${index}`;
                const arrowLabel = entries.length > 1 ? `Panah ${occurrence + 1}` : null;
                return (
                  <button key={hotspotId} type="button" disabled={disabled}
                    aria-label={`Atur arah tiba dari ${source.title}${arrowLabel ? `, ${arrowLabel}` : ""}`}
                    className="mt-1 flex w-full items-center justify-between gap-2 rounded border-t border-[var(--work-line)] py-1 text-left text-xs hover:bg-[var(--work-subtle)] disabled:opacity-50"
                    onClick={() => setSelection({
                      hotspotId, sourceTitle: arrowLabel ? `${source.title} · ${arrowLabel}` : source.title,
                      sceneId: destination.sceneId, title: destination.title, panoramaUrl: destination.panoramaUrl,
                      initialView: resolveSceneEntryView(hotspot, extractInitialViewFromCanvasData(destination.canvasData)),
                      incoming: {
                        sourceId: source.sceneId, index, yaw: hotspot.yaw, pitch: hotspot.pitch,
                        previousView: hotspot.targetView ?? null,
                      },
                    })}>
                    <span className="text-[var(--work-muted)]">
                      {arrowLabel && `${arrowLabel} · `}{hotspot.targetView ? "Arah khusus" : "Arah bawaan"}
                    </span>
                    <span className="shrink-0 font-semibold">Atur</span>
                  </button>
                );
              })}
            </li>
          ))}
        </ul>
      )}
      <details className="text-xs text-[var(--work-muted)]">
        <summary className="cursor-pointer py-1">Scene tujuan dari panah keluar ({outgoing.length})</summary>
        {outgoing.length > 0 && (
          <ul className="space-y-0.5 pl-4">
            {outgoing.map(scene => <li key={scene.sceneId} className="break-words">{scene.title}</li>)}
          </ul>
        )}
      </details>
      {selection && <SceneEntryViewDialog selection={selection} onClose={() => setSelection(null)}
        onApply={save} onReset={selection.incoming?.previousView ? () => save(null) : undefined} />}
    </section>
  );
}
