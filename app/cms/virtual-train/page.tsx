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
    <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white text-[#101828] p-6">
      <h1 className="text-lg font-bold text-[#101828]">Train Virtual Tour belum siap</h1>
      <p className="mt-2 text-sm text-slate-600">
        {error?.needsMigration
          ? "Tabel database kereta belum dibuat. Jalankan migrasi Prisma sekali di terminal project:"
          : error?.message}
      </p>
      {error?.needsMigration && (
        <pre className="mt-4 overflow-x-auto rounded-lg bg-white p-3 text-xs text-emerald-700">
          npx prisma migrate deploy
        </pre>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Setelah migrasi selesai, refresh halaman ini.
      </p>
      <Button asChild variant="outline" className="mt-4 border-slate-200">
        <Link href="/cms/dashboard">Kembali ke Dashboard</Link>
      </Button>
    </div>
  );
}
