/**
 * Copy legacy long panorama-tiles pyramids → short virtual-tour/pt/… keys and rewrite canvasData.
 * Needed because prod F5 rejects S3-proxy keys ≥ 88 chars.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/migrate-panorama-tiles-short-path.ts [--dry-run] [--scope=train|station|all] [--limit=N]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ override: false });

import { createHash } from "node:crypto";
import {
  CopyObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";
import { shortTileBasePath } from "../lib/panorama-tile-revision";

function parseArgs(argv: string[]) {
  let dryRun = false;
  let limit = 0;
  let scope: "train" | "station" | "all" = "all";
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--limit=")) limit = Number(arg.slice(8)) || 0;
    else if (arg.startsWith("--scope=")) {
      const v = arg.slice(8);
      if (v === "train" || v === "station" || v === "all") scope = v;
    }
  }
  return { dryRun, limit, scope };
}

function mapRev(oldSeg: string, kind: "economy" | "hd"): string {
  const digest = createHash("sha256").update(`vt-pt-rev:v1:${oldSeg}`).digest("hex").slice(0, 10);
  return kind === "hd" ? `h${digest}` : `t${digest}`;
}

function stripSlash(path: string) {
  return path.replace(/^\//, "").replace(/\/$/, "");
}

function parseLegacyBase(basePath: string): {
  slug: string;
  scene: string;
  rev: string;
  profile: "mobile" | "desktop" | null;
  kind: "economy" | "hd";
} | null {
  const key = stripSlash(basePath);
  const m = key.match(
    /^virtual-tour\/panorama-tiles\/([^/]+)\/([^/]+)\/([^/]+)(?:\/(mobile|desktop))?$/i,
  );
  if (!m) return null;
  const rev = m[3];
  const isHd = /^hd[-_]?/i.test(rev) || /^hdt/i.test(rev);
  return {
    slug: m[1],
    scene: m[2],
    rev,
    profile: (m[4]?.toLowerCase() as "mobile" | "desktop" | undefined) ?? null,
    kind: isHd ? "hd" : "economy",
  };
}

function getS3() {
  if (!process.env.S3_ENDPOINT || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
    throw new Error("S3 env missing");
  }
  return {
    client: new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    }),
    bucket: process.env.S3_BUCKET || "virtual-tour-lrt",
  };
}

async function listKeys(client: S3Client, bucket: string, prefix: string) {
  const keys: string[] = [];
  let token: string | undefined;
  const p = prefix.endsWith("/") ? prefix : `${prefix}/`;
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: p, ContinuationToken: token }),
    );
    for (const obj of res.Contents ?? []) if (obj.Key) keys.push(obj.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function exists(client: S3Client, bucket: string, key: string) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function copyTree(
  client: S3Client,
  bucket: string,
  oldPrefix: string,
  newPrefix: string,
  dryRun: boolean,
) {
  const keys = await listKeys(client, bucket, oldPrefix);
  let copied = 0;
  let skipped = 0;
  for (const key of keys) {
    const dest = `${newPrefix}${key.slice(oldPrefix.length)}`;
    if (await exists(client, bucket, dest)) {
      skipped += 1;
      continue;
    }
    if (!dryRun) {
      await client.send(
        new CopyObjectCommand({
          Bucket: bucket,
          CopySource: `${bucket}/${key}`,
          Key: dest,
          MetadataDirective: "COPY",
        }),
      );
    }
    copied += 1;
  }
  return { keys: keys.length, copied, skipped };
}

function rewriteBase(
  basePath: string,
  ownerSlug: string,
  sceneId: string,
): { next: string; oldPrefix: string; newPrefix: string } | null {
  const parsed = parseLegacyBase(basePath);
  if (!parsed) return null;
  const kind = parsed.kind;
  const rev = mapRev(parsed.rev, kind);
  const profile = parsed.profile ?? "mobile";
  const next = shortTileBasePath(ownerSlug, sceneId, rev, kind, profile);
  const oldPrefix = stripSlash(basePath);
  const newPrefix = stripSlash(next);
  return { next, oldPrefix, newPrefix };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const { client, bucket } = getS3();

  type Row = {
    kind: "train" | "station";
    id: string;
    sceneId: string;
    ownerSlug: string;
    canvasData: unknown;
    panoramaUrl: string;
  };
  const rows: Row[] = [];

  if (args.scope !== "station") {
    const train = await prisma.trainTourScene.findMany({
      select: {
        id: true, sceneId: true, canvasData: true, panoramaUrl: true,
        train: { select: { slug: true } },
      },
    });
    rows.push(
      ...train.map((r) => ({
        kind: "train" as const,
        id: r.id,
        sceneId: r.sceneId,
        ownerSlug: r.train.slug.startsWith("train-") ? r.train.slug : `train-${r.train.slug}`,
        // tile paths historically used train-lrt-jabodebek
        canvasData: r.canvasData,
        panoramaUrl: r.panoramaUrl,
      })),
    );
    // Fix owner slug: S3 uses train-lrt-jabodebek from upload context
    for (const r of rows) {
      if (r.kind === "train") {
        const raw = await prisma.trainTourScene.findUnique({
          where: { id: r.id },
          select: { train: { select: { slug: true } } },
        });
        const slug = raw?.train.slug ?? "lrt-jabodebek";
        r.ownerSlug = slug === "lrt-jabodebek" || !slug.startsWith("train-")
          ? (slug.startsWith("train-") ? slug : `train-${slug}`)
          : slug;
      }
    }
  }

  if (args.scope !== "train") {
    const station = await prisma.virtualTourScene.findMany({
      select: {
        id: true, sceneId: true, canvasData: true, panoramaUrl: true,
        station: { select: { slug: true } },
      },
    });
    rows.push(
      ...station.map((r) => ({
        kind: "station" as const,
        id: r.id,
        sceneId: r.sceneId,
        ownerSlug: r.station.slug,
        canvasData: r.canvasData,
        panoramaUrl: r.panoramaUrl,
      })),
    );
  }

  // Prefer historical train owner slug used in S3
  for (const r of rows) {
    if (r.kind !== "train") continue;
    const text = JSON.stringify(r.canvasData ?? {});
    const m = text.match(/panorama-tiles\/(train-[^/"]+)\//);
    if (m) r.ownerSlug = m[1];
  }

  let work = rows;
  if (args.limit > 0) work = work.slice(0, args.limit);
  console.log(`rows=${work.length} dryRun=${args.dryRun} scope=${args.scope}`);

  let updated = 0;
  let copiedTrees = 0;
  for (const row of work) {
    const canvas = row.canvasData && typeof row.canvasData === "object"
      ? { ...(row.canvasData as Record<string, unknown>) }
      : null;
    if (!canvas) continue;

    const replacements: Array<{ from: string; to: string; oldPrefix: string; newPrefix: string }> = [];
    const consider = (basePath: string | undefined) => {
      if (!basePath || !basePath.includes("panorama-tiles/")) return;
      if (basePath.includes("/virtual-tour/pt/") || basePath.includes("/pt/")) return;
      const mapped = rewriteBase(basePath, row.ownerSlug, row.sceneId);
      if (!mapped) return;
      replacements.push({
        from: basePath,
        to: mapped.next,
        oldPrefix: mapped.oldPrefix,
        newPrefix: mapped.newPrefix,
      });
    };

    const walk = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        for (const v of node) walk(v);
        return;
      }
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === "basePath" && typeof v === "string") consider(v);
        else walk(v);
      }
    };
    walk(canvas);

    if (!replacements.length) continue;

    // unique copy jobs
    const seen = new Set<string>();
    for (const rep of replacements) {
      const key = `${rep.oldPrefix}->${rep.newPrefix}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const result = await copyTree(client, bucket, rep.oldPrefix, rep.newPrefix, args.dryRun);
      copiedTrees += 1;
      console.log(
        `${row.kind}/${row.sceneId} copy keys=${result.keys} copied=${result.copied} skipped=${result.skipped}\n  ${rep.oldPrefix}\n  -> ${rep.newPrefix}`,
      );
    }

    let text = JSON.stringify(canvas);
    for (const rep of replacements) {
      text = text.split(rep.from).join(rep.to);
    }
    const nextCanvas = JSON.parse(text);
    if (!args.dryRun) {
      if (row.kind === "train") {
        await prisma.trainTourScene.update({ where: { id: row.id }, data: { canvasData: nextCanvas } });
      } else {
        await prisma.virtualTourScene.update({ where: { id: row.id }, data: { canvasData: nextCanvas } });
      }
    }
    updated += 1;
  }

  console.log(`done updated_rows=${updated} copied_trees=${copiedTrees}`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
