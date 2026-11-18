/**
 * Backfill profil tile adaptif (JPEG 85, desktop 1024 / mobile 512) untuk scene yang
 * masih memakai pyramid multiRes lama.
 *
 * Sumber tile SELALU panoramaUrl publik saat ini — master yang sudah aman privasi.
 * originalPanoramaUrl sengaja tidak dipakai karena belum tentu sudah diblur.
 *
 * canvasData.multiRes lama tidak disentuh: reader image rollback tetap memakai tile
 * lama, sehingga rollback aplikasi tidak mengubah perilaku sama sekali.
 *
 * Pemakaian:
 *   npm run panorama:backfill-adaptive [station-slug|train-slug] [--dry-run] [--limit=N]
 *
 * Bisa dihentikan kapan pun dan diteruskan lagi: scene yang sudah punya
 * multiResProfiles otomatis dilewati pada eksekusi berikutnya.
 */
import "dotenv/config";
import { panoramaProfileUpdateQuery } from "../lib/panorama-backfill";
import sharp from "sharp";
import { prisma } from "../lib/prisma";
import { downloadFromS3, extractS3KeyFromUrl } from "../lib/s3";
import { uploadAdaptivePanoramaTiles } from "../lib/panorama-tile-upload";
import { buildPanoramaTiles } from "../lib/panorama-multires";
import { isPannellumMultiRes } from "../lib/panorama-multires";
import { extractMultiResProfilesFromCanvasData } from "../lib/panorama-profile";

type Row = {
  kind: "station" | "train";
  id: string;
  sceneId: string;
  title: string;
  panoramaUrl: string;
  canvasData: unknown;
  ownerSlug: string;
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function parseArgs(argv: string[]) {
  let slug: string | undefined;
  let dryRun = false;
  let limit = 0;
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--limit=")) limit = Number(arg.slice("--limit=".length)) || 0;
    else if (arg && !arg.startsWith("--")) slug = arg;
  }
  return { slug, dryRun, limit };
}

function needsProfiles(row: Row): boolean {
  const canvas = asObject(row.canvasData);
  // Hanya scene dengan tile lama yang valid; scene tanpa multiRes ditangani
  // backfill-panorama-tiles.ts terlebih dahulu.
  return isPannellumMultiRes(canvas.multiRes) && !extractMultiResProfilesFromCanvasData(canvas);
}

async function collectRows(slug?: string): Promise<Row[]> {
  const stations = await prisma.virtualTourScene.findMany({
    where: {
      panoramaUrl: { not: "" },
      ...(slug ? { station: { slug } } : {}),
    },
    select: {
      id: true, sceneId: true, title: true, panoramaUrl: true, canvasData: true,
      station: { select: { slug: true } },
    },
    orderBy: [{ station: { slug: "asc" } }, { order: "asc" }],
  });
  const trains = await prisma.trainTourScene.findMany({
    where: {
      panoramaUrl: { not: "" },
      ...(slug ? { train: { slug } } : {}),
    },
    select: {
      id: true, sceneId: true, title: true, panoramaUrl: true, canvasData: true,
      train: { select: { slug: true } },
    },
    orderBy: [{ train: { slug: "asc" } }, { order: "asc" }],
  });
  return [
    ...stations.map((s) => ({ kind: "station" as const, id: s.id, sceneId: s.sceneId, title: s.title, panoramaUrl: s.panoramaUrl, canvasData: s.canvasData, ownerSlug: s.station.slug })),
    ...trains.map((s) => ({ kind: "train" as const, id: s.id, sceneId: s.sceneId, title: s.title, panoramaUrl: s.panoramaUrl, canvasData: s.canvasData, ownerSlug: s.train.slug })),
  ];
}

/** Bangun kedua pyramid di memori tanpa upload — validasi jalur generasi di dry-run. */
async function buildProfilesForReport(buffer: Buffer) {
  const metadata = await sharp(buffer, { limitInputPixels: false }).metadata();
  const cubeResolution = (metadata.width ?? 0) > 6400 ? 4096 : 2048;
  const report: Record<string, { tiles: number; bytes: number; maxLevel: number }> = {};
  for (const [name, tileResolution] of [["mobile", 512], ["desktop", 1024]] as const) {
    const tiles = await buildPanoramaTiles(buffer, {
      sourceWidth: null, cubeResolution, tileResolution, jpegQuality: 85,
    });
    report[name] = {
      tiles: tiles.length,
      bytes: tiles.reduce((sum, tile) => sum + tile.buffer.length, 0),
      maxLevel: Math.log2(cubeResolution / tileResolution) + 1,
    };
  }
  return { width: metadata.width ?? 0, height: metadata.height ?? 0, cubeResolution, report };
}

async function main() {
  const { slug, dryRun, limit } = parseArgs(process.argv.slice(2));
  const rows = (await collectRows(slug)).filter(needsProfiles);
  const capped = limit > 0 ? rows.slice(0, limit) : rows;

  console.log(
    `pending ${rows.length}${slug ? ` slug=${slug}` : ""}${limit > 0 ? ` limit=${capped.length}` : ""}` +
    (dryRun ? " mode=dry-run" : "")
  );

  let ok = 0;
  let failed = 0;
  for (const row of capped) {
    const label = `${row.kind}/${row.ownerSlug}/${row.sceneId}`;
    // Sumber sengaja panoramaUrl, bukan originalPanoramaUrl (bisa belum diblur).
    const key = extractS3KeyFromUrl(row.panoramaUrl);
    if (!key) {
      failed += 1;
      console.log(`skip ${label} panoramaUrl tidak dikenali`);
      continue;
    }

    const started = Date.now();
    let lastError = "";
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        const buffer = await downloadFromS3(key);
        if (dryRun) {
          const summary = await buildProfilesForReport(buffer);
          console.log(
            `dry ${label} ${summary.width}x${summary.height} cube=${summary.cubeResolution}` +
            ` mobile=${summary.report.mobile.tiles}t/${summary.report.mobile.bytes}B` +
            ` desktop=${summary.report.desktop.tiles}t/${summary.report.desktop.bytes}B` +
            ` ms=${Date.now() - started}`
          );
          ok += 1;
          break;
        }
        const multiResProfiles = await uploadAdaptivePanoramaTiles(buffer, row.ownerSlug, row.sceneId);
        const published = await prisma.$executeRaw(panoramaProfileUpdateQuery({
          kind: row.kind,
          id: row.id,
          panoramaUrl: row.panoramaUrl,
          previousProfiles: asObject(row.canvasData).multiResProfiles,
          profiles: multiResProfiles,
        }));
        if (!published) {
          console.log(`conflict ${label}: panorama/profil berubah; jalankan ulang untuk melanjutkan`);
          lastError = "";
          break;
        }
        ok += 1;
        lastError = "";
        console.log(
          `ok ${label} bytes=${buffer.length} ms=${Date.now() - started}` +
          ` desktop=${multiResProfiles.desktop.basePath}`
        );
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "gagal";
        const retry = attempt < 4 && /ENOBUFS|ECONNRESET|ETIMEDOUT|Timeout|socket/i.test(lastError);
        if (!retry) break;
        await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
      }
    }
    if (lastError) {
      failed += 1;
      console.log(`fail ${label} ${lastError}`);
    }
  }

  if (failed) process.exitCode = 1;
  console.log(`done ok=${ok} failed=${failed}${dryRun ? " (dry-run: tidak ada upload/DB write)" : ""}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
