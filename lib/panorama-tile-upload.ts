import { uploadToS3 } from "@/lib/s3";
import { buildPanoramaTiles, multiResConfig, type PannellumMultiRes } from "@/lib/panorama-multires";

function safeSegment(value: string) {
  return value.replace(/[^a-z0-9-]/gi, "-").toLowerCase() || "scene";
}

async function mapPool<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await task(current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
}

/** Potong panorama jadi tile Pannellum dan unggah ke S3. basePath siap dipakai getS3ProxyUrl. */
export async function uploadPanoramaTiles(
  panorama: Buffer,
  ownerSlug: string,
  sceneId: string
): Promise<PannellumMultiRes> {
  const prefix = `virtual-tour/panorama-tiles/${safeSegment(ownerSlug)}/${safeSegment(sceneId)}`;
  const tiles = await buildPanoramaTiles(panorama);
  await mapPool(tiles, 8, async (tile) => {
    await uploadToS3(tile.buffer, `${prefix}/${tile.name}`, "image/jpeg", {
      "scene-id": sceneId,
      "storage-mode": "pannellum-multires",
    });
  });
  return multiResConfig(`/${prefix}`);
}
