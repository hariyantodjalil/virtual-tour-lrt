"use client";

import { useTourLanguage } from "@/components/tour/TourLanguageProvider";


type Props = {
  cars: { slug: string; label: string }[];
  selectedSlugs: string[];
  onSelectionChange: (slugs: string[]) => void;
};

export default function TrainInquiryCarPicker({ cars, selectedSlugs, onSelectionChange }: Props) {
  const { t, content } = useTourLanguage();
  const selectedCount = cars.filter(car => selectedSlugs.includes(car.slug)).length;
  const allSelected = cars.length > 0 && selectedCount === cars.length;

  function toggleCar(slug: string) {
    onSelectionChange(selectedSlugs.includes(slug)
      ? selectedSlugs.filter(item => item !== slug)
      : [...selectedSlugs, slug]);
  }

  return <fieldset className="min-w-0">
    <legend className="text-sm font-semibold">{t("Gerbong yang diajukan")}</legend>
    <label className="flex min-h-11 cursor-pointer items-center justify-end gap-2 text-sm font-medium text-slate-700">
      <input type="checkbox" className="size-4 accent-[#E31E2D]" checked={allSelected}
        ref={element => { if (element) element.indeterminate = selectedCount > 0 && !allSelected; }}
        onChange={event => onSelectionChange(event.target.checked ? cars.map(car => car.slug) : [])} />
      {t("Pilih semua")}
    </label>
    <div role="group" aria-label={t("Pilih gerbong")} className="grid grid-cols-3 gap-2 sm:mt-1 sm:grid-cols-6 sm:gap-y-3">
      {cars.map((car, index) => {
        const selected = selectedSlugs.includes(car.slug);
        return <button key={car.slug} type="button" aria-label={content(car.label)} aria-pressed={selected}
          onClick={() => toggleCar(car.slug)}
          className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg border px-2 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-14 sm:flex-col sm:border-0 sm:px-1 ${selected ? "border-[#C41926] bg-red-50 font-semibold text-[#C41926] enabled:hover:bg-red-100 sm:bg-transparent sm:enabled:hover:bg-slate-50" : "border-slate-300 bg-white text-slate-600 enabled:hover:bg-slate-50 sm:bg-transparent sm:text-slate-500"}`}>
          <svg viewBox="0 0 52 28" aria-hidden="true" className="hidden h-7 w-full max-w-16 overflow-visible sm:block" fill={selected ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
            {index === 0 ? <path d="M46 3H20C15 3 11 6 8 11L3 18C1 21 3 25 7 25H46C48 25 50 23 50 21V7C50 5 48 3 46 3Z" />
              : index === cars.length - 1 ? <path d="M6 3H32C37 3 41 6 44 11L49 18C51 21 49 25 45 25H6C4 25 2 23 2 21V7C2 5 4 3 6 3Z" />
                : <rect x="2" y="3" width="48" height="22" rx="5" />}
          </svg>
          <span aria-hidden="true" className="text-sm font-semibold sm:hidden">G{index + 1}</span>
          <span className="hidden text-center text-xs font-semibold leading-snug [overflow-wrap:anywhere] sm:block">{content(car.label)}</span>
        </button>;
      })}
    </div>
    <p aria-live="polite" className="mt-2 text-xs text-slate-600">{t("{selected} dari {total} gerbong dipilih", { selected: selectedCount, total: cars.length })}</p>
  </fieldset>;
}
