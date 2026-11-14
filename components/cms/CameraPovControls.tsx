"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { PANNELLUM_EDITOR_HFOV, PANNELLUM_PITCH_LIMITS } from "@/lib/pannellum-viewer-defaults";
import { Camera, Check, Eye, RefreshCw, Trash2 } from "lucide-react";
import {
  MAX_CAMERA_BOOKMARKS,
  newCameraBookmark,
  type CameraBookmark,
} from "@/lib/scene-camera-bookmarks";

export type CameraView = { yaw: number; pitch: number; hfov: number };

type Props = {
  /** Membaca posisi kamera editor saat ini. */
  getView: () => CameraView | null;
  /** Menggerakkan kamera editor ke POV tertentu. */
  setView: (view: CameraView) => void;
  /** View awal yang sudah tersimpan untuk scene ini. */
  initialView?: { yaw: number; pitch: number; hfov?: number } | null;
  /** Simpan POV kamera saat ini sebagai view awal scene. */
  onUseCurrent: () => void;
  /** Kamera tersimpan (Kamera 1, Kamera 2, …) — khusus admin untuk pindah sudut saat menata hotspot. */
  bookmarks?: CameraBookmark[];
  onBookmarksChange?: (bookmarks: CameraBookmark[]) => void;
  /** Jadikan POV tertentu sebagai view awal scene. */
  onUseAsInitial?: (view: CameraView) => void;
  disabled?: boolean;
};

const LIVE_REFRESH_MS = 200;

function wrapYaw(yaw: number) {
  let y = yaw;
  while (y > 180) y -= 360;
  while (y <= -180) y += 360;
  return y;
}

