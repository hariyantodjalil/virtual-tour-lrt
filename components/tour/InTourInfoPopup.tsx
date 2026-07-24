"use client";

import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";

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
        className="absolute inset-0 bg-[#1C0A0E]/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Tutup"
      />
      <div className="tour-panel-in relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[color:rgb(255_214_218_/_0.14)] bg-[#3A161C] shadow-[0_24px_60px_rgba(28,10,14,0.55)]">
        <div className="flex items-start justify-between gap-3 border-b border-[color:rgb(255_214_218_/_0.12)] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E31E2D]/20 text-[#E31E2D]">
              <Info className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C4A8AD]">
                Informasi
              </p>
              <h3 className="truncate font-display text-lg font-semibold text-[#F8ECEE]">{title}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#C4A8AD] transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#F8ECEE]/80">
            {description || "Tidak ada deskripsi."}
          </p>
        </div>
        <div className="border-t border-[color:rgb(255_214_218_/_0.12)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-full items-center justify-center rounded-full bg-[#E31E2D] font-display text-sm font-bold text-white transition hover:bg-[#c41926]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
