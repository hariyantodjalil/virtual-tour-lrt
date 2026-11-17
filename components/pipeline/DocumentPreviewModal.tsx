"use client";

import { useEffect, useState, type RefObject } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import Image from "next/image";
import {
  AlertCircle,
  ExternalLink,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import { resolveDocumentPreview } from "@/lib/document-preview";

export type PreviewableDocumentItem = {
  mediaTitle: string;
  documentNumber?: string | null;
  mediaLink: string;
  createdAt?: string | null;
};

export default function DocumentPreviewModal({
  documentItem,
  returnFocusRef,
  onClose,
}: {
  documentItem: PreviewableDocumentItem;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [frameState, setFrameState] = useState<{
    src: string;
    loading: boolean;
    imageError: boolean;
  }>({
    src: "",
    loading: true,
    imageError: false,
  });

  const resolved = resolveDocumentPreview(
    documentItem.mediaLink,
    documentItem.mediaTitle
  );
  const currentSrc = resolved.embedUrl ?? "";
  const isIframeLoading =
    frameState.src === currentSrc ? frameState.loading : true;
  const hasImageError =
    frameState.src === currentSrc ? frameState.imageError : false;

  const isIframeKind =
    resolved.kind === "PDF_NATIVE" ||
    resolved.kind === "GOOGLE_EMBED" ||
    resolved.kind === "EXTERNAL_WEB";
  const showExternalTabIcon =
    Boolean(resolved.embedUrl) && !resolved.embedUrl?.startsWith("blob:");

  useEffect(() => {
    if (!isIframeKind || !currentSrc) return;
    // Pastikan indikator muat ringan segera hilang meski iframe eksternal lambat atau ditolak oleh header situs asal.
    const timer = window.setTimeout(() => {
      setFrameState((prev) =>
        prev.src === currentSrc && !prev.loading
          ? prev
          : { src: currentSrc, loading: false, imageError: false }
      );
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [currentSrc, isIframeKind]);

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-[1px]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            if (returnFocusRef?.current) {
              event.preventDefault();
              returnFocusRef.current.focus();
            }
          }}
          className={`fixed top-1/2 left-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all outline-none ${
            expanded
              ? "h-[94dvh] w-[calc(100%-1.5rem)] max-w-none"
              : "h-[88dvh] w-[calc(100%-2rem)] max-w-5xl"
          }`}
        >
          {/* Header Ringkas */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <DialogPrimitive.Title className="truncate text-sm font-semibold text-[#101828]">
                  {documentItem.mediaTitle}
                </DialogPrimitive.Title>
                {resolved.formatLabel && (
                  <span className="inline-flex shrink-0 items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                    {resolved.formatLabel}
                  </span>
                )}
              </div>
              {documentItem.documentNumber && (
                <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                  No. {documentItem.documentNumber}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {showExternalTabIcon && (
                <a
                  href={resolved.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Buka di tab baru"
                  aria-label="Buka di tab baru"
                  className="flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#101828]"
                >
                  <ExternalLink className="size-4" strokeWidth={1.5} />
                </a>
              )}
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                title={expanded ? "Perkecil tampilan" : "Perbesar tampilan"}
                aria-label={
                  expanded ? "Perkecil pratinjau" : "Perbesar pratinjau"
                }
                className="flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#101828]"
              >
                {expanded ? (
                  <Minimize2 className="size-4" strokeWidth={1.5} />
                ) : (
                  <Maximize2 className="size-4" strokeWidth={1.5} />
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                title="Tutup pratinjau"
                aria-label="Tutup pratinjau dokumen"
                className="flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#101828]"
              >
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Area Pratinjau Utama */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center bg-slate-900">
            {resolved.kind === "UNSAFE" || !resolved.embedUrl ? (
              <div className="flex max-w-md flex-col items-center gap-3 px-6 py-12 text-center text-white">
                <AlertCircle
                  className="size-10 text-amber-300"
                  strokeWidth={1.5}
                />
                <div>
                  <p className="text-sm font-semibold">
                    Tautan pratinjau tidak valid
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">
                    Gunakan tautan URL https yang valid atau unggahan berkas resmi.
                  </p>
                </div>
              </div>
            ) : resolved.kind === "IMAGE" ? (
              hasImageError ? (
                <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-white">
                  <FileText
                    className="size-10 text-slate-300"
                    strokeWidth={1.5}
                  />
                  <p className="text-sm font-semibold">
                    Gambar tidak dapat ditampilkan
                  </p>
                  <a
                    href={resolved.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#c41230] px-3.5 text-xs font-semibold text-white hover:bg-[#a60f28]"
                  >
                    <ExternalLink className="size-3.5" strokeWidth={1.5} />
                    Buka di Tab Baru
                  </a>
                </div>
              ) : resolved.embedUrl.startsWith("blob:") ? (
                <div className="flex size-full items-center justify-center p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolved.embedUrl}
                    alt={documentItem.mediaTitle}
                    onError={() =>
                      setFrameState({
                        src: currentSrc,
                        loading: false,
                        imageError: true,
                      })
                    }
                    className="max-h-full max-w-full rounded-lg object-contain"
                  />
                </div>
              ) : (
                <div className="relative size-full p-3">
                  <Image
                    src={resolved.embedUrl}
                    alt={documentItem.mediaTitle}
                    fill
                    sizes="(max-width: 1024px) 100vw, 1024px"
                    className="object-contain"
                    unoptimized
                    onError={() =>
                      setFrameState({
                        src: currentSrc,
                        loading: false,
                        imageError: true,
                      })
                    }
                  />
                </div>
              )
            ) : isIframeKind ? (
              <>
                {isIframeLoading && (
                  <div className="pointer-events-none absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1.5 text-xs text-white shadow-sm">
                    <Loader2 className="size-3.5 animate-spin text-white/90" />
                    <span>Memuat...</span>
                  </div>
                )}
                <iframe
                  key={resolved.embedUrl}
                  src={resolved.embedUrl}
                  title={documentItem.mediaTitle}
                  onLoad={() =>
                    setFrameState({
                      src: currentSrc,
                      loading: false,
                      imageError: false,
                    })
                  }
                  allow="autoplay; fullscreen; clipboard-read; clipboard-write"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="size-full bg-white"
                />
              </>
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
