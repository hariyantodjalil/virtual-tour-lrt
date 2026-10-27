import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { downloadFromS3, extractS3KeyFromUrl } from "../lib/s3";
import { uploadPanoramaTiles } from "../lib/panorama-tile-upload";
import { isPannellumMultiRes } from "../lib/panorama-multires";

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function main() {
  const onlySlug = process.argv[2];
  const scenes = await prisma.virtualTourScene.findMany({
    where: {
      panoramaUrl: { not: "" },
      ...(onlySlug ? { station: { slug: onlySlug } } : {}),
    },
    select: {
      id: true,
      sceneId: true,
      title: true,
      panoramaUrl: true,
      canvasData: true,
      station: { select: { slug: true } },
    },
  });

  const pending = scenes
    .filter((scene) => !isPannellumMultiRes(asObject(scene.canvasData).multiRes))
    .sort((a, b) => {
      const aBekasi = a.station.slug === "bekasi-barat" ? 0 : 1;
      const bBekasi = b.station.slug === "bekasi-barat" ? 0 : 1;
      if (aBekasi !== bBekasi) return aBekasi - bBekasi;
      return `${a.station.slug}/${a.sceneId}`.localeCompare(`${b.station.slug}/${b.sceneId}`);
    });

  console.log(`pending ${pending.length}${onlySlug ? ` slug=${onlySlug}` : ""}`);

  let ok = 0;
  let failed = 0;
  for (const scene of pending) {
    const label = `${scene.station.slug}/${scene.sceneId}`;
    const key = extractS3KeyFromUrl(scene.panoramaUrl);
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
        const multiRes = await uploadPanoramaTiles(buffer, scene.station.slug, scene.sceneId);
        await prisma.virtualTourScene.update({
          where: { id: scene.id },
          data: {
            canvasData: { ...asObject(scene.canvasData), multiRes } as Prisma.InputJsonValue,
          },
        });
        ok += 1;
        lastError = "";
        console.log(`ok ${label} bytes=${buffer.length} ms=${Date.now() - started} base=${multiRes.basePath}`);
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

  console.log(`done ok=${ok} failed=${failed}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
