"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
};

/**
 * Legenda pin fasilitas — pojok kanan atas virtual tour.
 * Klik item → kamera ke pin fasilitas di panorama.
 */
export default function FacilityLegend({
  activeFacilityId = null,
  onSelectFacility,
}: Props) {
  const [open, setOpen] = useState(true);

  return (
    <div className="pointer-events-auto absolute top-14 right-3 z-[58] flex items-start gap-1.5 sm:top-16 sm:right-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/75"
        aria-label={open ? "Sembunyikan legenda fasilitas" : "Tampilkan legenda fasilitas"}
        aria-expanded={open}
      >
        {open ? (
          <ChevronRight className="size-3" strokeWidth={2.5} />
        ) : (
          <ChevronLeft className="size-3" strokeWidth={2.5} />
        )}
      </button>

      {open ? (
        <div className="min-w-[128px] rounded-[15px] bg-black/60 px-2.5 py-2.5 shadow-lg backdrop-blur-[2px]">
          <ul className="space-y-1.5">
            {LEGEND_ITEMS.map((item) => {
              const active = activeFacilityId === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelectFacility?.(item.id)}
                    className={`grid w-full grid-cols-[1fr_28px] items-center gap-2 rounded-lg px-1 py-0.5 transition ${
                      active ? "bg-white/15" : "hover:bg-white/10"
                    }`}
                    aria-pressed={active}
                    aria-label={`Tampilkan ${item.label}`}
                  >
                    <span className="truncate text-right text-[10px] leading-none font-medium text-white">
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
        </div>
      ) : null}
    </div>
  );
}
