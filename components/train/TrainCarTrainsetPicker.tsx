"use client";

import { useState } from "react";
import TrainFormationMap from "@/components/tour/TrainFormationMap";
import { DEFAULT_TRAIN_CARS } from "@/lib/train-tour-defaults";
import {
  TRAINSET_OPTIONS,
  isAllTrainsets,
  parseCarTrainsetMap,
  type CarTrainsetMap,
} from "@/lib/train-rental-sales";

type Props = {
  value: CarTrainsetMap;
  onChange: (next: CarTrainsetMap) => void;
};

export default function TrainCarTrainsetPicker({ value, onChange }: Props) {
  const map = parseCarTrainsetMap(value);
  const [activeSlug, setActiveSlug] = useState(DEFAULT_TRAIN_CARS[0].slug);
  const activeCar = DEFAULT_TRAIN_CARS.find((car) => car.slug === activeSlug) ?? DEFAULT_TRAIN_CARS[0];
  const current = map[activeCar.slug] ?? [];
  const allSelected = isAllTrainsets(current);

  function setCarTrainsets(slug: string, next: string[]) {
    onChange({ ...map, [slug]: next });
  }

  function toggleTrainset(trainset: string) {
    const next = current.includes(trainset)
      ? current.filter((item) => item !== trainset)
      : [...current, trainset];
    setCarTrainsets(activeCar.slug, next);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-3">
        <p className="mb-2 text-[11px] font-medium text-slate-400">Pilih gerbong</p>
        <div className="flex justify-center">
          <TrainFormationMap
            cars={DEFAULT_TRAIN_CARS.map((car) => ({ id: car.slug, label: car.label }))}
            activeCarId={activeCar.slug}
            onSelectCar={setActiveSlug}
            svgClassName="h-9 w-full max-w-[420px]"
          />
        </div>
        <div className="mt-2 grid grid-cols-6 gap-1">
          {DEFAULT_TRAIN_CARS.map((car) => {
            const count = map[car.slug]?.length ?? 0;
            const selected = car.slug === activeCar.slug;
            return (
              <button
                key={car.slug}
                type="button"
                onClick={() => setActiveSlug(car.slug)}
                className={`rounded-md px-1 py-1.5 text-center transition ${
                  selected ? "bg-[#d32f2f] text-white" : "bg-slate-900 text-slate-300 hover:text-white"
                }`}
              >
                <span className="block text-[10px] font-semibold leading-tight">{car.label.replace("Gerbong ", "G")}</span>
                <span className={`block text-[9px] leading-tight ${selected ? "text-white/80" : "text-slate-500"}`}>
                  {count === 0 ? "—" : isAllTrainsets(map[car.slug] ?? []) ? "Semua" : `${count} TS`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-white">
            Train set di {activeCar.label}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-xs font-medium text-slate-300 hover:text-white"
              onClick={() => {
                const source = map[activeCar.slug] ?? [];
                const next = emptyCopy(map, source);
                onChange(next);
              }}
            >
              Salin ke semua gerbong
            </button>
            <button
              type="button"
              className="text-xs font-medium text-red-300 hover:text-red-200"
              onClick={() =>
                setCarTrainsets(activeCar.slug, allSelected ? [] : [...TRAINSET_OPTIONS])
              }
            >
              {allSelected ? "Hapus semua" : "Pilih semua TS"}
            </button>
          </div>
        </div>
        <div className="mt-1.5 max-h-36 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 p-2">
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {TRAINSET_OPTIONS.map((trainset) => {
              const checked = current.includes(trainset);
              return (
                <label
                  key={trainset}
                  className={`cursor-pointer rounded-md px-1.5 py-1 text-center text-[11px] font-medium ${
                    checked
                      ? "bg-[#d32f2f] text-white"
                      : "bg-slate-900 text-slate-400 hover:text-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggleTrainset(trainset)}
                  />
                  {trainset}
                </label>
              );
            })}
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Klik gerbong di peta, lalu pilih train set yang media ini bisa dipasang di gerbong itu.
        </p>
      </div>
    </div>
  );
}

function emptyCopy(map: CarTrainsetMap, source: string[]): CarTrainsetMap {
  return Object.fromEntries(Object.keys(map).map((slug) => [slug, [...source]]));
}
