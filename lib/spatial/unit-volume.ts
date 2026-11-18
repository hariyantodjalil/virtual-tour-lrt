import type { SpatialEntity, SphericalPoint, Vec3 } from "./types";
import { add, cross, dirToSpherical, dot, normalize, scale, sphericalToDir } from "./geometry/spherical";

/**
 * Volume 3D unit di dalam panorama, dibangun dari dimensi data tenant (P × L × T).
 *
 * Model: kamera 360° berada di titik asal pada ketinggian `cameraHeightM` di atas lantai datar.
 * Titik penanda yang diketahui ketinggiannya bisa dikembalikan ke posisi 3D-nya dengan memotong
 * sinarnya pada bidang datar setinggi itu. Dari posisi itu kotak berukuran asli dibangun, lalu setiap
 * sudutnya dikembalikan ke koordinat bola (yaw/pitch) agar bisa diproyeksikan oleh pipeline overlay
 * yang sama dengan Spatial Area. Rusuk lurus 3D jatuh tepat di lingkaran besar bola, jadi subdivisi
 * short-arc pada clipping tetap akurat.
 *
 * - Spatial Area: dua titik terbawah polygon dianggap rusuk bawah muka depan, menempel di lantai.
 * - Pin unit: titik pin dianggap pusat muka depan (setengah tinggi unit), sama seperti kotak
 *   putus-putus lama yang digambar berpusat di pin.
 */

/** Tinggi tripod kamera 360° yang umum dipakai; dapat diatur per scene di kemudian hari. */
export const DEFAULT_CAMERA_HEIGHT_M = 1.6;
/** Batas jarak wajar dari kamera; lebih jauh dari ini penanda dianggap tidak bisa diukur. */
const MAX_DISTANCE_M = 40;
/** Sinar yang terlalu landai terhadap bidang potong menghasilkan jarak yang tidak stabil. */
const MIN_RAY_SLOPE = Math.sin((1 * Math.PI) / 180);
/** Dua titik bawah yang lebih dekat dari ini tidak cukup untuk menentukan arah muka unit. */
const MIN_EDGE_M = 0.2;
/** Pin yang terlalu dekat horizon tidak bisa diukur jaraknya; unit diletakkan di jarak ini searah pin. */
export const PIN_FALLBACK_DISTANCE_M = 6;
/** Hasil ukur pin lebih jauh dari ini dianggap tidak andal dan memakai jarak cadangan. */
const PIN_MAX_DISTANCE_M = 25;
const PIN_ENTITY_PREFIX = "pin-volume:";

export type UnitVolumeDimensions = {
  lengthM?: number | null;
  widthM?: number | null;
  heightM?: number | null;
};

export type UnitVolumeFace = {
  key: "floor" | "front" | "back" | "left" | "right" | "top";
  vertices: SphericalPoint[];
  /** true bila sisi menghadap kamera (digambar solid); false = sisi belakang (garis putus-putus). */
  facesCamera: boolean;
};

type CompleteDimensions = { lengthM: number; widthM: number; heightM: number };

function completeDimensions(dimensions: UnitVolumeDimensions): CompleteDimensions | null {
  const { lengthM, widthM, heightM } = dimensions;
  if (!lengthM || !widthM || !heightM || lengthM <= 0 || widthM <= 0 || heightM <= 0) return null;
  return { lengthM, widthM, heightM };
}

/** Titik 3D tempat sinar penanda memotong bidang datar setinggi `heightAboveFloorM`. */
function pointAtHeight(point: SphericalPoint, heightAboveFloorM: number, cameraHeightM: number): Vec3 | null {
  const dir = sphericalToDir(point);
  if (Math.abs(dir.y) < MIN_RAY_SLOPE) return null;
  const t = (heightAboveFloorM - cameraHeightM) / dir.y;
  if (!Number.isFinite(t) || t <= 0) return null;
  const p = scale(dir, t);
  return Math.hypot(p.x, p.z) > MAX_DISTANCE_M ? null : p;
}

