"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Grid3X3,
  Maximize2,
  Phone,
  Search,
  Store,
  X,
} from "lucide-react";
import type { SpaceAvailabilityStatus } from "@/lib/space-availability";

type SpaceItem = {
  id: string;
  code: string;
  name: string;
  displayName?: string;
  type: string;
  status: SpaceAvailabilityStatus;
  area: number;
  tenantBrand?: string | null;
};

type Props = {
  spaces: SpaceItem[];
  typeLabels: Record<string, string>;
  onClose: () => void;
  onSelect: (space: SpaceItem) => void;
  onViewMap?: () => void;
  /** WhatsApp / kontak komersial — untuk empty & inventori penuh */
  contactUrl?: string;
};

const STATUS_BADGE: Record<
  SpaceItem["status"],
  { label: string; className: string }
> = {
  TERSEDIA: {
    label: "Tersedia",
    className: "bg-emerald-50 text-emerald-800",
  },
  RESERVED: {
    label: "Reserved",
    className: "bg-indigo-50 text-indigo-800",
  },
  FIT_OUT: {
    label: "Fit-Out",
    className: "bg-violet-50 text-violet-800",
  },
  TERISI: {
    label: "Terisi",
    className: "bg-red-50 text-red-800",
  },
  MAINTENANCE: {
    label: "Maintenance",
    className: "bg-amber-50 text-amber-800",
  },
};

function matchesQuery(
  space: SpaceItem,
  query: string,
  typeLabels: Record<string, string>
) {
  const q = query.trim().toLocaleLowerCase("id-ID");
  if (!q) return true;
  const haystack = [
    space.displayName,
    space.name,
    space.code,
    space.tenantBrand,
    typeLabels[space.type] ?? space.type,
    STATUS_BADGE[space.status]?.label,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("id-ID");
  return haystack.includes(q);
}

/**
 * Panel daftar unit — shell Operate putih (selaras SpaceInquiryModal / mobile sheet).
 */
export default function TourUnitsPanel({
  spaces,
  typeLabels,
  onClose,
  onSelect,
  onViewMap,
  contactUrl,
}: Props) {
  const [query, setQuery] = useState("");
  const available = spaces.filter((s) => s.status === "TERSEDIA").length;
  const occupied = spaces.filter((s) => s.status === "TERISI").length;
  const totalArea = spaces.reduce((sum, s) => sum + (s.area || 0), 0);
  const areaLabel =
    totalArea % 1 === 0 ? `${totalArea}` : totalArea.toFixed(1).replace(".", ",");
  const inventoryEmpty = spaces.length === 0;
  const noneAvailable = !inventoryEmpty && available === 0;
  const filtered = useMemo(
    () => spaces.filter((space) => matchesQuery(space, query, typeLabels)),
    [spaces, query, typeLabels]
  );
  const showSearch = spaces.length >= 5;
  const noSearchHits = !inventoryEmpty && filtered.length === 0 && query.trim().length > 0;

  return (
    <aside className="tour-drawer-in-left pointer-events-auto absolute inset-y-0 left-0 z-[65] flex w-full max-w-sm flex-col border-r border-slate-200 bg-white text-slate-900 shadow-[0_24px_64px_rgba(15,23,42,0.22)] sm:max-w-[22rem]">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-slate-200 bg-[#F3F8F5] px-3.5 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-signal text-white">
          <Grid3X3 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="font-display text-sm font-bold text-slate-900">Unit Komersial</h2>
            <span className="rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
              {spaces.length}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-200/60 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-signal"
          aria-label="Tutup daftar unit"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-1.5 border-b border-slate-200 px-3 py-2.5">
        {[
          {
            label: "Total Unit",
            value: String(spaces.length),
            icon: <Store className="size-3.5 text-slate-500" />,
            valueClass: "text-slate-900",
          },
          {
            label: "Tersedia",
            value: String(available),
            icon: <CheckCircle2 className="size-3.5 text-emerald-600" />,
            valueClass: "text-emerald-700",
          },
          {
            label: "Terisi",
            value: String(occupied),
            icon: <CalendarDays className="size-3.5 text-slate-500" />,
            valueClass: "text-slate-900",
          },
          {
            label: "Total Luas",
            value: `${areaLabel} m²`,
            icon: <Maximize2 className="size-3.5 text-slate-500" />,
            valueClass: "text-slate-900",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-slate-50 px-1.5 py-2 text-center ring-1 ring-slate-200"
          >
            <div className="mx-auto mb-1 flex size-6 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
              {stat.icon}
            </div>
            <p className={`text-[11px] font-bold leading-tight ${stat.valueClass}`}>
              {stat.value}
            </p>
            <p className="mt-0.5 text-[8px] leading-tight text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {showSearch && (
        <div className="border-b border-slate-200 px-3 py-2.5">
          <label htmlFor="tour-unit-search" className="sr-only">
            Cari unit
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="tour-unit-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama, kode, atau tipe…"
              autoComplete="off"
              className="h-10 w-full rounded-xl border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-signal focus:ring-2 focus:ring-signal/20"
            />
          </div>
          {query.trim() && (
            <p className="mt-1.5 text-xs text-slate-500">
              {filtered.length} dari {spaces.length} unit
            </p>
          )}
        </div>
      )}

      {/* List */}
      <div className="flex-1 space-y-1 overflow-y-auto px-2 py-2 pb-4">
        {filtered.map((space) => {
          const badge = STATUS_BADGE[space.status];
          const availableItem = space.status === "TERSEDIA";
          return (
            <button
              key={space.id}
              type="button"
              onClick={() => onSelect(space)}
              className={`flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-signal ${
                availableItem
                  ? "bg-emerald-50/40 ring-1 ring-emerald-200"
                  : "ring-1 ring-transparent"
              }`}
            >
              <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 ring-1 ring-slate-200">
                <Store className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">
                  {space.displayName || space.name}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[11px] text-slate-500">
                  {space.code}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="size-3 shrink-0" />
                    {typeLabels[space.type] ?? space.type}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span>{space.area} m²</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                </span>
              </span>
              <ChevronRight className="mt-2 size-4 shrink-0 text-slate-400" />
            </button>
          );
        })}
        {noSearchHits && (
          <p className="px-2 py-8 text-center text-sm text-slate-600">
            Tidak ada unit yang cocok dengan “{query.trim()}”.
          </p>
        )}
        {inventoryEmpty && (
          <div className="px-2 py-8 text-center">
            <p className="text-sm font-semibold text-slate-900">Belum ada unit di inventori stasiun ini</p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Data unit belum dipublikasikan. Tanya tim komersial untuk opsi stasiun lain.
            </p>
            {contactUrl && (
              <a
                href={contactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-signal px-4 text-sm font-semibold text-white hover:bg-signal-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              >
                <Phone className="size-4" />
                Tanya Ketersediaan
              </a>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {(onViewMap || (contactUrl && noneAvailable)) && (
        <div className="space-y-2 border-t border-slate-200 bg-white p-3">
          {contactUrl && noneAvailable && (
            <a
              href={contactUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-signal px-3.5 text-sm font-semibold text-white transition hover:bg-signal-deep focus-visible:outline-2 focus-visible:outline-signal"
            >
              <Phone className="size-4" />
              Tanya Ketersediaan Stasiun Lain
            </a>
          )}
          {onViewMap && (
            <button
              type="button"
              onClick={onViewMap}
              className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-signal"
            >
              <span className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Maximize2 className="size-3.5" />
              </span>
              <span className="flex-1">Lihat Peta Unit</span>
              <ChevronRight className="size-4 text-slate-400" />
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
