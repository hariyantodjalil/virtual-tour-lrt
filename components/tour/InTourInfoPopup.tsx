"use client";

import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  description: string;
  onClose: () => void;
};

export default function InTourInfoPopup({ title, description, onClose }: Props) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Tutup"
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-300">
              <Info className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-blue-300/80">Informasi</p>
              <h3 className="truncate text-lg font-semibold text-white">{title}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
            {description || "Tidak ada deskripsi."}
          </p>
        </div>
        <div className="border-t border-white/10 px-5 py-4">
          <Button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-500">
            Tutup
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
