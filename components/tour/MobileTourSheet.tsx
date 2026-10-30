"use client";

import { createContext, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type PointerEvent, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { resolveSheetSwipe } from "@/lib/sheet-gesture";

export type CloseTourSheet = (afterClose?: () => void) => void;
const CloseSheetContext = createContext<CloseTourSheet | null>(null);

export function TourSheetAction({ afterClose, children, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & { afterClose: () => void }) {
  const close = useContext(CloseSheetContext);
  return <button {...props} type="button" onClick={() => close?.(afterClose)}>{children}</button>;
}

type Props = {
  title: string;
  size: "content" | "list";
  onClose: () => void;
  initialExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  children: ReactNode;
  footer?: ReactNode;
};

export default function MobileTourSheet({ title, size, onClose, children, footer, initialExpanded = false, onExpandedChange }: Props) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [closing, setClosing] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef(typeof document !== "undefined" ? document.activeElement : null);
  const closeAction = useRef<(() => void) | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickUntil = useRef(0);
  const gesture = useRef<{ id: number; x: number; y: number; time: number; height: number; expanded: boolean; dragging: boolean; horizontal: boolean } | null>(null);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  function finishClose() {
    const action = closeAction.current;
    if (!action) return;
    closeAction.current = null;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    action();
  }

  function close(afterClose?: () => void) {
    if (closeAction.current) return;
    closeAction.current = () => { onClose(); afterClose?.(); };
    gesture.current = null;
    if (sheet.current) {
      const style = getComputedStyle(sheet.current);
      sheet.current.style.setProperty("--tour-unit-exit-transform", style.transform === "none" ? "translate3d(0,0,0)" : style.transform);
      sheet.current.style.setProperty("--tour-unit-exit-opacity", style.opacity);
    }
    if (backdrop.current) backdrop.current.style.setProperty("--tour-unit-backdrop-opacity", getComputedStyle(backdrop.current).opacity);
    setClosing(true);
    closeTimer.current = setTimeout(finishClose, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 400);
  }

  function resize(next: boolean) {
    setExpanded(next);
    onExpandedChange?.(next);
  }

  function resetDrag() {
    sheet.current?.removeAttribute("data-dragging");
    sheet.current?.style.removeProperty("--sheet-drag-y");
    sheet.current?.style.removeProperty("height");
  }

  function start(event: PointerEvent<HTMLElement>) {
    if (!event.isPrimary || event.button !== 0 || closing) return;
    if (event.target instanceof Element && event.target.closest("button,a,input,select,textarea") && !event.target.closest("[data-sheet-handle]")) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, height: sheet.current?.getBoundingClientRect().height ?? 0, expanded, dragging: false, horizontal: false };
  }

  function move(event: PointerEvent<HTMLElement>) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId || current.horizontal || !sheet.current) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.dragging) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dx) >= Math.abs(dy)) { current.horizontal = true; return; }
      current.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      sheet.current.setAttribute("data-dragging", "true");
    }
    event.preventDefault();
    if (dy >= 0) {
      sheet.current.style.removeProperty("height");
      sheet.current.style.setProperty("--sheet-drag-y", `${dy}px`);
    } else {
      sheet.current.style.setProperty("--sheet-drag-y", "0px");
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      sheet.current.style.height = `${Math.max(current.height, Math.min(viewport * 0.9, current.height - dy))}px`;
    }
  }

  function end(event: PointerEvent<HTMLElement>, cancelled = false) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    gesture.current = null;
    if (current.dragging || current.horizontal) suppressClickUntil.current = performance.now() + 400;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const action = cancelled || !current.dragging ? "none" : resolveSheetSwipe({ deltaX: event.clientX - current.x, deltaY: event.clientY - current.y, elapsedMs: event.timeStamp - current.time, sheetHeight: current.height, expanded: current.expanded });
    if (action === "dismiss") {
      sheet.current?.removeAttribute("data-dragging");
      sheet.current?.style.removeProperty("height");
      close();
      return;
    }
    resetDrag();
    if (action === "expand") resize(true);
    if (action === "collapse") resize(false);
  }

  const fullscreen = typeof document !== "undefined" && document.fullscreenElement instanceof HTMLElement ? document.fullscreenElement : undefined;
  return <Dialog.Root open onOpenChange={open => { if (!open) close(); }}>
    <Dialog.Portal container={fullscreen}>
      <Dialog.Overlay ref={backdrop} data-motion={closing ? "exit" : "enter"} className="tour-unit-backdrop fixed inset-0 z-[90] bg-black/20" />
      <Dialog.Content ref={sheet} aria-describedby={undefined} data-motion={closing ? "exit" : "enter"} data-tour-sheet={title}
        onKeyDown={event => event.stopPropagation()}
        onOpenAutoFocus={event => { event.preventDefault(); closeButton.current?.focus(); }}
        onCloseAutoFocus={event => { event.preventDefault(); if (previousFocus.current instanceof HTMLElement && previousFocus.current.isConnected) previousFocus.current.focus(); }}
        onAnimationEnd={event => { if (event.target === event.currentTarget && event.animationName === "tour-unit-exit") finishClose(); }}
        className={`tour-mobile-sheet fixed inset-x-0 bottom-0 z-[91] flex max-h-[90dvh] w-full translate-y-[var(--sheet-drag-y,0px)] flex-col overflow-clip rounded-t-3xl bg-white text-slate-900 shadow-[0_24px_64px_rgba(15,23,42,0.25)] outline-none transition-[translate,height] duration-200 ease-out data-[dragging=true]:transition-none motion-reduce:transition-none ${expanded ? "h-[90dvh]" : size === "list" ? "h-[60dvh] min-h-[min(24rem,80dvh)]" : ""}`}>
        <header onPointerDown={start} onPointerMove={move} onPointerUp={event => end(event)} onPointerCancel={event => end(event, true)} onLostPointerCapture={event => { if (event.target === event.currentTarget) end(event, true); }}
          onClickCapture={event => { if (event.detail > 0 && event.target instanceof Element && event.target.closest("[data-sheet-handle]") && performance.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation(); } }}
          className="shrink-0 touch-none border-b border-slate-200 bg-[#F3F8F5] px-4 select-none">
          <button type="button" data-sheet-handle aria-label={expanded ? "Ringkas panel" : "Perbesar panel"} aria-expanded={expanded} onClick={() => resize(!expanded)} className="mx-auto flex h-7 w-16 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-[#E31E2D]"><span aria-hidden="true" className="h-1 w-10 rounded-full bg-[#BFCFC5]" /></button>
          <div className="flex min-h-14 items-center gap-3 pb-2">
            <Dialog.Title className="min-w-0 flex-1 text-base font-semibold">{title}</Dialog.Title>
            <Dialog.Close ref={closeButton} aria-label={`Tutup ${title.toLocaleLowerCase("id-ID")}`} className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-200/60 focus-visible:outline-2 focus-visible:outline-[#E31E2D]"><X className="size-5" /></Dialog.Close>
          </div>
        </header>
        <CloseSheetContext.Provider value={close}>
          {children}
          {footer && <footer className="shrink-0 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</footer>}
        </CloseSheetContext.Provider>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
