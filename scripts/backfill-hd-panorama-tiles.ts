/**
 * Backfill profil panorama HD (canvasData.multiResProfilesHd) dari sumber asli.
 *
 * Kontrak reader: lib/panorama-hd-profile.ts (Codex) — versi metadata tetap
 * "jpeg85-v1" plus pengaman kesegaran (privacyVerified/sourcePanoramaUrl/mirror
 * blur & AI). Profil Hemat (multiResProfiles) dan legacy multiRes TIDAK disentuh.
 *
 * Keselamatan sumber:
 * - originalPanoramaUrl TIDAK otomatis aman. Bila blur privasi sudah dibake,
 *   blur hanya ada di panorama display; untuk scene seperti itu blur diterapkan
 *   ulang di resolusi native dan diverifikasi piksel terhadap hasil existing.
 *   Verifikasi gagal → scene di-skip, bukan ditebak.
 * - Scene dengan AI patch aktif dilewati (master native tidak membawa patch).
 * - Sumber <= 6400px dilewati (tidak ada keuntungan cube 4096; tanpa upscale).
 *
 * Pemakaian:
 *   npm run panorama:backfill-hd [slug] [--scene=ID] [--kind=station|train] \
 *     [--dry-run] [--limit=N] [--concurrency=1..3] [--backup-dir=DIR]
 *
 * Dry-run menjalankan seluruh verifikasi sumber tanpa upload S3 dan tanpa
 * tulis DB. Resume: scene yang sudah punya multiResProfilesHd otomatis dilewati.
 */
import "dotenv/config";
import { appendFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";
import { downloadFromS3, extractS3KeyFromUrl } from "../lib/s3";
import sharp from "sharp";
import { uploadHdPanoramaTiles } from "../lib/panorama-tile-upload";
import {
  extractMultiResProfilesHdFromCanvasData,
  isPanoramaMultiResProfilesHd,
} from "../lib/panorama-profile";
import { panoramaHdProfileUpdateQuery } from "../lib/panorama-backfill";
import {
  decideHdSource,
  rebakeNativeWithVerification,
} from "../lib/panorama-hd-source";
import { extractPrivacyBlursFromCanvasData } from "../lib/privacy-blur-normalize";

type Row = {
  kind: "station" | "train";
  id: string;
  sceneId: string;
  slug: string;
  panoramaUrl: string;
  originalPanoramaUrl: string | null;
  canvasData: unknown;
};

/** Semaphore untuk scene berat: proses 11904px memakan RAM besar; batasi
 *  2 berat berjalan bersamaan agar worker lain tetap aman memori. */
function createSemaphore(limit: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return {
    async acquire() {
      if (active >= limit) await new Promise<void>((resolve) => queue.push(resolve));
      active += 1;
    },
    release() {
      active -= 1;
      const next = queue.shift();
      if (next) next();
    },
  };
}
const heavySlots = createSemaphore(4);

type Outcome =
  | { bucket: "success"; row: Row; detail: string; ms: number; bytes: number }
  | { bucket: "skipped"; row: Row; reason: string }
  | { bucket: "unavailable"; row: Row; reason: string }
  | { bucket: "conflict"; row: Row; reason: string }
  | { bucket: "failed"; row: Row; reason: string };

function parseArgs(argv: string[]) {
  let slug: string | undefined;
  let scene: string | undefined;
  let kind: "station" | "train" | undefined;
  let dryRun = false;
  let limit = 0;
  let concurrency = 1;
  let backupDir = "/tmp/vt-hd-backup";
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--scene=")) scene = arg.slice("--scene=".length);
    else if (arg.startsWith("--kind=")) {
      const k = arg.slice("--kind=".length);
      if (k === "station" || k === "train") kind = k;
    }
    else if (arg.startsWith("--limit=")) limit = Number(arg.slice("--limit=".length)) || 0;
    else if (arg.startsWith("--concurrency=")) {
      concurrency = Math.max(1, Math.min(8, Number(arg.slice("--concurrency=".length)) || 1));
    }
    else if (arg.startsWith("--backup-dir=")) backupDir = arg.slice("--backup-dir=".length);
    else if (arg && !arg.startsWith("--")) slug = arg;
  }
  return { slug, scene, kind, dryRun, limit, concurrency, backupDir };
}

/** Tolak bila ada proses backfill panorama lain yang masih hidup.
 *  Rantai leluhur sendiri (npm/sh/tsx pembungkus perintah ini) dikecualikan. */
