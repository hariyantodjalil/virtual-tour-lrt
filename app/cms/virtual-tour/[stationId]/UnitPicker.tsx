"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { spaceStatusColor, type SpaceAvailabilityStatus } from "@/lib/space-availability";
import { isMediaSpaceType } from "@/lib/hotspot-types";

export type PickerSpace = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: SpaceAvailabilityStatus;
  tenantBrand?: string | null;
};

type Props = {
  spaces: PickerSpace[];
  value?: string;
  onChange: (code: string, space: PickerSpace) => void;
  /** retail | media | all */
  mode?: "retail" | "media" | "all";
  placeholder?: string;
};

const TYPE_LABELS: Record<string, string> = {
  KIOS: "Kios",
  RUKO: "Ruko",
  ATM: "ATM",
  VENDING: "Vending",
  MEDIA_IKLAN: "Media Iklan",
  AREA_PROMOSI: "Area Promosi",
};

const STATUS_LABELS: Record<SpaceAvailabilityStatus, string> = {
  TERSEDIA: "Tersedia",
  RESERVED: "Reserved",
  FIT_OUT: "Fit-Out",
  TERISI: "Terisi",
  MAINTENANCE: "Maintenance",
};

export function UnitPicker({
  spaces,
  value,
  onChange,
  mode = "all",
  placeholder = "Cari kode / nama unit…",
}: Props) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | SpaceAvailabilityStatus>("ALL");

  const pool = useMemo(() => {
    if (mode === "media") return spaces.filter((s) => isMediaSpaceType(s.type));
    if (mode === "retail") return spaces.filter((s) => !isMediaSpaceType(s.type));
    return spaces;
  }, [spaces, mode]);

  const types = useMemo(() => {
    const set = new Set(pool.map((s) => s.type));
    return Array.from(set).sort();
  }, [pool]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.filter((s) => {
      if (typeFilter !== "ALL" && s.type !== typeFilter) return false;
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (TYPE_LABELS[s.type] ?? s.type).toLowerCase().includes(q)
      );
    });
  }, [pool, query, typeFilter, statusFilter]);

  const selected = pool.find((s) => s.code === value);
  const selectedTenant =
    selected?.status === "TERISI" ? selected.tenantBrand?.trim() : "";

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#C4A8AD]" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="h-8 bg-[#3A161C] border-[rgba(255,214,218,0.18)] pl-8 text-xs text-[#F8ECEE]"
        />
      </div>
      <div className="flex gap-1.5">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-7 flex-1 rounded-md border border-[rgba(255,214,218,0.18)] bg-[#3A161C] px-1.5 text-[10px] text-[#F0DDE1]"
        >
          <option value="ALL">Semua tipe</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t] ?? t}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="h-7 flex-1 rounded-md border border-[rgba(255,214,218,0.18)] bg-[#3A161C] px-1.5 text-[10px] text-[#F0DDE1]"
        >
          <option value="ALL">Semua status</option>
          <option value="TERSEDIA">Tersedia</option>
          <option value="RESERVED">Reserved</option>
          <option value="FIT_OUT">Fit-Out</option>
          <option value="TERISI">Terisi</option>
          <option value="MAINTENANCE">Maintenance</option>
        </select>
      </div>

      {selected && (
        <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/30 px-2.5 py-2 text-xs">
          {selectedTenant ? (
            <>
              <p className="truncate font-semibold text-emerald-300">{selectedTenant}</p>
              <p className="truncate text-[10px] text-[#C4A8AD]">
                Tenant aktif · <span className="font-mono">{selected.code}</span> · {selected.name}
              </p>
            </>
          ) : (
            <>
              <p className="font-mono font-semibold text-emerald-300">{selected.code}</p>
              <p className="truncate text-[#F0DDE1]">{selected.name}</p>
            </>
          )}
        </div>
      )}

      <div className="max-h-44 overflow-y-auto rounded-lg border border-[rgba(255,214,218,0.18)] divide-y divide-[rgba(255,214,218,0.12)]">
        {filtered.length === 0 ? (
          <p className="px-2.5 py-3 text-center text-[11px] text-[#C4A8AD]">Tidak ada unit</p>
        ) : (
          filtered.map((s) => {
            const active = s.code === value;
            const tenantBrand =
              s.status === "TERISI" ? s.tenantBrand?.trim() : "";
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onChange(s.code, s)}
                className={`flex w-full items-start gap-2 px-2.5 py-2 text-left transition-colors ${
                  active ? "bg-emerald-950/50" : "hover:bg-[#3A161C]/80"
                }`}
              >
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: spaceStatusColor(s.status) }}
                />
                <span className="min-w-0 flex-1">
                  {tenantBrand ? (
                    <>
                      <span className="block truncate text-[11px] font-semibold text-[#F8ECEE]">
                        {tenantBrand}
                      </span>
                      <span className="block truncate text-[10px] text-[#C4A8AD]">
                        <span className="font-mono">{s.code}</span> · {s.name}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="block truncate font-mono text-[11px] font-semibold text-[#F8ECEE]">
                        {s.code}
                      </span>
                      <span className="block truncate text-[10px] text-[#C4A8AD]">{s.name}</span>
                    </>
                  )}
                  <span className="mt-0.5 block text-[9px] text-[#C4A8AD]">
                    {TYPE_LABELS[s.type] ?? s.type} · {STATUS_LABELS[s.status]}
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
