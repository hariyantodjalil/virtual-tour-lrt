"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MinimapDrawing } from "@/components/tour/StationMinimap";
import type { MinimapAsset, MinimapPoint } from "@/lib/station-minimap";
import { normalizeYaw } from "@/lib/spatial/geometry/spherical";

export type MinimapCalibration = {
  levelId: string;
  sceneId: string;
  sceneTitle: string;
  yaw: number | null;
};

type Point = Pick<MinimapPoint, "x" | "y">;
type CalibrationData = {
  assets: MinimapAsset[];
  selectedSourceKey: string | null;
  pointBySource: Record<string, MinimapPoint | null>;
};

const center = { x: 0.5, y: 0.5 };
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export default function StationMinimapCalibration({ stationId, selection, onClose, onSave }: {
  stationId: string;
  selection: MinimapCalibration;
  onClose: () => void;
  onSave: () => void;
}) {
  const endpoint = `/api/cms/virtual-tour/${encodeURIComponent(stationId)}/minimap`;
  const [data, setData] = useState<CalibrationData | null>(null);
  const [sourceKey, setSourceKey] = useState("");
  const [point, setPoint] = useState<(Point & { yawOffset?: number }) | undefined>();
  const [cursor, setCursor] = useState(center);
  const [step, setStep] = useState<"position" | "direction">("position");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [readySource, setReadySource] = useState("");
  const asset = data?.assets.find(item => item.sourceKey === sourceKey);
  const ready = Boolean(asset && readySource === sourceKey);
  const canCalibrate = ready && selection.yaw !== null;

  useEffect(() => {
    const abort = new AbortController();
    const query = new URLSearchParams({ level: selection.levelId, scene: selection.sceneId });
    async function load() {
      try {
        const response = await fetch(`${endpoint}?${query}`, { signal: abort.signal });
        if (!response.ok) throw new Error("Gagal memuat denah stasiun.");
        const loaded: CalibrationData = await response.json();
        if (abort.signal.aborted) return;
        setData(loaded);
        const source = loaded.selectedSourceKey ?? (loaded.assets.length === 1 ? loaded.assets[0].sourceKey : "");
        setSourceKey(source);
        setPoint(loaded.pointBySource[source] ?? undefined);
      } catch {
        if (!abort.signal.aborted) setError("Gagal memuat denah stasiun.");
      }
    }
    void load();
    return () => abort.abort();
  }, [endpoint, selection.levelId, selection.sceneId]);

  function selectAsset(source: string) {
    setSourceKey(source);
    setReadySource("");
    setPoint(data?.pointBySource[source] ?? undefined);
    setStep("position");
    setCursor(center);
    setError("");
  }

  function place(target: Point) {
    setError("");
    if (step === "position" || !point) {
      setPoint(target);
      setStep("direction");
      return;
    }
    if (!asset || selection.yaw === null) return;
    const dx = (target.x - point.x) * asset.width;
    const dy = (target.y - point.y) * asset.height;
    if (Math.hypot(dx, dy) < Math.min(asset.width, asset.height) * 0.03) {
      setError("Pilih titik acuan yang lebih jauh dari posisi scene.");
      return;
    }
    const bearing = Math.atan2(dx, -dy) * 180 / Math.PI;
    setPoint({ ...point, yawOffset: normalizeYaw(bearing - selection.yaw) });
  }

  async function save() {
    if (!canCalibrate || point?.yawOffset === undefined || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levelId: selection.levelId, sceneId: selection.sceneId, sourceKey, point }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        setError(result?.error ?? "Gagal menyimpan minimap.");
        return;
      }
      onSave();
    } catch {
      setError("Koneksi terputus saat menyimpan minimap.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
      <DialogContent className="flex max-w-4xl flex-col gap-0 overflow-hidden border border-[var(--work-line)] bg-[var(--work-surface)] p-0 text-[var(--work-text)]">
        <DialogHeader className="shrink-0 border-b border-[var(--work-line)] px-4 py-4 pr-14 text-left sm:px-6 sm:pr-14">
          <DialogTitle>Posisi di minimap</DialogTitle>
          <DialogDescription className="text-[var(--work-muted)]">{selection.sceneTitle}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto p-4 sm:px-6">
        {!data && !error && <p role="status" className="text-sm">Memuat denah…</p>}
        {data && data.assets.length === 0 && <p className="text-sm">Denah stasiun ini belum tersedia.</p>}
        {data && data.assets.length > 0 && (
          <label className="grid gap-1.5 text-sm font-medium">
            Denah lantai
            <select value={sourceKey} onChange={event => selectAsset(event.target.value)} disabled={saving}
              className="h-10 w-full rounded-lg border border-[var(--work-line)] bg-[var(--work-bg)] px-3 text-[var(--work-text)] sm:w-72">
              <option value="">Pilih denah</option>
              {data.assets.map(item => {
                const sameName = data.assets.filter(candidate => candidate.name === item.name);
                const occurrence = sameName.indexOf(item) + 1;
                return <option key={item.sourceKey} value={item.sourceKey}>{item.name}{sameName.length > 1 ? ` (${occurrence})` : ""}</option>;
              })}
            </select>
          </label>
        )}
        {asset && (
          <div className="grid gap-2">
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={step === "position" ? "default" : "outline"}
                onClick={() => setStep("position")} aria-pressed={step === "position"} disabled={!canCalibrate || saving}>
                Posisi scene
              </Button>
              <Button type="button" size="sm" variant={step === "direction" ? "default" : "outline"}
                onClick={() => setStep("direction")} aria-pressed={step === "direction"} disabled={!canCalibrate || !point || saving}>
                Arah pandang
              </Button>
            </div>
            <p className="text-sm text-[var(--work-muted)]">
              {selection.yaw === null ? "Muat panorama untuk mengatur posisi dan arah pandang."
                : step === "position" ? "Pilih posisi kamera di denah."
                : "Pilih titik di denah yang sesuai dengan arah kamera saat dialog dibuka."}
            </p>
            <button type="button" aria-label="Atur titik pada denah. Gunakan tombol panah, lalu Enter untuk memilih."
              disabled={!canCalibrate || saving}
              onKeyDown={event => {
                const increments: Record<string, Point> = {
                  ArrowLeft: { x: -0.02, y: 0 }, ArrowRight: { x: 0.02, y: 0 },
                  ArrowUp: { x: 0, y: -0.02 }, ArrowDown: { x: 0, y: 0.02 },
                };
                const move = increments[event.key];
                if (!move) return;
                event.preventDefault();
                event.stopPropagation();
                setCursor(prev => ({ x: clamp(prev.x + move.x), y: clamp(prev.y + move.y) }));
              }}
              onClick={event => {
                if (event.detail === 0) { place(cursor); return; }
                const rect = event.currentTarget.getBoundingClientRect();
                place({ x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) });
              }}
              className="group relative mx-auto block cursor-crosshair overflow-hidden rounded-lg bg-slate-50 ring-1 ring-[var(--work-line)] focus-visible:ring-2 focus-visible:ring-[#E31E2D] disabled:cursor-default"
              style={{ aspectRatio: asset.width / asset.height, width: `min(100%, ${42 * asset.width / asset.height}dvh)` }}>
              <MinimapDrawing key={sourceKey} asset={asset} point={selection.yaw === null && point ? { x: point.x, y: point.y } : point} yaw={selection.yaw ?? 0} onImageLoad={() => setReadySource(sourceKey)} />
              <span aria-hidden="true" className="pointer-events-none absolute hidden size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-white group-focus-visible:block"
                style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }} />
            </button>
          </div>
        )}
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}
        </div>
        <DialogFooter className="shrink-0 flex-row flex-wrap justify-end gap-2 border-t border-[var(--work-line)] px-4 py-3 sm:px-6 sm:space-x-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Batal</Button>
          <Button type="button" onClick={() => void save()} disabled={!canCalibrate || point?.yawOffset === undefined || saving}>
            {saving ? "Menyimpan…" : "Simpan minimap"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
