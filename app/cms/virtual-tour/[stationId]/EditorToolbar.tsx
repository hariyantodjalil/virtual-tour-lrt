"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRightLeft,
  Copy,
  Crosshair,
  Eye,
  EyeOff,
  Hand,
  Hexagon,
  Info,
  Loader2,
  Megaphone,
  MousePointer,
  Network,
  Redo2,
  RotateCcw,
  Save,
  Store,
  Undo2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AddMode } from "@/lib/hotspot-types";
import type { TourLevel } from "@/lib/virtual-tour-structure";

type LevelCfg = { label: string; color: string };

type Props = {
  stationName?: string;
  sceneTitle?: string;
  sceneLevelLabel?: string;
  sceneAreaLabel?: string;
  sceneLevelColor?: string;
  addMode: AddMode;
  setAddMode: (mode: AddMode | ((m: AddMode) => AddMode)) => void;
  spatialEnabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canDuplicate: boolean;
  hasUnsaved: boolean;
  saving: boolean;
  isPreview: boolean;
  hasScene: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onSetInitialView: () => void;
  onOpenConnectionMap: () => void;
  onTogglePreview: () => void;
  onReset: () => void;
  onSave: () => void;
  onPublishSpatial?: () => void;
  getLevelConfig?: (level: string, levels: TourLevel[]) => LevelCfg;
};

function toolClass(active: boolean, activeTone = "bg-[#E31E2D] text-white") {
  return `flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
    active ? activeTone : "text-[#C4A8AD] hover:text-[#F8ECEE]"
  }`;
}

