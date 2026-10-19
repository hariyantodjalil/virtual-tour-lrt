/** Transisi scene — preload dulu, lalu crossfade ringan (tanpa loading UI). */

export const SCENE_FADE_MS = 600;
export const SCENE_SWAP_MS = 140;
/** Masuk scene baru di zoom out maksimal (sama dengan PANNELLUM_HFOV.hfov). */
export const SCENE_ENTRY_HFOV = 120;

export type DiveOverlayState = {
  blur: number;
  fade: number;
  vignette: number;
};

export type DiveOverlayController = {
  update: (state: DiveOverlayState) => void;
  reset: () => void;
};

export type SceneTransitionOptions = {
  /** Pastikan texture panorama sudah di-cache/decode sebelum animasi */
  ensureReady: () => Promise<void>;
};

export function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function diveOverlayState(progress: number): DiveOverlayState {
  const p = Math.max(0, Math.min(1, progress));
  const peak = 0.58;
  const wave = p < peak ? p / peak : (1 - p) / (1 - peak);
  return {
    blur: wave * 18,
    fade: wave * 0.55,
    vignette: Math.sin(p * Math.PI) * 0.95,
  };
}

type DiveViewer = {
  stopAutoRotate?: () => void;
  setAutoRotate?: (speed: number) => void;
  lookAt: (pitch: number, yaw: number, hfov: number, duration?: number) => void;
  loadScene: (sceneId: string, pitch?: number, yaw?: number, hfov?: number) => void;
  getScene?: () => string;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
};

function waitPanoramaLoaded(viewer: DiveViewer, timeoutMs: number) {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      viewer.off?.("load", onLoad);
      resolve();
    };
    const onLoad = () => finish();
    viewer.on?.("load", onLoad);
    window.setTimeout(finish, timeoutMs);
  });
}

function runOverlayAnimation(
  overlay: DiveOverlayController,
  durationMs: number,
  onFrame?: (t: number) => void
) {
  return new Promise<void>((resolve) => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      overlay.update(diveOverlayState(t));
      onFrame?.(t);
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

export async function diveIntoScene(
  viewer: DiveViewer,
  targetSceneId: string,
  hotspotPitch: number,
  hotspotYaw: number,
  overlay: DiveOverlayController,
  options: SceneTransitionOptions,
  onSceneChange?: (sceneId: string) => void
) {
  if (viewer.getScene?.() === targetSceneId) return;

  // 1) Render/cache di belakang layar — tanpa animasi dulu
  await options.ensureReady();

  viewer.stopAutoRotate?.();

  const entryPitch = Math.max(-8, Math.min(8, hotspotPitch * 0.12));
  const totalOverlayMs = SCENE_FADE_MS * 0.55;
  let swapped = false;

  const loadDone = waitPanoramaLoaded(viewer, SCENE_FADE_MS + 800);

  const overlayPromise = runOverlayAnimation(overlay, totalOverlayMs, (t) => {
    const elapsedMs = t * totalOverlayMs;
    if (!swapped && elapsedMs >= SCENE_SWAP_MS) {
      swapped = true;
      viewer.loadScene(targetSceneId, entryPitch, hotspotYaw, SCENE_ENTRY_HFOV);
      onSceneChange?.(targetSceneId);
    }
  });

  await Promise.all([overlayPromise, loadDone]);

  overlay.reset();
  viewer.stopAutoRotate?.();
}

export async function softCrossfadeScene(
  viewer: DiveViewer,
  targetSceneId: string,
  overlay: DiveOverlayController,
  options: SceneTransitionOptions
) {
  if (viewer.getScene?.() === targetSceneId) return;

  await options.ensureReady();

  const start = { blur: 8, fade: 0.28, vignette: 0.3 };
  overlay.update(start);

  viewer.loadScene(targetSceneId);
  await waitPanoramaLoaded(viewer, SCENE_FADE_MS + 600);

  await new Promise<void>((resolve) => {
    const animStart = performance.now();
    const duration = 520;
    const tick = (now: number) => {
      const t = Math.min(1, (now - animStart) / duration);
      const k = 1 - easeInOutCubic(t);
      overlay.update({
        blur: start.blur * k,
        fade: start.fade * k,
        vignette: start.vignette * k,
      });
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });

  overlay.reset();
}
