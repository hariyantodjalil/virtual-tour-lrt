import sharp from "sharp";
import { isPannellumMultiRes, type PannellumMultiRes } from "./panorama-profile";
export { isPannellumMultiRes } from "./panorama-profile";
export type { PannellumMultiRes } from "./panorama-profile";

/** Kubus 2048, tile 512. Level 1 = 512px (1 tile), level 3 = 2048px (4×4). */
export const PANO_TILE = 512;
export const PANO_CUBE = 2048;
export const PANO_MAX_LEVEL = 3;
export const PANO_FACES = ["f", "r", "b", "l", "u", "d"] as const;

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

export function projectPanoramaFace(rgb: Uint8Array, width: number, height: number, face: Face, size: number) {
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

async function tilesFromFace(face: Face, raw: Uint8Array, size: number, options: PanoramaTileOptions): Promise<PanoramaTile[]> {
  const image = sharp(raw, { raw: { width: size, height: size, channels: 3 } });
  const tiles: PanoramaTile[] = [];
  const tileResolution = options.tileResolution ?? PANO_TILE;
  const maxLevel = Math.log2(size / tileResolution) + 1;
  for (let level = 1; level <= maxLevel; level++) {
    const levelSize = size / 2 ** (maxLevel - level);
    const across = levelSize / tileResolution;
    const resized =
      levelSize === size
        ? image.clone()
        : image.clone().resize(levelSize, levelSize, { fit: "fill" });
    for (let y = 0; y < across; y++) {
      for (let x = 0; x < across; x++) {
        const tile = resized
          .clone()
          .extract({ left: x * tileResolution, top: y * tileResolution, width: tileResolution, height: tileResolution });
        const extension = options.extension ?? "jpg";
        const buffer = await (extension === "webp"
          ? tile.webp({ quality: options.webpQuality ?? 85, effort: 4 })
          : tile.jpeg({ quality: options.jpegQuality ?? 72, mozjpeg: true })).toBuffer();
        tiles.push({ name: `${level}/${face}${y}_${x}.${extension}`, buffer });
      }
    }
  }
  return tiles;
}

export type PanoramaTileOptions = {
  /** Omit to retain the existing 4096px profile; null preserves source dimensions. */
  sourceWidth?: number | null;
  jpegQuality?: number;
  cubeResolution?: 2048 | 4096;
  tileResolution?: 512 | 1024;
  extension?: "jpg" | "webp";
  webpQuality?: number;
};

export async function buildPanoramaTiles(input: Buffer, options: PanoramaTileOptions = {}): Promise<PanoramaTile[]> {
  const sourceWidth = options.sourceWidth === undefined ? 4096 : options.sourceWidth;
  const image = sharp(input, { limitInputPixels: 80_000_000 });
  if (sourceWidth !== null) image.resize(sourceWidth, sourceWidth / 2, { fit: "fill" });
  const { data: source, info } = await image
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgb = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  const cubeResolution = options.cubeResolution ?? PANO_CUBE;
  const batches = await Promise.all(
    PANO_FACES.map(async (face) => tilesFromFace(face, projectPanoramaFace(rgb, info.width, info.height, face, cubeResolution), cubeResolution, options))
  );
  return batches.flat();
}

export function multiResConfig(basePath: string, tileResolution = PANO_TILE, cubeResolution = PANO_CUBE): PannellumMultiRes {
  return {
    basePath,
    path: "/%l/%s%y_%x",
    extension: "jpg",
    tileResolution,
    maxLevel: Math.log2(cubeResolution / tileResolution) + 1,
    cubeResolution,
  };
}

export function extractMultiResFromCanvasData(canvasData: unknown): PannellumMultiRes | undefined {
  if (!canvasData || typeof canvasData !== "object") return undefined;
  const multiRes = (canvasData as Record<string, unknown>).multiRes;
  return isPannellumMultiRes(multiRes) ? multiRes : undefined;
}
