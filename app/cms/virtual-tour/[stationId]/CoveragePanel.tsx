"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, CircleDashed, MapPin } from "lucide-react";
import { isMediaSpaceType } from "@/lib/hotspot-types";
import type { HotspotItem } from "@/lib/hotspot-types";
import type { SpaceAvailabilityStatus } from "@/lib/space-availability";
import { spaceStatusColor } from "@/lib/space-availability";

type SceneRef = {
  sceneId: string;
  title: string;
  hotspots: Omit<HotspotItem, "_id">[];
};

type SpaceRef = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: SpaceAvailabilityStatus;
  tenantBrand?: string | null;
};

type Placement = {
  sceneId: string;
  sceneTitle: string;
  hotspotIndex: number;
  hotspotType: "space" | "ad";
};

type Props = {
  spaces: SpaceRef[];
  scenes: SceneRef[];
  currentHotspots: HotspotItem[];
  currentSceneId: string | null;
  onJumpTo: (sceneId: string, hotspotIndex: number) => void;
  hideKindFilters?: boolean;
};

export function CoveragePanel({
  spaces,
  scenes,
  currentHotspots,
  currentSceneId,
  onJumpTo,
  hideKindFilters = false,
}: Props) {
  const [mode, setMode] = useState<"all" | "retail" | "media">("all");
  const [onlyMissing, setOnlyMissing] = useState(false);

  const placementMap = useMemo(() => {
    const map = new Map<string, Placement[]>();
    const push = (code: string, placement: Placement) => {
      const key = code.toLowerCase();
      const list = map.get(key) ?? [];
      list.push(placement);
      map.set(key, list);
    };

    for (const scene of scenes) {
      const list =
        scene.sceneId === currentSceneId
          ? currentHotspots.map((h) => {
              const { _id, ...rest } = h;
              void _id;
              return rest;
            })
          : scene.hotspots;
      list.forEach((h, index) => {
        if ((h.type === "space" || h.type === "ad") && h.spaceCode) {
          push(h.spaceCode, {
            sceneId: scene.sceneId,
            sceneTitle: scene.title,
            hotspotIndex: index,
            hotspotType: h.type,
          });
        }
      });
    }
    return map;
  }, [scenes, currentHotspots, currentSceneId]);

  const rows = useMemo(() => {
    return spaces
      .filter((s) => {
        if (mode === "media") return isMediaSpaceType(s.type);
        if (mode === "retail") return !isMediaSpaceType(s.type);
        return true;
      })
      .map((s) => {
        const placements = placementMap.get(s.code.toLowerCase()) ?? [];
        return { space: s, placements, covered: placements.length > 0 };
      })
      .filter((r) => (onlyMissing ? !r.covered : true))
      .sort((a, b) => Number(a.covered) - Number(b.covered) || a.space.code.localeCompare(b.space.code));
  }, [spaces, mode, onlyMissing, placementMap]);

  const coveredCount = rows.filter((r) => r.covered).length;
  const totalShown = rows.length;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Coverage</h3>
        <span className="text-[10px] text-slate-500">
          {coveredCount}/{mode === "all" ? spaces.length : totalShown + (onlyMissing ? coveredCount : 0)}
        </span>
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {hideKindFilters ? null : (
          <>
            {(["all", "retail", "media"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-md px-2 py-1 text-[10px] font-medium ${
                  mode === m ? "bg-slate-700 text-white" : "text-slate-500 hover:bg-slate-800"
                }`}
              >
                {m === "all" ? "Semua" : m === "retail" ? "Retail" : "Media"}
              </button>
            ))}
          </>
        )}
        <button
          type="button"
          onClick={() => setOnlyMissing((v) => !v)}
          className={`ml-auto rounded-md px-2 py-1 text-[10px] font-medium ${
            onlyMissing ? "bg-amber-900/60 text-amber-200" : "text-slate-500 hover:bg-slate-800"
          }`}
        >
          Belum saja
        </button>
      </div>

      <div className="max-h-56 space-y-1 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="py-3 text-center text-[11px] text-slate-500">Tidak ada data</p>
        ) : (
          rows.map(({ space, placements, covered }) => (
            <div
              key={space.id}
              className="rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-1.5"
            >
              <div className="flex items-start gap-2">
                {covered ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                ) : (
                  <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: spaceStatusColor(space.status) }}
                    />
                    <p className="truncate font-mono text-[11px] text-slate-200">{space.code}</p>
                  </div>
                  {space.status === "TERISI" && space.tenantBrand ? (
                    <>
                      <p className="truncate text-[10px] font-semibold text-emerald-400">
                        {space.tenantBrand}
                      </p>
                      <p className="truncate text-[9px] text-slate-600">{space.name}</p>
                    </>
                  ) : (
                    <p className="truncate text-[10px] text-slate-500">{space.name}</p>
                  )}
                  {covered ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {placements.map((p) => (
                        <button
                          key={`${p.sceneId}-${p.hotspotIndex}`}
                          type="button"
                          onClick={() => onJumpTo(p.sceneId, p.hotspotIndex)}
                          className="inline-flex items-center gap-0.5 rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-300 hover:bg-slate-700"
                          title={`Buka di ${p.sceneTitle}`}
                        >
                          <MapPin className="h-2.5 w-2.5" />
                          {p.sceneTitle}
                          <span className="text-slate-500">({p.hotspotType})</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-0.5 text-[9px] text-amber-500/80">Belum ditandai di tour</p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
