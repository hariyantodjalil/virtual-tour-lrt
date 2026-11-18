import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dirToYawPitch,
  extractPerspective,
  perspectivePixelToDir,
  reprojectPerspectiveOntoEquirect,
  yawPitchToDir,
  yawPitchToEquirect,
} from "./panorama-perspective";

describe("panorama-perspective", () => {
  it("yawPitchToDir/dirToYawPitch roundtrip di pusat", () => {
    const [x, y, z] = yawPitchToDir(0, 0);
    const back = dirToYawPitch(x, y, z);
    assert.ok(Math.abs(back.yaw) < 1e-6);
    assert.ok(Math.abs(back.pitch) < 1e-6);
  });

  it("pixel pusat perspective mengarah ke yaw/pitch kamera", () => {
    const view = { yaw: 45, pitch: -10, hfov: 90 };
    const [dx, dy, dz] = perspectivePixelToDir(512, 512, 1024, 1024, view);
    const back = dirToYawPitch(dx, dy, dz);
    assert.ok(Math.abs(back.yaw - 45) < 0.5);
    assert.ok(Math.abs(back.pitch - -10) < 0.5);
  });

  it("equirect mapping pusat panorama", () => {
    const { x, y } = yawPitchToEquirect(0, 0, 4000, 2000);
    assert.equal(x, 2000);
    assert.equal(y, 1000);
  });

  it("extract + reproject menjaga resolusi dan mengubah pusat view", () => {
    const w = 64;
    const h = 32;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = 10;
      data[i * 4 + 1] = 20;
      data[i * 4 + 2] = 30;
      data[i * 4 + 3] = 255;
    }
    // tandai strip merah di yaw≈0, pitch≈0
    for (let y = h / 2 - 2; y <= h / 2 + 2; y++) {
      for (let x = w / 2 - 2; x <= w / 2 + 2; x++) {
        const o = (y * w + x) * 4;
        data[o] = 255;
        data[o + 1] = 0;
        data[o + 2] = 0;
      }
    }

    const base = { width: w, height: h, data };
    const view = { yaw: 0, pitch: 0, hfov: 90 };
    const patch = extractPerspective(base, view, 16, 16);
    assert.equal(patch.width, 16);
    assert.equal(patch.height, 16);

    // warnai seluruh patch jadi hijau
    for (let i = 0; i < 16 * 16; i++) {
      patch.data[i * 4] = 0;
      patch.data[i * 4 + 1] = 255;
      patch.data[i * 4 + 2] = 0;
      patch.data[i * 4 + 3] = 255;
    }

    const merged = reprojectPerspectiveOntoEquirect(base, patch, view, { featherPx: 0 });
    assert.equal(merged.width, w);
    assert.equal(merged.height, h);
    const center = ((h / 2) * w + w / 2) * 4;
    assert.ok(merged.data[center + 1] > 180, `green at center=${merged.data[center + 1]}`);
  });
});
