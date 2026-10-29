"use client";

import { useState } from "react";
import { MapPin, Trash2 } from "lucide-react";
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
import type { TourArea } from "@/lib/virtual-tour-structure";

export type AreaDialogState =
  | { mode: "add"; levelId: string; levelLabel: string }
  | { mode: "edit"; area: TourArea; levelLabel: string }
  | { mode: "delete"; area: TourArea; levelLabel: string }
  | null;

type Props = {
  state: AreaDialogState;
  onClose: () => void;
  onSubmitAdd: (levelId: string, label: string) => Promise<void>;
  onSubmitEdit: (areaId: string, label: string) => Promise<void>;
  onConfirmDelete: (areaId: string) => Promise<void>;
};

export function ManageAreaDialog({
  state,
  onClose,
  onSubmitAdd,
  onSubmitEdit,
  onConfirmDelete,
}: Props) {
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [prevState, setPrevState] = useState(state);

  if (state !== prevState) {
    setPrevState(state);
    if (state?.mode === "edit") setLabel(state.area.label);
    else if (state?.mode === "add") setLabel("");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!state || state.mode === "delete") return;
    const trimmed = label.trim();
    if (!trimmed) {
      setError("Nama area wajib diisi");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (state.mode === "add") {
        await onSubmitAdd(state.levelId, trimmed);
      } else {
        await onSubmitEdit(state.area.id, trimmed);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan area");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!state || state.mode !== "delete") return;
    setBusy(true);
    setError("");
    try {
      await onConfirmDelete(state.area.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus area");
    } finally {
      setBusy(false);
    }
  }

  const open = state !== null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] text-[#F8ECEE] [&>button]:text-[#C4A8AD] [&>button]:hover:text-white">
        {state?.mode === "delete" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#F8ECEE]">
                <Trash2 className="h-5 w-5 text-red-400" />
                Hapus Area
              </DialogTitle>
              <DialogDescription className="text-[#C4A8AD]">
                Hapus area <strong className="text-[#F8ECEE]">{state.area.label}</strong> dari{" "}
                <strong className="text-[#F8ECEE]">{state.levelLabel}</strong>? Area harus kosong dari scene.
              </DialogDescription>
            </DialogHeader>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="bg-red-600 hover:bg-red-500"
              >
                {busy ? "Menghapus…" : "Hapus Area"}
              </Button>
            </DialogFooter>
          </>
        ) : state ? (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#F8ECEE]">
                <MapPin className="h-5 w-5 text-emerald-400" />
                {state.mode === "add" ? "Tambah Area" : "Edit Area"}
              </DialogTitle>
              <DialogDescription className="text-[#C4A8AD]">
                Level: <span className="font-medium text-[#F0DDE1]">{state.levelLabel}</span>
                {state.mode === "add"
                  ? " — contoh: Concourse Paid, Concourse Unpaid, Koridor A"
                  : ` — slug: ${state.area.slug}`}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <Label htmlFor="area-label" className="mb-1.5 block text-xs text-[#C4A8AD]">
                Nama Area
              </Label>
              <Input
                id="area-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Nama area"
                className="border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] text-[#F8ECEE]"
                autoFocus
                required
              />
              {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                Batal
              </Button>
              <Button
                type="submit"
                disabled={busy || !label.trim()}
                className="bg-[#E31E2D] hover:bg-[#c41926]"
              >
                {busy ? "Menyimpan…" : state.mode === "add" ? "Tambah Area" : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
