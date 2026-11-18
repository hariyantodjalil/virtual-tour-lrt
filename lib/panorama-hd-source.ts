import sharp from "sharp";
import {
  extractPrivacyBlursFromCanvasData,
  isPrivacyBlurBakedInPanorama,
} from "./privacy-blur-normalize";
import { isAiPatchApplied } from "./ai-patch-normalize";
import { bakePrivacyBlursIntoPanoramaBuffer } from "./panorama-privacy-blur-bake";
import {
  blurRegionRects,
  blurSigmaForRegion,
  defaultViewerBakeContext,
  equirectPoint,
  normYaw,
  type EquirectRect,
  type ViewerBakeContext,
} from "./panorama-privacy-blur-geometry";
import { blurCornerRadiusPatchPx, roundedBlurMaskSvg } from "./privacy-blur-shape";
import type { PrivacyBlur } from "./privacy-blur-types";

/**
 * Sumber HD harus terbukti membawa blur privasi & hasil edit yang sama dengan
 * panorama public. `originalPanoramaUrl` belum tentu aman: bila blur sudah
 * dibake, blur tersebut hanya ada di panorama display (6000px).
 *
 * Konteks layar saat bake dulu tidak direkam (ukuran jendela editor live),
 * sehingga extent region metadata belum tentu sama dengan blur yang benar-benar
 * dibake. Karena itu extent blur diturunkan langsung dari piksel display di
 * sekitar pusat setiap region, region ditulis ulang sesuai extent teramati,
 * blur diterapkan ulang di resolusi native, lalu dibuktikan: sel-sel yang diblur
 * display wajib juga diblur di HD (superset). Region yang tak terdeteksi,
 * blur jauh di luar metadata, atau konten yang tak cocok → scene di-skip.
 */

export type HdSourceDecision =
  | { kind: "original"; reason: string }
  | { kind: "original-reblur"; reason: string }
  | { kind: "skip"; reason: string };

export function decideHdSource(canvasData: unknown): HdSourceDecision {
  if (isAiPatchApplied(canvasData)) {
    return {
      kind: "skip",
      reason: "AI patch aktif — master native tidak membawa patch; menunggu regenerasi patch",
    };
  }
  const blurs = extractPrivacyBlursFromCanvasData(canvasData);
  const baked = isPrivacyBlurBakedInPanorama(canvasData);
  if (baked && blurs.length === 0) {
    return {
      kind: "skip",
      reason: "blur sudah dibake tapi region metadata tidak tersedia — blur existing tak bisa direproduksi di native",
    };
  }
  if (baked && blurs.length > 0) {
    return {
      kind: "original-reblur",
      reason: `blur baked (${blurs.length} region) — extent diturunkan dari display, re-bake native + bukti superset`,
    };
  }
  if (!baked && blurs.length > 0) {
    return {
      kind: "original",
      reason: `blur hanya draft (${blurs.length}) — piksel display belum diblur, sama seperti Hemat`,
    };
  }
  return { kind: "original", reason: "tanpa blur — sumber asli adalah master yang sama" };
}

type Gray = { width: number; height: number; data: Float32Array };

async function toGray(buffer: Buffer): Promise<Gray> {
  const { data, info } = await sharp(buffer, { limitInputPixels: false })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    data: new Float32Array(data),
  };
}

async function rectGray(buffer: Buffer, rect: EquirectRect): Promise<Gray> {
  const region = await sharp(buffer, { limitInputPixels: false })
    .extract({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    width: region.info.width,
    height: region.info.height,
    data: new Float32Array(region.data),
  };
}

function gradientEnergy(g: Gray): number {
  let sum = 0;
  for (let y = 0; y < g.height; y++) {
    const row = y * g.width;
    for (let x = 1; x < g.width; x++) sum += Math.abs(g.data[row + x] - g.data[row + x - 1]);
  }
  for (let y = 1; y < g.height; y++) {
    const row = y * g.width;
    const prev = (y - 1) * g.width;
    for (let x = 0; x < g.width; x++) sum += Math.abs(g.data[row + x] - g.data[prev + x]);
  }
  return sum / Math.max(1, g.width * g.height * 2);
}

async function lowFreqCorrelation(a: Gray, b: Gray): Promise<number> {
  const w = 32, h = 16;
  const ra = downsampleGray(a, w, h);
  const rb = downsampleGray(b, w, h);
  const n = w * h;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += ra[i]; mb += rb[i]; }
  ma /= n; mb /= n;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) {
    const da = ra[i] - ma, db = rb[i] - mb;
    cov += da * db; va += da * da; vb += db * db;
  }
  const denom = Math.sqrt(va * vb);
  return denom === 0 ? 0 : cov / denom;
}