/** Putar vektor horizontal mengelilingi sumbu vertikal (derajat, searah jarum jam dilihat dari atas). */
function rotateAboutUp(v: Vec3, degrees: number): Vec3 {
  const r = (degrees * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
}

/**
 * Kotak dari pusat rusuk bawah muka depan. Panjang sejajar `along` (default: muka depan menghadap
 * kamera), lebar mengarah menjauhi kamera, tinggi ke atas. `rotationDeg` memutar kotak pada pusat
 * alasnya agar admin bisa menyamakan arah unit dengan foto.
 */
function buildBox(anchor: Vec3, along: Vec3 | null, dims: CompleteDimensions, rotationDeg = 0): UnitVolumeFace[] {
  const up: Vec3 = { x: 0, y: 1, z: 0 };
  const towardCamera = normalize({ x: -anchor.x, y: 0, z: -anchor.z });
  let lateral = along ?? normalize(cross(up, towardCamera));
  let depth = normalize(cross(up, lateral));
  if (dot(depth, towardCamera) > 0) depth = scale(depth, -1);

  let origin = anchor;
  if (rotationDeg) {
    const center = add(anchor, scale(depth, dims.widthM / 2));
    lateral = rotateAboutUp(lateral, rotationDeg);
    depth = rotateAboutUp(depth, rotationDeg);
    origin = add(center, scale(depth, -dims.widthM / 2));
  }

  const corner = (a: number, d: number, h: number) =>
    add(add(add(origin, scale(lateral, a)), scale(depth, d)), scale(up, h));
  const halfL = dims.lengthM / 2;
  const W = dims.widthM;
  const H = dims.heightM;
  const quads: Record<UnitVolumeFace["key"], Vec3[]> = {
    floor: [corner(-halfL, 0, 0), corner(halfL, 0, 0), corner(halfL, W, 0), corner(-halfL, W, 0)],
    front: [corner(-halfL, 0, 0), corner(halfL, 0, 0), corner(halfL, 0, H), corner(-halfL, 0, H)],
    back: [corner(-halfL, W, 0), corner(halfL, W, 0), corner(halfL, W, H), corner(-halfL, W, H)],
    left: [corner(-halfL, 0, 0), corner(-halfL, W, 0), corner(-halfL, W, H), corner(-halfL, 0, H)],
    right: [corner(halfL, 0, 0), corner(halfL, W, 0), corner(halfL, W, H), corner(halfL, 0, H)],
    top: [corner(-halfL, 0, H), corner(halfL, 0, H), corner(halfL, W, H), corner(-halfL, W, H)],
  };
  const outward: Record<UnitVolumeFace["key"], Vec3> = {
    floor: scale(up, -1),
    top: up,
    front: scale(depth, -1),
    back: depth,
    left: scale(lateral, -1),
    right: lateral,
  };

  // Gambar dari yang terjauh ke terdekat supaya sisi depan menimpa sisi belakang.
  const order: UnitVolumeFace["key"][] = ["floor", "back", "left", "right", "front", "top"];
  return order.map((key) => {
    const points = quads[key];
    const centroid = scale(points.reduce((sum, p) => add(sum, p), { x: 0, y: 0, z: 0 }), 1 / points.length);
    // Kamera di titik asal: sisi menghadap kamera bila normal luar searah vektor sisi → kamera.
    // Alas selalu tampil solid: kamera berada di atas lantai, jadi jejak unit terlihat menembus
    // dinding transparan dan menjadi petunjuk kedalaman utama saat unit menghadap lurus ke kamera.
    const facesCamera = key === "floor" || dot(outward[key], scale(centroid, -1)) > 0;
    return { key, vertices: points.map(dirToSpherical), facesCamera };
  });
}

/**
 * Volume dari polygon Spatial Area: dua titik terbawah = rusuk bawah muka depan di lantai.
 * Mengembalikan null bila dimensi belum lengkap atau penanda tidak menyentuh lantai.
 */
export function buildUnitVolume(
  polygon: SphericalPoint[],
  dimensions: UnitVolumeDimensions,
  cameraHeightM = DEFAULT_CAMERA_HEIGHT_M
): UnitVolumeFace[] | null {
  const dims = completeDimensions(dimensions);
  if (!dims || polygon.length < 3) return null;

  const lowest = [...polygon].sort((a, b) => a.pitch - b.pitch).slice(0, 2);
  const floor = lowest.map((p) => pointAtHeight(p, 0, cameraHeightM));
  if (!floor[0]) return null;

  const anchor = floor[1] ? scale(add(floor[0], floor[1]), 0.5) : floor[0];
  let along: Vec3 | null = null;
  if (floor[1]) {
    const edge = { x: floor[1].x - floor[0].x, y: 0, z: floor[1].z - floor[0].z };
    if (Math.hypot(edge.x, edge.z) >= MIN_EDGE_M) along = normalize(edge);
  }
  return buildBox(anchor, along, dims);
}

/**
 * Cara meletakkan volume pin:
 * - "floor": unit berdiri di lantai (ruang komersial stasiun), jarak diukur dari tinggi kamera;
 * - "distance": media menempel/tergantung di kabin (train space: handgrip, panel, pintu), diletakkan
 *   pada jarak tetap searah pin karena tidak menyentuh lantai.
 */
export type PinPlacement = { mode: "floor" } | { mode: "distance"; distanceM: number };

/** Jarak umum media di kabin kereta LRT dari posisi kamera (lebar kabin ±2,6 m). */
export const TRAIN_MEDIA_DISTANCE_M = 1.8;

/** Titik di arah `point` dengan jarak horizontal `distanceM` dari kamera. */
function pointAtDistance(point: SphericalPoint, distanceM: number): Vec3 | null {
  const dir = sphericalToDir(point);
  const horizontal = Math.hypot(dir.x, dir.z);
  if (horizontal < 0.05) return null;
  return scale(dir, distanceM / horizontal);
}

/** Batas pengaturan manual volume pin di editor CMS. */
export const PIN_VOLUME_DISTANCE_MIN_M = 0.5;
export const PIN_VOLUME_DISTANCE_MAX_M = 30;

/**
 * Penyesuaian volume pin oleh admin (disimpan per hotspot):
 * - rotationDeg: arah hadap unit, 0 = muka depan menghadap kamera;
 * - distanceM: jarak horizontal dari kamera, menggantikan perkiraan otomatis.
 */
export type PinVolumeOptions = {
  placement?: PinPlacement;
  rotationDeg?: number;
  distanceM?: number;
};

/**
 * Volume dari pin unit: titik pin = pusat muka depan pada setengah tinggi unit.
 * Jarak memakai pengaturan manual bila ada; bila tidak, unit berdiri di lantai bila pin bisa diukur
 * (mode "floor"), atau diletakkan di jarak cadangan searah pin (pin di horizon, media kereta).
 */
export function buildPinVolume(
  pin: SphericalPoint,
  dimensions: UnitVolumeDimensions,
  options: PinVolumeOptions = {},
  cameraHeightM = DEFAULT_CAMERA_HEIGHT_M
): UnitVolumeFace[] | null {
  const dims = completeDimensions(dimensions);
  if (!dims) return null;
  const placement = options.placement ?? { mode: "floor" };
  const manual =
    options.distanceM && options.distanceM > 0
      ? Math.min(PIN_VOLUME_DISTANCE_MAX_M, Math.max(PIN_VOLUME_DISTANCE_MIN_M, options.distanceM))
      : null;
  // Unit lantai dengan jarak manual: tetap berdiri di lantai, digeser maju/mundur searah pin.
  if (manual !== null && placement.mode === "floor") {
    const ahead = pointAtDistance({ yaw: pin.yaw, pitch: 0 }, manual);
    if (!ahead) return null;
    return buildBox({ x: ahead.x, y: -cameraHeightM, z: ahead.z }, null, dims, options.rotationDeg ?? 0);
  }
  const measured =
    manual === null && placement.mode === "floor" ? pointAtHeight(pin, dims.heightM / 2, cameraHeightM) : null;
  const center =
    measured && Math.hypot(measured.x, measured.z) <= PIN_MAX_DISTANCE_M
      ? measured
      : pointAtDistance(
          pin,
          manual ?? (placement.mode === "distance" ? placement.distanceM : PIN_FALLBACK_DISTANCE_M)
        );
  if (!center) return null;
  return buildBox(
    { x: center.x, y: center.y - dims.heightM / 2, z: center.z },
    null,
    dims,
    options.rotationDeg ?? 0
  );
}

// ─── Entitas overlay ──────────────────────────────────────────────────────────

/** true bila pin unit bisa digambar sebagai volume (dimensi lengkap; pin tidak tegak lurus ke atas/bawah). */
export function canBuildPinVolume(
  pin: SphericalPoint,
  dimensions: UnitVolumeDimensions | undefined,
  options?: PinVolumeOptions
) {
  return !!dimensions && buildPinVolume(pin, dimensions, options) !== null;
}

/** Pengaturan volume dari data hotspot pin (arah & jarak yang diatur admin di editor). */
export function pinVolumeOptions(
  hotspot: { volumeRotation?: number; volumeDistance?: number },
  placement?: PinPlacement
): PinVolumeOptions {
  return { placement, rotationDeg: hotspot.volumeRotation, distanceM: hotspot.volumeDistance };
}

/** Pengaturan volume per entitas pin sintetis; WeakMap agar ikut terbuang bersama entitasnya. */
const pinOptionsByEntity = new WeakMap<SpatialEntity, PinVolumeOptions>();

/** Entitas overlay sintetis agar pin unit berdimensi digambar oleh SpatialOverlay sebagai volume 3D. */
export function pinVolumeEntity(
  sceneId: string,
  index: number,
  pin: SphericalPoint & { spaceCode: string; label?: string },
  options: PinVolumeOptions = {}
): SpatialEntity {
  const entity: SpatialEntity = {
    id: `${PIN_ENTITY_PREFIX}${sceneId}:${index}`,
    kind: "SPATIAL_AREA",
    sceneId,
    unitId: null,
    spaceCode: pin.spaceCode,
    label: pin.label,
    // Polygon kecil di sekitar pin hanya dipakai sebagai cadangan; titik pin ada di vertex pertama.
    geometry: {
      type: "spherical_polygon",
      vertices: [
        { yaw: pin.yaw, pitch: pin.pitch },
        { yaw: pin.yaw + 0.5, pitch: pin.pitch - 0.5 },
        { yaw: pin.yaw - 0.5, pitch: pin.pitch - 0.5 },
      ],
    },
    style: {},
    action: { type: "unit_detail" },
    enabled: true,
    schemaVersion: 1,
    revision: 0,
  };
  pinOptionsByEntity.set(entity, options);
  return entity;
}

/** Entitas sintetis dari pin unit — diwarnai sesuai status unit seperti kotak pin lama. */
export function isPinVolumeEntity(entity: SpatialEntity) {
  return entity.id.startsWith(PIN_ENTITY_PREFIX);
}

/** Volume untuk entitas overlay mana pun: pin sintetis memakai titik pin, Spatial Area memakai polygon. */
export function buildEntityVolume(entity: SpatialEntity, dimensions: UnitVolumeDimensions) {
  if (entity.geometry.type !== "spherical_polygon") return null;
  const vertices = entity.geometry.vertices;
  if (!isPinVolumeEntity(entity)) return buildUnitVolume(vertices, dimensions);
  return buildPinVolume(vertices[0], dimensions, pinOptionsByEntity.get(entity));
}
