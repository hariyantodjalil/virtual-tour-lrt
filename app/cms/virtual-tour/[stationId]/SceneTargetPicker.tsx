"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import type { TourLevel } from "@/lib/virtual-tour-structure";

type SceneRef = {
  sceneId: string;
  title: string;
  level: string;
  levelId?: string | null;
  areaId?: string | null;
  order: number;
};

type Props = {
  levels: TourLevel[];
  scenes: SceneRef[];
  currentSceneId: string;
  value?: string;
  defaultLevelId?: string | null;
  defaultAreaId?: string | null;
  /** Berubah saat hotspot lain dipilih — untuk reset default level/area */
  syncKey: string;
  onChange: (sceneId: string) => void;
};

function resolveLevelId(scene: SceneRef, levels: TourLevel[]): string {
  if (scene.levelId) return scene.levelId;
  return levels.find((l) => l.slug === scene.level)?.id ?? "";
}

function resolvePickerSelection(
  levels: TourLevel[],
  scenes: SceneRef[],
  value: string | undefined,
  defaultLevelId: string | null | undefined,
  defaultAreaId: string | null | undefined
) {
  if (value) {
    const target = scenes.find((s) => s.sceneId === value);
    if (target) {
      return {
        levelId: resolveLevelId(target, levels),
        areaId: target.areaId ?? "",
      };
    }
  }
  const lvl = defaultLevelId ?? levels[0]?.id ?? "";
  const level = levels.find((l) => l.id === lvl);
  return {
    levelId: lvl,
    areaId: defaultAreaId ?? level?.areas[0]?.id ?? "",
  };
}

const selectClass =
  "w-full bg-slate-800 border border-slate-700 rounded-md h-8 px-2 text-sm text-slate-100";

export function SceneTargetPicker({
  levels,
  scenes,
  currentSceneId,
  value,
  defaultLevelId,
  defaultAreaId,
  syncKey,
  onChange,
}: Props) {
  const initial = resolvePickerSelection(levels, scenes, value, defaultLevelId, defaultAreaId);
  const [levelId, setLevelId] = useState(initial.levelId);
  const [areaId, setAreaId] = useState(initial.areaId);
  const [prevSyncKey, setPrevSyncKey] = useState(syncKey);

  // Reset level/area hanya saat ganti hotspot (syncKey), biarkan user ubah filter bebas
  if (syncKey !== prevSyncKey) {
    setPrevSyncKey(syncKey);
    const next = resolvePickerSelection(levels, scenes, value, defaultLevelId, defaultAreaId);
    setLevelId(next.levelId);
    setAreaId(next.areaId);
  }

  const selectedLevel = levels.find((l) => l.id === levelId);
  const areas = selectedLevel?.areas ?? [];

  const availableScenes = scenes
    .filter((s) => s.sceneId !== currentSceneId)
    .filter((s) => {
      const sLevel = resolveLevelId(s, levels);
      if (levelId && sLevel !== levelId) return false;
      if (areaId && s.areaId && s.areaId !== areaId) return false;
      if (areaId && !s.areaId) {
        const area = areas.find((a) => a.id === areaId);
        if (area && s.level !== selectedLevel?.slug) return false;
      }
      return true;
    })
    .sort((a, b) => a.order - b.order);

  function handleLevelChange(nextLevelId: string) {
    setLevelId(nextLevelId);
    const nextLevel = levels.find((l) => l.id === nextLevelId);
    const nextAreaId = nextLevel?.areas[0]?.id ?? "";
    setAreaId(nextAreaId);
    if (value) {
      const target = scenes.find((s) => s.sceneId === value);
      if (!target || resolveLevelId(target, levels) !== nextLevelId) {
        onChange("");
      }
    }
  }

  function handleAreaChange(nextAreaId: string) {
    setAreaId(nextAreaId);
    if (value) {
      const target = scenes.find((s) => s.sceneId === value);
      if (target?.areaId && target.areaId !== nextAreaId) {
        onChange("");
      }
    }
  }

  const targetLevel = levels.find((l) => l.id === levelId);
  const targetArea = areas.find((a) => a.id === areaId);

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs text-slate-500 mb-1.5 block">Level</Label>
        <select
          value={levelId}
          onChange={(e) => handleLevelChange(e.target.value)}
          className={selectClass}
        >
          {levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label className="text-xs text-slate-500 mb-1.5 block">Area</Label>
        <select
          value={areaId}
          onChange={(e) => handleAreaChange(e.target.value)}
          className={selectClass}
          disabled={areas.length === 0}
        >
          {areas.length === 0 ? (
            <option value="">— tidak ada area —</option>
          ) : (
            areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.label}
              </option>
            ))
          )}
        </select>
      </div>

      <div>
        <Label className="text-xs text-slate-500 mb-1.5 block">Scene</Label>
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={selectClass}
          disabled={availableScenes.length === 0}
        >
          <option value="">— pilih scene —</option>
          {availableScenes.map((s) => (
            <option key={s.sceneId} value={s.sceneId}>
              {s.title}
            </option>
          ))}
        </select>
        {availableScenes.length === 0 && (
          <p className="text-[10px] text-slate-500 mt-1">
            Tidak ada scene lain di {targetLevel?.label}
            {targetArea ? ` › ${targetArea.label}` : ""}. Pilih level/area lain atau tambah scene.
          </p>
        )}
      </div>

      {value && (
        <p className="text-[10px] text-slate-600 font-mono">
          → {value}
          {targetLevel && targetArea && (
            <span className="text-slate-500">
              {" "}
              · {targetLevel.label} › {targetArea.label}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