function downsampleGray(g: Gray, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * g.width) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * g.width) / w));
      const y0 = Math.floor((y * g.height) / h);
      const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * g.height) / h));
      let sum = 0, count = 0;
      for (let yy = y0; yy < y1 && yy < g.height; yy++) {
        const row = yy * g.width;
        for (let xx = x0; xx < x1 && xx < g.width; xx++) {
          sum += g.data[row + xx];
          count++;
        }
      }
      out[y * w + x] = count ? sum / count : 0;
    }
  }
  return out;
}

/** Deteksi blur pada sel halus: sel dianggap diblur bila rasio energi
 *  display/original di bawah ambang dan konten aslinya berdetail. */
function blurredCellSet(
  display: Gray,
  original: Gray,
  cell: number,
  ratioThreshold: number,
): Map<number, boolean> {
  const set = new Map<number, boolean>();
  for (let wy = 0; wy + cell <= display.height; wy += cell) {
    for (let wx = 0; wx + cell <= display.width; wx += cell) {
      let dEnergy = 0, oEnergy = 0;
      for (let y = wy; y < wy + cell; y++) {
        const row = y * display.width;
        for (let x = wx + 1; x < wx + cell; x++) {
          dEnergy += Math.abs(display.data[row + x] - display.data[row + x - 1]);
          oEnergy += Math.abs(original.data[row + x] - original.data[row + x - 1]);
        }
      }
      if (oEnergy < cell * cell * 1.5) continue; // datar — tidak ada konten dilindungi
      set.set(cellKey(wx, wy, cell), dEnergy / oEnergy < ratioThreshold);
    }
  }
  return set;
}

/** Kunci sel grid: koordinat selalu di-snap ke grid DERIVE_CELL agar lookup
 *  dari loop apa pun menemukan sel yang sama. */
function cellKey(wx: number, wy: number, cell: number): number {
  const gx = Math.floor(wx / cell) * cell;
  const gy = Math.floor(wy / cell) * cell;
  return gy * 100000 + gx;
}

function cellBlurred(set: Map<number, boolean>, wx: number, wy: number): boolean | undefined {
  return set.get(cellKey(wx, wy, DERIVE_CELL));
}

const DERIVE_CELL = 16;
const DERIVE_RATIO = 0.55;
const COVERAGE_RATIO = 0.6;

/** Pusat angular sebuah region → titik piksel display. */
function centerPoint(blur: PrivacyBlur, display: Gray): { x: number; y: number } {
  return equirectPoint(blur.yaw, blur.pitch, display.width, display.height);
}

/**
 * Turunkan half-extent angular blur yang benar-benar dibake di display,
 * dengan memindai sel halus di sekitar pusat region. Menangani seam ±180°
 * secara alami lewat normalisasi delta yaw. Bila tidak ada sel blur yang
 * terdeteksi (konten datar/blur tak terlihat), kembalikan undefined dan
 * biarkan pemanggil memakai extent metadata.
 */
