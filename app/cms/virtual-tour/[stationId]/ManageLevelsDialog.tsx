"use client";

import { useState, type DragEvent } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Layers, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TourLevel } from "@/lib/virtual-tour-structure";

const PRESET_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899"];

type Props = {
  open: boolean;
  levels: TourLevel[];
  onClose: () => void;
  onCreate: (data: { label: string; color: string; hint?: string }) => Promise<void>;
  onUpdate: (levelId: string, data: { label?: string; color?: string; hint?: string; order?: number }) => Promise<void>;
  onReorder: (orderedLevelIds: string[]) => Promise<void>;
  onDelete: (levelId: string) => Promise<{ ok: boolean; error?: string }>;
};

export function ManageLevelsDialog({
  open,
  levels,
  onClose,
  onCreate,
  onUpdate,
  onReorder,
  onDelete,
}: Props) {
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [newHint, setNewHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TourLevel | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [dragLevelId, setDragLevelId] = useState<string | null>(null);
  const [dropLevelId, setDropLevelId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setBusy(true);
    try {
      await onCreate({ label: newLabel.trim(), color: newColor, hint: newHint.trim() || undefined });
      setNewLabel("");
      setNewHint("");
    } finally {
      setBusy(false);
    }
  }

  async function applyReorder(orderedIds: string[]) {
    setBusy(true);
    try {
      await onReorder(orderedIds);
    } finally {
      setBusy(false);
    }
  }

  async function moveLevel(level: TourLevel, dir: "up" | "down") {
    const idx = levels.findIndex((l) => l.id === level.id);
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= levels.length) return;
    const ids = levels.map((l) => l.id);
    const next = [...ids];
    const [removed] = next.splice(idx, 1);
    next.splice(swap, 0, removed);
    await applyReorder(next);
  }

  function handleDragOver(e: DragEvent, levelId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragLevelId && dragLevelId !== levelId) setDropLevelId(levelId);
  }

  async function handleDrop(targetLevelId: string) {
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
    await applyReorder(next);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    setDeleteError("");
    const result = await onDelete(deleteTarget.id);
    setBusy(false);
    if (result.ok) {
      setDeleteTarget(null);
    } else {
      setDeleteError(result.error ?? "Gagal menghapus level");
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="flex max-h-[85vh] max-w-lg flex-col border-slate-700 bg-slate-900 text-slate-100 [&>button]:text-slate-400 [&>button]:hover:text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-100">
              <Layers className="h-5 w-5 text-emerald-400" />
              Kelola Level
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Drag level untuk mengubah urutan tab di virtual tour publik. Level paling atas = tab pertama.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-2">
            {levels.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-center text-sm text-slate-500">
                Belum ada level. Tambahkan level pertama di bawah.
              </p>
            )}

            {levels.map((level, idx) => (
              <div
                key={level.id}
                onDragOver={(e) => handleDragOver(e, level.id)}
                onDrop={() => handleDrop(level.id)}
                className={`flex items-start gap-2 rounded-lg border bg-slate-800/40 p-3 transition-colors ${
                  dragLevelId === level.id ? "opacity-40 border-slate-700" : "border-slate-800"
                } ${
                  dropLevelId === level.id
                    ? "border-emerald-500/70 bg-emerald-950/30 ring-1 ring-emerald-500/50"
                    : ""
                }`}
              >
                <button
                  type="button"
                  draggable={!busy}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", level.id);
                    setDragLevelId(level.id);
                  }}
                  onDragEnd={() => {
                    setDragLevelId(null);
                    setDropLevelId(null);
                  }}
                  className="mt-1 shrink-0 cursor-grab rounded p-1 text-slate-500 active:cursor-grabbing hover:bg-slate-700 hover:text-slate-200"
                  title="Drag untuk ubah urutan"
                  aria-label={`Geser urutan level ${level.label}`}
                >
                  <GripVertical className="h-4 w-4" />
                </button>
                <input
                  type="color"
                  value={level.color}
                  onChange={(e) => onUpdate(level.id, { color: e.target.value })}
                  className="mt-1 h-8 w-8 cursor-pointer rounded border-0 bg-transparent"
                  title="Warna level"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    value={level.label}
                    onChange={(e) => onUpdate(level.id, { label: e.target.value })}
                    className="h-8 border-slate-700 bg-slate-900 text-sm text-slate-100"
                  />
                  <Input
                    value={level.hint ?? ""}
                    onChange={(e) => onUpdate(level.id, { hint: e.target.value })}
                    placeholder="Deskripsi singkat level"
                    className="h-7 border-slate-700 bg-slate-900 text-xs text-slate-400"
                  />
                  <p className="font-mono text-[10px] text-slate-600">
                    #{idx + 1} · {level.slug} · {level.areas.length} area
                  </p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveLevel(level, "up")}
                    disabled={idx === 0 || busy}
                    className="rounded p-0.5 text-slate-500 hover:text-white disabled:opacity-20"
                    title="Naikkan urutan"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveLevel(level, "down")}
                    disabled={idx === levels.length - 1 || busy}
                    className="rounded p-0.5 text-slate-500 hover:text-white disabled:opacity-20"
                    title="Turunkan urutan"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError("");
                      setDeleteTarget(level);
                    }}
                    className="mt-1 rounded p-0.5 text-red-400 hover:text-red-300"
                    title="Hapus level"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}

            <form
              onSubmit={handleCreate}
              className="space-y-3 rounded-lg border border-dashed border-emerald-800/50 bg-emerald-950/20 p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400/80">
                + Tambah Level Baru
              </p>
              <div>
                <Label className="mb-1 block text-xs text-slate-400">Nama Level</Label>
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="contoh: Mezanin, Parkir, Rooftop"
                  className="border-slate-700 bg-slate-800 text-slate-100"
                  required
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-slate-400">Warna label</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                        newColor === c ? "border-white" : "border-transparent"
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <Input
                value={newHint}
                onChange={(e) => setNewHint(e.target.value)}
                placeholder="Deskripsi singkat (opsional)"
                className="border-slate-700 bg-slate-800 text-sm text-slate-100"
              />
              <Button
                type="submit"
                disabled={busy || !newLabel.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-500"
              >
                <Plus className="mr-1 h-4 w-4" />
                Tambah Level
              </Button>
            </form>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} className="w-full sm:w-auto">
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm border-slate-700 bg-slate-900 text-slate-100 [&>button]:text-slate-400">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-100">
              <Trash2 className="h-5 w-5 text-red-400" />
              Hapus Level
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Hapus level <strong className="text-slate-200">{deleteTarget?.label}</strong>? Semua scene di
              level ini harus sudah dipindah atau dihapus terlebih dahulu.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm text-red-400">{deleteError}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)} disabled={busy}>
              Batal
            </Button>
            <Button
              type="button"
              onClick={confirmDelete}
              disabled={busy}
              className="bg-red-600 hover:bg-red-500"
            >
              {busy ? "Menghapus…" : "Hapus Level"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
