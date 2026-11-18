"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export type PrivacyBlurBakeTarget = "both" | "hemat" | "hd";

type BakePrivacyBlurDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rebake: boolean;
  confirming?: boolean;
  onConfirm: (target: PrivacyBlurBakeTarget) => void;
};

/**
 * Pilih target bake blur: Hemat saja, HD saja, atau keduanya.
 */
export function BakePrivacyBlurDialog({
  open,
  onOpenChange,
  rebake,
  confirming = false,
  onConfirm,
}: BakePrivacyBlurDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[var(--work-line)] bg-[var(--work-subtle)] p-6 text-[var(--work-text)]">
        <DialogTitle className="pr-8 font-[family-name:var(--font-display,inherit)] text-lg font-semibold tracking-tight">
          {rebake ? "Bake ulang blur?" : "Bake blur privasi?"}
        </DialogTitle>
        <DialogDescription className="text-sm leading-relaxed text-[var(--work-muted)]">
          Pilih target. Hemat mengubah panorama display + tile Hemat sekarang. HD
          generate tile native di background (kecuali HD saja — langsung dijalankan).
          HD saja tidak mengubah Hemat; jika region berubah, Hemat bisa beda sampai
          di-bake ulang.
        </DialogDescription>
        <div className="mt-3 flex flex-col gap-2">
          <Button
            type="button"
            disabled={confirming}
            className="justify-start bg-[#F8ECEE] text-[#1C0A0E] hover:bg-white"
            onClick={() => onConfirm("both")}
          >
            {confirming ? "Memproses…" : rebake ? "Bake ulang Hemat + HD" : "Hemat + HD"}
          </Button>
          <Button
            type="button"
            disabled={confirming}
            variant="outline"
            className="justify-start border-[rgba(255,214,218,0.25)] text-[var(--work-text)] hover:bg-[var(--work-subtle)]"
            onClick={() => onConfirm("hemat")}
          >
            Hemat saja
          </Button>
          <Button
            type="button"
            disabled={confirming}
            variant="outline"
            className="justify-start border-[rgba(255,214,218,0.25)] text-[var(--work-text)] hover:bg-[var(--work-subtle)]"
            onClick={() => onConfirm("hd")}
          >
            HD saja
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-[var(--work-muted)] hover:bg-[var(--work-subtle)] hover:text-[var(--work-text)]"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
          >
            Batal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
