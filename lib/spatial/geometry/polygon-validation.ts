import type { SphericalPoint } from "../types";
import { angularDiffDeg, normalizeYaw, sphericalToDir, dot } from "./spherical";

export const MIN_VERTICES = 3;
export const MAX_VERTICES = 64;
export const MIN_EDGE_DEG = 0.15;
/** Span yaw antar vertex — longgar agar outline ruko yang wrap sudut tetap lolos. */
export const MAX_SPAN_DEG = 160;
/** Vertex yang jauh dari centroid cluster (klik meleset) — picu “melencong”. */
export const OUTLIER_MIN_DEG = 32;
export const OUTLIER_MEDIAN_FACTOR = 2.8;

export type PolygonValidationResult =
  | { ok: true; vertices: SphericalPoint[] }
  | { ok: false; reason: string };

function almostSame(a: SphericalPoint, b: SphericalPoint): boolean {
  return (
    Math.abs(angularDiffDeg(a.yaw, b.yaw)) < MIN_EDGE_DEG &&
    Math.abs(a.pitch - b.pitch) < MIN_EDGE_DEG
  );
}

/** Approximate self-intersection via 2D unwrap around centroid yaw (MVP). */
function hasSelfIntersection(verts: SphericalPoint[]): boolean {
  if (verts.length < 4) return false;
  const cy = verts.reduce((s, v) => s + angularDiffDeg(v.yaw, verts[0].yaw), 0) / verts.length;
  const base = verts[0].yaw;
  const pts = verts.map((v) => ({
    x: angularDiffDeg(v.yaw, base) - cy,
    y: v.pitch,
  }));

  const n = pts.length;
  const orient = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) => {
    const v = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
    if (Math.abs(v) < 1e-9) return 0;
    return v > 0 ? 1 : 2;
  };
  const onSeg = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number }
  ) =>
    Math.min(a.x, b.x) - 1e-9 <= c.x &&
    c.x <= Math.max(a.x, b.x) + 1e-9 &&
    Math.min(a.y, b.y) - 1e-9 <= c.y &&
    c.y <= Math.max(a.y, b.y) + 1e-9;

  const intersects = (
    p1: { x: number; y: number },
    q1: { x: number; y: number },
    p2: { x: number; y: number },
    q2: { x: number; y: number }
  ) => {
    const o1 = orient(p1, q1, p2);
    const o2 = orient(p1, q1, q2);
    const o3 = orient(p2, q2, p1);
    const o4 = orient(p2, q2, q1);
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSeg(p1, q1, p2)) return true;
    if (o2 === 0 && onSeg(p1, q1, q2)) return true;
    if (o3 === 0 && onSeg(p2, q2, p1)) return true;
    if (o4 === 0 && onSeg(p2, q2, q1)) return true;
    return false;
  };

  for (let i = 0; i < n; i++) {
    const a1 = pts[i];
    const a2 = pts[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      if ((j + 1) % n === i) continue;
      const b1 = pts[j];
      const b2 = pts[(j + 1) % n];
      if (intersects(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

function approximateArea(verts: SphericalPoint[]): number {
  // Shoelace on unwrapped yaw/pitch
  const base = verts[0].yaw;
  const pts = verts.map((v) => ({ x: angularDiffDeg(v.yaw, base), y: v.pitch }));
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

export function validateSphericalPolygon(
  raw: SphericalPoint[]
): PolygonValidationResult {
  if (!Array.isArray(raw)) return { ok: false, reason: "Vertices harus array" };
  if (raw.length < MIN_VERTICES) {
    return { ok: false, reason: `Minimal ${MIN_VERTICES} vertex` };
  }
  if (raw.length > MAX_VERTICES) {
    return { ok: false, reason: `Maksimal ${MAX_VERTICES} vertex` };
  }

  const vertices: SphericalPoint[] = [];
  for (const v of raw) {
    if (
      typeof v?.yaw !== "number" ||
      typeof v?.pitch !== "number" ||
      !Number.isFinite(v.yaw) ||
      !Number.isFinite(v.pitch)
    ) {
      return { ok: false, reason: "Yaw/pitch harus angka finite" };
    }
    if (Math.abs(v.pitch) > 89.9) {
      return { ok: false, reason: "Pitch di luar rentang aman (±89.9°)" };
    }
    const next = { yaw: normalizeYaw(v.yaw), pitch: v.pitch };
    if (vertices.length && almostSame(vertices[vertices.length - 1], next)) {
      continue; // drop duplikat berurutan
    }
    vertices.push(next);
  }

  if (vertices.length >= 2 && almostSame(vertices[0], vertices[vertices.length - 1])) {
    vertices.pop();
  }
  if (vertices.length < MIN_VERTICES) {
    return { ok: false, reason: "Vertex unik kurang dari 3" };
  }

  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 2; j < vertices.length; j++) {
      if (i === 0 && j === vertices.length - 1) continue;
      if (almostSame(vertices[i], vertices[j])) {
        return { ok: false, reason: "Vertex duplikat non-adjacent" };
      }
    }
  }

  // Span check: max angular distance from first vertex
  const origin = sphericalToDir(vertices[0]);
  for (const v of vertices) {
    const d = Math.acos(Math.max(-1, Math.min(1, dot(origin, sphericalToDir(v)))));
    const ang = (d * 180) / Math.PI;
    if (ang > MAX_SPAN_DEG) {
      return {
        ok: false,
        reason: `Polygon terlalu lebar untuk MVP (>${MAX_SPAN_DEG}°)`,
      };
    }
  }

  if (approximateArea(vertices) < 0.05) {
    return { ok: false, reason: "Area polygon terlalu kecil / degenerate" };
  }

  if (hasSelfIntersection(vertices)) {
    return { ok: false, reason: "Polygon self-intersecting ditolak" };
  }

  return { ok: true, vertices };
}

/** Validasi ketat untuk commit/edit authoring — tolak titik meleset (melencong). */
export function validateSphericalPolygonAuthoring(
  raw: SphericalPoint[]
): PolygonValidationResult {
  const base = validateSphericalPolygon(raw);
  if (!base.ok) return base;
  const outlier = findOutlierVertexIndex(base.vertices);
  if (outlier != null) {
    return {
      ok: false,
      reason: `Titik #${outlier + 1} terlalu jauh dari outline (melencong). Hapus titik terakhir (Backspace), atau drag handle yang meleset kembali ke sudut unit.`,
    };
  }
  return base;
}

function angularDistanceDeg(a: SphericalPoint, b: SphericalPoint): number {
  const c = Math.max(-1, Math.min(1, dot(sphericalToDir(a), sphericalToDir(b))));
  return (Math.acos(c) * 180) / Math.PI;
}

/**
 * Index vertex yang menyentuh edge “melencong” (jauh lebih panjang dari median edge).
 * Cocok untuk klik ke-4/ke-5 yang meleset jauh dari kotak unit.
 */
export function findOutlierVertexIndex(verts: SphericalPoint[]): number | null {
  if (verts.length < 4) return null;
  const n = verts.length;
  const edgeLens: number[] = [];
  for (let i = 0; i < n; i++) {
    edgeLens.push(angularDistanceDeg(verts[i]!, verts[(i + 1) % n]!));
  }
  const sorted = [...edgeLens].sort((a, b) => a - b);
  // Baseline = median setengah edge terpendek (tahan terhadap 1–2 edge melencong)
  const lower = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
  const baseline = lower[Math.floor(lower.length / 2)] ?? 0;
  const threshold = Math.max(OUTLIER_MIN_DEG, baseline * OUTLIER_MEDIAN_FACTOR + 8);

  let worstEdge = -1;
  let worstLen = 0;
  for (let i = 0; i < n; i++) {
    const len = edgeLens[i] ?? 0;
    if (len > worstLen) {
      worstLen = len;
      worstEdge = i;
    }
  }
  if (worstEdge < 0 || worstLen <= threshold) return null;

  const a = worstEdge;
  const b = (worstEdge + 1) % n;
  const score = (i: number) => {
    const prev = verts[(i - 1 + n) % n]!;
    const next = verts[(i + 1) % n]!;
    return angularDistanceDeg(verts[i]!, prev) + angularDistanceDeg(verts[i]!, next);
  };
  return score(a) >= score(b) ? a : b;
}
