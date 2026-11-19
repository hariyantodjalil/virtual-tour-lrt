import type { Hotspot, PanoramaScene, SceneInitialView } from "@/lib/tour-types";
import type { SpaceHotspotTarget } from "@/lib/space-hotspot-locate";
import { resolveSceneEntryView } from "./scene-entry-view";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import { setupHotspotElement, resolveSceneHotspotTitle, type SpaceHotspotMarker } from "@/lib/pannellum-hotspot";
import { findSpaceStatus, type SpaceAvailabilityStatus } from "@/lib/space-availability";
import { SCENE_FADE_MS } from "@/lib/pannellum-tour-dive";
import { PANNELLUM_HFOV, PANNELLUM_INTERACTION, PANNELLUM_PITCH_LIMITS } from "@/lib/pannellum-viewer-defaults";
import { preloadPanoramaUrl, preloadPanoramaUrls } from "@/lib/panorama-preload";
import type { PannellumMultiRes } from "@/lib/panorama-multires";
import { selectQualityMultiRes } from "./panorama-quality-profile";
import type { PanoramaQuality } from "./panorama-quality";
import { panoramaIntentUrls, panoramaViewport, type PanoramaViewport } from "./panorama-intent";

export type AdHotspotPayload = {
  target?: Extract<SpaceHotspotTarget, { yaw: number }>;
  spaceCode?: string;
  text: string;
  creativeUrl?: string;
  creativeTitle?: string;
};

type SceneHandlers = {
  spaceMarker?: SpaceHotspotMarker;
  onSceneHotspot: (targetSceneId: string, pitch: number, yaw: number, entryView: SceneInitialView) => void;
  onScenePreload?: (targetSceneId: string, view: SceneInitialView) => void;
  onSpaceClick: (spaceCode: string, target?: SpaceHotspotTarget) => void;
  onAdClick?: (payload: AdHotspotPayload) => void;
  onInfoClick: (title: string, description: string) => void;
  getSpaceStatus?: (spaceCode: string) => SpaceAvailabilityStatus | undefined;
};

export { findSpaceStatus };