export function deriveObservedBlurExtent(
  display: Gray,
  original: Gray,
  blur: PrivacyBlur,
  others: PrivacyBlur[] = [],
): { halfYawDeg: number; halfPitchDeg: number; detected: boolean } | undefined {
  // Aturan Voronoi: sel hanya milik region terdekat — mencegah region
  // berdekatan saling "mencuri" blob tetangga hingga extent melar lebar.
  const nearest = (yaw: number, pitch: number) => {
    let own = Infinity, best = Infinity;
    for (const other of [blur, ...others]) {
      let dy = yaw - other.yaw;
      if (dy < -180) dy += 360;
      if (dy > 180) dy -= 360;
      const dp = pitch - other.pitch;
      const dist = Math.sqrt(dy * dy + dp * dp);
      if (other === blur) own = dist;
      else best = Math.min(best, dist);
    }
    return own <= best;
  };
  const degPerPx = 360 / display.width;
  const pitchDegPerPx = 180 / display.height;
  const cellDeg = DERIVE_CELL * degPerPx;
  // Area pemindaian: cukup untuk region wajah/plat + margin besar.
  const scanYaw = Math.min(24, Math.max(6, cellDeg * 14));
  const scanPitch = Math.min(14, Math.max(4, cellDeg * 8));
  const center = centerPoint(blur, display);

  let maxDx = 0, maxDy = 0, found = false;
  // Jendela scan selalu di-snap ke grid DERIVE_CELL supaya sel-selnya
  // berimpit dengan sel coverage — sel yang memotong tepi blur akan mencampur
  // area tajam dan lolos deteksi.
  const snap = (value: number) => Math.max(0, Math.floor(value / DERIVE_CELL) * DERIVE_CELL);
  const yStart = snap(center.y - Math.round(scanPitch / pitchDegPerPx));
  const yEnd = Math.min(display.height, Math.ceil((center.y + Math.round(scanPitch / pitchDegPerPx)) / DERIVE_CELL) * DERIVE_CELL);
  const xStart = snap(center.x - Math.round(scanYaw / degPerPx));
  const xEnd = Math.min(display.width, Math.ceil((center.x + Math.round(scanYaw / degPerPx)) / DERIVE_CELL) * DERIVE_CELL);
  for (let wy = yStart; wy + DERIVE_CELL <= yEnd; wy += DERIVE_CELL) {
    for (let wx = xStart; wx + DERIVE_CELL <= xEnd; wx += DERIVE_CELL) {
      // Hitung delta angular normalisasi (jendela bisa melintasi seam).
      const cellCenterX = wx + DERIVE_CELL / 2;
      let dx = (cellCenterX - center.x) * degPerPx;
      if (dx < -180) dx += 360;
      if (dx > 180) dx -= 360;
      const dy = (wy + DERIVE_CELL / 2 - center.y) * pitchDegPerPx;
      if (Math.abs(dx) > scanYaw || Math.abs(dy) > scanPitch) continue;
      let dEnergy = 0, oEnergy = 0;
      for (let y = wy; y < wy + DERIVE_CELL; y++) {
        const row = y * display.width;
        for (let x = wx + 1; wx + DERIVE_CELL > x; x++) {
          if (x >= display.width) break;
          dEnergy += Math.abs(display.data[row + x] - display.data[row + x - 1]);
          oEnergy += Math.abs(original.data[row + x] - original.data[row + x - 1]);
        }
      }
      if (oEnergy < DERIVE_CELL * DERIVE_CELL * 1.5) continue;
      if (dEnergy / oEnergy < DERIVE_RATIO && nearest(blur.yaw + dx, blur.pitch + dy)) {
        found = true;
        maxDx = Math.max(maxDx, Math.abs(dx) + cellDeg / 2);
        maxDy = Math.max(maxDy, Math.abs(dy) + (DERIVE_CELL * pitchDegPerPx) / 2);
      }
    }
  }
  if (!found) return undefined;
  return { halfYawDeg: maxDx, halfPitchDeg: maxDy, detected: true };
}

/**
 * Bake blur di resolusi native TANPA re-encode gambar penuh per region:
 * dekode sekali ke buffer raw, tiap region di-blur pada crop kecil lalu
 * ditulis balik (memcpy) ke raw, hasil akhir di-encode JPEG sekali.
 * Kekuatan blur dan mask sudut mengikuti jalur display bake agar setara.
 */
