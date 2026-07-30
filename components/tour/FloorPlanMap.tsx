"use client";

import { useState } from "react";
import type { SpaceAvailabilityStatus } from "@/lib/space-availability";

type Space = {
  id: string;
  code: string;
  name: string;
  status: SpaceAvailabilityStatus;
  area: number;
  floor: string;
  location: string;
};

type Props = {
  spaces: Space[];
  stationName: string;
  onSpaceSelect: (spaceCode: string) => void;
  selectedCode?: string;
};

const STATUS_COLORS = {
  TERSEDIA: { fill: "#10B981", hover: "#059669", text: "Tersedia" },
  RESERVED: { fill: "#6366F1", hover: "#4F46E5", text: "Reserved" },
  FIT_OUT: { fill: "#8B5CF6", hover: "#7C3AED", text: "Fit-Out" },
  TERISI: { fill: "#EF4444", hover: "#DC2626", text: "Terisi" },
  MAINTENANCE: { fill: "#F59E0B", hover: "#D97706", text: "Maintenance" },
};

export default function FloorPlanMap({ spaces, stationName, onSpaceSelect, selectedCode }: Props) {
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);

  const groundFloor = spaces.filter((s) => s.floor === "G");
  const firstFloor = spaces.filter((s) => s.floor === "1");
  const [activeFloor, setActiveFloor] = useState("G");
  const floorSpaces = activeFloor === "G" ? groundFloor : firstFloor;

  const cols = 4;
  const cellW = 80;
  const cellH = 60;
  const padding = 20;
  const rows = Math.ceil(floorSpaces.length / cols);
  const svgW = cols * cellW + padding * 2 + 200; // extra width for corridor
  const svgH = rows * cellH + padding * 2 + 80;

  return (
    <div className="flex flex-col h-full p-4">
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Denah Interaktif</p>
        <p className="text-sm font-bold text-gray-900">{stationName}</p>
      </div>

      {/* Floor selector */}
      {groundFloor.length > 0 && firstFloor.length > 0 && (
        <div className="flex gap-2 mb-4">
          {["G", "1"].map((floor) => (
            <button
              key={floor}
              onClick={() => setActiveFloor(floor)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                activeFloor === floor
                  ? "bg-[#1B3A6B] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Lantai {floor}
            </button>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4">
        {Object.entries(STATUS_COLORS).map(([status, conf]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: conf.fill }} />
            <span className="text-xs text-gray-500">{conf.text}</span>
          </div>
        ))}
      </div>

      {/* SVG Floor Plan */}
      <div className="flex-1 overflow-auto rounded-xl bg-gray-50 border border-gray-200 p-2">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full"
          style={{ minHeight: 200 }}
        >
          {/* Background */}
          <rect x="0" y="0" width={svgW} height={svgH} fill="#F8FAFC" rx="8" />

          {/* Corridor (concourse area) */}
          <rect
            x={padding}
            y={padding + rows * cellH / 2 - 20}
            width={cols * cellW + 160}
            height={40}
            fill="#DBEAFE"
            opacity="0.7"
            rx="4"
          />
          <text
            x={padding + (cols * cellW + 160) / 2}
            y={padding + rows * cellH / 2 + 5}
            textAnchor="middle"
            className="text-xs"
            fontSize="10"
            fill="#3B82F6"
            fontWeight="600"
          >
            Concourse / Koridor Utama
          </text>

          {/* Commercial units grid */}
          {floorSpaces.map((space, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const isTop = row < Math.floor(rows / 2);
            const x = padding + col * cellW;
            const y = isTop
              ? padding + row * cellH
              : padding + rows * cellH / 2 + 50 + (row - Math.floor(rows / 2)) * cellH;
            const colors = STATUS_COLORS[space.status];
            const isSelected = selectedCode === space.code;
            const isHovered = hoveredCode === space.code;

            return (
              <g key={space.id}>
                <rect
                  x={x + 3}
                  y={y + 3}
                  width={cellW - 6}
                  height={cellH - 6}
                  fill={isSelected ? "#1B3A6B" : isHovered ? colors.hover : colors.fill}
                  rx="6"
                  className="cursor-pointer transition-all"
                  onClick={() => onSpaceSelect(space.code)}
                  onMouseEnter={() => setHoveredCode(space.code)}
                  onMouseLeave={() => setHoveredCode(null)}
                  opacity={isSelected ? 1 : 0.85}
                  stroke={isSelected ? "#E31E2D" : "white"}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />
                <text
                  x={x + cellW / 2}
                  y={y + cellH / 2 - 4}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="bold"
                  fill="white"
                  pointerEvents="none"
                >
                  {space.code}
                </text>
                <text
                  x={x + cellW / 2}
                  y={y + cellH / 2 + 9}
                  textAnchor="middle"
                  fontSize="8"
                  fill="white"
                  opacity="0.9"
                  pointerEvents="none"
                >
                  {space.area}m²
                </text>
              </g>
            );
          })}

          {/* Entry/Exit markers */}
          <g>
            <rect x={padding + cols * cellW + 20} y={svgH / 2 - 15} width={60} height={30} fill="#1B3A6B" rx="4" />
            <text x={padding + cols * cellW + 50} y={svgH / 2 + 5} textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">
              EXIT
            </text>
          </g>
        </svg>
      </div>

      {/* Hovered space info */}
      {hoveredCode && (() => {
        const s = floorSpaces.find((sp) => sp.code === hoveredCode);
        if (!s) return null;
        const colors = STATUS_COLORS[s.status];
        return (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.fill }} />
            <span className="font-mono font-bold">{s.code}</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-300">{s.name}</span>
            <span className="text-gray-400">·</span>
            <span className="text-xs text-gray-400">{colors.text}</span>
          </div>
        );
      })()}
    </div>
  );
}
