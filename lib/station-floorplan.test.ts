import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptyFloorplanData,
  layersFromCatalog,
  layersToMinimapAssets,
  parseStationFloorplanData,
  stationFloorplanDataSchema,
  validatePlacedAssetRefs,
} from "./station-floorplan";
import { concourseAssetCode } from "./concourse-plan";
import { minimapAssets, resolveStationMinimap } from "./station-minimap";

describe("station-floorplan", () => {
  it("layersFromCatalog returns tipikal layers for Type A station", () => {
    const layers = layersFromCatalog("tmii");
    assert.ok(layers.length >= 2);
    assert.equal(layers[0]?.name, "Concourse");
    assert.match(layers[0]?.sourceKey ?? "", /virtual-tour\/floorplans\//);
  });

  it("layersToMinimapAssets maps active layers only", () => {
    const assets = layersToMinimapAssets([
      {
        id: "a", name: "Concourse", sourceKey: "virtual-tour/floorplans/x/concourse.webp",
        url: "/virtual-tour/floorplans/x/concourse.webp", viewBox: "0 0 100 80",
        width: 100, height: 80, isActive: true,
      },
      {
        id: "b", name: "Hidden", sourceKey: "virtual-tour/floorplans/x/hidden.webp",
        url: "/virtual-tour/floorplans/x/hidden.webp", viewBox: "0 0 100 80",
        width: 100, height: 80, isActive: false,
      },
    ]);
    assert.equal(assets.length, 1);
    assert.equal(assets[0]?.name, "Concourse");
  });

  it("respects an empty saved floorplan and restricts linked layers to their level", () => {
    const [reference] = layersFromCatalog("harjamukti");
    assert.ok(reference);
    const layer = { ...reference, name: "Lantai baru", levelId: "concourse" };
    assert.deepEqual(minimapAssets("harjamukti", []), []);
    assert.deepEqual(minimapAssets("harjamukti", [layer], "peron"), []);
    const minimap = resolveStationMinimap("harjamukti", {
      id: "concourse", slug: "concourse", label: "Concourse", minimap: null,
    }, [layer]);
    assert.equal(minimap?.asset.name, "Lantai baru");
  });

  it("rejects placed space with unknown spaceId", () => {
    const data = {
      ...emptyFloorplanData(),
      floorPlans: [{
        id: "floor-1", name: "Concourse", sourceKey: "virtual-tour/floorplans/x/concourse.webp",
        url: "/virtual-tour/floorplans/x/concourse.webp", viewBox: "0 0 100 80",
        width: 100, height: 80, isActive: true,
      }],
      placedAssets: [{
        id: "space-1", kind: "space" as const, spaceId: "missing",
        floorPlanId: "floor-1", x: 10, y: 20, scale: 1, rotation: 0,
      }],
    };
    const error = validatePlacedAssetRefs(data, {
      spaceIds: new Set(["real-space"]),
      slotIds: new Set(),
      sceneIds: new Set(),
    });
    assert.equal(error, "Unit komersial tidak valid untuk stasiun ini.");
  });

  it("accepts valid space placement and keeps Ganang code from slot", () => {
    const data = stationFloorplanDataSchema.parse({
      floorPlans: [{
        id: "floor-1", name: "Concourse", sourceKey: "virtual-tour/floorplans/x/concourse.webp",
        url: "/virtual-tour/floorplans/x/concourse.webp", viewBox: "0 0 100 80",
        width: 100, height: 80, isActive: true,
      }],
      placedAssets: [{
        id: "space-1", kind: "space", spaceId: "space-real", slotId: "slot-1",
        floorPlanId: "floor-1", x: 12, y: 34,
      }],
    });
    const error = validatePlacedAssetRefs(data, {
      spaceIds: new Set(["space-real"]),
      slotIds: new Set(["slot-1"]),
      sceneIds: new Set(),
    });
    assert.equal(error, null);
    assert.equal(
      concourseAssetCode("HJM", {
        access: "PAD", kind: "F", sequence: 1,
      }),
      "HJM-CON-PAD-F-001",
    );
    assert.equal(validatePlacedAssetRefs(data, {
      spaceIds: new Set(["space-real"]),
      slotIds: new Set(["slot-1"]),
      slotSpaceIds: new Map([["slot-1", "other-space"]]),
      sceneIds: new Set(),
    }), "Slot kodifikasi sudah terkait dengan unit lain.");
    const [pin] = data.placedAssets;
    assert.equal(validatePlacedAssetRefs({ ...data, placedAssets: [{ ...pin, x: 101 }] }, {
      spaceIds: new Set(["space-real"]), slotIds: new Set(["slot-1"]), sceneIds: new Set(),
    }), "Pin berada di luar denah.");
    const roundtrip = parseStationFloorplanData(data);
    assert.equal(roundtrip.placedAssets[0]?.kind, "space");
    if (roundtrip.placedAssets[0]?.kind === "space") {
      assert.equal(roundtrip.placedAssets[0].spaceId, "space-real");
      assert.equal(roundtrip.placedAssets[0].x, 12);
    }
  });
});
