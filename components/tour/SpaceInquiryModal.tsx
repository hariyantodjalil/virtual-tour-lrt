"use client";

import { useTourLanguage } from "@/components/tour/TourLanguageProvider";
import { useCallback, useEffect, useRef, useState, type ComponentProps, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  Copy,
  ExternalLink,
  Heart,
  ImageIcon,
  MapPin,
  MessageCircle,
  Store,
  X,
  Zap,
} from "lucide-react";
import type InTourSpacePopupLegacy from "./InTourSpacePopupLegacy";
import TourEditorLink from "./TourEditorLink";
import SpaceInquiryForm, { type SpaceInquiryStage } from "./SpaceInquiryForm";
import { useCommercialProfile } from "@/components/commercial/CommercialProfileProvider";
import { SPACE_STATUS_LABELS } from "@/lib/commercial-pipeline";
import { cn, getWhatsAppUrl } from "@/lib/utils";
import { resolveSheetSwipe } from "@/lib/sheet-gesture";
import { FAVORITES_UPDATED_EVENT, isFavoriteSpace, toggleFavoriteSpace } from "@/lib/favorite-spaces";
import { resolvePublicAssetUrl, shouldUnoptimizeImage } from "@/lib/s3-utils";

export type SpaceInquiryModalProps = ComponentProps<typeof InTourSpacePopupLegacy> & { onExplore?: () => void };

const secondaryClass =
  "inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D]";
const primaryClass =
  "inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg bg-[#E31E2D] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#C41926] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D] disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[12rem]";

function InfoRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 py-4 last:border-b-0">
      <span
        className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-500">{label}</p>
        <div className="mt-1.5 min-w-0 text-sm font-semibold text-slate-900">{children}</div>
      </div>
    </div>
  );
}