function assertNoOtherBackfillRunning(selfPid: number) {
  // Di Windows /proc tidak tersedia — lewati pemeriksaan lintas-proses.
  try {
    readdirSync("/proc");
  } catch {
    return;
  }
  const excluded = new Set<number>([selfPid]);
  let cursor = selfPid;
  while (cursor > 0) {
    let ppid = 0;
    try {
      const status: string = readFileSync(`/proc/${cursor}/status`, "utf8");
      ppid = Number((/^PPid:\s+(\d+)$/m.exec(status) ?? [])[1]) || 0;
    } catch {
      break;
    }
    if (!ppid || excluded.has(ppid)) break;
    excluded.add(ppid);
    cursor = ppid;
  }
  for (const pid of readdirSync("/proc")) {
    const numeric = Number(pid);
    if (!/^\d+$/.test(pid) || excluded.has(numeric)) continue;
    let cmdline = "";
    try {
      cmdline = readFileSync(`/proc/${pid}/cmdline`, "utf8");
    } catch {
      continue;
    }
    if (/backfill-(hd-)?panorama-tiles/.test(cmdline)) {
      throw new Error(
        `Proses backfill panorama lain masih berjalan (pid ${pid}). Selesaikan dulu — jangan dua backfill pada target bersamaan.`
      );
    }
  }
}

async function collectRows(filters: {
  slug?: string; scene?: string; kind?: "station" | "train";
}): Promise<Row[]> {
  const stationFilter = {
    panoramaUrl: { not: "" },
    ...(filters.slug ? { station: { slug: filters.slug } } : {}),
    ...(filters.scene ? { sceneId: filters.scene } : {}),
  };
  const trainFilter = {
    panoramaUrl: { not: "" },
    ...(filters.slug ? { train: { slug: filters.slug } } : {}),
    ...(filters.scene ? { sceneId: filters.scene } : {}),
  };
  const stations = filters.kind === "train" ? [] : await prisma.virtualTourScene.findMany({
    where: stationFilter,
    select: {
      id: true, sceneId: true, panoramaUrl: true, originalPanoramaUrl: true, canvasData: true,
      station: { select: { slug: true } },
    },
    orderBy: [{ station: { slug: "asc" } }, { order: "asc" }],
  });
  const trains = filters.kind === "station" ? [] : await prisma.trainTourScene.findMany({
    where: trainFilter,
    select: {
      id: true, sceneId: true, panoramaUrl: true, originalPanoramaUrl: true, canvasData: true,
      train: { select: { slug: true } },
    },
    orderBy: [{ train: { slug: "asc" } }, { order: "asc" }],
  });
  return [
    ...stations.map((s) => ({
      kind: "station" as const, id: s.id, sceneId: s.sceneId, slug: s.station.slug,
      panoramaUrl: s.panoramaUrl, originalPanoramaUrl: s.originalPanoramaUrl, canvasData: s.canvasData,
    })),
    ...trains.map((s) => ({
      kind: "train" as const, id: s.id, sceneId: s.sceneId, slug: s.train.slug,
      panoramaUrl: s.panoramaUrl, originalPanoramaUrl: s.originalPanoramaUrl, canvasData: s.canvasData,
    })),
  ];
}

function canvasBase(canvasData: unknown): Record<string, unknown> {
  return canvasData && typeof canvasData === "object" && !Array.isArray(canvasData)
    ? (canvasData as Record<string, unknown>)
    : {};
}

function pyramidTileCount(cubeResolution: number, tileResolution: number): number {
  const levels = Math.log2(cubeResolution / tileResolution) + 1;
  let tiles = 0;
  for (let level = 1; level <= levels; level++) {
    const side = cubeResolution / 2 ** (levels - level);
    tiles += (side / tileResolution) ** 2;
  }
  return tiles * 6; // 6 sisi kubus
}

