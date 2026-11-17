/**
 * Minimap denah per level tur.
 *
 * Denah bisa tampak atas maupun isometrik. Untuk isometrik, admin menandai 3 sudut lantai
 * (P0 = sudut acuan, P1 = ujung sisi pertama, P2 = ujung sisi kedua). Lantai datar yang digambar
 * miring adalah transformasi afin dari tampak atas, sehingga arah pandang kamera bisa diubah ke
 * arah di gambar dengan matriks M = [a/|a|, b/|b|] (a = P1-P0, b = P2-P0). Asumsinya kedua sisi
 * diperpendek sama besar, seperti pada gambar isometrik dan denah tampak atas.
 *
 * Semua koordinat disimpan dalam piksel gambar asli (width × height).
 */

export type MinimapPoint = { x: number; y: number };

export type MinimapPin = {
  x: number;
  y: number;
  /** Yaw panorama (derajat) saat arah dikalibrasi. */
  yawRef?: number;
  /** Arah di lantai (radian, ruang lantai terkalibrasi) yang sesuai dengan yawRef. */
  angleRef?: number;
};

export type LevelMinimap = {
  imageUrl: string;
  width: number;
  height: number;
  corners?: [MinimapPoint, MinimapPoint, MinimapPoint];
  pins: Record<string, MinimapPin>;
};

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parsePoint(raw: unknown): MinimapPoint | null {
  if (!raw || typeof raw !== "object") return null;
  const { x, y } = raw as Record<string, unknown>;
  return finite(x) && finite(y) ? { x, y } : null;
}

export function parseLevelMinimap(raw: unknown): LevelMinimap | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.imageUrl !== "string" || !data.imageUrl) return null;
  if (!finite(data.width) || !finite(data.height) || data.width <= 0 || data.height <= 0) return null;

  let corners: LevelMinimap["corners"];
  if (Array.isArray(data.corners) && data.corners.length === 3) {
    const pts = data.corners.map(parsePoint);
    if (pts.every(Boolean)) corners = pts as [MinimapPoint, MinimapPoint, MinimapPoint];
  }

  const pins: Record<string, MinimapPin> = {};
  if (data.pins && typeof data.pins === "object") {
    for (const [sceneId, value] of Object.entries(data.pins as Record<string, unknown>)) {
      const point = parsePoint(value);
      if (!point) continue;
      const { yawRef, angleRef } = value as Record<string, unknown>;
      pins[sceneId] = {
        ...point,
        ...(finite(yawRef) && finite(angleRef) ? { yawRef, angleRef } : {}),
      };
    }
  }

  return { imageUrl: data.imageUrl, width: data.width, height: data.height, corners, pins };
}

type Basis = { ax: number; ay: number; bx: number; by: number; det: number };

/** Matriks lantai → gambar. Tanpa kalibrasi dianggap denah tampak atas (identitas). */
export function floorBasis(map: Pick<LevelMinimap, "corners">): Basis {
  const corners = map.corners;
  if (corners) {
    const [p0, p1, p2] = corners;
    const ax = p1.x - p0.x;
    const ay = p1.y - p0.y;
    const bx = p2.x - p0.x;
    const by = p2.y - p0.y;
    const la = Math.hypot(ax, ay);
    const lb = Math.hypot(bx, by);
    if (la > 1 && lb > 1) {
      const basis = { ax: ax / la, ay: ay / la, bx: bx / lb, by: by / lb, det: 0 };
      basis.det = basis.ax * basis.by - basis.bx * basis.ay;
      // Sisi hampir sejajar → kalibrasi tidak bisa dipakai.
      if (Math.abs(basis.det) > 0.05) return basis;
    }
  }
  return { ax: 1, ay: 0, bx: 0, by: 1, det: 1 };
}

/** Arah di gambar (dx, dy piksel) → sudut di ruang lantai (radian). */
export function imageDirToFloorAngle(basis: Basis, dx: number, dy: number): number {
  const u = (basis.by * dx - basis.bx * dy) / basis.det;
  const v = (-basis.ay * dx + basis.ax * dy) / basis.det;
  return Math.atan2(v, u);
}

/** Sudut di ruang lantai → vektor arah di gambar (panjang mengikuti perspektif). */
export function floorAngleToImageDir(basis: Basis, angle: number): MinimapPoint {
  const u = Math.cos(angle);
  const v = Math.sin(angle);
  return { x: basis.ax * u + basis.bx * v, y: basis.ay * u + basis.by * v };
}

const DEG = Math.PI / 180;

/**
 * Sudut lantai untuk yaw kamera saat ini. Yaw Pannellum bertambah saat menoleh ke kanan (searah jarum
 * jam dilihat dari atas); pada lantai yang tercermin (det < 0) arah putarannya dibalik.
 */
export function headingFloorAngle(basis: Basis, pin: MinimapPin, yaw: number): number | null {
  if (!finite(pin.yawRef) || !finite(pin.angleRef)) return null;
  return pin.angleRef + Math.sign(basis.det) * (yaw - pin.yawRef) * DEG;
}

/** Poligon kerucut pandang (string atribut points SVG) di koordinat gambar. */
export function viewConePoints(
  map: Pick<LevelMinimap, "corners">,
  pin: MinimapPin,
  yaw: number,
  hfov: number,
  radius: number
): string | null {
  const basis = floorBasis(map);
  const center = headingFloorAngle(basis, pin, yaw);
  if (center == null) return null;
  const half = (Math.min(Math.max(hfov, 30), 150) / 2) * DEG;
  const points: string[] = [`${pin.x},${pin.y}`];
  const steps = 10;
  for (let i = 0; i <= steps; i += 1) {
    const angle = center - half + (2 * half * i) / steps;
    const dir = floorAngleToImageDir(basis, angle);
    points.push(`${pin.x + dir.x * radius},${pin.y + dir.y * radius}`);
  }
  return points.join(" ");
}

/** Hitung referensi arah dari titik patokan yang diklik admin saat kamera menghadap patokan itu. */
export function calibrateHeading(
  map: Pick<LevelMinimap, "corners">,
  pin: MinimapPin,
  target: MinimapPoint,
  yaw: number
): MinimapPin | null {
  const dx = target.x - pin.x;
  const dy = target.y - pin.y;
  if (Math.hypot(dx, dy) < 2) return null;
  return { x: pin.x, y: pin.y, yawRef: yaw, angleRef: imageDirToFloorAngle(floorBasis(map), dx, dy) };
}

/** Panjang kerucut pandang dalam piksel gambar. */
export function viewConeRadius(map: Pick<LevelMinimap, "width" | "height">): number {
  return Math.max(map.width, map.height) * 0.07;
}
