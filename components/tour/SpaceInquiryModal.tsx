"use client";

import { useCallback, useEffect, useRef, useState, type ComponentProps, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CalendarDays, Check, ChevronLeft, Copy, Download, Heart, MapPin, Maximize2, Phone, Store, Wrench, X, Zap } from "lucide-react";
import type InTourSpacePopupLegacy from "./InTourSpacePopupLegacy";
import SpaceInquiryForm, { type SpaceInquiryStage } from "./SpaceInquiryForm";
import { useCommercialProfile } from "@/components/commercial/CommercialProfileProvider";
import { PUBLIC_LEASING_STEPS, SPACE_STATUS_LABELS } from "@/lib/commercial-pipeline";
import { printSpaceSummary } from "@/lib/space-summary";
import { cn, getWhatsAppUrl } from "@/lib/utils";
import { resolveSheetSwipe } from "@/lib/sheet-gesture";
import { FAVORITES_UPDATED_EVENT, isFavoriteSpace, toggleFavoriteSpace } from "@/lib/favorite-spaces";

export type SpaceInquiryModalProps = ComponentProps<typeof InTourSpacePopupLegacy> & { onExplore?: () => void };
const TYPE_LABELS: Record<string, string> = {
  KIOS: "Kios", RUKO: "Ruko", ATM: "ATM", VENDING: "Vending Machine", MEDIA_IKLAN: "Media Iklan", AREA_PROMOSI: "Area Promosi",
};
type SpecRow = { label: string; value: string; hint?: string | null; icon: ReactNode };
const secondaryClass = "inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D]";

