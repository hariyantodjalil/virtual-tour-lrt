import type { SphericalPoint, Vec3 } from "../types";

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export function rad(deg: number): number {
  return deg * DEG2RAD;
}

export function deg(radians: number): number {
  return radians * RAD2DEG;
}

/** Normalisasi yaw ke [-180, 180). */
export function normalizeYaw(yaw: number): number {
  if (!Number.isFinite(yaw)) return NaN;
  return ((yaw % 360) + 540) % 360 - 180;
}

/** Selisih sudut terkecil (derajat), hasil di (-180, 180]. */
export function angularDiffDeg(a: number, b: number): number {
  return normalizeYaw(a - b);
}

export function clampPitch(pitch: number): number {
  return Math.max(-89.9, Math.min(89.9, pitch));
}

/** yaw=0 → +Z, yaw+ → +X, pitch+ → +Y (referensi spek / Pannellum equirect). */
export function sphericalToDir({ yaw, pitch }: SphericalPoint): Vec3 {
  const y = rad(yaw);
  const p = rad(pitch);
  return {
    x: Math.cos(p) * Math.sin(y),
    y: Math.sin(p),
    z: Math.cos(p) * Math.cos(y),
  };
}

export function dirToSpherical(v: Vec3): SphericalPoint {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  const x = v.x / len;
  const y = v.y / len;
  const z = v.z / len;
  return {
    yaw: normalizeYaw(deg(Math.atan2(x, z))),
    pitch: clampPitch(deg(Math.asin(Math.max(-1, Math.min(1, y))))),
  };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function scale(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/** Interpolasi short-arc pada unit sphere (slerp-ish linear + renorm). */
export function slerpDir(a: Vec3, b: Vec3, t: number): Vec3 {
  const d = Math.max(-1, Math.min(1, dot(normalize(a), normalize(b))));
  const omega = Math.acos(d);
  if (!Number.isFinite(omega) || omega < 1e-6) {
    return normalize(add(scale(a, 1 - t), scale(b, t)));
  }
  const so = Math.sin(omega);
  return normalize(
    add(scale(a, Math.sin((1 - t) * omega) / so), scale(b, Math.sin(t * omega) / so))
  );
}

export function cameraBasis(yawDeg: number, pitchDeg: number): {
  forward: Vec3;
  right: Vec3;
  up: Vec3;
} {
  const a = rad(yawDeg);
  const b = rad(pitchDeg);
  const forward = {
    x: Math.cos(b) * Math.sin(a),
    y: Math.sin(b),
    z: Math.cos(b) * Math.cos(a),
  };
  const right = { x: Math.cos(a), y: 0, z: -Math.sin(a) };
  const up = cross(forward, right);
  return { forward, right, up: normalize(up) };
}
