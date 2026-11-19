import Link from "next/link";
import { ensureDefaultTrain } from "@/lib/default-train";
import { cmsUi } from "@/lib/cms-ui";
import TrainTourEditor, { type TrainEditorTarget } from "./TrainTourEditor";
import TrainBootstrap from "./TrainBootstrap";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TrainFront } from "lucide-react";

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

export default async function CmsVirtualTrainPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ train, error }, { scene, media, kind, yaw, pitch }] = await Promise.all([loadDefaultTrain(), searchParams]);
  const initialTarget: TrainEditorTarget | undefined = typeof scene === "string" && typeof media === "string" &&
    (kind === "ad" || kind === "space") && typeof yaw === "string" && typeof pitch === "string" &&
    yaw.trim() && pitch.trim() && Number.isFinite(Number(yaw)) && Number.isFinite(Number(pitch))
    ? { sceneId: scene, code: media, kind, yaw: Number(yaw), pitch: Number(pitch) }
    : undefined;

  if (train) {
    return <TrainTourEditor trainId={train.id} trainName={train.name} trainSlug={train.slug} initialTarget={initialTarget} />;
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card className={cmsUi.card}>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start gap-3">
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${cmsUi.nested}`}>
              <TrainFront className="size-5 text-[var(--work-text)]" aria-hidden />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-[var(--work-text)]">
                Train Virtual Tour belum siap
              </h1>
              <p className={`mt-1 text-sm ${cmsUi.muted}`}>
                {error?.needsMigration
                  ? "Tabel database kereta belum dibuat. Jalankan migrasi Prisma sekali di terminal project:"
                  : error?.message}
              </p>
            </div>
          </div>

          {!error?.needsMigration ? <TrainBootstrap /> : null}
          {error?.needsMigration ? (
            <>
              <pre className={`overflow-x-auto rounded-lg p-3 text-xs text-[var(--work-text)] ${cmsUi.nested}`}>
                npx prisma migrate deploy
              </pre>
              <p className={`text-xs ${cmsUi.muted}`}>Setelah migrasi selesai, refresh halaman ini.</p>
            </>
          ) : null}

          <Button asChild variant="outline" className={cmsUi.outlineBtn}>
            <Link href="/cms/dashboard">Kembali ke Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
