import type { CameraState, ScreenPoint, SphericalPoint, Vec3 } from "../types";
import { NEAR_EPSILON } from "./projection";
import {
  add,
  cameraBasis,
  dirToSpherical,
  dot,
  normalize,
  rad,
  scale,
  slerpDir,
  sphericalToDir,
} from "./spherical";

export type ProjectedFragment = {
  points: ScreenPoint[];
  /** Semua vertex di dalam frustum viewport. */
  fullyVisible: boolean;
};

const DEFAULT_SUBDIV_DEG = 2.5;
const MAX_SUBDIV_POINTS = 128;
// Geometry is immutable in the editor. Reuse sphere tessellation while only the
// camera moves; WeakMap lets scene/undo data be reclaimed when no longer used.
const tessellationCache = new WeakMap<SphericalPoint[], { step: number; directions: Vec3[] }>();

function angleBetweenDirs(a: Vec3, b: Vec3): number {
  const d = Math.max(-1, Math.min(1, dot(normalize(a), normalize(b))));
  return (Math.acos(d) * 180) / Math.PI;
}

/** Subdivide edge short-arc agar kurva di zoom lebar tidak menjadi chord kasar. */
export function subdivideEdge(
  a: SphericalPoint,
  b: SphericalPoint,
  maxStepDeg = DEFAULT_SUBDIV_DEG
): SphericalPoint[] {
  const da = sphericalToDir(a);
  const db = sphericalToDir(b);
  const ang = angleBetweenDirs(da, db);
  if (ang < maxStepDeg || !Number.isFinite(ang)) return [a, b];
  const steps = Math.min(Math.ceil(ang / maxStepDeg), Math.floor(MAX_SUBDIV_POINTS / 2));
  const out: SphericalPoint[] = [a];
  for (let i = 1; i < steps; i++) {
    out.push(dirToSpherical(slerpDir(da, db, i / steps)));
  }
  out.push(b);
  return out;
}

/** Sutherland–Hodgman in direction space, before perspective division.
 * Keep intersection points unnormalized so subsequent planes use the same space.
 */
function clipRing(ring: Vec3[], distance: (point: Vec3) => number): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const da = distance(a);
    const db = distance(b);
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      out.push(add(a, scale(add(b, scale(a, -1)), t)));
    }
  }
  return out;
}

/**
 * Proyeksikan polygon spherical → fragment layar.
 * Vertex di belakang kamera dipotong di near-plane; jika seluruhnya di belakang → [].
 */
export function projectPolygonFragments(
  vertices: SphericalPoint[],
  camera: CameraState,
  options?: { subdivDeg?: number }
): ProjectedFragment[] {
  if (vertices.length < 3) return [];

  const subdivDeg = options?.subdivDeg ?? DEFAULT_SUBDIV_DEG;
  let tessellation = tessellationCache.get(vertices);
  if (!tessellation || tessellation.step !== subdivDeg) {
    const ring: SphericalPoint[] = [];
    for (let i = 0; i < vertices.length; i++) {
      const a = vertices[i];
      const b = vertices[(i + 1) % vertices.length];
      const edge = subdivideEdge(a, b, subdivDeg);
      for (let j = 0; j < edge.length - 1; j++) ring.push(edge[j]);
    }
    tessellation = { step: subdivDeg, directions: ring.map(sphericalToDir) };
    tessellationCache.set(vertices, tessellation);
  }
  if (tessellation.directions.length < 3) return [];

  const { forward, right, up } = cameraBasis(camera.yawDeg, camera.pitchDeg);
  const halfW = camera.widthCssPx / 2;
  const halfH = camera.heightCssPx / 2;
  const focal = halfW / Math.tan(rad(camera.hfovDeg) / 2);
  if (halfW < 1 || halfH < 1 || !Number.isFinite(focal) || focal <= 0) return [];
  const horizontal = halfW / focal;
  const vertical = halfH / focal;
  const planes = [
    (p: Vec3) => dot(p, forward) - NEAR_EPSILON,
    (p: Vec3) => horizontal * dot(p, forward) + dot(p, right),
    (p: Vec3) => horizontal * dot(p, forward) - dot(p, right),
    (p: Vec3) => vertical * dot(p, forward) + dot(p, up),
    (p: Vec3) => vertical * dot(p, forward) - dot(p, up),
  ];
  let clipped = tessellation.directions;
  const fullyVisible = clipped.every((p) => planes.every((plane) => plane(p) >= 0));
  for (const plane of planes) {
    clipped = clipRing(clipped, plane);
    if (clipped.length < 3) return [];
  }
  const points = clipped.map((p) => {
    const depth = dot(p, forward);
    return {
      x: Math.max(0, Math.min(camera.widthCssPx, halfW + focal * dot(p, right) / depth)),
      y: Math.max(0, Math.min(camera.heightCssPx, halfH - focal * dot(p, up) / depth)),
    };
  });
  if (points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return [];
  return [{ points, fullyVisible }];
}

/** SVG path `d` dari fragment (closed). */
export function fragmentToPathD(fragment: ProjectedFragment): string {
  if (fragment.points.length === 0) return "";
  const [first, ...rest] = fragment.points;
  let d = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;
  for (const p of rest) d += ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  return `${d} Z`;
}
