"use client";

import { AlertCircle, CheckCircle, ChevronRight, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatRupiah, formatNumber } from "@/lib/utils";

type Space = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: "TERSEDIA" | "TERISI" | "MAINTENANCE";
  area: number;
  monthlyRent: number;
  exposure: number;
  floor: string;
};

type Props = {
  spaces: Space[];
  onSpaceSelect: (spaceCode: string) => void;
  selectedCode?: string;
};

const TYPE_LABELS: Record<string, string> = {
  KIOS: "Kios",
  RUKO: "Ruko",
  ATM: "ATM",
  VENDING: "Vending",
  MEDIA_IKLAN: "Iklan",
  AREA_PROMOSI: "Promosi",
};

const statusIcon = (s: string) => ({
  TERSEDIA: <CheckCircle className="h-4 w-4 text-emerald-500" />,
  TERISI: <XCircle className="h-4 w-4 text-red-500" />,
  MAINTENANCE: <AlertCircle className="h-4 w-4 text-amber-500" />,
}[s] ?? null);

export default function SpacesPanel({ spaces, onSpaceSelect, selectedCode }: Props) {
  const grouped = spaces.reduce<Record<string, Space[]>>((acc, s) => {
    const key = `Lantai ${s.floor}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 p-4 border-b border-gray-100">
        {[
          { label: "Tersedia", count: spaces.filter((s) => s.status === "TERSEDIA").length, color: "text-emerald-600" },
          { label: "Terisi", count: spaces.filter((s) => s.status === "TERISI").length, color: "text-red-600" },
          { label: "Total", count: spaces.length, color: "text-gray-900" },
        ].map((item) => (
          <div key={item.label} className="text-center rounded-lg bg-gray-50 py-2">
            <p className={`text-xl font-black ${item.color}`}>{item.count}</p>
            <p className="text-[10px] text-gray-500 font-medium">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Space list */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {Object.entries(grouped).map(([floor, floorSpaces]) => (
          <div key={floor}>
            <div className="sticky top-0 bg-gray-50 px-4 py-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{floor}</p>
            </div>
            {floorSpaces.map((space) => (
              <button
                key={space.id}
                onClick={() => onSpaceSelect(space.code)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                  selectedCode === space.code ? "bg-blue-50 border-l-2 border-[#1B3A6B]" : ""
                }`}
              >
                <div className="shrink-0">{statusIcon(space.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">{space.code}</span>
                    <Badge variant="secondary" className="text-[10px] py-0">
                      {TYPE_LABELS[space.type] ?? space.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{space.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs font-semibold text-[#1B3A6B]">{formatRupiah(space.monthlyRent)}/bln</span>
                    <span className="text-xs text-gray-400">{space.area} m²</span>
                    <span className="text-xs text-gray-400">{formatNumber(Math.round(space.exposure))} org/hr</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
