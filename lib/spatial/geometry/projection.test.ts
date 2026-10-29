import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { projectPoint, screenDistance, unprojectPoint } from "./projection";
import { dirToSpherical, sphericalToDir, normalizeYaw } from "./spherical";
import type { CameraState } from "../types";

const camera: CameraState = {
  yawDeg: 0,
  pitchDeg: 0,
  hfovDeg: 100,
  widthCssPx: 1280,
  heightCssPx: 720,
};

describe("spherical round-trip", () => {
  it("dir ↔ spherical stabil", () => {
    const samples = [
      { yaw: 0, pitch: 0 },
      { yaw: 45, pitch: -10 },
      { yaw: -120, pitch: 20 },
      { yaw: 179, pitch: -5 },
    ];
    for (const p of samples) {
      const back = dirToSpherical(sphericalToDir(p));
      assert.ok(Math.abs(normalizeYaw(back.yaw - p.yaw)) < 0.05);
      assert.ok(Math.abs(back.pitch - p.pitch) < 0.05);
    }
  });
});

describe("project ↔ unproject", () => {
  it("center projects near viewport center", () => {
    const sp = projectPoint({ yaw: 0, pitch: 0 }, camera);
    assert.ok(sp);
    assert.ok(screenDistance(sp!, { x: 640, y: 360 }) < 1);
  });

  it("screen → spherical → screen ≤ 3 CSS px", () => {
    const samples = [
      { x: 640, y: 360 },
      { x: 200, y: 200 },
      { x: 1000, y: 500 },
      { x: 640, y: 120 },
      { x: 100, y: 600 },
      { x: 1100, y: 100 },
    ];
    for (const screen of samples) {
      const sph = unprojectPoint(screen, camera);
      assert.ok(sph, `unproject failed at ${screen.x},${screen.y}`);
      const back = projectPoint(sph!, camera);
      assert.ok(back);
      const dist = screenDistance(screen, back!);
      assert.ok(
        dist <= 3,
        `round-trip ${dist.toFixed(2)}px > 3 at (${screen.x},${screen.y})`
      );
    }
  });

  it("points behind camera return null", () => {
    const sp = projectPoint({ yaw: 180, pitch: 0 }, camera);
    assert.equal(sp, null);
  });
});
