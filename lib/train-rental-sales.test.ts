import assert from "node:assert/strict";
import test from "node:test";
import { emptyCarTrainsetMap, isAllTrainsets, parseCarTrainsetMap } from "./train-rental-sales";

test("availability preserves a carriage created in DB beyond the old six", () => {
  const map = parseCarTrainsetMap({ "gerbong-7": ["ts32", "TS32"] });
  assert.deepEqual(map, { "gerbong-7": ["TS32"] });
  assert.equal("gerbong-1" in map, false);
});

test("legacy shared availability only expands over the provided DB car catalog", () => {
  assert.deepEqual(parseCarTrainsetMap({}, ["TS40"], [{ slug: "kabin-baru" }]), { "kabin-baru": ["TS40"] });
  assert.deepEqual(emptyCarTrainsetMap(), {});
});

test("all trainsets uses catalog identity rather than a fixed fleet size", () => {
  assert.equal(isAllTrainsets(["TS99", "TS98"], ["TS32", "TS33"]), false);
  assert.equal(isAllTrainsets(["TS32"], ["TS32"]), true);
  assert.equal(isAllTrainsets([], []), false);
});

test("untrusted JSON keys cannot replace the availability object prototype", () => {
  const map = parseCarTrainsetMap(JSON.parse('{"__proto__":["TS01"]}'));
  assert.equal(Object.getPrototypeOf(map), Object.prototype);
});
