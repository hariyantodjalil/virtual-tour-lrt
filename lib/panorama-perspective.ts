/**
 * Konversi equirectangular ↔ perspective (rectilinear) untuk patch AI di Pannellum.
 * Konvensi sudut mengikuti Pannellum: yaw [-180,180], pitch [-90,90], hfov derajat.
 */

export type PerspectiveView = {
  yaw: number;
  pitch: number;
  hfov: number;
};

export type RgbaImage = {
  width: number;
  height: number;
  /** length = width * height * 4 */
  data: Uint8ClampedArray;
};

function degToRad(d: number) {
  return (d * Math.PI) / 180;
}

function radToDeg(r: number) {
  return (r * 180) / Math.PI;
}

export function normYaw(yaw: number): number {
  let y = yaw;
  while (y > 180) y -= 360;
  while (y <= -180) y += 360;
  return y;
}

/** Arah kamera (yaw/pitch) → vektor unit di ruang dunia. */
export function yawPitchToDir(yawDeg: number, pitchDeg: number): [number, number, number] {
  const yaw = degToRad(yawDeg);
  const pitch = degToRad(pitchDeg);
  const cp = Math.cos(pitch);
  return [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
}

/** Vektor unit → yaw/pitch Pannellum. */
export function dirToYawPitch(x: number, y: number, z: number): { yaw: number; pitch: number } {
  const yaw = radToDeg(Math.atan2(x, z));
  const pitch = radToDeg(Math.atan2(y, Math.sqrt(x * x + z * z)));
  return { yaw: normYaw(yaw), pitch: Math.max(-90, Math.min(90, pitch)) };
}

/**
 * Pixel perspective (i,j) → arah dunia setelah rotasi kamera.
 * FOV horizontal = view.hfov; vertikal mengikuti aspek rasio output.
 */
export function perspectivePixelToDir(
  i: number,
  j: number,
  outW: number,
  outH: number,
  view: PerspectiveView
): [number, number, number] {
  const hfovRad = degToRad(view.hfov);
  const halfW = Math.tan(hfovRad / 2);
  const halfH = halfW * (outH / Math.max(1, outW));

  const nx = (2 * (i + 0.5)) / outW - 1;
  const ny = 1 - (2 * (j + 0.5)) / outH;
  const localX = nx * halfW;
  const localY = ny * halfH;
  const localZ = 1;

  const len = Math.hypot(localX, localY, localZ) || 1;
  const lx = localX / len;
  const ly = localY / len;
  const lz = localZ / len;

  // Pitch ke +Y (look up), lalu yaw ke +X — selaras yawPitchToDir
  const pitch = degToRad(view.pitch);
  const yaw = degToRad(view.yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const y1 = ly * cosP + lz * sinP;
  const z1 = -ly * sinP + lz * cosP;
  const x1 = lx;

  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const x2 = x1 * cosY + z1 * sinY;
  const z2 = -x1 * sinY + z1 * cosY;
  return [x2, y1, z2];
}

export function yawPitchToEquirect(
  yaw: number,
  pitch: number,
  panoW: number,
  panoH: number
): { x: number; y: number } {
  const ny = normYaw(yaw);
  const x = ((ny + 180) / 360) * panoW;
  const y = ((90 - pitch) / 180) * panoH;
  return { x, y };
}

function sampleBilinear(
  src: RgbaImage,
  x: number,
  y: number,
  out: Uint8ClampedArray,
  outOffset: number
) {
  const { width: w, height: h, data } = src;
  // wrap horizontal
  let sx = x % w;
  if (sx < 0) sx += w;
  const sy = Math.max(0, Math.min(h - 1, y));

  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const x1 = (x0 + 1) % w;
  const y1 = Math.min(h - 1, y0 + 1);
  const fx = sx - x0;
  const fy = sy - y0;

  const i00 = (y0 * w + x0) * 4;
  const i10 = (y0 * w + x1) * 4;
  const i01 = (y1 * w + x0) * 4;
  const i11 = (y1 * w + x1) * 4;

  for (let c = 0; c < 4; c++) {
    const v00 = data[i00 + c];
    const v10 = data[i10 + c];
    const v01 = data[i01 + c];
    const v11 = data[i11 + c];
    const v0 = v00 * (1 - fx) + v10 * fx;
    const v1 = v01 * (1 - fx) + v11 * fx;
    out[outOffset + c] = Math.round(v0 * (1 - fy) + v1 * fy);
  }
}

/** Crop view Pannellum menjadi gambar perspective RGBA. */
export function extractPerspective(src: RgbaImage, view: PerspectiveView, outW: number, outH: number): RgbaImage {
  const data = new Uint8ClampedArray(outW * outH * 4);
  for (let j = 0; j < outH; j++) {
    for (let i = 0; i < outW; i++) {
      const [dx, dy, dz] = perspectivePixelToDir(i, j, outW, outH, view);
      const { yaw, pitch } = dirToYawPitch(dx, dy, dz);
      const { x, y } = yawPitchToEquirect(yaw, pitch, src.width, src.height);
      sampleBilinear(src, x, y, data, (j * outW + i) * 4);
    }
  }
  return { width: outW, height: outH, data };
}

function featherAlpha(i: number, j: number, w: number, h: number, margin: number): number {
  if (margin <= 0) return 1;
  const dl = i;
  const dr = w - 1 - i;
  const dt = j;
  const db = h - 1 - j;
  const d = Math.min(dl, dr, dt, db);
  if (d >= margin) return 1;
  return Math.max(0, d / margin);
}

/**
 * Tempel hasil perspective kembali ke equirectangular dengan feather di tepi.
 * Mengembalikan salinan baru (tidak mutasi `base`).
 */
export function reprojectPerspectiveOntoEquirect(
  base: RgbaImage,
  patch: RgbaImage,
  view: PerspectiveView,
  options?: { featherPx?: number }
): RgbaImage {
  const featherPx = options?.featherPx ?? Math.max(8, Math.round(Math.min(patch.width, patch.height) * 0.04));
  const out = new Uint8ClampedArray(base.data);
  const { width: panoW, height: panoH } = base;
  const { width: outW, height: outH } = patch;
  const n = panoW * panoH;
  const accR = new Float32Array(n);
  const accG = new Float32Array(n);
  const accB = new Float32Array(n);
  const accW = new Float32Array(n);

  const accumulate = (
    px: number,
    py: number,
    weight: number,
    srcOff: number,
    edgeAlpha: number
  ) => {
    const a = weight * edgeAlpha;
    if (a <= 0.001) return;
    let sx = Math.floor(px);
    while (sx < 0) sx += panoW;
    while (sx >= panoW) sx -= panoW;
    const sy = Math.max(0, Math.min(panoH - 1, Math.floor(py)));
    const idx = sy * panoW + sx;
    accR[idx] += patch.data[srcOff] * a;
    accG[idx] += patch.data[srcOff + 1] * a;
    accB[idx] += patch.data[srcOff + 2] * a;
    accW[idx] += a;
  };

  // Supersample 2×2 + splat bilinear → coverage penuh di sphere
  for (let j = 0; j < outH; j++) {
    for (let i = 0; i < outW; i++) {
      const edgeAlpha = featherAlpha(i, j, outW, outH, featherPx);
      if (edgeAlpha <= 0) continue;
      const srcOff = (j * outW + i) * 4;

      for (const ou of [0.25, 0.75]) {
        for (const ov of [0.25, 0.75]) {
          const [dx, dy, dz] = perspectivePixelToDir(
            i + ou - 0.5,
            j + ov - 0.5,
            outW,
            outH,
            view
          );
          const { yaw, pitch } = dirToYawPitch(dx, dy, dz);
          const { x, y } = yawPitchToEquirect(yaw, pitch, panoW, panoH);
          const x0 = Math.floor(x);
          const y0 = Math.floor(y);
          const fx = x - x0;
          const fy = y - y0;
          accumulate(x0, y0, (1 - fx) * (1 - fy), srcOff, edgeAlpha);
          accumulate(x0 + 1, y0, fx * (1 - fy), srcOff, edgeAlpha);
          accumulate(x0, y0 + 1, (1 - fx) * fy, srcOff, edgeAlpha);
          accumulate(x0 + 1, y0 + 1, fx * fy, srcOff, edgeAlpha);
        }
      }
    }
  }

  for (let idx = 0; idx < n; idx++) {
    const wsum = accW[idx];
    if (wsum <= 0.001) continue;
    const a = Math.min(1, wsum);
    const dst = idx * 4;
    const pr = accR[idx] / wsum;
    const pg = accG[idx] / wsum;
    const pb = accB[idx] / wsum;
    out[dst] = Math.round(out[dst] * (1 - a) + pr * a);
    out[dst + 1] = Math.round(out[dst + 1] * (1 - a) + pg * a);
    out[dst + 2] = Math.round(out[dst + 2] * (1 - a) + pb * a);
    out[dst + 3] = 255;
  }

  return { width: panoW, height: panoH, data: out };
}
