import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { projectPolygonFragments, fragmentToPathD } from "./clipping";
import { normalizeYaw } from "./spherical";
import { spatialEntitiesSchema } from "../spatial-entity-schema";
import type { CameraState } from "../types";

const camera: CameraState = {
  yawDeg: 0, pitchDeg: 0, hfovDeg: 100, widthCssPx: 1280, heightCssPx: 720,
};
const quad = [
  { yaw: -25, pitch: 15 }, { yaw: 25, pitch: 15 },
  { yaw: 25, pitch: -15 }, { yaw: -25, pitch: -15 },
];

describe("spatial clipping regressions", () => {
  it("clips visible polygons against every viewport edge over a full pan cycle", () => {
    let visible = 0;
    for (let yaw = -180; yaw <= 180; yaw += 3) {
      const fragments = projectPolygonFragments(quad, { ...camera, yawDeg: yaw });
      visible += fragments.length;
      for (const fragment of fragments) {
        assert.ok(!/NaN|Infinity/.test(fragmentToPathD(fragment)));
        for (const p of fragment.points) {
          assert.ok(p.x >= 0 && p.x <= camera.widthCssPx);
          assert.ok(p.y >= 0 && p.y <= camera.heightCssPx);
        }
      }
    }
    assert.ok(visible > 0);
    assert.equal(projectPolygonFragments(quad, { ...camera, yawDeg: 180 }).length, 0);
  });
  it("preserves a near-plane crossing polygon that still intersects the viewport", () => {
    const fragments = projectPolygonFragments([
      { yaw: -10, pitch: 12 }, { yaw: 110, pitch: 12 },
      { yaw: 110, pitch: -12 }, { yaw: -10, pitch: -12 },
    ], camera);
    assert.ok(fragments.length > 0);
    assert.ok(fragments[0].points.some((p) => Math.abs(p.x - camera.widthCssPx) < 0.01));
    assert.equal(fragments[0].fullyVisible, false);
  });
  it("keeps a seam polygon visible at yaw 180 rather than wrapping across the world", () => {
    const seam = quad.map((p) => ({ ...p, yaw: normalizeYaw(p.yaw + 180) }));
    assert.ok(projectPolygonFragments(seam, { ...camera, yawDeg: 180 }).length > 0);
    assert.equal(projectPolygonFragments(seam, camera).length, 0);
  });
  it("normalizes extreme finite yaw in constant time and rejects it at the API boundary", () => {
    assert.ok(Number.isFinite(normalizeYaw(1e20)));
    assert.equal(normalizeYaw(180), -180);
    assert.equal(normalizeYaw(-540), -180);
    const input = [{
      id: "area", kind: "SPATIAL_AREA", sceneId: "scene", enabled: true,
      schemaVersion: 1, revision: 1, action: { type: "none" },
      geometry: { type: "spherical_polygon", vertices: quad.map((p) => ({ ...p, yaw: 1e20 })) },
    }];
    assert.equal(spatialEntitiesSchema.safeParse(input).success, false);
  });
});
