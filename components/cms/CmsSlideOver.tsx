"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, X } from "lucide-react";

type Props = {
  /** Label kecil di atas judul, mis. "Edit Unit". */
  eyebrow: string;
  title: string;
  onClose: () => void;
  /** Tombol aksi di bawah (Batal / Simpan) — selalu terlihat. */
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * Dialog form detail CMS di tengah layar. Dirender ke <body> agar tidak tertutup header dan sidebar
 * CMS; tingginya mengikuti layar dengan header dan footer tetap, dan bisa diperlebar ke layar penuh.
 */
export default function CmsSlideOver({ eyebrow, title, onClose, footer, children }: Props) {
  // Portal ke <body> hanya di browser; saat render server tidak ada document.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[80] flex items-center justify-center ${expanded ? "" : "p-3 sm:p-6"}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${eyebrow} ${title}`}
    >
      <button
        type="button"
        aria-label="Tutup panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <div
        className={`cms-dialog-in relative flex w-full flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl ${
          expanded ? "h-dvh max-w-none rounded-none" : "max-h-[calc(100dvh-1.5rem)] max-w-[960px] rounded-2xl sm:max-h-[calc(100dvh-3rem)]"
        }`}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{eyebrow}</p>
            <h2 className="mt-1 truncate text-xl font-black text-[#101828]">{title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-[#101828] sm:inline-flex"
              aria-label={expanded ? "Kecilkan panel" : "Perlebar panel ke layar penuh"}
              title={expanded ? "Kecilkan panel" : "Perlebar ke layar penuh"}
            >
              {expanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-[#101828]"
              aria-label="Tutup form"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">{children}</div>

        {footer ? (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 sm:px-6">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
