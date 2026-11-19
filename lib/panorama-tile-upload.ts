import { uploadToS3 } from "@/lib/s3";
import { buildPanoramaTiles, multiResConfig, type PannellumMultiRes } from "@/lib/panorama-multires";
import {
  newPanoramaTileRevisionId,
  type PanoramaMultiResProfiles,
  type PanoramaMultiResProfilesHd,
} from "./panorama-profile";
import sharp from "sharp";

function safeSegment(value: string) {
  return value.replace(/[^a-z0-9-]/gi, "-").toLowerCase() || "scene";
}

function tilePrefix(ownerSlug: string, sceneId: string, kind: "economy" | "hd" = "economy") {
  return `virtual-tour/panorama-tiles/${safeSegment(ownerSlug)}/${safeSegment(sceneId)}/${newPanoramaTileRevisionId(kind)}`;
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
  const prefix = tilePrefix(ownerSlug, sceneId);
  const tiles = await buildPanoramaTiles(panorama);
  await mapPool(tiles, 3, async (tile) => {
    await uploadToS3(tile.buffer, `${prefix}/${tile.name}`, "image/jpeg", {
      "scene-id": sceneId,
      "storage-mode": "pannellum-multires",
    });
  });
  return multiResConfig(`/${prefix}`);
}

/** Two immutable pyramids from the same privacy-safe full-resolution source. */
export async function uploadAdaptivePanoramaTiles(
  panorama: Buffer, ownerSlug: string, sceneId: string,
): Promise<PanoramaMultiResProfiles> {
  const metadata = await sharp(panorama).metadata();
  const cubeResolution = (metadata.width ?? 0) > 6400 ? 4096 : 2048;
  const prefix = tilePrefix(ownerSlug, sceneId);
  const profiles = {} as Pick<PanoramaMultiResProfiles, "desktop" | "mobile">;
  // Sequential generation limits peak memory; publish metadata only after both uploads finish.
  for (const [name, tileResolution] of [["mobile", 512], ["desktop", 1024]] as const) {
    const tiles = await buildPanoramaTiles(panorama, {
      sourceWidth: null, cubeResolution, tileResolution, jpegQuality: 85,
    });
    await mapPool(tiles, 4, async (tile) => {
      await uploadToS3(tile.buffer, `${prefix}/${name}/${tile.name}`, "image/jpeg", {
        "scene-id": sceneId, "storage-mode": "pannellum-multires-jpeg85-v1", "profile": name,
      });
    });
    profiles[name] = multiResConfig(`/${prefix}/${name}`, tileResolution, cubeResolution);
  }
  return { version: "jpeg85-v1", ...profiles };
}

/** Pyramid HD dari sumber asli (tanpa resize 6000px). Provenance dirakit pemanggil;
 *  metadata baru boleh dipublikasi setelah kedua pyramid selesai dan tervalidasi. */
export async function uploadHdPanoramaTiles(
  panorama: Buffer, ownerSlug: string, sceneId: string,
): Promise<Pick<PanoramaMultiResProfilesHd, "desktop" | "mobile">> {
  const metadata = await sharp(panorama, { limitInputPixels: false }).metadata();
  const cubeResolution = (metadata.width ?? 0) > 6400 ? 4096 : 2048;
  const prefix = tilePrefix(ownerSlug, sceneId, "hd");
  const profiles = {} as Pick<PanoramaMultiResProfilesHd, "desktop" | "mobile">;
  // Sequential generation limits peak memory at native resolution.
  for (const [name, tileResolution] of [["mobile", 512], ["desktop", 1024]] as const) {
    const tiles = await buildPanoramaTiles(panorama, {
      sourceWidth: null, cubeResolution, tileResolution, jpegQuality: 85,
    });
    await mapPool(tiles, 4, async (tile) => {
      await uploadToS3(tile.buffer, `${prefix}/${name}/${tile.name}`, "image/jpeg", {
        "scene-id": sceneId, "storage-mode": "pannellum-multires-hd-jpeg85-v1",
        "profile": name, "quality": "hd",
      });
    });
    profiles[name] = multiResConfig(`/${prefix}/${name}`, tileResolution, cubeResolution);
  }
  return profiles;
}
