"use client";

import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Grid3X3,
  Maximize2,
  Store,
  X,
} from "lucide-react";

type SpaceItem = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: "TERSEDIA" | "TERISI" | "MAINTENANCE";
  area: number;
};

type Props = {
  spaces: SpaceItem[];
  typeLabels: Record<string, string>;
  onClose: () => void;
  onSelect: (space: SpaceItem) => void;
  onViewMap?: () => void;
};

const STATUS_BADGE: Record<
  SpaceItem["status"],
  { label: string; className: string }
> = {
  TERSEDIA: {
    label: "Tersedia",
    className: "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40",
  },
  TERISI: {
    label: "Terisi",
    className: "bg-[#E31E2D]/20 text-[#ff8a93] ring-1 ring-[#E31E2D]/35",
  },
  MAINTENANCE: {
    label: "Maintenance",
    className: "bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/35",
  },
};

/**
 * Panel daftar unit — muncul dari "Lihat semua Tenant" (kiri).
 */
export default function TourUnitsPanel({
  spaces,
  typeLabels,
  onClose,
  onSelect,
  onViewMap,
}: Props) {
  const available = spaces.filter((s) => s.status === "TERSEDIA").length;
  const occupied = spaces.filter((s) => s.status === "TERISI").length;
  const totalArea = spaces.reduce((sum, s) => sum + (s.area || 0), 0);
  const areaLabel =
    totalArea % 1 === 0 ? `${totalArea}` : totalArea.toFixed(1).replace(".", ",");

  return (
    <aside className="tour-drawer-in-left pointer-events-auto absolute inset-y-0 left-0 z-[65] flex w-full max-w-sm flex-col border border-white/10 bg-black/60 text-[#F8ECEE] shadow-[0_22px_50px_rgba(0,0,0,0.6)] backdrop-blur-md sm:max-w-[22rem]">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-white/10 px-3.5 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#E31E2D] text-white">
          <Grid3X3 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="font-display text-sm font-bold text-white">Unit Komersial</h2>
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/80">
              {spaces.length}
            </span>
          </div>
        </div>
        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          {available} tersedia
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
          aria-label="Tutup daftar unit"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-1.5 border-b border-white/10 px-3 py-2.5">
        {[
          {
            label: "Total Unit",
            value: String(spaces.length),
            icon: <Store className="size-3.5 text-white/70" />,
            valueClass: "text-white",
          },
          {
            label: "Tersedia",
            value: String(available),
            icon: <CheckCircle2 className="size-3.5 text-emerald-400" />,
            valueClass: "text-emerald-300",
          },
          {
            label: "Terisi",
            value: String(occupied),
            icon: <CalendarDays className="size-3.5 text-white/70" />,
            valueClass: "text-white",
          },
          {
            label: "Total Luas",
            value: `${areaLabel} m²`,
            icon: <Maximize2 className="size-3.5 text-white/70" />,
            valueClass: "text-white",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-black/35 px-1.5 py-2 text-center ring-1 ring-white/5"
          >
            <div className="mx-auto mb-1 flex size-6 items-center justify-center rounded-full bg-white/5">
              {stat.icon}
            </div>
            <p className={`text-[11px] font-bold leading-tight ${stat.valueClass}`}>
              {stat.value}
            </p>
            <p className="mt-0.5 text-[8px] leading-tight text-white/50">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3 pb-4">
        {spaces.map((space) => {
          const badge = STATUS_BADGE[space.status];
          const availableItem = space.status === "TERSEDIA";
          return (
            <button
              key={space.id}
              type="button"
              onClick={() => onSelect(space)}
              className={`flex w-full items-center gap-2.5 rounded-xl bg-black/40 p-2.5 text-left transition hover:bg-black/55 ${
                availableItem
                  ? "ring-1 ring-emerald-400/50"
                  : "ring-1 ring-white/8"
              }`}
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/10 px-1 text-center font-mono text-[9px] leading-tight font-bold text-white/85 ring-1 ring-white/10">
                {space.code}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-white">
                  {space.name}
                </span>
                <span className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-white/55">
                  <Building2 className="size-3 shrink-0" />
                  {typeLabels[space.type] ?? space.type}
                  <span className="opacity-40">·</span>
                  {space.area} m²
                </span>
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${badge.className}`}
              >
                {badge.label}
              </span>
              <ChevronRight className="size-4 shrink-0 text-white/35" />
            </button>
          );
        })}
        {spaces.length === 0 && (
          <p className="py-10 text-center text-sm text-white/50">
            Belum ada unit untuk stasiun ini.
          </p>
        )}
      </div>

      {/* Footer */}
      {onViewMap && (
        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={onViewMap}
            className="flex h-11 w-full items-center gap-2 rounded-xl bg-black/45 px-3.5 text-left text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-black/60"
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-white/10">
              <Maximize2 className="size-3.5" />
            </span>
            <span className="flex-1">Lihat Peta Unit</span>
            <ChevronRight className="size-4 text-white/40" />
          </button>
        </div>
      )}
    </aside>
  );
}