export function EditorToolbar({
  stationName,
  sceneTitle,
  sceneLevelLabel,
  sceneAreaLabel,
  sceneLevelColor,
  addMode,
  setAddMode,
  spatialEnabled,
  canUndo,
  canRedo,
  canDuplicate,
  hasUnsaved,
  saving,
  isPreview,
  hasScene,
  onUndo,
  onRedo,
  onDuplicate,
  onSetInitialView,
  onOpenConnectionMap,
  onTogglePreview,
  onReset,
  onSave,
  onPublishSpatial,
}: Props) {
  return (
    <div className="relative z-30 flex shrink-0 flex-col border-b border-[rgba(255,214,218,0.14)] bg-[#261015]">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
        <Button asChild variant="ghost" size="sm" className="shrink-0 text-[#C4A8AD] hover:text-[#F8ECEE]">
          <Link href="/cms/virtual-tour">
            <ArrowLeft className="mr-1 h-4 w-4" /> Kembali
          </Link>
        </Button>
        <div className="h-5 w-px bg-[#4A1F28]" />
        <nav aria-label="Lokasi scene" className="min-w-0 flex-1 basis-72">
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
            <li className="min-w-0 break-words font-semibold text-[#F8ECEE]">{stationName ?? "…"}</li>
            {[sceneLevelLabel, sceneAreaLabel, sceneTitle].map((label, index) => label && (
              <li key={index} className="flex min-w-0 items-start gap-1.5">
                <span aria-hidden="true" className="text-[#A88990]">›</span>
                <span className="min-w-0 break-words font-medium" style={{ color: index === 1 ? "#F8ECEE" : sceneLevelColor }} aria-current={index === 2 ? "page" : undefined}>
                  {label}
                </span>
              </li>
            ))}
          </ol>
        </nav>
        <div className="ml-auto flex max-w-full flex-wrap items-center gap-2">
        {hasUnsaved ? (
          <span className="flex items-center gap-1 text-xs text-amber-400">
            <AlertCircle className="h-3.5 w-3.5" /> Belum disimpan
          </span>
        ) : (
          <span className="text-xs text-[#A88990]">Tersimpan</span>
        )}
        <button
          type="button"
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
            isPreview
              ? "border-[#E31E2D]/70 bg-[#3A161C] text-[#F8ECEE]"
              : "border-[rgba(255,214,218,0.18)] bg-[#3A161C] text-[#F0DDE1] hover:border-[rgba(255,214,218,0.35)] hover:text-[#F8ECEE]"
          }`}
          onClick={onTogglePreview}
        >
          {isPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {isPreview ? "Kembali Edit" : "Preview"}
        </button>
        <Button
          size="sm"
          variant="outline"
          onClick={onReset}
          disabled={!hasUnsaved || saving || !hasScene}
          className="shrink-0 border-[rgba(255,214,218,0.22)] bg-[#3A161C] text-[#F8ECEE] hover:bg-[#4A1F28] hover:text-white disabled:opacity-40"
          title="Buang perubahan yang belum disimpan"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          title="Simpan scene dan pin; area Spatial disimpan sebagai draft"
          disabled={saving || !hasScene}
          className="shrink-0 bg-[#E31E2D] hover:bg-[#c41926]"
        >
          {saving ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Menyimpan…
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Save className="h-3.5 w-3.5" /> Simpan
            </span>
          )}
        </Button>
        {spatialEnabled && onPublishSpatial && (
          <Button size="sm" variant="outline" onClick={onPublishSpatial} disabled={saving || !hasScene} title="Tampilkan versi area ini kepada pengunjung">
            Publikasikan Area
          </Button>
        )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[rgba(255,214,218,0.08)] px-4 py-2">
        <div className="flex items-center gap-1 rounded-lg bg-[#3A161C] p-1" role="group" aria-label="Navigasi">
          <button
            type="button"
            className={toolClass(addMode === "none")}
            onClick={() => setAddMode("none")}
            title="Mode Seleksi (V)"
          >
            <MousePointer className="h-3.5 w-3.5" /> Pilih
          </button>
          <button
            type="button"
            className={toolClass(addMode === "pan", "bg-[#4A1F28] text-white")}
            onClick={() => setAddMode((m) => (m === "pan" ? "none" : "pan"))}
            title="Geser kamera (H) — drag panorama tanpa menambah hotspot"
          >
            <Hand className="h-3.5 w-3.5" /> Geser
          </button>
        </div>

        <div className="h-5 w-px bg-[#4A1F28]" />

        <div className="flex items-center gap-1 rounded-lg bg-[#3A161C] p-1" role="group" aria-label="Navigasi scene & info">
          <button
            type="button"
            className={toolClass(addMode === "scene", "bg-emerald-600 text-white")}
            onClick={() => setAddMode((m) => (m === "scene" ? "none" : "scene"))}
            title="Tambah hotspot scene"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" /> Scene
          </button>
          <button
            type="button"
            className={toolClass(addMode === "info", "bg-blue-600 text-white")}
            onClick={() => setAddMode((m) => (m === "info" ? "none" : "info"))}
            title="Tambah hotspot info"
          >
            <Info className="h-3.5 w-3.5" /> Info
          </button>
          <button
            type="button"
            className={toolClass(addMode === "ad", "bg-[#7C3AED] text-white")}
            onClick={() => setAddMode((m) => (m === "ad" ? "none" : "ad"))}
            title="Tambah hotspot iklan (Media)"
          >
            <Megaphone className="h-3.5 w-3.5" /> Iklan
          </button>
        </div>

        <div className="h-5 w-px bg-[#4A1F28]" />

        {/* Unit komersial: satu aksi, dua bentuk (pin atau spatial) */}
        <div
          className="flex items-center gap-1 rounded-lg bg-[#3A161C] p-1"
          role="group"
          aria-label="Unit komersial — pilih bentuk"
        >
          <span className="hidden items-center gap-1 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#A88990] sm:inline-flex">
            <Store className="h-3 w-3" /> Unit
          </span>
          <button
            type="button"
            className={toolClass(addMode === "space", "bg-amber-600 text-white")}
            onClick={() => setAddMode((m) => (m === "space" ? "none" : "space"))}
            title="Unit berbentuk pin titik — klik panorama"
          >
            <MousePointer className="h-3.5 w-3.5" />
            <span className="sm:hidden">Unit</span>
            Pin
          </button>
          <button
            type="button"
            className={toolClass(
              addMode === "spatial",
              "bg-emerald-600 text-white"
            )}
            onClick={() => {
              if (!spatialEnabled) return;
              setAddMode((m) => (m === "spatial" ? "none" : "spatial"));
            }}
            disabled={!spatialEnabled}
            title={
              spatialEnabled
                ? "Unit berbentuk Spatial Area — klik sudut outline unit (G)"
                : "Spatial Area — aktifkan flag CMS_SPATIAL_HOTSPOT"
            }
          >
            <Hexagon className="h-3.5 w-3.5" /> Spatial
          </button>
        </div>

        <div className="h-5 w-px bg-[#4A1F28]" />

        <div className="flex items-center gap-1 rounded-lg bg-[#3A161C] p-1" role="group" aria-label="Privasi">
          <button
            type="button"
            className={toolClass(addMode === "blur", "bg-[#4A1F28] text-[#F0DDE1]")}
            onClick={() => setAddMode((m) => (m === "blur" ? "none" : "blur"))}
            title="Tambah blur privasi"
          >
            <EyeOff className="h-3.5 w-3.5" /> Blur
          </button>
        </div>

        <div className="h-5 w-px bg-[#4A1F28]" />

        <div className="flex items-center gap-1 rounded-lg bg-[#3A161C] p-1" role="group" aria-label="Riwayat">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-[#C4A8AD] hover:text-[#F8ECEE] disabled:pointer-events-none disabled:opacity-30"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-[#C4A8AD] hover:text-[#F8ECEE] disabled:pointer-events-none disabled:opacity-30"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-[#C4A8AD] hover:text-[#F8ECEE] disabled:pointer-events-none disabled:opacity-30"
            onClick={onDuplicate}
            disabled={!canDuplicate}
            title="Duplikat hotspot/blur terpilih"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-[#C4A8AD] hover:text-[#F8ECEE] disabled:pointer-events-none disabled:opacity-30"
            onClick={onSetInitialView}
            disabled={!hasScene || isPreview}
            title="Set view awal dari posisi kamera"
          >
            <Crosshair className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-[#C4A8AD] hover:text-[#F8ECEE]"
            onClick={onOpenConnectionMap}
            title="Peta koneksi antar scene"
          >
            <Network className="h-3.5 w-3.5" />
          </button>
        </div>
        <details className="relative ml-auto text-xs text-[#C4A8AD]" onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }}>
          <summary className="cursor-pointer rounded-md px-2 py-1.5 hover:text-[#F8ECEE] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Bantuan</summary>
          <div className="absolute right-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-3 rounded-lg border border-[rgba(255,214,218,0.18)] bg-[#261015] p-4 text-xs leading-relaxed">
            <div><strong className="text-[#F8ECEE]">Simpan dan publikasikan</strong><p>Simpan memperbarui scene dan pin, serta menyimpan draft Spatial. Publikasikan Area menampilkan Spatial kepada pengunjung.</p></div>
            <div><strong className="text-[#F8ECEE]">Batas Spatial</strong><p>Klik minimal 3 sudut, lalu Selesaikan area. Geser titik putih untuk mengubah batas; titik biru menambah titik.</p></div>
            <div><strong className="text-[#F8ECEE]">Pintasan</strong><p>V: pilih · H: geser · G: Spatial<br />Enter: selesai · Backspace: hapus titik terakhir<br />Delete: hapus vertex terpilih · Esc: batalkan drag<br />Ctrl+Z: undo · Ctrl+Y: redo</p></div>
          </div>
        </details>
      </div>
    </div>
  );
}