function SliderRow({
  label,
  value,
  min,
  max,
  unit,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Label className="text-[11px] text-slate-600">{label}</Label>
        <span className="font-mono text-[11px] text-[#101828]">
          {value.toFixed(1)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={0.5}
        value={Math.min(max, Math.max(min, value))}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[#c41230] disabled:opacity-40"
        aria-label={label}
      />
    </div>
  );
}

/**
 * Atur POV kamera (arah, atas/bawah, zoom) dengan slider yang langsung menggerakkan kamera editor,
 * lalu simpan sebagai view awal scene. Nilai ikut berubah saat kamera digeser dengan mouse.
 */
export default function CameraPovControls({
  getView,
  setView,
  initialView,
  onUseCurrent,
  bookmarks = [],
  onBookmarksChange,
  onUseAsInitial,
  disabled,
}: Props) {
  const [live, setLive] = useState<CameraView | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = getView();
      setLive((prev) =>
        next &&
        (!prev ||
          Math.abs(prev.yaw - next.yaw) > 0.05 ||
          Math.abs(prev.pitch - next.pitch) > 0.05 ||
          Math.abs(prev.hfov - next.hfov) > 0.05)
          ? next
          : prev
      );
    }, LIVE_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [getView]);

  const move = (patch: Partial<CameraView>) => {
    if (!live) return;
    const next = { ...live, ...patch };
    setLive(next);
    setView(next);
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white/60 p-3">
      <div>
        <p className="text-xs font-semibold text-[#101828]">Arah kamera awal scene (POV)</p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
          Atur arah dan zoom kamera di bawah atau geser panorama langsung, lalu simpan sebagai tampilan pertama
          saat pengunjung membuka scene ini.
        </p>
      </div>

      {live ? (
        <>
          <SliderRow
            label="Arah kiri/kanan (yaw)"
            value={live.yaw}
            min={-180}
            max={180}
            unit="°"
            disabled={disabled}
            onChange={(yaw) => move({ yaw: wrapYaw(yaw) })}
          />
          <SliderRow
            label="Arah atas/bawah (pitch)"
            value={live.pitch}
            min={PANNELLUM_PITCH_LIMITS.minPitch}
            max={PANNELLUM_PITCH_LIMITS.maxPitch}
            unit="°"
            disabled={disabled}
            onChange={(pitch) => move({ pitch })}
          />
          <SliderRow
            label="Zoom (HFOV, kecil = lebih dekat)"
            value={live.hfov}
            min={PANNELLUM_EDITOR_HFOV.minHfov}
            max={PANNELLUM_EDITOR_HFOV.maxHfov}
            unit="°"
            disabled={disabled}
            onChange={(hfov) => move({ hfov })}
          />
        </>
      ) : (
        <p className="text-[10px] text-slate-500">Menunggu panorama dimuat…</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled || !initialView}
          onClick={() =>
            initialView &&
            setView({
              yaw: initialView.yaw,
              pitch: initialView.pitch,
              hfov: initialView.hfov ?? PANNELLUM_EDITOR_HFOV.hfov,
            })
          }
          className="rounded-md border border-slate-200 px-2 py-1.5 text-[11px] text-[#101828] hover:bg-slate-100 disabled:opacity-40"
        >
          Lihat view awal
        </button>
        <button
          type="button"
          disabled={disabled || !live}
          onClick={onUseCurrent}
          className="rounded-md border border-[#c41230] px-2 py-1.5 text-[11px] font-semibold text-[#FF6B6B] hover:bg-[#c41230] hover:text-white disabled:opacity-40"
        >
          Gunakan arah kamera saat ini
        </button>
      </div>

      {onBookmarksChange ? (
        <div className="space-y-2 border-t border-slate-200 pt-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[#101828]">Kamera tersimpan</p>
            <span className="text-[10px] text-slate-500">khusus admin</span>
          </div>
          {bookmarks.length === 0 ? (
            <p className="text-[10px] leading-relaxed text-slate-500">
              Simpan beberapa sudut pandang (Kamera 1, Kamera 2, …) untuk berpindah cepat saat menata hotspot.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {bookmarks.map((bookmark) => (
                <li
                  key={bookmark.id}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5"
                >
                  <div className="flex items-center gap-1.5">
                    <Camera className="size-3.5 shrink-0 text-[#E31E2D]" />
                    <input
                      value={bookmark.label}
                      disabled={disabled}
                      maxLength={40}
                      onChange={(event) =>
                        onBookmarksChange(
                          bookmarks.map((b) => (b.id === bookmark.id ? { ...b, label: event.target.value } : b))
                        )
                      }
                      className="min-w-0 flex-1 rounded bg-transparent px-1 text-[11px] font-semibold text-[#101828] outline-none focus:bg-white"
                      aria-label="Nama kamera"
                    />
                    <button
                      type="button"
                      title="Lihat dari kamera ini"
                      disabled={disabled}
                      onClick={() => setView(bookmark)}
                      className="rounded p-1 text-[#101828] hover:bg-slate-100 disabled:opacity-40"
                    >
                      <Eye className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Perbarui dengan posisi kamera saat ini"
                      disabled={disabled || !live}
                      onClick={() =>
                        live &&
                        onBookmarksChange(
                          bookmarks.map((b) =>
                            b.id === bookmark.id ? { ...newCameraBookmark(live, []), id: b.id, label: b.label } : b
                          )
                        )
                      }
                      className="rounded p-1 text-[#101828] hover:bg-slate-100 disabled:opacity-40"
                    >
                      <RefreshCw className="size-3.5" />
                    </button>
                    {onUseAsInitial ? (
                      <button
                        type="button"
                        title="Jadikan view awal scene"
                        disabled={disabled}
                        onClick={() => onUseAsInitial(bookmark)}
                        className="rounded p-1 text-[#101828] hover:bg-slate-100 disabled:opacity-40"
                      >
                        <Check className="size-3.5" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      title="Hapus kamera"
                      disabled={disabled}
                      onClick={() => onBookmarksChange(bookmarks.filter((b) => b.id !== bookmark.id))}
                      className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <p className="mt-0.5 pl-5 font-mono text-[10px] text-slate-500">
                    yaw {bookmark.yaw.toFixed(1)}° · pitch {bookmark.pitch.toFixed(1)}° · hfov {bookmark.hfov.toFixed(0)}°
                  </p>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            disabled={disabled || !live || bookmarks.length >= MAX_CAMERA_BOOKMARKS}
            onClick={() => live && onBookmarksChange([...bookmarks, newCameraBookmark(live, bookmarks)])}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 px-2 py-1.5 text-[11px] text-[#101828] hover:bg-slate-100 disabled:opacity-40"
          >
            <Camera className="size-3.5" />+ Tambah kamera dari posisi saat ini
          </button>
        </div>
      ) : null}

      <p className="text-[10px] text-slate-500">
        {initialView
          ? `Tersimpan: yaw ${initialView.yaw.toFixed(1)}°, pitch ${initialView.pitch.toFixed(1)}°, hfov ${(
              initialView.hfov ?? PANNELLUM_EDITOR_HFOV.hfov
            ).toFixed(0)}°`
          : "Belum ada view awal — scene dibuka dari arah default."}
      </p>
    </div>
  );
}
