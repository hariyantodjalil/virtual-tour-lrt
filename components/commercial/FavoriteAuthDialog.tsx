"use client";

import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Heart, LogIn, ShieldAlert, X } from "lucide-react";

type Props = {
  open: boolean;
  mode: "guest" | "non-mitra";
  redirectPath: string;
  roleLabel?: string;
  onClose: () => void;
};

export default function FavoriteAuthDialog({
  open,
  mode,
  redirectPath,
  roleLabel,
  onClose,
}: Props) {
  const loginHref = `/login?redirect=${encodeURIComponent(redirectPath || "/")}`;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[130] bg-slate-950/50 backdrop-blur-[1px]" />
        <Dialog.Content
          onKeyDown={(e) => e.stopPropagation()}
          className="fixed top-1/2 left-1/2 z-[131] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 text-[#0B1220] shadow-2xl outline-none"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-rose-50 text-[#C41926]">
              {mode === "guest" ? (
                <Heart className="size-5 fill-current" />
              ) : (
                <ShieldAlert className="size-5" />
              )}
            </div>
            <Dialog.Close
              aria-label="Tutup dialog"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <Dialog.Title className="mt-4 font-display text-lg font-bold text-slate-900">
            {mode === "guest"
              ? "Login sebagai Mitra untuk menyimpan favorit"
              : "Fitur Favorit Khusus Akun Mitra"}
          </Dialog.Title>

          <Dialog.Description className="mt-2 text-sm leading-relaxed text-slate-600">
            {mode === "guest"
              ? "Simpan unit pilihan agar tetap tersinkron di akun Mitra Anda dan mudah dibuka kembali lewat Portal Mitra. Setelah login atau daftar, unit ini akan langsung tersimpan otomatis."
              : `Anda sedang login sebagai akun ${roleLabel || "internal"}. Daftar unit favorit hanya tersedia untuk akun Mitra (penyewa komersial).`}
          </Dialog.Description>

          <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {mode === "guest" ? "Nanti saja" : "Mengerti"}
            </button>

            {mode === "guest" && (
              <Link
                href={loginHref}
                onClick={onClose}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#E31E2D] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#C41926]"
              >
                <LogIn className="size-4" />
                Login / Daftar Mitra
              </Link>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
