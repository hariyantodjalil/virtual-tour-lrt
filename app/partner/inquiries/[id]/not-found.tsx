import Link from "next/link";
import { getTourTranslator } from "@/lib/tour-translated-content";

export default async function InquiryNotFound() {
  const t = await getTourTranslator();
  return (
    <main className="grid min-h-screen place-content-center gap-4 bg-slate-50 px-5 text-center text-slate-900">
      <h1 className="text-2xl font-bold">{t("Pengajuan tidak ditemukan")}</h1>
      <p className="text-sm text-slate-600">{t("Lihat pengajuan yang tersedia untuk akun Anda.")}</p>
      <Link href="/partner" className="mx-auto inline-flex min-h-11 items-center rounded-lg bg-[#c41230] px-4 text-sm font-semibold text-white">
        {t("Kembali ke Portal Mitra")}
      </Link>
    </main>
  );
}