export async function leanBakePrivacyBlurs(
  originalBuffer: Buffer,
  plans: { region: PrivacyBlur; context: ViewerBakeContext }[],
  sigmaHardCapScale: number,
): Promise<Buffer> {
  const { data, info } = await sharp(originalBuffer, { limitInputPixels: false })
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const channels = info.channels;
  const pixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const hardCap = Math.max(1, Math.round(120 * sigmaHardCapScale));

  for (const { region, context } of plans) {
    const rects = blurRegionRects(region, width, height, context);
    for (const rect of rects) {
      // Cap mengikuti jalur display bake: minDim CROP region (bukan gambar penuh).
      const minDimCap = Math.max(1, Math.floor(Math.min(rect.width, rect.height) / 6));
      const sigma = Math.max(1, Math.min(
        blurSigmaForRegion(region, rect.width, context), minDimCap, hardCap
      ));
      const cornerR = blurCornerRadiusPatchPx(rect.width, rect.height, region);

      // Crop region → blur → mask sudut → composite alfa manual (semantika
      // "over" tanpa dest-in): di area mask transparan, piksel panorama asli
      // dipertahankan — tidak ada pojok hitam.
      const blurredRaw = await sharp(pixels.subarray(0), {
        raw: { width, height, channels },
        limitInputPixels: false,
      })
        .extract({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
        .blur(sigma)
        .removeAlpha()
        .raw()
        .toBuffer();
      const maskRaw = await sharp(
        Buffer.from(roundedBlurMaskSvg(rect.width, rect.height, cornerR)),
        { limitInputPixels: false }
      )
        .resize(rect.width, rect.height, { fit: "fill" })
        .grayscale()
        .raw()
        .toBuffer();

      for (let y = 0; y < rect.height; y++) {
        for (let x = 0; x < rect.width; x++) {
          const mIdx = y * rect.width + x;
          const alpha = maskRaw[mIdx] / 255;
          if (alpha <= 0) continue;
          const srcIdx = (mIdx) * channels;
          const dstIdx = (((rect.top + y) * width) + rect.left + x) * channels;
          if (alpha >= 1) {
            pixels[dstIdx] = blurredRaw[srcIdx];
            pixels[dstIdx + 1] = blurredRaw[srcIdx + 1];
            pixels[dstIdx + 2] = blurredRaw[srcIdx + 2];
          } else {
            pixels[dstIdx] = Math.round(blurredRaw[srcIdx] * alpha + pixels[dstIdx] * (1 - alpha));
            pixels[dstIdx + 1] = Math.round(blurredRaw[srcIdx + 1] * alpha + pixels[dstIdx + 1] * (1 - alpha));
            pixels[dstIdx + 2] = Math.round(blurredRaw[srcIdx + 2] * alpha + pixels[dstIdx + 2] * (1 - alpha));
          }
        }
      }
    }
  }

  return sharp(pixels.subarray(0), {
    raw: { width, height, channels },
    limitInputPixels: false,
  })
    .jpeg({ quality: 95 })
    .toBuffer();
}

/**
 * Atur konteks per-region agar extent blur yang dibake sama dengan yang
 * teramati di display, TANPA mengubah width/height/scale region — dengan
 * begitu rumus sigma (intensity × rectPx / (width×scale)) otomatis setara
 * dengan bake display. viewerW diselesaikan dari persamaan yaw; viewerH
 * via bisection untuk pitch. Bila target pitch tak tercapai, tinggi region
 * diperbesar (aman: sigma hanya bergantung pada lebar).
 */
export function solveContextForExtent(
  blur: PrivacyBlur,
  halfYawDeg: number,
  halfPitchDeg: number,
  margin = { yaw: 1.2, pitch: 0.8 },
): { context: ViewerBakeContext; region: PrivacyBlur } {
  const hfov = 100;
  const targetYaw = Math.min(88, Math.max(0.15, halfYawDeg + margin.yaw));
  const targetPitch = Math.min(55, Math.max(0.15, halfPitchDeg + margin.pitch));
  const screenW = Math.max(1, (blur.width ?? 100) * (blur.scale ?? 1));
  const viewerWidth = Math.min(6000, Math.max(60, (hfov * screenW) / targetYaw));

  let region = blur;
  let screenH = Math.max(1, (blur.height ?? 72) * (blur.scale ?? 1));
  const halfPitchOf = (vh: number) => {
    const vfov = 2 * Math.atan((vh / viewerWidth) * Math.tan((hfov * Math.PI) / 360)) * 180 / Math.PI;
    return (screenH * vfov) / vh;
  };
  const maxPitch = halfPitchOf(10);
  if (targetPitch > maxPitch) {
    screenH = screenH * (targetPitch / maxPitch);
    region = { ...blur, height: (blur.height ?? 72) * (targetPitch / maxPitch) };
  }
  let lo = 10, hi = 8000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (halfPitchOf(mid) > targetPitch) lo = mid; else hi = mid;
  }
  return {
    context: { viewerWidth, viewerHeight: (lo + hi) / 2, hfov },
    region,
  };
}

export type BlurMappingVerification = {
  ok: boolean;
  regionsChecked: number;
  failures: string[];
  context: ViewerBakeContext;
};

/**
 * Bangun sumber HD untuk scene ber-blur baked:
 * 1. turunkan extent blur aktual per region dari piksel display,
 * 2. tulis ulang region sesuai extent, bake di resolusi native
 *    (cap sigma diskalakan agar angular setara),
 * 3. buktikan superset: setiap sel display yang diblur juga diblur di HD,
 * 4. konten di balik blur harus sama, dan
 * 5. tidak ada area blur besar yang tak tersambung ke region metadata.
 * Gagal → scene di-skip, jangan ditebak.
 */
export async function rebakeNativeWithVerification(opts: {
  originalBuffer: Buffer;
  displayBuffer: Buffer;
  blurs: PrivacyBlur[];
}): Promise<
  | { ok: true; nativeBuffer: Buffer; verification: BlurMappingVerification }
  | { ok: false; reason: string }
> {
  const displayMeta = await sharp(opts.displayBuffer, { limitInputPixels: false }).metadata();
  const displayW = displayMeta.width ?? 0;
  const displayH = displayMeta.height ?? 0;
  if (!displayW || !displayH) return { ok: false, reason: "dimensi display tidak valid" };
  const nativeMeta = await sharp(opts.originalBuffer, { limitInputPixels: false }).metadata();
  const nativeW = nativeMeta.width ?? 0;
  const nativeH = nativeMeta.height ?? 0;
  if (!nativeW || !nativeH) return { ok: false, reason: "dimensi sumber native tidak valid" };

  const originalDownscaled = await sharp(opts.originalBuffer, { limitInputPixels: false })
    .resize(displayW, displayH, { fit: "fill" })
    .toBuffer();
  const display = await toGray(opts.displayBuffer);
  const original = await toGray(originalDownscaled);

  // Sumber asli wajib gambar yang sama dengan panorama display — kalau tidak,
  // seluruh premis HD dari original gugur (mis. original tertinggal versi lama).
  const globalParity = await (async () => {
    const a = downsampleGray(display, 64, 32);
    const b = downsampleGray(original, 64, 32);
    let ma = 0, mb = 0;
    for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; }
    ma /= a.length; mb /= b.length;
    let cov = 0, va = 0, vb = 0;
    for (let i = 0; i < a.length; i++) {
      const da = a[i] - ma, db = b[i] - mb;
      cov += da * db; va += da * da; vb += db * db;
    }
    return cov / Math.max(1e-9, Math.sqrt(va * vb));
  })();
  if (globalParity < 0.95) {
    return {
      ok: false,
      reason: `sumber asli berbeda dari panorama display (paritas ${globalParity.toFixed(3)}) — HD dari original tidak aman`,
    };
  }

  // (5) blur besar yang tak tersambung ke region metadata mana pun → tak bisa dijelaskan.
  const context = defaultViewerBakeContext();
  const coarseCells = blurredCellSet(display, original, 128, 0.45);
  const explained = (wx: number, wy: number) =>
    opts.blurs.some((blur) => {
      const extent = deriveObservedBlurExtent(display, original, blur, opts.blurs);
      const halfYaw = extent?.halfYawDeg ?? 12;
      const halfPitch = extent?.halfPitchDeg ?? 8;
      const center = centerPoint(blur, display);
      const cellDeg = (128 * 360) / displayW;
      let dx = (wx + 64 - center.x) * (360 / displayW);
      if (dx < -180) dx += 360;
      if (dx > 180) dx -= 360;
      const dy = (wy + 64 - center.y) * (180 / displayH);
      return Math.abs(dx) <= halfYaw + cellDeg && Math.abs(dy) <= halfPitch + (128 * 180) / displayH;
    });
  let unexplained = 0;
  for (const [key, blurred] of coarseCells) {
    if (!blurred) continue;
    const wx = key % 100000, wy = Math.floor(key / 100000);
    if (!explained(wx, wy)) unexplained++;
  }

  // Bake dirantai per-region dengan konteks per-region: region tetap apa adanya
  // (sigma setara otomatis), extent diatur lewat konteks hasil solve.
  const sigmaHardCapScale = nativeW / displayW;
  const plans: { region: PrivacyBlur; context: ViewerBakeContext }[] = opts.blurs.map((blur) => {
    const extent = deriveObservedBlurExtent(display, original, blur, opts.blurs);
    return extent
      ? { ...solveContextForExtent(blur, extent.halfYawDeg, extent.halfPitchDeg) }
      : { region: blur, context };
  });
  const bakedBuffer = await leanBakePrivacyBlurs(opts.originalBuffer, plans, sigmaHardCapScale);
  const baked = { buffer: bakedBuffer };

  // HD di-downscale ke dimensi display untuk perbandingan sel dengan existing.
  const hdDownscaled = await sharp(baked.buffer, { limitInputPixels: false })
    .resize(displayW, displayH, { fit: "fill" })
    .toBuffer();
  const hd = await toGray(hdDownscaled);

  const failures: string[] = [];
  if (unexplained > 0) {
    failures.push(
      `${unexplained} area blur besar tidak tersambung ke region metadata — tak bisa dijelaskan; scene di-skip`
    );
  }

  // (3) superset per region pada sel halus di sekitar region.
  const displayCells = blurredCellSet(display, original, DERIVE_CELL, COVERAGE_RATIO);
  const hdCells = blurredCellSet(hd, original, DERIVE_CELL, COVERAGE_RATIO);
  let regions = 0;
  for (const blur of opts.blurs) {
    const center = centerPoint(blur, display);
    const extent = deriveObservedBlurExtent(display, original, blur, opts.blurs);
    const halfYaw = extent?.halfYawDeg ?? 12;
    const halfPitch = extent?.halfPitchDeg ?? 8;
    const cellDeg = (DERIVE_CELL * 360) / displayW;
    const cellPitchDeg = (DERIVE_CELL * 180) / displayH;
    let regionChecked = false;
    let missing = 0;
    const missingCells: { wx: number; wy: number }[] = [];
    for (let wy = Math.max(0, center.y - Math.round((halfPitch * 1.6) / cellPitchDeg));
         wy + DERIVE_CELL <= display.height;
         wy += DERIVE_CELL) {
      if (wy > center.y + (halfPitch * 1.6) / cellPitchDeg) break;
      for (let wx = Math.max(0, center.x - Math.round((halfYaw * 1.6) / cellDeg));
           wx + DERIVE_CELL <= display.width;
           wx += DERIVE_CELL) {
        if (wx > center.x + (halfYaw * 1.6) / cellDeg) break;
        let dx = (wx + DERIVE_CELL / 2 - center.x) * cellDeg / DERIVE_CELL;
        if (dx < -180) dx += 360;
        if (dx > 180) dx -= 360;
        const dy = (wy + DERIVE_CELL / 2 - center.y) * cellPitchDeg / DERIVE_CELL;
        if (Math.abs(dx) > halfYaw * 1.6 || Math.abs(dy) > halfPitch * 1.6) continue;
        const dBlurred = cellBlurred(displayCells, wx, wy);
        if (dBlurred !== true) continue;
        regionChecked = true;
        if (cellBlurred(hdCells, wx, wy) !== true) {
          missing++;
          missingCells.push({ wx, wy });
        }
      }
    }
    // Sel yang hilang di tepi falloff blur (bertetangga dengan sel HD yang
    // ter-blur) masih terlindungi sebagian; sel terisolasi adalah lubang nyata.
    const hasHdNeighbor = (wx: number, wy: number) =>
      [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].some(
        ([dx, dy]) => cellBlurred(hdCells, wx + dx * DERIVE_CELL, wy + dy * DERIVE_CELL) === true
      );
    const holes = missingCells.filter((cell) => !hasHdNeighbor(cell.wx, cell.wy));
    if (!regionChecked) {
      failures.push(
        `region yaw=${blur.yaw}: tidak ada sel blur terdeteksi di display — extent tak bisa diturunkan`
      );
      continue;
    }
    regions++;
    if (holes.length > 0) {
      failures.push(
        `region yaw=${blur.yaw}: ${holes.length} sel blur display tidak tercakup HD (lubang terisolasi)`
      );
    }
    // (4) konten di balik blur sama (bandingkan crop pusat region).
    // Crop 2x2 sel yang terpusat di pusat region (bukan di tepi extent);
    // clamp di semua sisi — region dekat tepi/seam tidak boleh overflow.
    const cropLeft = Math.max(0, Math.round(center.x) - DERIVE_CELL);
    const cropTop = Math.max(0, Math.round(center.y) - DERIVE_CELL);
    const centerRect = {
      left: cropLeft,
      top: cropTop,
      width: Math.max(1, Math.min(DERIVE_CELL * 2, display.width - cropLeft)),
      height: Math.max(1, Math.min(DERIVE_CELL * 2, display.height - cropTop)),
    } as EquirectRect;
    const displayCrop = await rectGray(opts.displayBuffer, centerRect);
    const hdCrop = await rectGray(hdDownscaled, centerRect);
    const corr = await lowFreqCorrelation(displayCrop, hdCrop);
    if (corr < 0.6) {
      failures.push(
        `region yaw=${blur.yaw}: konten HD berbeda dengan existing (korelasi ${corr.toFixed(3)})`
      );
    }
  }

  const verification: BlurMappingVerification = {
    ok: failures.length === 0 && regions > 0,
    regionsChecked: regions,
    failures: [...new Set(failures)].slice(0, 10),
    context,
  };
  if (!verification.ok) {
    return { ok: false, reason: verification.failures[0] ?? "pemetaan blur tak terverifikasi" };
  }
  return { ok: true, nativeBuffer: baked.buffer, verification };
}
