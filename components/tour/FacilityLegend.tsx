"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { FACILITY_ICONS, type FacilityIconId } from "@/lib/facility-icons";

const LEGEND_ORDER: FacilityIconId[] = [
  "escalator",
  "mushola",
  "toilet",
  "gate",
  "lift",
];

const LEGEND_ITEMS = LEGEND_ORDER.map(
  (id) => FACILITY_ICONS.find((icon) => icon.id === id)!
);

type Props = {
  activeFacilityId?: FacilityIconId | null;
  onSelectFacility?: (id: FacilityIconId) => void;
  className?: string;
  mobile?: boolean;
  availableIds?: FacilityIconId[];
  onClose?: () => void;
};

/**
 * Daftar pin fasilitas — panel muncul saat tombol Fasilitas di rail diklik.
 */
export default function FacilityLegend({
  activeFacilityId = null,
  onSelectFacility,
  className = "",
  mobile = false,
  availableIds,
  onClose,
}: Props) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobile || !onClose) return;
    const previousFocus = document.activeElement;
    closeButton.current?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose?.(); }
    }
    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("keydown", handleKey, true);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [mobile, onClose]);
  const items = availableIds ? LEGEND_ITEMS.filter(item => availableIds.includes(item.id)) : LEGEND_ITEMS;
  return (
    <div
      role={mobile ? "dialog" : undefined}
      aria-label={mobile ? "Fasilitas stasiun" : undefined}
      onKeyDown={event => { if (mobile) event.stopPropagation(); }}
      className={`${mobile ? "tour-panel-in flex w-[min(15rem,calc(100vw-4.5rem))] max-h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-2xl bg-white text-slate-900 shadow-[0_12px_32px_rgba(15,23,42,0.22)]" : "min-w-[140px] rounded-2xl border border-white/12 bg-[#1c1c1e]/90 px-2.5 py-2.5 shadow-lg backdrop-blur-md"} ${className}`}
    >
      {mobile && <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 py-1 pr-1 pl-3">
        <h2 className="min-w-0 flex-1 text-sm font-semibold">Fasilitas</h2>
        <button ref={closeButton} type="button" aria-label="Tutup fasilitas" onClick={onClose} className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[#E31E2D]"><X className="size-4" /></button>
      </div>}
      <ul className={mobile ? "min-h-0 space-y-1 overflow-y-auto overscroll-contain p-2" : "space-y-1.5"}>
        {items.map((item) => {
          const active = activeFacilityId === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelectFacility?.(item.id)}
                className={mobile ? `flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-[#E31E2D] ${active ? "bg-red-50" : "hover:bg-slate-100"}` : `grid w-full grid-cols-[1fr_28px] items-center gap-2 rounded-lg px-1 py-0.5 transition ${active ? "bg-white/15" : "hover:bg-white/10"}`}
                aria-pressed={active}
                aria-label={`Tampilkan ${item.label}`}
              >
                <span className={mobile ? "order-2 min-w-0 flex-1 text-sm font-medium" : "truncate text-right text-[10px] leading-none font-medium text-white"}>
                  {item.label}
                </span>
                <Image
                  src={item.src}
                  alt=""
                  width={28}
                  height={28}
                  className={`size-7 object-contain ${active ? "drop-shadow-[0_0_4px_rgba(255,255,255,0.55)]" : ""}`}
                  unoptimized
                />
              </button>
            </li>
          );
        })}
      </ul>
      {!items.length && <p className="px-3 pb-4 text-sm leading-relaxed text-slate-600">Belum ada titik fasilitas.</p>}
    </div>
  );
}