function buildHotSpots(scene: PanoramaScene, allScenes: PanoramaScene[], handlers: SceneHandlers) {
  // Blur privasi dibake ke piksel panorama — tidak pakai overlay CSS di tour publik.
  const blurSpots: never[] = [];

  const hotSpots = scene.hotspots.map((h: Hotspot) => {
    let onClick: (() => void) | undefined;

    if (h.type === "scene" && h.sceneId) {
      const sceneId = h.sceneId;
      const pitch = h.pitch;
      const yaw = h.yaw;
      const entryView = resolveSceneEntryView(h, allScenes.find((s) => s.id === sceneId)?.initialView);
      onClick = () => handlers.onSceneHotspot(sceneId, pitch, yaw, entryView);
    } else if (h.type === "space" && h.spaceCode) {
      const code = h.spaceCode;
      onClick = () => handlers.onSpaceClick(code, { sceneId: scene.id, yaw: h.yaw, pitch: h.pitch });
    } else if (h.type === "ad") {
      const payload: AdHotspotPayload = {
        target: { sceneId: scene.id, yaw: h.yaw, pitch: h.pitch },
        spaceCode: h.spaceCode,
        text: h.text,
        creativeUrl: h.creativeUrl,
        creativeTitle: h.creativeTitle,
      };
      onClick = () => {
        if (handlers.onAdClick) handlers.onAdClick(payload);
        else if (h.spaceCode) handlers.onSpaceClick(h.spaceCode);
      };
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
        setupHotspotElement(div, {
          type: h.type,
          spaceMarker: handlers.spaceMarker,
          onClick,
          scale: h.scale,
          spaceStatus,
          spaceCode: h.type === "space" ? h.spaceCode : undefined,
          facilityIcon: h.type === "info" ? h.facilityIcon : undefined,
          sceneTitle:
            h.type === "scene"
              ? resolveSceneHotspotTitle(h.sceneId, allScenes, h.text)
              : undefined,
          direction: h.type === "scene" ? h.direction : undefined,
        });

        const sceneLabel = div.querySelector<HTMLElement>(".lrt-scene-nav");
        if (sceneLabel) sceneLabel.dataset.tourText = sceneLabel.getAttribute("aria-label") ?? "";

        if (h.type === "scene" && h.sceneId && handlers.onScenePreload) {
          const targetId = h.sceneId;
          const entry = resolveSceneEntryView(h, allScenes.find((s) => s.id === targetId)?.initialView);
          div.addEventListener("pointerenter", () => handlers.onScenePreload?.(targetId, entry), {
            passive: true,
          });
          div.addEventListener("focus", () => handlers.onScenePreload?.(targetId, entry));
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

const PREVIEW_FACES = ["f", "r", "b", "l", "u", "d"];

function proxyMultiRes(multiRes: PannellumMultiRes) {
  return {
    ...multiRes,
    basePath: getS3ProxyUrl(multiRes.basePath).replace(/\/$/, ""),
  };
}

/** Tile tingkat rendah saja. Scene tanpa tile tetap memakai WebP utuh. */
export function scenePreviewUrls(scene: PanoramaScene | undefined, viewportWidth = panoramaViewport().width, quality?: PanoramaQuality) {
  if (!scene) return [];
  const multiRes = selectQualityMultiRes(scene, viewportWidth, quality);
  if (multiRes) {
    const base = proxyMultiRes(multiRes).basePath;
    return PREVIEW_FACES.map((face) => `${base}/1/${face}0_0.${multiRes.extension}`);
  }
  const url = getS3ProxyUrl(scene.panoramaUrl);
  return url ? [url] : [];
}

export function linkedSceneIds(scene: PanoramaScene) {
  return scene.hotspots
    .filter((h) => h.type === "scene" && h.sceneId)
    .map((h) => h.sceneId as string);
}

export function preloadInitialPanorama(scenes: PanoramaScene[], sceneId?: string, viewportWidth?: number) {
  const initial = scenes.find((scene) => scene.id === sceneId) ?? scenes[0];
  void preloadPanoramaUrls(scenePreviewUrls(initial, viewportWidth, "economy"));
}

let intentTimer: ReturnType<typeof setTimeout> | undefined;
function allowsSpeculativePreload() {
  const connection = typeof navigator === "undefined" ? undefined :
    (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !connection?.saveData && !connection?.effectiveType?.includes("2g");
}

/** Debounce rapid hover changes; one destination, no more than two URLs. */
export function schedulePanoramaIntent(scene: PanoramaScene | undefined, view: SceneInitialView, viewport?: PanoramaViewport) {
  if (intentTimer) clearTimeout(intentTimer);
  if (!scene || !allowsSpeculativePreload()) return;
  intentTimer = setTimeout(() => { void preloadPanoramaUrls(panoramaIntentUrls(scene, view, viewport)); }, 120);
}

export function preloadLinkedScenes(scenes: PanoramaScene[], fromSceneId: string, viewport?: PanoramaViewport) {
  if (!allowsSpeculativePreload()) return;
  const scene = scenes.find((s) => s.id === fromSceneId);
  if (!scene) return;
  const urls = scene.hotspots.filter(h => h.type === "scene" && h.sceneId).slice(0, 2).flatMap(h => {
    const destination = scenes.find(s => s.id === h.sceneId);
    return destination ? panoramaIntentUrls(destination, resolveSceneEntryView(h, destination.initialView), viewport).slice(0, 1) : [];
  });
  void preloadPanoramaUrls(urls);
}

/** Build an inactive destination without reloading the currently visible scene. */
export function buildPannellumSceneConfig(
  scene: PanoramaScene, scenes: PanoramaScene[], handlers: SceneHandlers,
  viewportWidth: number, quality: PanoramaQuality,
) {
  const view = scene.initialView;
  const multiRes = selectQualityMultiRes(scene, viewportWidth, quality);
  return {
    ...(multiRes
      ? { type: "multires", multiRes: proxyMultiRes(multiRes) }
      : { type: "equirectangular", panorama: getS3ProxyUrl(scene.panoramaUrl) }),
    hotSpots: buildHotSpots(scene, scenes, handlers),
    ...(view ? { yaw: view.yaw, pitch: view.pitch, hfov: view.hfov ?? PANNELLUM_HFOV.hfov } : {}),
  };
}

export function buildPannellumTourConfig(
  scenes: PanoramaScene[],
  firstSceneId: string,
  handlers: SceneHandlers
  , viewportWidth = panoramaViewport().width
) {
  const sceneMap: Record<string, object> = {};

  for (const scene of scenes) {
    sceneMap[scene.id] = buildPannellumSceneConfig(scene, scenes, handlers, viewportWidth, "economy");
  }

  return {
    default: {
      firstScene: firstSceneId,
      sceneFadeDuration: SCENE_FADE_MS,
      autoLoad: true,
      autoRotate: 0,
      showControls: false,
      showFullscreenCtrl: false,
      ...PANNELLUM_HFOV,
      ...PANNELLUM_PITCH_LIMITS,
      ...PANNELLUM_INTERACTION,
    },
    scenes: sceneMap,
  };
}

export { preloadPanoramaUrl, preloadPanoramaUrls };
