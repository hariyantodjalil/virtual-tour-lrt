import { it } from "node:test";
import assert from "node:assert/strict";
import { runSpatialAction } from "../actions";
import { validateSpatialLinks } from "../links";
import { normalizeSpatialEntities } from "../normalize";
import type { SpatialEntity } from "../types";
import { spatialUnitInteractionKeys } from "../unit-groups";

const area: SpatialEntity = {
  id: "area", kind: "SPATIAL_AREA", sceneId: "scene", enabled: true, revision: 1, schemaVersion: 1,
  unitId: "unit", spaceCode: "UNIT-1", action: { type: "unit_detail", targetId: "unit" }, style: {},
  geometry: { type: "spherical_polygon", vertices: [
    { yaw: -10, pitch: 10 }, { yaw: 10, pitch: 10 }, { yaw: 10, pitch: -10 }, { yaw: -10, pitch: -10 },
  ] },
};

it("dispatches each action explicitly and never opens a unit for action none", () => {
  const calls: string[] = [];
  const handlers = {
    openUnit: (id: string) => calls.push(`unit:${id}`),
    openScene: (id: string) => calls.push(`scene:${id}`),
    openInfo: (title: string) => calls.push(`info:${title}`),
  };
  runSpatialAction({ ...area, action: { type: "none" } }, handlers);
  assert.deepEqual(calls, []);
  runSpatialAction(area, handlers);
  runSpatialAction({ ...area, action: { type: "open_scene", targetId: "next" } }, handlers);
  runSpatialAction({ ...area, action: { type: "info_detail", title: "Informasi" } }, handlers);
  assert.deepEqual(calls, ["unit:UNIT-1", "scene:next", "info:Informasi"]);
});

it("normalizer skips unknown schema versions without losing valid areas", () => {
  const result = normalizeSpatialEntities([area, { ...area, id: "future", schemaVersion: 2 }], "scene");
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "area");
});

it("rejects duplicate area IDs and mismatched unit code before storage", () => {
  const units = [{ id: "unit", code: "UNIT-1" }];
  assert.equal(validateSpatialLinks([area, area], "scene", units, ["scene"]).ok, false);
  assert.equal(validateSpatialLinks([{ ...area, spaceCode: "WRONG" }], "scene", units, ["scene"]).ok, false);
});

it("groups faces by unit identity and connects legacy code-only faces", () => {
  const otherSide = { ...area, id: "other-side", spaceCode: "renamed-code" };
  const legacy = { ...area, id: "legacy", unitId: null, spaceCode: " unit-1 " };
  const keys = spatialUnitInteractionKeys([area, otherSide, legacy]);
  assert.equal(keys.get(area.id), keys.get(otherSide.id));
  assert.equal(keys.get(area.id), keys.get(legacy.id));
});

it("groups normalized codes but keeps unlinked areas separate", () => {
  const a = { ...area, id: "a", unitId: null };
  const b = { ...area, id: "b", unitId: null, spaceCode: " unit-1 " };
  const unlinkedA = { ...area, id: "unlinked-a", unitId: null, spaceCode: null };
  const unlinkedB = { ...unlinkedA, id: "unlinked-b" };
  const keys = spatialUnitInteractionKeys([a, b, unlinkedA, unlinkedB]);
  assert.equal(keys.get(a.id), keys.get(b.id));
  assert.notEqual(keys.get(unlinkedA.id), keys.get(unlinkedB.id));
  assert.notEqual(keys.get(a.id), keys.get(unlinkedA.id));
});

it("does not merge distinct unit IDs when stale codes conflict", () => {
  const other = { ...area, id: "other", unitId: "different-unit" };
  const legacy = { ...area, id: "legacy", unitId: null };
  const keys = spatialUnitInteractionKeys([area, other, legacy]);
  assert.notEqual(keys.get(area.id), keys.get(other.id));
  assert.notEqual(keys.get(legacy.id), keys.get(area.id));
  assert.notEqual(keys.get(legacy.id), keys.get(other.id));
});
