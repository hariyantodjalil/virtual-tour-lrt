import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveSceneEntryView } from "./scene-entry-view";
import { normalizeHotspots } from "./hotspot-normalize";
import { sceneUpdateSchema } from "./api-schemas";
import { buildWalkPathHotspots } from "./walk-path";

test("destination camera takes precedence over source marker angles", () => {
  const initialView = { yaw: 160, pitch: 2, hfov: 90 };
  const marker = { yaw: -70, pitch: -20 };
  assert.deepEqual(resolveSceneEntryView(marker, initialView), initialView);
  const targetView = { yaw: 42, pitch: -3, hfov: 80 };
  assert.deepEqual(resolveSceneEntryView({ ...marker, targetView }, initialView), targetView);
  assert.deepEqual(resolveSceneEntryView(marker), { yaw: -70, pitch: -2.4, hfov: 120 });
});

test("normalization retains valid per-connection cameras and discards invalid legacy values", () => {
  const base = { type: "scene", sceneId: "b", yaw: 0, pitch: -12, text: "Go B" };
  const targetView = { yaw: 170, pitch: 0, hfov: 90 };
  assert.deepEqual(normalizeHotspots([{ ...base, targetView }])[0]?.targetView, targetView);
  for (const invalid of [null, { yaw: 0 }, { yaw: Infinity, pitch: 0 }, { yaw: 0, pitch: 0, hfov: 500 }]) {
    assert.equal(normalizeHotspots([{ ...base, targetView: invalid }])[0]?.targetView, undefined);
    assert.equal(sceneUpdateSchema.safeParse({ hotspots: [{ ...base, targetView: invalid }] }).success, false);
  }
  assert.equal(normalizeHotspots([{ ...base, type: "space", targetView }])[0]?.targetView, undefined);
  assert.equal(sceneUpdateSchema.safeParse({ hotspots: [base] }).success, true);
  assert.equal(sceneUpdateSchema.safeParse({ hotspots: [{ ...base, targetView }] }).success, true);
});

test("rebuilding a walking path retains separately configured forward and return arrival views", () => {
  const forward = { yaw: 85, pitch: 1, hfov: 100 };
  const back = { yaw: -95, pitch: 0, hfov: 110 };
  const paths = buildWalkPathHotspots([
    { sceneId: "a", title: "A", order: 0, hotspots: [{ type: "scene", sceneId: "b", text: "→ B", yaw: 0, pitch: -12, targetView: forward }] },
    { sceneId: "b", title: "B", order: 1, hotspots: [{ type: "scene", sceneId: "a", text: "← A", yaw: 180, pitch: -12, targetView: back }] },
  ]);
  assert.deepEqual(paths.get("a")?.[0]?.targetView, forward);
  assert.deepEqual(paths.get("b")?.[0]?.targetView, back);
});
