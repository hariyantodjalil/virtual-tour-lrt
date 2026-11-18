"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ConfirmDialogOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true = aksi merusak (tombol rose); false/undefined = aksi utama (tombol signal merah). */
  destructive?: boolean;
};

/**
 * Pengganti window.confirm bawaan browser — modal Dialog shadcn berbasis Promise.
 *
 * const { confirmDialog, confirmElement } = useConfirmDialog();
 * if (!(await confirmDialog({ title: "Hapus item?", destructive: true }))) return;
 * ... lalu render {confirmElement} sekali di JSX halaman/komponen.
 */
export function useConfirmDialog() {
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirmDialog = useCallback((next: ConfirmDialogOptions) => {
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }, []);

  const confirmElement: ReactNode = (
    <Dialog
      open={options !== null}
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{options?.title}</DialogTitle>
          {options?.description && (
            <DialogDescription>{options.description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => settle(false)}>
            {options?.cancelLabel ?? "Batal"}
          </Button>
          <Button
            type="button"
            onClick={() => settle(true)}
            className={
              options?.destructive ? "bg-rose-600 text-white hover:bg-rose-500" : ""
            }
          >
            {options?.confirmLabel ?? "Konfirmasi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirmDialog, confirmElement };
}