export default function SpaceInquiryModal({ space, stationName, stationSlug, contactPhone, onClose, onExplore = onClose, returnToList = false }: SpaceInquiryModalProps) {
  const profile = useCommercialProfile();
  const phone = contactPhone || profile.whatsappNumber;
  const [copied, setCopied] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [favoriteError, setFavoriteError] = useState("");
  const [stage, setStage] = useState<SpaceInquiryStage>("details");
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<{ pointerId: number; x: number; y: number; time: number; height: number; expanded: boolean; dragging: boolean; horizontal: boolean } | null>(null);
  const suppressClickUntil = useRef(0);
  const dismissTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeCallback = useRef<(() => void) | null>(null);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef(typeof document !== "undefined" ? document.activeElement : null);
  const location = space.location?.trim() || space.floor?.trim() || "-";
  const locationHint = space.location?.trim() && space.floor?.trim() && space.location.trim() !== space.floor.trim()
    ? space.floor.trim() : space.nearestExit?.trim() ? `Exit terdekat: ${space.nearestExit.trim()}` : null;
  const tenant = space.status === "TERISI" ? space.tenantBrand?.trim() : null;
  const breadcrumb = [stationName, space.floor, space.location].map(part => part?.trim()).filter(Boolean).join(" | ");
  const rows: SpecRow[] = [
    { label: "Luas Lantai", value: `${space.area} m²`, icon: <Maximize2 className="size-4" /> },
    { label: "Lokasi Toko", value: location, hint: locationHint, icon: <MapPin className="size-4" /> },
    { label: "Jenis Ruang", value: TYPE_LABELS[space.type] ?? space.type, hint: space.description?.trim() || null, icon: <Store className="size-4" /> },
    { label: "Pasokan Listrik", value: space.powerSupply?.trim() || "-", icon: <Zap className="size-4" /> },
    { label: "Utilitas", value: [space.waterAccess ? "Air" : null, space.airConditioning ? "AC / ventilasi" : null].filter(Boolean).join(" · ") || "-", icon: <Wrench className="size-4" /> },
    { label: "Ketersediaan", value: SPACE_STATUS_LABELS[space.status], hint: tenant ? `Penyewa: ${tenant}` : null, icon: <CalendarDays className="size-4" /> },
  ];
  const waUrl = getWhatsAppUrl(phone, `Halo, saya tertarik dengan unit komersial ${space.code} (${space.name}) di Stasiun ${stationName}. Mohon informasi lebih lanjut.`);
  const afterSteps = <ol className="mt-5 space-y-5">
    {PUBLIC_LEASING_STEPS.slice(2).map(step => <li key={step.n} className="flex gap-4">
      <span className="w-6 shrink-0 pt-0.5 font-display text-xs font-semibold text-[#C41926]">{step.n}</span>
      <div><p className="text-sm font-semibold">{step.title}</p><p className="mt-1 text-sm leading-relaxed text-slate-600">{step.detail}</p></div>
    </li>)}
  </ol>;
  const specRows = rows.map(row => <div key={row.label} className="flex items-start gap-3 py-4">
    <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600" aria-hidden="true">{row.icon}</span>
    <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] gap-3">
      <dt className="pt-1 text-sm text-slate-600">{row.label}</dt>
      <dd className="min-w-0 break-words text-sm font-semibold">{row.value}{row.hint && <p className="mt-1 text-xs leading-relaxed font-normal text-slate-600">{row.hint}</p>}</dd>
    </div>
  </div>);
  const statusColor = space.status === "TERSEDIA" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : space.status === "TERISI" ? "border-red-200 bg-red-50 text-red-800" : "border-slate-200 bg-slate-50 text-slate-700";

  useEffect(() => {
    void fetch("/api/analytics", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "SPACE_VIEW", spaceId: space.id }),
    }).catch(() => null);
  }, [space.id]);
  useEffect(() => () => { if (copyTimeout.current) clearTimeout(copyTimeout.current); }, []);
  useEffect(() => () => { if (dismissTimeout.current) clearTimeout(dismissTimeout.current); }, []);
  useEffect(() => {
    const refresh = () => setFavorite(isFavoriteSpace(space.id));
    refresh();
    window.addEventListener(FAVORITES_UPDATED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(FAVORITES_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [space.id]);

  function toggleFavorite() {
    if (!stationSlug) return;
    try {
      setFavorite(toggleFavoriteSpace({
        spaceId: space.id, code: space.code, name: space.name, type: space.type,
        status: space.status, area: space.area, monthlyRent: space.monthlyRent,
        location: space.location, floor: space.floor, panoramaUrl: space.panoramaUrl,
        stationSlug, stationName,
      }));
      setFavoriteError("");
    } catch { setFavoriteError("Favorit gagal disimpan. Periksa penyimpanan browser."); }
  }

  function finishClose() {
    const callback = closeCallback.current;
    if (!callback) return;
    closeCallback.current = null;
    if (dismissTimeout.current) clearTimeout(dismissTimeout.current);
    dismissTimeout.current = null;
    callback();
  }

  function requestClose(callback: () => void) {
    if (closeCallback.current) return;
    closeCallback.current = callback;
    gestureRef.current = null;
    if (sheetRef.current) {
      const style = getComputedStyle(sheetRef.current);
      sheetRef.current.style.setProperty("--tour-unit-exit-transform", style.transform === "none" ? "translate3d(0, 0, 0)" : style.transform);
      sheetRef.current.style.setProperty("--tour-unit-exit-opacity", style.opacity);
    }
    if (backdropRef.current) backdropRef.current.style.setProperty("--tour-unit-backdrop-opacity", getComputedStyle(backdropRef.current).opacity);
    setClosing(true);
    // Fallback if animationend is skipped, including a motion preference change.
    dismissTimeout.current = setTimeout(finishClose, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 400);
  }

  const handleStageChange = useCallback((nextStage: SpaceInquiryStage) => {
    setStage(nextStage);
    setExpanded(nextStage !== "details");
  }, []);

  function resetDrag() {
    sheetRef.current?.removeAttribute("data-dragging");
    sheetRef.current?.style.removeProperty("--sheet-drag-y");
    sheetRef.current?.style.removeProperty("height");
  }

  function startSwipe(event: ReactPointerEvent<HTMLElement>) {
    if (!event.isPrimary || event.button !== 0 || dismissTimeout.current || !window.matchMedia("(max-width: 1023px)").matches) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("button, a, input, select, textarea") && !target.closest("[data-sheet-handle]")) return;
    gestureRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, height: sheetRef.current?.getBoundingClientRect().height ?? 0, expanded, dragging: false, horizontal: false };
  }

  function moveSwipe(event: ReactPointerEvent<HTMLElement>) {
    const gesture = gestureRef.current;
    const sheet = sheetRef.current;
    if (!gesture || gesture.horizontal || gesture.pointerId !== event.pointerId || !sheet) return;
    const deltaX = event.clientX - gesture.x;
    const deltaY = event.clientY - gesture.y;
    if (!gesture.dragging) {
      if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return;
      if (Math.abs(deltaX) >= Math.abs(deltaY)) { gesture.horizontal = true; return; }
      gesture.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      sheet.setAttribute("data-dragging", "true");
    }
    event.preventDefault();
    if (deltaY >= 0) {
      sheet.style.removeProperty("height");
      sheet.style.setProperty("--sheet-drag-y", `${deltaY}px`);
    } else {
      sheet.style.setProperty("--sheet-drag-y", "0px");
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      sheet.style.height = `${Math.max(gesture.height, Math.min(viewportHeight * 0.9, gesture.height - deltaY))}px`;
    }
  }

  function finishSwipe(event: ReactPointerEvent<HTMLElement>, cancelled = false) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    if (gesture.dragging || gesture.horizontal) suppressClickUntil.current = performance.now() + 400;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const action = cancelled || !gesture.dragging ? "none" : resolveSheetSwipe({
      deltaX: event.clientX - gesture.x, deltaY: event.clientY - gesture.y,
      elapsedMs: event.timeStamp - gesture.time, sheetHeight: gesture.height, expanded: gesture.expanded,
    });
    if (action === "dismiss") {
      sheetRef.current?.removeAttribute("data-dragging");
      sheetRef.current?.style.removeProperty("height");
      requestClose(onExplore);
      return;
    }
    resetDrag();
    if (action === "expand") setExpanded(true);
    if (action === "collapse") setExpanded(false);
  }

  function trackAction(eventType: "WHATSAPP_CLICK" | "PDF_DOWNLOAD") {
    void fetch("/api/analytics", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, spaceId: space.id }),
    }).catch(() => null);
  }
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(space.code);
      setCopied(true);
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
      copyTimeout.current = setTimeout(() => setCopied(false), 1600);
    } catch { setCopied(false); }
  }
  function downloadSummary() {
    const opened = printSpaceSummary({ code: space.code, stationName, rows, teamName: profile.teamName, phone });
    setPdfError(opened ? "" : "Izinkan popup browser untuk membuka ringkasan PDF, lalu coba lagi.");
    if (opened) trackAction("PDF_DOWNLOAD");
  }
  const fullscreen = typeof document !== "undefined" && document.fullscreenElement instanceof HTMLElement
    ? document.fullscreenElement : undefined;

  return <Dialog.Root open onOpenChange={open => { if (!open) requestClose(onClose); }}>
    <Dialog.Portal container={fullscreen}>
      <Dialog.Overlay ref={backdropRef} data-motion={closing ? "exit" : "enter"} className="tour-unit-backdrop fixed inset-0 z-[90] bg-black/20 lg:bg-black/30 lg:backdrop-blur-[2px]" />
      <Dialog.Content ref={sheetRef} aria-describedby={undefined} data-motion={closing ? "exit" : "enter"}
        onAnimationEnd={event => { if (event.target === event.currentTarget && event.animationName === "tour-unit-exit") finishClose(); }}
        onOpenAutoFocus={event => { event.preventDefault(); closeRef.current?.focus(); }}
        onCloseAutoFocus={event => { event.preventDefault(); if (previousFocus.current instanceof HTMLElement) previousFocus.current.focus(); }}
        onKeyDown={event => event.stopPropagation()}
        className={cn("tour-unit-modal fixed inset-x-0 bottom-0 z-[91] flex min-h-[min(32rem,calc(100dvh-3.5rem))] max-h-[calc(100dvh-0.75rem)] w-full max-w-[1200px] translate-y-[var(--sheet-drag-y,0px)] flex-col overflow-clip rounded-t-3xl bg-white text-[#0B1220] shadow-[0_24px_64px_rgba(15,23,42,0.25)] outline-none transition-[translate,height] duration-200 ease-out data-[dragging=true]:transition-none motion-reduce:transition-none lg:inset-x-auto lg:top-1/2 lg:bottom-auto lg:left-1/2 lg:h-[min(820px,calc(100dvh-4rem))] lg:min-h-0 lg:max-h-[calc(100dvh-1.5rem)] lg:w-[calc(100%-1.5rem)] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-2xl", expanded ? "h-[90dvh]" : "h-[70dvh]")}>
        <header onPointerDown={startSwipe} onPointerMove={moveSwipe} onPointerUp={event => finishSwipe(event)} onPointerCancel={event => finishSwipe(event, true)} onLostPointerCapture={event => { if (event.target === event.currentTarget) finishSwipe(event, true); }}
          onClickCapture={event => { if (event.detail > 0 && event.target instanceof Element && event.target.closest("[data-sheet-handle]") && performance.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation(); } }}
          className="shrink-0 touch-none border-b border-slate-200 bg-[#F3F8F5] px-4 pb-4 select-none sm:px-6 lg:touch-auto lg:bg-white lg:py-2.5 lg:select-auto">
          <button data-sheet-handle type="button" onClick={() => setExpanded(value => !value)} aria-label={expanded ? "Ringkas detail unit" : "Perbesar detail unit"} aria-expanded={expanded} className="mx-auto flex h-7 w-16 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-[#E31E2D] lg:hidden"><span aria-hidden="true" className="h-1 w-10 rounded-full bg-[#BFCFC5]" /></button>
          <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-[10px] font-semibold tracking-widest text-emerald-800 lg:hidden">{stage === "details" ? "DETAIL RUANG KOMERSIAL" : space.code}</p>
          <div className="hidden lg:block">
          {returnToList ? <button type="button" onClick={() => requestClose(onClose)} className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-lg text-sm font-medium text-slate-700 hover:text-slate-900"><ChevronLeft className="size-4 shrink-0" />Kembali ke Daftar Unit</button>
            : <p className="text-sm font-medium text-slate-600">Ruang Komersial</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {stationSlug && <button type="button" onClick={toggleFavorite} aria-label={favorite ? "Hapus dari favorit" : "Simpan ke favorit"} aria-pressed={favorite} title={favorite ? "Hapus dari favorit" : "Simpan ke favorit"} className={cn("inline-flex size-11 items-center justify-center rounded-full transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D]", favorite ? "text-[#C41926]" : "text-slate-600")}><Heart aria-hidden="true" className={cn("size-5", favorite && "fill-current")} /></button>}
            <Dialog.Close ref={closeRef} aria-label="Tutup detail unit" className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D]"><X className="size-5" /></Dialog.Close>
          </div>
          </div>
          {favoriteError && <p role="alert" className="mt-2 text-xs text-red-700">{favoriteError}</p>}
          <div className={stage === "details" ? "lg:sr-only" : "sr-only"}>
            <Dialog.Title className="pr-2 text-lg leading-snug font-semibold [overflow-wrap:anywhere]">{space.name || space.code}</Dialog.Title>
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600">{space.code} · {space.floor}{space.location ? ` · ${space.location}` : ""}</p>
            {stage === "details" && <span className={cn("mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", statusColor)}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{space.status === "TERSEDIA" ? "Tersedia untuk disewa" : SPACE_STATUS_LABELS[space.status]}</span>}
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-2">
          <section aria-label="Unit dan langkah pengajuan" className="hidden min-w-0 flex-col border-b border-slate-200 lg:flex lg:min-h-0 lg:border-r lg:border-b-0">
            <div className="min-h-0 flex-1 px-5 py-6 sm:px-7 lg:overflow-y-auto lg:overscroll-contain lg:px-8 lg:py-7">
              <div className="flex items-start gap-2">
                <h2 className="min-w-0 flex-1 font-display text-2xl leading-tight font-semibold [overflow-wrap:anywhere] lg:text-3xl">{space.code}</h2>
                <button type="button" onClick={() => void copyCode()} aria-label={copied ? "Kode disalin" : "Salin kode unit"} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}</button>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{breadcrumb}</p>
              {tenant && <p className="mt-3 text-sm font-semibold text-[#C41926]">Penyewa saat ini: {tenant}</p>}
              <div className="mt-8 hidden border-t border-slate-200 pt-6 lg:block">
                <h2 className="text-sm font-semibold text-slate-900">Setelah pengajuan</h2>
                {afterSteps}
              </div>
            </div>
            <footer className="shrink-0 border-t border-slate-200 px-5 py-4 sm:px-7 lg:px-8">
              <div className="grid grid-cols-2 gap-3">
                <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackAction("WHATSAPP_CLICK")} className={secondaryClass}><Phone className="size-4 shrink-0" />WhatsApp Tim</a>
                <button type="button" onClick={downloadSummary} className={secondaryClass}><Download className="size-4 shrink-0" />Unduh PDF</button>
              </div>
              {pdfError && <p role="alert" className="mt-2 text-xs text-red-700">{pdfError}</p>}
            </footer>
          </section>
          <section aria-label="Pengajuan minat sewa" className="flex min-h-0 min-w-0 flex-col">
            <SpaceInquiryForm key={space.id} spaceId={space.id} spaceCode={space.code} stationName={stationName} area={space.area}
              canApply={space.status === "TERSEDIA"}
              onStageChange={handleStageChange} onExplore={() => requestClose(onExplore)}
              details={<>
                <div className="py-3 lg:hidden">
                  <h3 className="text-sm font-semibold">Informasi Unit</h3>
                  <dl className="mt-3 grid grid-cols-2 gap-2.5">
                    {[["Stasiun", stationName], ["Area", location], ["Luas", `${space.area} m²`], ["Status", SPACE_STATUS_LABELS[space.status]]].map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold">{value}</dd></div>)}
                  </dl>
                  {tenant && <p className="mt-3 text-sm text-slate-600">Penyewa: {tenant}</p>}
                  <details className="mt-3 border-b border-slate-200 pb-3"><summary className="cursor-pointer py-2 text-sm font-medium text-slate-700">Spesifikasi dan utilitas</summary><dl className="divide-y divide-slate-200">{specRows}</dl></details>
                  <details className="border-b border-slate-200 py-3"><summary className="cursor-pointer py-2 text-sm font-medium text-slate-700">Setelah pengajuan</summary>{afterSteps}</details>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackAction("WHATSAPP_CLICK")} className={secondaryClass}><Phone className="size-4 shrink-0" />WhatsApp Tim</a>
                    <button type="button" onClick={downloadSummary} className={secondaryClass}><Download className="size-4 shrink-0" />Unduh PDF</button>
                  </div>
                  {pdfError && <p role="alert" className="mt-2 text-xs text-red-700">{pdfError}</p>}
                </div>
                <dl className="hidden divide-y divide-slate-200 lg:block">{specRows}</dl>
              </>} />
          </section>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
