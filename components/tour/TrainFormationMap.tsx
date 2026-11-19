"use client";

import { useTourLanguage } from "@/components/tour/TourLanguageProvider";
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
  touchTargets?: boolean;
};

const ACTIVE = "#22C55E";
const IDLE = "#FFFFFF";

const CAB_PATH = "M240 20C240 8.95431 231.046 0 220 0H126.449C105.868 0 86.3302 9.05685 73.03 24.7625L27.8824 78.075C16.8761 91.0718 26.1139 111 43.1449 111H220C231.046 111 240 102.046 240 91V20Z";

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
  touchTargets = false,
}: Props) {
  const { t } = useTourLanguage();
  if (cars.length === 0) return null;

  if (touchTargets) return (
    <div role="group" aria-label={t("Peta formasi gerbong")} className={`pointer-events-auto flex max-w-full gap-0.5 overflow-x-auto overscroll-x-contain ${className}`}>
      {cars.map((car, index) => <button key={car.id} type="button" title={car.label} aria-label={car.label} aria-pressed={car.id === activeCarId}
        onClick={() => onSelectCar(car.id)} className="flex h-11 min-w-6 flex-1 items-center justify-center rounded-lg px-0.5 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white md:min-w-11">
        <svg viewBox="0 0 240 111" className="h-6 w-full" aria-hidden="true" fill={car.id === activeCarId ? ACTIVE : IDLE}>
          {index === 0 || index === cars.length - 1
            ? <path d={CAB_PATH} transform={index === 0 ? undefined : "translate(240 0) scale(-1 1)"} />
            : <rect width={240} height={111} rx={20} />}
        </svg>
      </button>)}
    </div>
  );

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
      aria-label={t("Peta formasi gerbong")}
    >
      <svg
        viewBox={`0 0 ${cars.length * 258 - 18} 111`}
        width={306}
        height={22}
        className={
          svgClassName ??
          "h-[22px] w-[min(92vw,306px)] sm:h-[28px] sm:w-[min(92vw,390px)]"
        }
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {cars.map((car, index) => {
          const props = bindCar(car);

          if (index === 0 || index === cars.length - 1) {
            return (
              <path key={car.id} d={CAB_PATH} transform={index === 0 ? undefined : `translate(${index * 258 + 240} 0) scale(-1 1)`} {...props}>
                <title>{car.label}</title>
              </path>
            );
          }

          return (
            <rect key={car.id} x={index * 258} width={240} height={111} rx={20} {...props}>
              <title>{car.label}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}
