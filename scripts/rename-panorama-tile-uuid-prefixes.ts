/**
 * Copy S3 panorama-tile pyramids off UUID prefixes (WAF-safe) and rewrite canvasData basePath.
 * Deterministic mapping so local / DEV / prod DB converge on the same keys (shared bucket).
 *
 *   npm run panorama:rename-waf-safe -- [--dry-run] [--db-only] [--s3-only] [--limit=N] [--scope=train|station|all]
 */
import { config as loadEnv } from "dotenv";
import { createHash } from "node:crypto";

// Jangan timpa DATABASE_URL yang sudah di-set pemanggil (DEV/prod).
loadEnv({ override: false });
import {
  CopyObjectCommand,
  ListObjectsV2Command,
  S3Client,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";
import { isWafSafePanoramaBasePath } from "../lib/panorama-profile";

const UUID_SEG =
  /^(hd-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PATH_UUID =
  /\/virtual-tour\/panorama-tiles\/([^/]+)\/([^/]+)\/((?:hd-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?=\/|"|$)/gi;

function parseArgs(argv: string[]) {
  let dryRun = false;
  let dbOnly = false;
  let s3Only = false;
  let limit = 0;
  let scope: "train" | "station" | "all" = "all";
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--db-only") dbOnly = true;
    else if (arg === "--s3-only") s3Only = true;
    else if (arg.startsWith("--limit=")) limit = Number(arg.slice(8)) || 0;
    else if (arg.startsWith("--scope=")) {
      const v = arg.slice(8);
      if (v === "train" || v === "station" || v === "all") scope = v;
    }
  }
  return { dryRun, dbOnly, s3Only, limit, scope };
}

/** Stable WAF-safe revision so every env rewrites to the same S3 keys. */
export function wafSafeRevisionFromLegacy(segment: string): string {
  if (!UUID_SEG.test(segment)) {
    throw new Error(`not a legacy uuid revision: ${segment}`);
  }
  const hd = segment.toLowerCase().startsWith("hd-");
  const uuid = hd ? segment.slice(3) : segment;
  const digest = createHash("sha256").update(`pano-tile-rev:v1:${uuid.toLowerCase()}`).digest("hex");
  const id = hd ? `hdt${digest.slice(0, 18)}` : `t${digest.slice(0, 20)}`;
  if (!isWafSafePanoramaBasePath(`/${id}`)) {
    throw new Error(`mapped revision still WAF-unsafe: ${id}`);
  }
  return id;
}

function collectLegacyPrefixes(text: string, into: Map<string, string>) {
  PATH_UUID.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PATH_UUID.exec(text))) {
    const slug = m[1];
    const scene = m[2];
    const rev = m[3];
    const oldPrefix = `virtual-tour/panorama-tiles/${slug}/${scene}/${rev}`;
    if (!into.has(oldPrefix)) into.set(oldPrefix, wafSafeRevisionFromLegacy(rev));
  }
}

function rewritePaths(text: string, prefixMap: Map<string, string>): string {
  let out = text;
  // Longest prefixes first so nested replaces stay stable.
  const ordered = [...prefixMap.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [oldPrefix, newRev] of ordered) {
    const parts = oldPrefix.split("/");
    const parent = parts.slice(0, -1).join("/");
    const newPrefix = `${parent}/${newRev}`;
    if (oldPrefix === newPrefix) continue;
    out = out.split(`/${oldPrefix}`).join(`/${newPrefix}`);
    out = out.split(oldPrefix).join(newPrefix);
  }
  return out;
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

async function listKeys(client: S3Client, bucket: string, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix.endsWith("/") ? prefix : `${prefix}/`, ContinuationToken: token }),
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function objectExists(client: S3Client, bucket: string, key: string) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function copyPrefix(
  client: S3Client,
  bucket: string,
  oldPrefix: string,
  newRev: string,
  dryRun: boolean,
) {
  const parts = oldPrefix.split("/");
  const parent = parts.slice(0, -1).join("/");
  const newPrefix = `${parent}/${newRev}`;
  const keys = await listKeys(client, bucket, oldPrefix);
  let copied = 0;
  let skipped = 0;
  for (const key of keys) {
    const dest = `${newPrefix}${key.slice(oldPrefix.length)}`;
    if (await objectExists(client, bucket, dest)) {
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
  return { keys: keys.length, copied, skipped, newPrefix };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  type Row = { id: string; sceneId: string; canvasData: unknown; kind: "train" | "station" };
  const rows: Row[] = [];

  if (args.scope !== "station") {
    const train = await prisma.trainTourScene.findMany({
      select: { id: true, sceneId: true, canvasData: true },
    });
    rows.push(...train.map((r) => ({ ...r, kind: "train" as const })));
  }
  if (args.scope !== "train") {
    const station = await prisma.virtualTourScene.findMany({
      select: { id: true, sceneId: true, canvasData: true },
    });
    rows.push(...station.map((r) => ({ ...r, kind: "station" as const })));
  }

  const prefixMap = new Map<string, string>();
  for (const row of rows) {
    if (!row.canvasData) continue;
    collectLegacyPrefixes(JSON.stringify(row.canvasData), prefixMap);
  }

  let entries = [...prefixMap.entries()];
  if (args.limit > 0) entries = entries.slice(0, args.limit);
  console.log(`prefixes=${entries.length} dryRun=${args.dryRun} scope=${args.scope} dbOnly=${args.dbOnly} s3Only=${args.s3Only}`);
  for (const [oldPrefix, newRev] of entries.slice(0, 5)) {
    console.log(`  ${oldPrefix} -> .../${newRev}`);
  }

  if (!args.dbOnly) {
    const { client, bucket } = getS3();
    let i = 0;
    for (const [oldPrefix, newRev] of entries) {
      i += 1;
      const result = await copyPrefix(client, bucket, oldPrefix, newRev, args.dryRun);
      console.log(`[${i}/${entries.length}] s3 keys=${result.keys} copied=${result.copied} skipped=${result.skipped} -> ${result.newPrefix}`);
    }
  }

  if (!args.s3Only) {
    const activeMap = new Map(entries);
    // also include full map for rewrite when limit used? only rewrite for entries we processed
    let updated = 0;
    for (const row of rows) {
      if (!row.canvasData) continue;
      const before = JSON.stringify(row.canvasData);
      if (![...activeMap.keys()].some((p) => before.includes(p))) continue;
      const after = rewritePaths(before, activeMap);
      if (after === before) continue;
      // sanity: no legacy uuid left for processed prefixes
      const parsed = JSON.parse(after);
      if (!args.dryRun) {
        if (row.kind === "train") {
          await prisma.trainTourScene.update({ where: { id: row.id }, data: { canvasData: parsed } });
        } else {
          await prisma.virtualTourScene.update({ where: { id: row.id }, data: { canvasData: parsed } });
        }
      }
      updated += 1;
    }
    console.log(`db_rows_updated=${updated}`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
