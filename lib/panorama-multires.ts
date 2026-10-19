import sharp from "sharp";

/** Kubus 2048, tile 512. Level 1 = 512px (1 tile), level 3 = 2048px (4×4). */
export const PANO_TILE = 512;
export const PANO_CUBE = 2048;
export const PANO_MAX_LEVEL = 3;
export const PANO_FACES = ["f", "r", "b", "l", "u", "d"] as const;

export type PannellumMultiRes = {
  basePath: string;
  path: "/%l/%s%y_%x";
  extension: "jpg";
  tileResolution: number;
  maxLevel: number;
  cubeResolution: number;
};

export type PanoramaTile = {
  name: string;
  buffer: Buffer;
};

type Face = (typeof PANO_FACES)[number];

function faceDirection(face: Face, nx: number, ny: number): [number, number, number] {
  switch (face) {
    case "f":
      return [nx, -ny, 1];
    case "r":
      return [1, -ny, -nx];
    case "b":
      return [-nx, -ny, -1];
    case "l":
      return [-1, -ny, nx];
    case "u":
      return [nx, 1, ny];
    case "d":
      return [nx, -1, -ny];
  }
}

function sampleEquirect(
  rgb: Uint8Array,
  width: number,
  height: number,
  u: number,
  v: number,
  out: Uint8Array,
  offset: number
) {
  const uu = u - Math.floor(u);
  const vv = Math.min(0.999999, Math.max(0, v));
  const x = uu * width;
  const y = vv * (height - 1);
  const x0 = Math.floor(x) % width;
  const y0 = Math.floor(y);
  const x1 = (x0 + 1) % width;
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = x - Math.floor(x);
  const ty = y - y0;
  const row = width * 3;
  const i00 = y0 * row + x0 * 3;
  const i10 = y0 * row + x1 * 3;
  const i01 = y1 * row + x0 * 3;
  const i11 = y1 * row + x1 * 3;
  const w00 = (1 - tx) * (1 - ty);
  const w10 = tx * (1 - ty);
  const w01 = (1 - tx) * ty;
  const w11 = tx * ty;
  out[offset] = rgb[i00] * w00 + rgb[i10] * w10 + rgb[i01] * w01 + rgb[i11] * w11;
  out[offset + 1] = rgb[i00 + 1] * w00 + rgb[i10 + 1] * w10 + rgb[i01 + 1] * w01 + rgb[i11 + 1] * w11;
  out[offset + 2] = rgb[i00 + 2] * w00 + rgb[i10 + 2] * w10 + rgb[i01 + 2] * w01 + rgb[i11 + 2] * w11;
}

function renderFace(rgb: Uint8Array, width: number, height: number, face: Face, size: number) {
  const out = new Uint8Array(size * size * 3);
  for (let j = 0; j < size; j++) {
    const ny = ((j + 0.5) / size) * 2 - 1;
    for (let i = 0; i < size; i++) {
      const nx = ((i + 0.5) / size) * 2 - 1;
      const [x, y, z] = faceDirection(face, nx, ny);
      const length = Math.hypot(x, y, z) || 1;
      const dx = x / length;
      const dy = y / length;
      const dz = z / length;
      const lon = Math.atan2(dx, dz);
      const lat = Math.asin(Math.max(-1, Math.min(1, dy)));
      const u = lon / (Math.PI * 2) + 0.5;
      const v = 0.5 - lat / Math.PI;
      sampleEquirect(rgb, width, height, u, v, out, (j * size + i) * 3);
    }
  }
  return out;
}

async function tilesFromFace(face: Face, raw: Uint8Array, size: number): Promise<PanoramaTile[]> {
  const image = sharp(raw, { raw: { width: size, height: size, channels: 3 } });
  const tiles: PanoramaTile[] = [];
  for (let level = 1; level <= PANO_MAX_LEVEL; level++) {
    const levelSize = PANO_CUBE / 2 ** (PANO_MAX_LEVEL - level);
    const across = levelSize / PANO_TILE;
    const resized =
      levelSize === size
        ? image.clone()
        : image.clone().resize(levelSize, levelSize, { fit: "fill" });
    for (let y = 0; y < across; y++) {
      for (let x = 0; x < across; x++) {
        const buffer = await resized
          .clone()
          .extract({ left: x * PANO_TILE, top: y * PANO_TILE, width: PANO_TILE, height: PANO_TILE })
          .jpeg({ quality: 72, mozjpeg: true })
          .toBuffer();
        tiles.push({ name: `${level}/${face}${y}_${x}.jpg`, buffer });
      }
    }
  }
  return tiles;
}

export async function buildPanoramaTiles(input: Buffer): Promise<PanoramaTile[]> {
  const source = await sharp(input, { limitInputPixels: 80_000_000 })
    .resize(4096, 2048, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
  const rgb = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  const batches = await Promise.all(
    PANO_FACES.map(async (face) => tilesFromFace(face, renderFace(rgb, 4096, 2048, face, PANO_CUBE), PANO_CUBE))
  );
  return batches.flat();
}

export function multiResConfig(basePath: string): PannellumMultiRes {
  return {
    basePath,
    path: "/%l/%s%y_%x",
    extension: "jpg",
    tileResolution: PANO_TILE,
    maxLevel: PANO_MAX_LEVEL,
    cubeResolution: PANO_CUBE,
  };
}

export function isPannellumMultiRes(value: unknown): value is PannellumMultiRes {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.basePath === "string" &&
    row.basePath.length > 0 &&
    row.extension === "jpg" &&
    row.tileResolution === PANO_TILE &&
    row.maxLevel === PANO_MAX_LEVEL &&
    row.cubeResolution === PANO_CUBE
  );
}

export function extractMultiResFromCanvasData(canvasData: unknown): PannellumMultiRes | undefined {
  if (!canvasData || typeof canvasData !== "object") return undefined;
  const multiRes = (canvasData as Record<string, unknown>).multiRes;
  return isPannellumMultiRes(multiRes) ? multiRes : undefined;
}
