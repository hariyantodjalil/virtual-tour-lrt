import type { CameraState, ScreenPoint, SphericalPoint, Vec3 } from "../types";
import {
  cameraBasis,
  dirToSpherical,
  dot,
  normalize,
  rad,
  sphericalToDir,
} from "./spherical";

/** Near-plane: titik di belakang / terlalu dekat kamera disembunyikan. */
export const NEAR_EPSILON = 0.08;

export function projectPoint(
  point: SphericalPoint,
  camera: CameraState
): ScreenPoint | null {
  const v = sphericalToDir(point);
  const { forward, right, up } = cameraBasis(camera.yawDeg, camera.pitchDeg);
  const depth = dot(v, forward);
  if (depth <= NEAR_EPSILON) return null;

  const halfW = camera.widthCssPx / 2;
  const halfH = camera.heightCssPx / 2;
  if (halfW < 1 || halfH < 1) return null;

  const focal = halfW / Math.tan(rad(camera.hfovDeg) / 2);
  const x = halfW + (focal * dot(v, right)) / depth;
  const y = halfH - (focal * dot(v, up)) / depth;

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  // Cull proyeksi meledak (R2 giant triangle) — di luar margin viewport
  const margin = Math.max(camera.widthCssPx, camera.heightCssPx) * 1.25;
  if (
    x < -margin ||
    y < -margin ||
    x > camera.widthCssPx + margin ||
    y > camera.heightCssPx + margin
  ) {
    return null;
  }
  return { x, y };
}

/** Inverse: layar CSS → arah spherical (untuk harness round-trip). */
export function unprojectPoint(
  screen: ScreenPoint,
  camera: CameraState
): SphericalPoint | null {
  const halfW = camera.widthCssPx / 2;
  const halfH = camera.heightCssPx / 2;
  if (halfW < 1 || halfH < 1) return null;

  const focal = halfW / Math.tan(rad(camera.hfovDeg) / 2);
  if (focal <= 0 || !Number.isFinite(focal)) return null;

  const nx = (screen.x - halfW) / focal;
  const ny = (halfH - screen.y) / focal;
  const { forward, right, up } = cameraBasis(camera.yawDeg, camera.pitchDeg);

  const dir: Vec3 = normalize({
    x: forward.x + nx * right.x + ny * up.x,
    y: forward.y + nx * right.y + ny * up.y,
    z: forward.z + nx * right.z + ny * up.z,
  });

  return dirToSpherical(dir);
}

/** Jarak Euclidean CSS px antara dua screen point. */
export function screenDistance(a: ScreenPoint, b: ScreenPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
