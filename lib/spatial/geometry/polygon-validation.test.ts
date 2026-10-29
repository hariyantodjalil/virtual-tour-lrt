import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateSphericalPolygon,
  validateSphericalPolygonAuthoring,
} from "./polygon-validation";

describe("validateSphericalPolygon", () => {
  it("accepts simple quad", () => {
    const r = validateSphericalPolygon([
      { yaw: -10, pitch: -2 },
      { yaw: 10, pitch: -2 },
      { yaw: 10, pitch: -12 },
      { yaw: -10, pitch: -12 },
    ]);
    assert.equal(r.ok, true);
  });

  it("rejects fewer than 3 vertices", () => {
    const r = validateSphericalPolygon([
      { yaw: 0, pitch: 0 },
      { yaw: 1, pitch: 0 },
    ]);
    assert.equal(r.ok, false);
  });

  it("rejects self-intersecting bowtie", () => {
    const r = validateSphericalPolygon([
      { yaw: -10, pitch: -2 },
      { yaw: 10, pitch: -12 },
      { yaw: 10, pitch: -2 },
      { yaw: -10, pitch: -12 },
    ]);
    assert.equal(r.ok, false);
  });

  it("rejects oversized span", () => {
    // Chord sphere antar vertex > MAX_SPAN_DEG (160°)
    const r = validateSphericalPolygon([
      { yaw: 0, pitch: 0 },
      { yaw: 170, pitch: 0 },
      { yaw: 170, pitch: -15 },
      { yaw: 0, pitch: -15 },
    ]);
    assert.equal(r.ok, false);
  });

  it("accepts shop-corner wrap within span budget", () => {
    const r = validateSphericalPolygon([
      { yaw: -25, pitch: -2 },
      { yaw: 5, pitch: -2 },
      { yaw: 35, pitch: -4 },
      { yaw: 35, pitch: -16 },
      { yaw: 5, pitch: -18 },
      { yaw: -25, pitch: -16 },
    ]);
    assert.equal(r.ok, true);
  });

  it("authoring rejects melencong outlier vertex", () => {
    // Tiga sudut ruko + satu titik jauh ke kanan (tanpa bowtie)
    const r = validateSphericalPolygonAuthoring([
      { yaw: -6, pitch: -3 },
      { yaw: 50, pitch: -3 },
      { yaw: 6, pitch: -14 },
      { yaw: -6, pitch: -14 },
    ]);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /melencong/i);
  });

  it("authoring accepts tight shop quad", () => {
    const r = validateSphericalPolygonAuthoring([
      { yaw: -8, pitch: -2 },
      { yaw: 8, pitch: -2 },
      { yaw: 8, pitch: -12 },
      { yaw: -8, pitch: -12 },
    ]);
    assert.equal(r.ok, true);
  });
});