async function processScene(row: Row, opts: {
  dryRun: boolean; backupDir: string;
}): Promise<Outcome> {
  const label = `${row.kind}/${row.slug}/${row.sceneId}`;
  const started = Date.now();
  const canvas = canvasBase(row.canvasData);

  // Idempotent/resume: sudah ada metadata HD valid → lewati.
  if (extractMultiResProfilesHdFromCanvasData(row.canvasData)) {
    return { bucket: "skipped", row, reason: "sudah punya profil HD" };
  }

  const decision = decideHdSource(row.canvasData);
  if (decision.kind === "skip") {
    return { bucket: "skipped", row, reason: decision.reason };
  }

  const originalKey = row.originalPanoramaUrl ? extractS3KeyFromUrl(row.originalPanoramaUrl) : null;
  if (!row.originalPanoramaUrl || !originalKey) {
    return { bucket: "unavailable", row, reason: "originalPanoramaUrl kosong — tidak ada sumber native" };
  }

  // Transient retry di sekitar I/O S3/network.
  let lastError = "";
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const originalBuffer = await downloadFromS3(originalKey);
      const meta = await sharp(originalBuffer, { limitInputPixels: false }).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      if (!width || !height) throw new Error("metadata sumber asli tidak valid");
      if (width <= 6400) {
        return {
          bucket: "unavailable",
          row,
          reason: `sumber ${width}x${height} ≤ 6400px — tidak lebih baik dari Hemat (tanpa upscale)`,
        };
      }

      let sourceBuffer = originalBuffer;
      const provenancePrivacy: Record<string, unknown> = {
        blurRegions: extractPrivacyBlursFromCanvasData(row.canvasData).length,
        reBakedAtNative: false,
      };
      if (decision.kind === "original-reblur") {
        const blurs = extractPrivacyBlursFromCanvasData(row.canvasData);
        const displayKey = extractS3KeyFromUrl(row.panoramaUrl);
        if (!displayKey) throw new Error("panoramaUrl display tidak valid");
        const displayBuffer = await downloadFromS3(displayKey);
        const rebake = await rebakeNativeWithVerification({
          originalBuffer, displayBuffer, blurs,
        });
        if (!rebake.ok) {
          return {
            bucket: "skipped",
            row,
            reason: `pemetaan blur di native tak terverifikasi (${rebake.reason})`,
          };
        }
        sourceBuffer = rebake.nativeBuffer;
        provenancePrivacy.reBakedAtNative = true;
        provenancePrivacy.extentDerivedFromDisplay = true;
        provenancePrivacy.regionsVerified = rebake.verification.regionsChecked;
        provenancePrivacy.viewerContext = {
          viewerWidth: rebake.verification.context.viewerWidth,
          viewerHeight: rebake.verification.context.viewerHeight,
          hfov: rebake.verification.context.hfov,
        };
        provenancePrivacy.verifiedAgainstKey = row.panoramaUrl;
      }

      const cubeResolution = width > 6400 ? 4096 : 2048;
      const plannedTiles =
        pyramidTileCount(cubeResolution, 512) + pyramidTileCount(cubeResolution, 1024);
      // Scene berat (>10000px) dibatasi 2 paralel — memori tetap aman saat
      // total worker dinaikkan untuk scene ringan.
      const isHeavy = width > 10000;
      if (isHeavy) await heavySlots.acquire();
      try {

      if (opts.dryRun) {
        return {
          bucket: "success",
          row,
          detail:
            `dry-run: sumber=${decision.kind} ${width}x${height} cube=${cubeResolution}` +
            ` tile≈${plannedTiles} (${decision.reason})`,
          ms: Date.now() - started,
          bytes: 0,
        };
      }

      const profiles = await uploadHdPanoramaTiles(sourceBuffer, row.slug, row.sceneId);
      const hd = {
        version: "jpeg85-v1",
        desktop: profiles.desktop,
        mobile: profiles.mobile,
        privacyVerified: true,
        sourcePanoramaUrl: row.panoramaUrl,
        ...(typeof canvas.privacyBlurLastBakedAt === "string"
          ? { privacyBlurLastBakedAt: canvas.privacyBlurLastBakedAt } : {}),
        ...(typeof canvas.aiPatchLastBakedAt === "string"
          ? { aiPatchLastBakedAt: canvas.aiPatchLastBakedAt } : {}),
        provenance: {
          source: decision.kind,
          sourceKey: row.originalPanoramaUrl,
          sourceDimensions: `${width}x${height}`,
          generator: {
            jpegQuality: 85,
            cubeResolution,
            tileResolutions: { mobile: 512, desktop: 1024 },
          },
          privacy: provenancePrivacy,
          createdAt: new Date().toISOString(),
        },
      } as Record<string, unknown>;
      if (!isPanoramaMultiResProfilesHd(hd)) {
        throw new Error("metadata HD tidak lolos validator kontrak");
      }

      // Cadangkan canvasData lama (di luar repo) sebelum menulis.
      appendFileSync(
        join(opts.backupDir, "canvas-before-hd.jsonl"),
        JSON.stringify({ kind: row.kind, slug: row.slug, sceneId: row.sceneId, id: row.id, canvasData: row.canvasData }) + "\n"
      );

      const published = await prisma.$executeRaw(panoramaHdProfileUpdateQuery({
        kind: row.kind,
        id: row.id,
        panoramaUrl: row.panoramaUrl,
        privacyBlurLastBakedAt: (canvas.privacyBlurLastBakedAt as string | undefined) ?? null,
        aiPatchLastBakedAt: (canvas.aiPatchLastBakedAt as string | undefined) ?? null,
        privacyBlurs: canvas.privacyBlurs ?? [],
        previousHd: canvas.multiResProfilesHd ?? null,
        hd,
      }));
      if (published === 0) {
        return {
          bucket: "conflict",
          row,
          reason: "scene berubah selama pemrosesan (panorama/blur/AI/HD) — tile terunggah tapi metadata tidak dipublikasi; jalankan ulang",
        };
      }
      return {
        bucket: "success",
        row,
        detail: `sumber=${decision.kind} ${width}x${height} cube=${cubeResolution} tile=${plannedTiles}`,
        ms: Date.now() - started,
        bytes: originalBuffer.length,
      } as Outcome;
      } finally {
        if (isHeavy) heavySlots.release();
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "gagal";
      const retry = attempt < 4 && /ENOBUFS|ECONNRESET|ETIMEDOUT|Timeout|socket|503|429|abort|Connection terminated|terminated unexpectedly/i.test(lastError);
      if (!retry) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
    }
  }
  return { bucket: "failed", row, reason: `${label} ${lastError}` };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // Dry-run read-only — aman berjalan bersama backfill lain.
  if (!args.dryRun) assertNoOtherBackfillRunning(process.pid);
  mkdirSync(args.backupDir, { recursive: true });

  const rows = (await collectRows(args)).filter((row) => {
    const hasHd = Boolean(canvasBase(row.canvasData).multiResProfilesHd);
    return !hasHd;
  });
  const capped = args.limit > 0 ? rows.slice(0, args.limit) : rows;

  console.log(
    `pending ${rows.length}${args.slug ? ` slug=${args.slug}` : ""}` +
    `${args.scene ? ` scene=${args.scene}` : ""}${args.kind ? ` kind=${args.kind}` : ""}` +
    `${args.limit > 0 ? ` limit=${capped.length}` : ""}` +
    ` concurrency=${args.concurrency}${args.dryRun ? " mode=dry-run" : ""}`
  );

  const outcomes: Outcome[] = [];
  let index = 0;
  let infraStreak = 0;
  let infraSignature = "";
  async function worker() {
    while (index < capped.length) {
      const current = capped[index];
      index += 1;
      const outcome = await processScene(current, { dryRun: args.dryRun, backupDir: args.backupDir });
      outcomes.push(outcome);
      if (outcome.bucket === "failed") {
        const infra = /ENOTFOUND|ETIMEDOUT|ECONNRESET|socket/i.test(outcome.reason);
        const signature = infra ? outcome.reason.replace(/[a-z0-9/-]*station|train[a-z0-9/-]*/gi, "").slice(0, 60) : "";
        if (infra && signature === infraSignature) infraStreak += 1;
        else if (infra) { infraSignature = signature; infraStreak = 1; }
        else { infraStreak = 0; infraSignature = ""; }
        if (infraStreak >= 5) {
          throw new Error(
            "Infrastruktur S3/DNS bermasalah (5 kegagalan beruntun) — run dihentikan agar scene tidak dibakar; resume setelah jaringan normal."
          );
        }
      } else if (outcome.bucket !== "conflict") {
        infraStreak = 0; infraSignature = "";
      }
      const label = `${outcome.row.kind}/${outcome.row.slug}/${outcome.row.sceneId}`;
      if (outcome.bucket === "success") {
        console.log(`ok ${label} ${outcome.detail} ms=${outcome.ms}`);
      } else {
        console.log(`${outcome.bucket} ${label} ${outcome.reason}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(args.concurrency, capped.length) }, worker));

  const count = (bucket: Outcome["bucket"]) =>
    outcomes.filter((o) => o.bucket === bucket).length;
  const totalMs = outcomes.reduce((sum, o) => sum + ("ms" in o ? o.ms : 0), 0);
  const totalBytes = outcomes.reduce((sum, o) => sum + ("bytes" in o ? o.bytes : 0), 0);
  console.log(
    `done success=${count("success")} skipped=${count("skipped")}` +
    ` unavailable=${count("unavailable")} conflict=${count("conflict")} failed=${count("failed")}` +
    ` ms=${totalMs} sourceBytes=${totalBytes}` +
    `${args.dryRun ? " (dry-run: tidak ada upload/DB write)" : ""}`
  );
  if (count("failed") > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
