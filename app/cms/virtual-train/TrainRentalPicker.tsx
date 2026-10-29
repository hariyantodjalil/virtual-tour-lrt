"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { spaceStatusColor, type SpaceAvailabilityStatus } from "@/lib/space-availability";
import { TRAIN_RENTAL_STATUS_LABELS, type TrainRentalStatus } from "@/lib/train-rental-sales";

export type TrainRentalPickerItem = {
  id: string;
  code: string;
  name: string;
  status: SpaceAvailabilityStatus;
  rentalStatus: TrainRentalStatus;
};

type Props = {
  spaces: TrainRentalPickerItem[];
  value?: string;
  onChange: (code: string, space: TrainRentalPickerItem) => void;
  placeholder?: string;
};

export function TrainRentalPicker({
  spaces,
  value,
  onChange,
  placeholder = "Cari handgrip, wall panel, layar…",
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return spaces;
    return spaces.filter(
      (space) =>
        space.code.toLowerCase().includes(q) || space.name.toLowerCase().includes(q)
    );
  }, [query, spaces]);

  const selected = spaces.find((space) => space.code === value);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#A88990]" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="h-8 border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] pl-8 text-xs text-[#F8ECEE]"
        />
      </div>

      {selected ? (
        <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/30 px-2.5 py-2 text-xs">
          <p className="font-mono font-semibold text-emerald-300">{selected.code}</p>
          <p className="truncate text-[#F0DDE1]">{selected.name}</p>
          <p className="mt-0.5 text-[10px] text-[#A88990]">
            {TRAIN_RENTAL_STATUS_LABELS[selected.rentalStatus]}
          </p>
        </div>
      ) : null}

      <div className="max-h-44 divide-y divide-[rgba(255,214,218,0.12)] overflow-y-auto rounded-lg border border-[rgba(255,214,218,0.14)]">
        {filtered.length === 0 ? (
          <p className="px-2.5 py-3 text-center text-[11px] text-[#A88990]">
            Belum ada ruang sewa kereta. Tambah dulu di Train Rental Space.
          </p>
        ) : (
          filtered.map((space) => {
            const active = space.code === value;
            return (
              <button
                key={space.id}
                type="button"
                onClick={() => onChange(space.code, space)}
                className={`flex w-full items-start gap-2 px-2.5 py-2 text-left transition-colors ${
                  active ? "bg-emerald-950/50" : "hover:bg-[#261015]/80"
                }`}
              >
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: spaceStatusColor(space.status) }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[11px] font-semibold text-[#F8ECEE]">
                    {space.code}
                  </span>
                  <span className="block truncate text-[10px] text-[#C4A8AD]">{space.name}</span>
                  <span className="mt-0.5 block text-[9px] text-[#A88990]">
                    Ruang sewa kereta · {TRAIN_RENTAL_STATUS_LABELS[space.rentalStatus]}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
