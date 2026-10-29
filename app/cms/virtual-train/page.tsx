import Link from "next/link";
import { ensureDefaultTrain } from "@/lib/default-train";
import TrainTourEditor from "./TrainTourEditor";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function loadDefaultTrain() {
  try {
    const train = await ensureDefaultTrain();
    return { train, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memuat Train Virtual Tour";
    const needsMigration =
      message.includes("does not exist") ||
      message.includes("P2021") ||
      message.toLowerCase().includes("trains");

    return { train: null, error: { message, needsMigration } };
  }
}

export default async function CmsVirtualTrainPage() {
  const { train, error } = await loadDefaultTrain();

  if (train) {
    return <TrainTourEditor trainId={train.id} trainName={train.name} trainSlug={train.slug} />;
  }

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-[rgba(255,214,218,0.14)] bg-[#3A161C] text-[#F8ECEE] p-6">
      <h1 className="text-lg font-bold text-[#F8ECEE]">Train Virtual Tour belum siap</h1>
      <p className="mt-2 text-sm text-[#C4A8AD]">
        {error?.needsMigration
          ? "Tabel database kereta belum dibuat. Jalankan migrasi Prisma sekali di terminal project:"
          : error?.message}
      </p>
      {error?.needsMigration && (
        <pre className="mt-4 overflow-x-auto rounded-lg bg-[#1C0A0E] p-3 text-xs text-emerald-300">
          npx prisma migrate deploy
        </pre>
      )}
      <p className="mt-3 text-xs text-[#A88990]">
        Setelah migrasi selesai, refresh halaman ini.
      </p>
      <Button asChild variant="outline" className="mt-4 border-[rgba(255,214,218,0.14)]">
        <Link href="/cms/dashboard">Kembali ke Dashboard</Link>
      </Button>
    </div>
  );
}
