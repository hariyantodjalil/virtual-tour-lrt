"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Compass,
  Crosshair,
  Loader2,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Ruler,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import MinimapCanvas from "@/components/tour/MinimapCanvas";
import { cmsFetch } from "@/lib/cms-fetch";
import {
  calibrateHeading,
  floorAngleToImageDir,
  floorBasis,
  imageDirToFloorAngle,
  parseLevelMinimap,
  type LevelMinimap,
  type MinimapPoint,
} from "@/lib/minimap";

type LevelOption = { id: string; label: string; minimap?: unknown };
type SceneOption = { sceneId: string; title: string; levelId?: string | null };

type Mode = "none" | "corners" | "place" | "heading";

type Props = {
  stationId: string;
  levels: LevelOption[];
  scenes: SceneOption[];
  currentSceneId: string | null;
  getView: () => { yaw: number; pitch: number; hfov: number } | null;
  onSaved: (levelId: string, minimap: LevelMinimap | null) => void;
  onClose: () => void;
};

const MODE_HINT: Record<Mode, string> = {
  none: "",
  corners:
    "Klik 3 sudut lantai di denah: 1) satu sudut lantai, 2) sudut di ujung sisi pertama, 3) sudut di ujung sisi kedua.",
  place: "Klik posisi scene aktif di denah.",
  heading:
    "Putar panorama editor sampai menghadap suatu patokan (eskalator, pintu, dll.), lalu klik patokan yang sama di denah.",
};

/**
 * Panel melayang di editor stasiun untuk mengatur minimap: unggah denah per level, kalibrasi
 * 3 sudut lantai (untuk denah isometrik), taruh posisi scene, dan atur arah hadap scene.
 */
