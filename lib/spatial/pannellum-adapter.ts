import type { CameraState, SphericalPoint } from "./types";

type RenderedPose = Pick<CameraState, "pitchDeg" | "yawDeg" | "hfovDeg">;
type FrameListener = (pose: RenderedPose) => void;
type PannellumRendererLike = {
  render(pitch: number, yaw: number, hfov: number, options?: unknown): unknown;
};
type RenderHook = {
  original: PannellumRendererLike["render"];
  wrapped: PannellumRendererLike["render"];
  listeners: Set<FrameListener>;
  lastPose: () => RenderedPose | null;
};
const renderHooks = new WeakMap<PannellumRendererLike, RenderHook>();

function subscribeRenderedPose(renderer: PannellumRendererLike, listener: FrameListener) {
  let hook = renderHooks.get(renderer);
  if (!hook) {
    const original = renderer.render;
    const listeners = new Set<FrameListener>();
    let last: RenderedPose | null = null;
    const wrapped: PannellumRendererLike["render"] = function (this: PannellumRendererLike, pitch, yaw, hfov, options) {
      const result = original.call(this, pitch, yaw, hfov, options);
      if ([pitch, yaw, hfov].every(Number.isFinite)) {
        last = { pitchDeg: pitch * 180 / Math.PI, yawDeg: yaw * 180 / Math.PI, hfovDeg: hfov * 180 / Math.PI };
        for (const subscriber of listeners) subscriber(last);
      }
      return result;
    };
    hook = { original, wrapped, listeners, lastPose: () => last };
    renderHooks.set(renderer, hook);
    renderer.render = wrapped;
  }
  const active = hook;
  active.listeners.add(listener);
  return {
    lastPose: active.lastPose,
    dispose: () => {
      active.listeners.delete(listener);
      if (active.listeners.size) return;
      // Preserve any later hook installed by a different consumer.
      if (renderer.render === active.wrapped) renderer.render = active.original;
      renderHooks.delete(renderer);
    },
  };
}

/** Minimal surface untuk viewer Pannellum yang dipakai overlay. */
export type PannellumViewerLike = {
  getYaw?: () => number;
  getPitch?: () => number;
  getHfov?: () => number;
  getRenderer?: () => PannellumRendererLike | undefined;
  mouseEventToCoords?: (e: MouseEvent | PointerEvent) => [number, number];
  resize?: () => void;
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
  off?: (event: string, cb: (...args: unknown[]) => void) => void;
};

export function readCameraState(
  viewer: PannellumViewerLike | null | undefined,
  container: HTMLElement | null | undefined
): CameraState | null {
  if (!viewer || !container) return null;
  try {
    const rect = container.getBoundingClientRect();
    const width = container.clientWidth || rect.width;
    const height = container.clientHeight || rect.height;
    if (width < 1 || height < 1) return null;
    const yaw = Number(viewer.getYaw?.());
    const pitch = Number(viewer.getPitch?.());
    const hfov = Number(viewer.getHfov?.());
    if (![yaw, pitch, hfov].every(Number.isFinite)) return null;
    return {
      yawDeg: yaw,
      pitchDeg: pitch,
      hfovDeg: hfov,
      widthCssPx: width,
      heightCssPx: height,
    };
  } catch {
    return null;
  }
}

/** Official Pannellum: mouseEventToCoords → [pitch, yaw]. */
export function mouseEventToSpherical(
  viewer: PannellumViewerLike,
  e: MouseEvent | PointerEvent
): SphericalPoint | null {
  try {
    const coords = viewer.mouseEventToCoords?.(e);
    if (!coords || coords.length < 2) return null;
    const pitch = Number(coords[0]);
    const yaw = Number(coords[1]);
    if (!Number.isFinite(pitch) || !Number.isFinite(yaw)) return null;
    return { yaw, pitch };
  } catch {
    return null;
  }
}

export function cameraStateChanged(
  a: CameraState | null,
  b: CameraState | null,
  epsilon = 0.02
): boolean {
  if (!a || !b) return a !== b;
  return (
    Math.abs(a.yawDeg - b.yawDeg) > epsilon ||
    Math.abs(a.pitchDeg - b.pitchDeg) > epsilon ||
    Math.abs(a.hfovDeg - b.hfovDeg) > epsilon ||
    Math.abs(a.widthCssPx - b.widthCssPx) > 0.5 ||
    Math.abs(a.heightCssPx - b.heightCssPx) > 0.5
  );
}

/**
 * Follow the pose actually rendered by Pannellum, not its next animation target.
 * Commit in a microtask before paint; retain rAF for adapters without a renderer.
 */
export function startCameraSync(options: {
  getViewer: () => PannellumViewerLike | null;
  getContainer: () => HTMLElement | null;
  onFrame: (camera: CameraState) => void;
}): () => void {
  let raf = 0;
  let last: CameraState | null = null;
  let alive = true;
  let pending: CameraState | null = null;
  let queued = false;

  const publish = (camera: CameraState | null) => {
    if (!alive || !camera) return;
    pending = camera;
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!alive || !pending || !cameraStateChanged(last, pending, 1e-6)) return;
      last = pending;
      options.onFrame(pending);
    });
  };
  const onRenderedPose = (pose: RenderedPose) => {
    const container = options.getContainer();
    if (!container || container.clientWidth < 1 || container.clientHeight < 1) return;
    publish({ ...pose, widthCssPx: container.clientWidth, heightCssPx: container.clientHeight });
  };
  const renderer = options.getViewer()?.getRenderer?.();
  const subscription = renderer && typeof renderer.render === "function"
    ? subscribeRenderedPose(renderer, onRenderedPose)
    : null;

  const tick = () => {
    if (!alive) return;
    const pose = subscription?.lastPose();
    if (pose) onRenderedPose(pose);
    else publish(readCameraState(options.getViewer(), options.getContainer()));
    if (!subscription) raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);

  const container = options.getContainer();
  let ro: ResizeObserver | null = null;
  if (container && typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => {
      last = null;
      const viewer = options.getViewer();
      try {
        viewer?.resize?.();
      } catch {
        /* ignore */
      }
      const pose = subscription?.lastPose();
      if (pose) onRenderedPose(pose);
      else publish(readCameraState(options.getViewer(), options.getContainer()));
    });
    ro.observe(container);
  }

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    subscription?.dispose();
    ro?.disconnect();
  };
}