export default function SpaceInquiryModal({
  space,
  stationName,
  stationSlug,
  contactPhone,
  onClose,
  onExplore = onClose,
  returnToList = false,
  editHotspotHref,
}: SpaceInquiryModalProps) {
  const { t, content, locale } = useTourLanguage();
  const profile = useCommercialProfile();
  const phone = contactPhone || profile.whatsappNumber;
  const [copied, setCopied] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [favoriteError, setFavoriteError] = useState("");
  const [stage, setStage] = useState<SpaceInquiryStage>("details");
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    time: number;
    height: number;
    expanded: boolean;
    dragging: boolean;
    horizontal: boolean;
  } | null>(null);
  const suppressClickUntil = useRef(0);
  const dismissTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeCallback = useRef<(() => void) | null>(null);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef(typeof document !== "undefined" ? document.activeElement : null);

  const preferredUses = Array.isArray((space as { preferredUses?: string[] }).preferredUses)
    ? ((space as { preferredUses?: string[] }).preferredUses ?? []).map((item) => item.trim()).filter(Boolean)
    : [];
  const breadcrumb = [stationName, space.floor, space.location]
    .map((part) => part?.trim() ? content(part.trim()) : "")
    .filter(Boolean)
    .join(" | ");
  const lokasiValue = [stationName, space.floor || space.location]
    .map((part) => part?.trim() ? content(part.trim()) : "")
    .filter(Boolean)
    .join(" — ") || "—";
  const areaLabel = `${Number(space.area).toLocaleString(locale, { maximumFractionDigits: 2 })} m²`;
  const powerLabel = space.powerSupply?.trim() || "—";
  const statusLabel =
    SPACE_STATUS_LABELS[space.status as keyof typeof SPACE_STATUS_LABELS] ?? space.status;
  const canApply = space.status === "TERSEDIA";
  const tenant = space.status === "TERISI" ? space.tenantBrand?.trim() : null;
  const imageSrc = space.panoramaUrl?.trim()
    ? resolvePublicAssetUrl(space.panoramaUrl.trim())
    : null;
  const waUrl = getWhatsAppUrl(
    phone,
    t("Halo, saya tertarik dengan unit komersial {code} ({name}) di Stasiun {station}. Mohon informasi lebih lanjut.", { code: space.code, name: content(space.name), station: stationName })
  );
  const statusTone =
    space.status === "TERSEDIA"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : space.status === "TERISI"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-slate-200 bg-slate-50 text-slate-700";

  useEffect(() => {
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "SPACE_VIEW", spaceId: space.id }),
    }).catch(() => null);
  }, [space.id]);
  useEffect(() => () => {
    if (copyTimeout.current) clearTimeout(copyTimeout.current);
  }, []);
  useEffect(() => () => {
    if (dismissTimeout.current) clearTimeout(dismissTimeout.current);
  }, []);
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
      setFavorite(
        toggleFavoriteSpace({
          spaceId: space.id,
          code: space.code,
          name: space.name,
          type: space.type,
          status: space.status,
          area: space.area,
          monthlyRent: space.monthlyRent,
          location: space.location,
          floor: space.floor,
          panoramaUrl: space.panoramaUrl,
          stationSlug,
          stationName,
        })
      );
      setFavoriteError("");
    } catch {
      setFavoriteError("Favorit gagal disimpan. Periksa penyimpanan browser.");
    }
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
      sheetRef.current.style.setProperty(
        "--tour-unit-exit-transform",
        style.transform === "none" ? "translate3d(0, 0, 0)" : style.transform
      );
      sheetRef.current.style.setProperty("--tour-unit-exit-opacity", style.opacity);
    }
    if (backdropRef.current) {
      backdropRef.current.style.setProperty(
        "--tour-unit-backdrop-opacity",
        getComputedStyle(backdropRef.current).opacity
      );
    }
    setClosing(true);
    dismissTimeout.current = setTimeout(
      finishClose,
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 400
    );
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
    if (!event.isPrimary || event.button !== 0 || dismissTimeout.current || !window.matchMedia("(max-width: 1023px)").matches) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("button, a, input, select, textarea") && !target.closest("[data-sheet-handle]")) {
      return;
    }
    gestureRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: event.timeStamp,
      height: sheetRef.current?.getBoundingClientRect().height ?? 0,
      expanded,
      dragging: false,
      horizontal: false,
    };
  }

  function moveSwipe(event: ReactPointerEvent<HTMLElement>) {
    const gesture = gestureRef.current;
    const sheet = sheetRef.current;
    if (!gesture || gesture.horizontal || gesture.pointerId !== event.pointerId || !sheet) return;
    const deltaX = event.clientX - gesture.x;
    const deltaY = event.clientY - gesture.y;
    if (!gesture.dragging) {
      if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return;
      if (Math.abs(deltaX) >= Math.abs(deltaY)) {
        gesture.horizontal = true;
        return;
      }
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
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const action =
      cancelled || !gesture.dragging
        ? "none"
        : resolveSheetSwipe({
            deltaX: event.clientX - gesture.x,
            deltaY: event.clientY - gesture.y,
            elapsedMs: event.timeStamp - gesture.time,
            sheetHeight: gesture.height,
            expanded: gesture.expanded,
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

  function trackWhatsApp() {
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "WHATSAPP_CLICK", spaceId: space.id }),
    }).catch(() => null);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(space.assetCode ?? space.code);
      setCopied(true);
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
      copyTimeout.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  const fullscreen =
    typeof document !== "undefined" && document.fullscreenElement instanceof HTMLElement
      ? document.fullscreenElement
      : undefined;

  const infoPanel = (
    <div>
      <h3 className="text-base font-semibold text-slate-900">{t("Informasi Ruang Komersial")}</h3>
      <div className="mt-4 overflow-hidden rounded-xl border border-[#F3C5CB] bg-[#FFF5F6] px-4 py-3">
        <p className="text-xs font-medium text-slate-500">{t("Total Luas")}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-[#C41926]">{areaLabel}</p>
      </div>
      <div className="mt-1">
        <InfoRow label={t("Lokasi")} icon={<MapPin className="size-4" />}>
          <span className="break-words">{content(lokasiValue)}</span>
        </InfoRow>
        <InfoRow label={t("Peruntukan usaha")} icon={<Store className="size-4" />}>
          {preferredUses.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {preferredUses.map((use) => (
                <span
                  key={use}
                  className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {content(use)}
                </span>
              ))}
            </div>
          ) : (
            <span className="font-normal text-slate-400">—</span>
          )}
        </InfoRow>
        <InfoRow label={t("Pasokan Listrik")} icon={<Zap className="size-4" />}>
          <span className={cn("break-words", powerLabel === "—" && "font-normal text-slate-400")}>
            {content(powerLabel)}
          </span>
        </InfoRow>
        <InfoRow label={t("Ketersediaan")} icon={<CalendarDays className="size-4" />}>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
              statusTone
            )}
          >
            {space.status === "TERSEDIA" ? (
              <CheckCircle2 className="size-3.5" aria-hidden />
            ) : null}
            {t(statusLabel)}
          </span>
          {tenant ? <p className="mt-2 text-xs font-normal text-slate-600">{t("Penyewa:")} {tenant}</p> : null}
        </InfoRow>
      </div>
    </div>
  );

  const mediaPanel = (
    <div className="min-w-0">
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1 text-2xl leading-tight font-semibold tracking-tight text-slate-900 [overflow-wrap:anywhere] lg:text-[1.75rem]">
          {space.assetCode ?? space.code}
        </h2>
        <button
          type="button"
          onClick={() => void copyCode()}
          aria-label={copied ? t("Kode disalin") : t("Salin kode unit")}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{breadcrumb || "—"}</p>
      <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={content(space.name || space.code)}
            fill
            className="object-cover"
            sizes="(max-width: 1023px) 100vw, 520px"
            unoptimized={shouldUnoptimizeImage(imageSrc)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            <ImageIcon className="size-10 opacity-50" aria-hidden />
          </div>
        )}
        <button
          type="button"
          onClick={() => requestClose(onExplore)}
          className="absolute bottom-3 left-3 inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3.5 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur-sm hover:bg-white"
        >
          <span aria-hidden className="text-[11px] font-bold tracking-wide text-[#C41926]">
            360°
          </span>
          {t("Lihat di Virtual Tour")}
          <ExternalLink className="size-3.5 text-slate-500" aria-hidden />
        </button>
      </div>
    </div>
  );

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) requestClose(onClose);
      }}
    >
      <Dialog.Portal container={fullscreen}>
        <Dialog.Overlay
          ref={backdropRef}
          data-motion={closing ? "exit" : "enter"}
          className="tour-unit-backdrop fixed inset-0 z-[90] bg-black/20 lg:bg-black/30 lg:backdrop-blur-[2px]"
        />
        <Dialog.Content
          ref={sheetRef}
          aria-describedby={undefined}
          data-motion={closing ? "exit" : "enter"}
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget && event.animationName === "tour-unit-exit") {
              finishClose();
            }
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            closeRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (previousFocus.current instanceof HTMLElement) previousFocus.current.focus();
          }}
          onKeyDown={(event) => event.stopPropagation()}
          className={cn(
            "tour-unit-modal fixed inset-x-0 bottom-0 z-[91] flex min-h-[min(32rem,calc(100dvh-3.5rem))] max-h-[calc(100dvh-0.75rem)] w-full max-w-[1100px] translate-y-[var(--sheet-drag-y,0px)] flex-col overflow-clip rounded-t-3xl bg-white text-[#0B1220] shadow-[0_24px_64px_rgba(15,23,42,0.25)] outline-none transition-[translate,height] duration-200 ease-out data-[dragging=true]:transition-none motion-reduce:transition-none lg:inset-x-auto lg:top-1/2 lg:bottom-auto lg:left-1/2 lg:h-[min(760px,calc(100dvh-4rem))] lg:min-h-0 lg:max-h-[calc(100dvh-1.5rem)] lg:w-[calc(100%-1.5rem)] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-2xl",
            expanded || stage !== "details" ? "h-[90dvh]" : "h-[70dvh]"
          )}
        >
          <header
            onPointerDown={startSwipe}
            onPointerMove={moveSwipe}
            onPointerUp={(event) => finishSwipe(event)}
            onPointerCancel={(event) => finishSwipe(event, true)}
            onLostPointerCapture={(event) => {
              if (event.target === event.currentTarget) finishSwipe(event, true);
            }}
            onClickCapture={(event) => {
              if (
                event.detail > 0 &&
                event.target instanceof Element &&
                event.target.closest("[data-sheet-handle]") &&
                performance.now() < suppressClickUntil.current
              ) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
            className="shrink-0 touch-none border-b border-slate-200 bg-white px-4 pb-3 select-none sm:px-6 lg:touch-auto lg:py-4 lg:select-auto"
          >
            <button
              data-sheet-handle
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-label={expanded ? t("Ringkas detail unit") : t("Perbesar detail unit")}
              aria-expanded={expanded}
              className="mx-auto flex h-7 w-16 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-[#E31E2D] lg:hidden"
            >
              <span aria-hidden="true" className="h-1 w-10 rounded-full bg-[#BFCFC5]" />
            </button>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {returnToList && stage === "details" ? (
                  <button
                    type="button"
                    onClick={() => requestClose(onClose)}
                    className="mb-2 inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-medium text-slate-700 hover:text-slate-900"
                  >
                    <ChevronLeft className="size-4 shrink-0" />
                    {t("Kembali ke Daftar Unit")}
                  </button>
                ) : null}
                <Dialog.Title className="text-lg font-semibold tracking-tight text-slate-900 lg:text-xl">
                  {stage === "details" ? t(canApply ? "Ruang tersedia" : "Detail unit") : space.assetCode ?? space.code}
                </Dialog.Title>
                <p className="mt-0.5 text-sm text-slate-500">
                  {stage === "details" ? t("Ruang Komersial LRT Jabodebek") : content(space.name)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {stationSlug ? (
                  <button
                    type="button"
                    onClick={toggleFavorite}
                    aria-label={favorite ? t("Hapus dari favorit") : t("Simpan ke favorit")}
                    aria-pressed={favorite}
                    title={favorite ? t("Hapus dari favorit") : t("Simpan ke favorit")}
                    className={cn(
                      "inline-flex size-11 items-center justify-center rounded-full transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D]",
                      favorite ? "text-[#C41926]" : "text-slate-600"
                    )}
                  >
                    <Heart aria-hidden="true" className={cn("size-5", favorite && "fill-current")} />
                  </button>
                ) : null}
                <Dialog.Close
                  ref={closeRef}
                  aria-label={t("Tutup detail unit")}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D]"
                >
                  <X className="size-5" />
                </Dialog.Close>
              </div>
            </div>
            {stage === "details" && editHotspotHref && <TourEditorLink href={editHotspotHref} label={t("Edit hotspot di CMS")} />}
            {favoriteError ? (
              <p role="alert" className="mt-2 text-xs text-red-700">
                {t(favoriteError)}
              </p>
            ) : null}
          </header>

          {stage === "details" ? (
            <>
              <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto overscroll-contain lg:grid-cols-2 lg:overflow-hidden">
                <section
                  aria-label={t("Identitas dan foto unit")}
                  className="min-w-0 border-b border-slate-100 px-4 py-4 sm:px-6 lg:overflow-y-auto lg:overscroll-contain lg:border-r lg:border-b-0 lg:px-7 lg:py-6"
                >
                  {mediaPanel}
                </section>
                <section
                  aria-label={t("Informasi ruang komersial")}
                  className="min-w-0 px-4 py-4 sm:px-6 lg:overflow-y-auto lg:overscroll-contain lg:px-7 lg:py-6"
                >
                  {infoPanel}
                </section>
              </div>
              <footer className="shrink-0 border-t border-slate-200 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-7 lg:pb-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={trackWhatsApp}
                    className={cn(secondaryClass, "w-full sm:w-auto sm:min-w-[10.5rem]")}
                  >
                    <MessageCircle className="size-4 shrink-0" />
                    {t("WhatsApp Tim")}
                  </a>
                  <button
                    type="button"
                    disabled={!canApply}
                    onClick={() => {
                      setStage("form");
                      setExpanded(true);
                    }}
                    className={cn(primaryClass, "w-full sm:w-auto")}
                  >
                    {canApply ? (
                      <>
                        {t("Ajukan Minat Sewa")}
                        <ArrowRight className="size-4" />
                      </>
                    ) : (
                      t("Ruang belum tersedia")
                    )}
                  </button>
                </div>
              </footer>
            </>
          ) : (
            <SpaceInquiryForm
              key={`${space.id}-form`}
              spaceId={space.id}
              spaceCode={space.assetCode ?? space.code}
              stationName={stationName}
              area={space.area}
              canApply={canApply}
              initialStage="form"
              onStageChange={handleStageChange}
              onExplore={() => requestClose(onExplore)}
              onBackToDetails={() => {
                setStage("details");
                setExpanded(false);
              }}
              details={<></>}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