export default function MinimapEditorPanel({
  stationId,
  levels,
  scenes,
  currentSceneId,
  getView,
  onSaved,
  onClose,
}: Props) {
  const currentScene = scenes.find((scene) => scene.sceneId === currentSceneId) ?? null;
  const [levelId, setLevelId] = useState<string>(() => currentScene?.levelId ?? levels[0]?.id ?? "");
  const level = levels.find((item) => item.id === levelId) ?? null;
  const savedMinimap = useMemo(() => parseLevelMinimap(level?.minimap), [level?.minimap]);

  const [mode, setMode] = useState<Mode>("none");
  const [draftCorners, setDraftCorners] = useState<MinimapPoint[]>([]);
  const [busy, setBusy] = useState<"upload" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [wide, setWide] = useState(false);
  const [view, setView] = useState<{ yaw: number; hfov: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Ikuti arah kamera editor agar kerucut pandang scene aktif terlihat hidup.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = getView();
      if (!next) return;
      setView((prev) =>
        prev && Math.abs(prev.yaw - next.yaw) < 0.2 && Math.abs(prev.hfov - next.hfov) < 0.2
          ? prev
          : { yaw: next.yaw, hfov: next.hfov }
      );
    }, 150);
    return () => window.clearInterval(timer);
  }, [getView]);

  const minimap = savedMinimap;
  const currentPin = currentSceneId && minimap ? minimap.pins[currentSceneId] : undefined;
  const levelScenes = scenes.filter((scene) => scene.levelId === levelId);
  const placedCount = minimap ? levelScenes.filter((scene) => minimap.pins[scene.sceneId]).length : 0;

  async function save(next: LevelMinimap | null) {
    if (!level) return false;
    setBusy("save");
    setError(null);
    try {
      const res = await cmsFetch(`/api/cms/virtual-tour/${stationId}/levels/${level.id}/minimap`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minimap: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan minimap");
        return false;
      }
      onSaved(level.id, next);
      setSavedAt(Date.now());
      return true;
    } finally {
      setBusy(null);
    }
  }

  async function uploadImage(file: File) {
    if (!level) return;
    if (minimap && Object.keys(minimap.pins).length > 0) {
      const ok = confirm("Mengganti denah akan menghapus posisi semua scene di level ini. Lanjutkan?");
      if (!ok) return;
    }
    setBusy("upload");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await cmsFetch(`/api/cms/virtual-tour/${stationId}/levels/${level.id}/minimap`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Gagal mengunggah denah");
        return;
      }
      setBusy(null);
      await save({ imageUrl: data.imageUrl, width: data.width, height: data.height, pins: {} });
      setMode("corners");
      setDraftCorners([]);
    } finally {
      setBusy(null);
    }
  }

  /** Kalibrasi ulang mempertahankan arah scene di gambar, bukan angka sudutnya. */
  function applyCorners(corners: [MinimapPoint, MinimapPoint, MinimapPoint]): LevelMinimap | null {
    if (!minimap) return null;
    const oldBasis = floorBasis(minimap);
    const newBasis = floorBasis({ corners });
    const pins = Object.fromEntries(
      Object.entries(minimap.pins).map(([sceneId, pin]) => {
        if (pin.angleRef == null || pin.yawRef == null) return [sceneId, pin];
        const dir = floorAngleToImageDir(oldBasis, pin.angleRef);
        return [sceneId, { ...pin, angleRef: imageDirToFloorAngle(newBasis, dir.x, dir.y) }];
      })
    );
    return { ...minimap, corners, pins };
  }

  async function handleCanvasClick(point: MinimapPoint) {
    if (!minimap) return;
    if (mode === "corners") {
      const next = [...draftCorners, point];
      if (next.length < 3) {
        setDraftCorners(next);
        return;
      }
      const corners = next as [MinimapPoint, MinimapPoint, MinimapPoint];
      setDraftCorners([]);
      setMode("none");
      const [p0, p1, p2] = corners;
      const cross = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
      const spread = Math.hypot(p1.x - p0.x, p1.y - p0.y) * Math.hypot(p2.x - p0.x, p2.y - p0.y);
      if (spread === 0 || Math.abs(cross) / spread < 0.05) {
        setError("Ketiga titik hampir segaris. Klik sudut lantai yang membentuk huruf L.");
        return;
      }
      const updated = applyCorners(corners);
      if (updated) await save(updated);
      return;
    }
    if (!currentSceneId) return;
    if (mode === "place") {
      const previous = minimap.pins[currentSceneId];
      const pin = { ...previous, x: point.x, y: point.y };
      setMode(previous?.angleRef == null ? "heading" : "none");
      await save({ ...minimap, pins: { ...minimap.pins, [currentSceneId]: pin } });
      return;
    }
    if (mode === "heading" && currentPin) {
      const live = getView();
      if (!live) {
        setError("Panorama editor belum siap. Tunggu panorama tampil lalu coba lagi.");
        return;
      }
      const pin = calibrateHeading(minimap, currentPin, point, live.yaw);
      if (!pin) {
        setError("Klik patokan yang agak jauh dari titik scene.");
        return;
      }
      setMode("none");
      await save({ ...minimap, pins: { ...minimap.pins, [currentSceneId]: pin } });
    }
  }

  async function removeCurrentPin() {
    if (!minimap || !currentSceneId || !currentPin) return;
    const pins = { ...minimap.pins };
    delete pins[currentSceneId];
    await save({ ...minimap, pins });
  }

  async function removeMinimap() {
    if (!minimap) return;
    if (!confirm(`Hapus denah level ${level?.label ?? ""} beserta semua posisi scene?`)) return;
    setMode("none");
    await save(null);
  }

  const toggleMode = (next: Mode) => {
    setError(null);
    setDraftCorners([]);
    setMode((prev) => (prev === next ? "none" : next));
  };

  const toolBtn = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
      active
        ? "border-[#c41230] bg-[#c41230] text-white"
        : "border-slate-300 bg-white text-[#101828] hover:bg-slate-50"
    }`;

  return (
    <div
      className={`pointer-events-auto absolute right-3 top-3 z-30 flex max-h-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-[#101828] shadow-2xl ${
        wide ? "w-[min(720px,calc(100%-1.5rem))]" : "w-[min(400px,calc(100%-1.5rem))]"
      }`}
    >
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5">
        <MapIcon className="size-4 shrink-0 text-[#c41230]" />
        <p className="text-sm font-black">Minimap</p>
        <select
          value={levelId}
          onChange={(event) => {
            setLevelId(event.target.value);
            setMode("none");
            setDraftCorners([]);
          }}
          className="ml-1 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
          aria-label="Pilih level"
        >
          {levels.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
              {parseLevelMinimap(item.minimap) ? "" : " (belum ada denah)"}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setWide((value) => !value)}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#101828]"
          aria-label={wide ? "Kecilkan panel" : "Lebarkan panel"}
          title={wide ? "Kecilkan" : "Lebarkan"}
        >
          {wide ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#101828]"
          aria-label="Tutup panel minimap"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void uploadImage(file);
          }}
        />

        {!minimap ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
            <p className="text-sm font-semibold">Level ini belum punya denah</p>
            <p className="mt-1 text-xs text-slate-500">Unggah gambar denah (PNG/JPG/WebP). Denah isometrik juga bisa.</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy !== null || !level}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#c41230] px-3 py-2 text-xs font-semibold text-white hover:bg-[#a30f28] disabled:opacity-50"
            >
              {busy === "upload" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Unggah denah
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={toolBtn(mode === "corners")} onClick={() => toggleMode("corners")} disabled={busy !== null}>
                <Ruler className="size-3.5" /> Kalibrasi lantai
              </button>
              <button
                type="button"
                className={toolBtn(mode === "place")}
                onClick={() => toggleMode("place")}
                disabled={busy !== null || !currentSceneId}
              >
                <Crosshair className="size-3.5" /> Taruh scene aktif
              </button>
              <button
                type="button"
                className={toolBtn(mode === "heading")}
                onClick={() => toggleMode("heading")}
                disabled={busy !== null || !currentPin}
                title={currentPin ? undefined : "Taruh scene di denah dulu"}
              >
                <Compass className="size-3.5" /> Atur arah
              </button>
            </div>

            {mode !== "none" ? (
              <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                {MODE_HINT[mode]}
                {mode === "corners" ? ` (${draftCorners.length}/3)` : ""}
              </p>
            ) : null}

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <MinimapCanvas
                minimap={minimap}
                scenes={scenes}
                activeSceneId={currentSceneId}
                view={view}
                onCanvasClick={mode === "none" ? undefined : (point) => void handleCanvasClick(point)}
                showCalibration={mode === "corners" || !minimap.corners}
                draftCorners={mode === "corners" ? draftCorners : undefined}
                crosshair={mode !== "none"}
              />
            </div>

            <div className="space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <p>
                Scene aktif: <span className="font-semibold text-[#101828]">{currentScene?.title ?? "-"}</span>
                {" · "}
                {currentPin
                  ? currentPin.angleRef != null
                    ? "posisi dan arah sudah diatur"
                    : "posisi sudah, arah belum"
                  : "belum ada di denah"}
              </p>
              <p>
                {placedCount}/{levelScenes.length} scene level ini sudah ditaruh
                {minimap.corners ? " · lantai terkalibrasi" : " · lantai belum dikalibrasi (dianggap tampak atas)"}
              </p>
              {currentScene && currentScene.levelId && currentScene.levelId !== levelId ? (
                <p className="text-amber-700">Scene aktif berada di level lain; pin tetap disimpan di denah level ini.</p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" className={toolBtn(false)} onClick={() => fileRef.current?.click()} disabled={busy !== null}>
                {busy === "upload" ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} Ganti denah
              </button>
              <button type="button" className={toolBtn(false)} onClick={() => void removeCurrentPin()} disabled={busy !== null || !currentPin}>
                <Trash2 className="size-3.5" /> Hapus pin scene
              </button>
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-45"
                onClick={() => void removeMinimap()}
                disabled={busy !== null}
              >
                Hapus denah
              </button>
            </div>
          </>
        )}

        {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
        <p className="text-[11px] text-slate-400">
          {busy === "save" ? "Menyimpan…" : savedAt ? "Perubahan minimap tersimpan otomatis." : "Perubahan minimap tersimpan otomatis, terpisah dari tombol Simpan scene."}
        </p>
      </div>
    </div>
  );
}
