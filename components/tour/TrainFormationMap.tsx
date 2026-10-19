"use client";

import type { KeyboardEvent } from "react";

type CarItem = {
  id: string;
  label: string;
};

type Props = {
  cars: CarItem[];
  activeCarId: string;
  onSelectCar: (carId: string) => void;
  className?: string;
  svgClassName?: string;
};

const ACTIVE = "#22C55E";
const IDLE = "#FFFFFF";

/** Layout & path persis export Figma node 51:861 (Group 229). */
const FIGMA_SLOTS = [
  {
    kind: "path" as const,
    d: "M240 20C240 8.95431 231.046 0 220 0H126.449C105.868 0 86.3302 9.05685 73.03 24.7625L27.8824 78.075C16.8761 91.0718 26.1139 111 43.1449 111H220C231.046 111 240 102.046 240 91V20Z",
  },
  { kind: "rect" as const, x: 258 },
  { kind: "rect" as const, x: 516 },
  { kind: "rect" as const, x: 774 },
  { kind: "rect" as const, x: 1032 },
  {
    kind: "path" as const,
    d: "M1290 20C1290 8.95431 1298.95 0 1310 0H1403.55C1424.13 0 1443.67 9.05685 1456.97 24.7625L1502.12 78.075C1513.12 91.0718 1503.89 111 1486.86 111H1310C1298.95 111 1290 102.046 1290 91V20Z",
  },
] as const;

/**
 * Mini-map formasi — visual Figma `51:861`, gerbong aktif hijau.
 * https://www.figma.com/design/9ng5EOwY9EypKJeHBJKI7U/tanggal-11?node-id=51-861
 */
export default function TrainFormationMap({
  cars,
  activeCarId,
  onSelectCar,
  className = "",
  svgClassName,
}: Props) {
  if (cars.length === 0) return null;

  const slots = FIGMA_SLOTS.slice(0, Math.min(cars.length, FIGMA_SLOTS.length));

  function bindCar(car: CarItem) {
    return {
      fill: car.id === activeCarId ? ACTIVE : IDLE,
      className: "cursor-pointer transition-opacity hover:opacity-90",
      role: "button" as const,
      tabIndex: 0,
      "aria-label": car.label,
      "aria-pressed": car.id === activeCarId,
      onClick: () => onSelectCar(car.id),
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectCar(car.id);
        }
      },
    };
  }

  return (
    <div
      className={`pointer-events-auto inline-flex items-center ${className}`}
      role="group"
      aria-label="Peta formasi gerbong"
    >
      <svg
        viewBox="0 0 1530 111"
        width={306}
        height={22}
        className={
          svgClassName ??
          "h-[22px] w-[min(92vw,306px)] sm:h-[28px] sm:w-[min(92vw,390px)]"
        }
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {slots.map((slot, index) => {
          const car = cars[index];
          if (!car) return null;
          const props = bindCar(car);

          if (slot.kind === "path") {
            return (
              <path key={car.id} d={slot.d} {...props}>
                <title>{car.label}</title>
              </path>
            );
          }

          return (
            <rect key={car.id} x={slot.x} width={240} height={111} rx={20} {...props}>
              <title>{car.label}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}
