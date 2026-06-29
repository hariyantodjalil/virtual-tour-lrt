import type { Hotspot, PanoramaScene } from "@/lib/tour-types";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import { setupHotspotElement } from "@/lib/pannellum-hotspot";
import { setupPrivacyBlurElement } from "@/lib/pannellum-privacy-blur";
import { findSpaceStatus, type SpaceAvailabilityStatus } from "@/lib/space-availability";
import { SCENE_FADE_MS } from "@/lib/pannellum-tour-dive";
import { preloadPanoramaUrl, preloadPanoramaUrls } from "@/lib/panorama-preload";

type SceneHandlers = {
  onSceneHotspot: (targetSceneId: string, pitch: number, yaw: number) => void;
  onScenePreload?: (targetSceneId: string) => void;
  onSpaceClick: (spaceCode: string) => void;
  onInfoClick: (title: string, description: string) => void;
  getSpaceStatus?: (spaceCode: string) => SpaceAvailabilityStatus | undefined;
};

export { findSpaceStatus };

function buildHotSpots(scene: PanoramaScene, handlers: SceneHandlers) {
  const blurSpots = (scene.privacyBlurs ?? []).map((blur, index) => ({
    id: `blur-${scene.id}-${index}`,
    pitch: blur.pitch,
    yaw: blur.yaw,
    type: "custom" as const,
    cssClass: "lrt-privacy-blur-hs",
    createTooltipFunc: (div: HTMLDivElement) => {
      setupPrivacyBlurElement(div, {
        editor: false,
        width: blur.width,
        height: blur.height,
        intensity: blur.intensity,
        scale: blur.scale,
      });
    },
  }));

  const hotSpots = scene.hotspots.map((h: Hotspot) => {
    let onClick: (() => void) | undefined;

    if (h.type === "scene" && h.sceneId) {
      const sceneId = h.sceneId;
      const pitch = h.pitch;
      const yaw = h.yaw;
      onClick = () => handlers.onSceneHotspot(sceneId, pitch, yaw);
    } else if (h.type === "space" && h.spaceCode) {
      const code = h.spaceCode;
      onClick = () => handlers.onSpaceClick(code);
    } else if (h.type === "info") {
      const title = h.text;
      const description = h.description ?? "";
      onClick = () => handlers.onInfoClick(title, description);
    }

    return {
      pitch: h.pitch,
      yaw: h.yaw,
      type: "custom" as const,
      cssClass: `lrt-${h.type}-hotspot`,
      createTooltipFunc: (div: HTMLDivElement) => {
        const spaceStatus =
          h.type === "space" && h.spaceCode
            ? handlers.getSpaceStatus?.(h.spaceCode)
            : undefined;
        setupHotspotElement(div, { type: h.type, onClick, scale: h.scale, spaceStatus });

        if (h.type === "scene" && h.sceneId && handlers.onScenePreload) {
          const targetId = h.sceneId;
          div.addEventListener("pointerenter", () => handlers.onScenePreload?.(targetId), {
            passive: true,
          });
        }
      },
    };
  });

  return [...blurSpots, ...hotSpots];
}

export function panoramaUrlForScene(scenes: PanoramaScene[], sceneId: string) {
  const scene = scenes.find((s) => s.id === sceneId);
  return scene ? getS3ProxyUrl(scene.panoramaUrl) : "";
}

export function linkedSceneIds(scene: PanoramaScene) {
  return scene.hotspots
    .filter((h) => h.type === "scene" && h.sceneId)
    .map((h) => h.sceneId as string);
}

export function preloadTourPanoramas(scenes: PanoramaScene[]) {
  void preloadPanoramaUrls(scenes.map((s) => getS3ProxyUrl(s.panoramaUrl)));
}

export function preloadLinkedScenes(scenes: PanoramaScene[], fromSceneId: string) {
  const scene = scenes.find((s) => s.id === fromSceneId);
  if (!scene) return;
  const urls = linkedSceneIds(scene)
    .map((id) => panoramaUrlForScene(scenes, id))
    .filter(Boolean);
  void preloadPanoramaUrls(urls);
}

export function buildPannellumTourConfig(
  scenes: PanoramaScene[],
  firstSceneId: string,
  handlers: SceneHandlers
) {
  const sceneMap: Record<string, object> = {};

  for (const scene of scenes) {
    sceneMap[scene.id] = {
      title: scene.title,
      type: "equirectangular",
      panorama: getS3ProxyUrl(scene.panoramaUrl),
      hotSpots: buildHotSpots(scene, handlers),
    };
  }

  return {
    default: {
      firstScene: firstSceneId,
      sceneFadeDuration: SCENE_FADE_MS,
      autoLoad: true,
      autoRotate: -2,
      showControls: false,
      showFullscreenCtrl: false,
      hfov: 100,
      minHfov: 50,
      maxHfov: 120,
    },
    scenes: sceneMap,
  };
}

export { preloadPanoramaUrl };
