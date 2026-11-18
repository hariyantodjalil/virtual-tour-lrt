import type { PanoramaScene, SceneInitialView } from "./tour-types";
import { selectQualityMultiRes as selectSceneMultiRes } from "./panorama-quality-profile";
import { getS3ProxyUrl } from "./s3-utils";

export type PanoramaViewport = { width: number; height: number; pixelRatio?: number; profileWidth?: number };
export function panoramaViewport(): PanoramaViewport {
  return typeof window === "undefined" ? { width: 1024, height: 768, pixelRatio: 1 } :
    { width: window.innerWidth, height: window.innerHeight, pixelRatio: window.devicePixelRatio || 1 };
}

function face(x: number, y: number, z: number): [string, number, number] {
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  if (az >= ax && az >= ay) return [z >= 0 ? "f" : "b", z >= 0 ? x / az : -x / az, -y / az];
  if (ax >= ay) return [x >= 0 ? "r" : "l", x >= 0 ? -z / ax : z / ax, -y / ax];
  return [y >= 0 ? "u" : "d", x / ay, y >= 0 ? z / ay : -z / ay];
}

/** At most one base tile and one detail tile, from one known destination. */
export function panoramaIntentUrls(scene: PanoramaScene, view: SceneInitialView, viewport = panoramaViewport()): string[] {
  const config = selectSceneMultiRes(scene, viewport.profileWidth ?? viewport.width);
  if (!config) return []; // Do not speculatively download an entire panorama.
  const yaw = view.yaw * Math.PI / 180, pitch = view.pitch * Math.PI / 180;
  const [side, nx, ny] = face(Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw));
  const hfov = Math.max(1, Math.min(179, view.hfov ?? 120)) * Math.PI / 180;
  let level = 1;
  while (level < config.maxLevel && viewport.width * (viewport.pixelRatio ?? 1) >
    config.tileResolution * 2 ** (level - 1) * Math.tan(hfov / 2) * .707) level++;
  const size = config.cubeResolution * 2 ** (level - config.maxLevel), across = Math.ceil(size / config.tileResolution);
  const index = (n: number) => Math.max(0, Math.min(across - 1, Math.floor((n + 1) / 2 * size / config.tileResolution)));
  const base = getS3ProxyUrl(config.basePath).replace(/\/$/, "");
  return [...new Set([`${base}/1/${side}0_0.jpg`, `${base}/${level}/${side}${index(ny)}_${index(nx)}.jpg`])];
}

