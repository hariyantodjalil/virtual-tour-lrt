import { getTourTranslator } from "@/lib/tour-translated-content";
import { TRAIN_TOUR_LANDING } from "@/lib/tour-nav";
import Link from "next/link";

export default async function TrainNotFound() {
  const t = await getTourTranslator();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#07111f] px-4 text-center">
      <p className="text-sm font-semibold tracking-wide text-[#E31E2D]">{t("Kereta")}</p>
      <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">{t("Tur kereta tidak ditemukan")}</h1>
      <p className="mt-3 max-w-md text-sm text-slate-400">
        {t("Virtual tour untuk kereta ini belum tersedia.")}
      </p>
      <Link
        href={TRAIN_TOUR_LANDING}
        className="mt-8 inline-flex rounded-xl bg-[#E31E2D] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#c41926]"
      >
        {t("Pilih tur kereta")}
      </Link>
    </div>
  );
}
