"use client";

import { useTourLanguage } from "@/components/tour/TourLanguageProvider";
import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import MobileTourSheet from "@/components/tour/MobileTourSheet";
import { useMobileTour } from "@/lib/use-mobile-tour";

export default function TrainTourPanel({ title, onClose, children, footer, wide = false, compact = false, centered = false, fitContent = false, width }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  compact?: boolean;
  centered?: boolean;
  fitContent?: boolean;
  width?: number;
}) {
  const { t } = useTourLanguage();
  const mobile = useMobileTour();
  if (mobile) return <MobileTourSheet key={title} title={title} size={compact ? "content" : "list"} onClose={onClose} initialExpanded={(wide && !fitContent) || (!compact && window.matchMedia("(max-height: 700px)").matches)} footer={footer}>{children}</MobileTourSheet>;
  const fullscreen = typeof document !== "undefined" && document.fullscreenElement instanceof HTMLElement ? document.fullscreenElement : undefined;
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal container={fullscreen}>
      <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/20" />
      <Dialog.Content aria-describedby={undefined} onKeyDown={event => event.stopPropagation()} style={width ? { width } : undefined}
        className={`tour-panel-in fixed z-[91] flex max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl bg-white text-slate-900 shadow-[0_24px_64px_rgba(15,23,42,0.25)] outline-none ${centered ? `inset-0 m-auto ${compact || fitContent ? "h-fit" : "h-[min(820px,calc(100dvh-2rem))]"}` : `top-4 right-4 ${compact ? "" : "bottom-4"}`} ${wide ? "w-[960px]" : centered ? "w-[640px]" : "w-[420px]"}`}>
        <header className="flex min-h-18 shrink-0 items-center gap-3 border-b border-slate-200 px-6">
          <Dialog.Title className="min-w-0 flex-1 text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Close aria-label={t("Tutup {title}", { title })} className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[#E31E2D]"><X className="size-5" /></Dialog.Close>
        </header>
        {children}
        {footer && <footer className="shrink-0 border-t border-slate-200 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</footer>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
