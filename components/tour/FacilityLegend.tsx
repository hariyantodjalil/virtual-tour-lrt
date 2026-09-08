"use client";

import Image from "next/image";
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
};

/**
 * Daftar pin fasilitas — panel muncul saat tombol Fasilitas di rail diklik.
 */
export default function FacilityLegend({
  activeFacilityId = null,
  onSelectFacility,
  className = "",
}: Props) {
  return (
    <div
      className={`min-w-[140px] rounded-2xl border border-white/12 bg-[#1c1c1e]/90 px-2.5 py-2.5 shadow-lg backdrop-blur-md ${className}`}
    >
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
  );
}
