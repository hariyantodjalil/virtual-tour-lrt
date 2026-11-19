"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  const cancelButton = useRef<HTMLButtonElement>(null);

  useEffect(() => () => {
    resolver.current?.(false);
    resolver.current = null;
  }, []);

  const confirmDialog = useCallback((next: ConfirmDialogOptions) => {
    resolver.current?.(false);
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
      <DialogContent role="alertdialog" overlayClassName="z-[110]" className="z-[111] max-w-md gap-5 border border-slate-200 bg-white p-5 text-slate-900 sm:p-6"
        {...(!options?.description ? { "aria-describedby": undefined } : {})}
        onOpenAutoFocus={event => {
          event.preventDefault();
          cancelButton.current?.focus();
        }}
        onPointerDownOutside={event => event.preventDefault()}>
        <DialogHeader className="gap-2 space-y-0 text-left">
          <DialogTitle className="pr-9 text-base leading-snug text-slate-900 sm:text-lg">{options?.title}</DialogTitle>
          {options?.description && (
            <DialogDescription className="leading-relaxed text-slate-600">{options.description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="flex-row flex-wrap justify-end gap-2 sm:space-x-0">
          <Button ref={cancelButton} type="button" variant="ghost" className="px-3 sm:px-4" onClick={() => settle(false)}>
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
