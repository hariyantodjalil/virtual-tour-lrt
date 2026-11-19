import {
  isWafSafePanoramaBasePath,
  selectSceneMultiRes,
  type PanoramaMultiResProfiles,
  type PannellumMultiRes,
} from "./panorama-profile";
import { getAutomaticPanoramaQuality, type PanoramaQuality } from "./panorama-quality";

export type QualityScene = {
  multiRes?: PannellumMultiRes;
  multiResProfiles?: PanoramaMultiResProfiles;
  multiResProfilesHd?: PanoramaMultiResProfiles;
};

export function selectQualityMultiRes(
  scene: QualityScene, width: number, quality: PanoramaQuality = getAutomaticPanoramaQuality(width),
): PannellumMultiRes | undefined {
  const hd = scene.multiResProfilesHd?.[width >= 1024 ? "desktop" : "mobile"];
  const economy = selectSceneMultiRes(scene, width);
  // HD hanya jika basePath pendek (lolos batas panjang WAF prod).
  if (
    quality === "hd" &&
    hd &&
    economy &&
    hd.cubeResolution > economy.cubeResolution &&
    isWafSafePanoramaBasePath(hd.basePath)
  ) {
    return hd;
  }
  return economy;
}
