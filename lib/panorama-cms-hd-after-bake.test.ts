import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideCmsHdAfterBake } from "./panorama-cms-hd-after-bake";

describe("decideCmsHdAfterBake", () => {
  const blurs = [{ pitch: 0, yaw: 0, width: 8, height: 8, intensity: 1, radius: 0.5, scale: 1 }];

  it("queues when original + blur regions tersedia", () => {
    assert.deepEqual(
      decideCmsHdAfterBake({
        originalPanoramaUrl: "/virtual-tour/originals/x.jpg",
        privacyBlurs: blurs,
        canvasDataForGuards: {},
        displayWidth: 6000,
      }),
      { status: "queued" }
    );
  });

  it("skips when original kosong", () => {
    const d = decideCmsHdAfterBake({
      originalPanoramaUrl: null,
      privacyBlurs: blurs,
      canvasDataForGuards: {},
      displayWidth: 6000,
    });
    assert.equal(d.status, "skipped");
  });

  it("skips when AI patch aktif", () => {
    const d = decideCmsHdAfterBake({
      originalPanoramaUrl: "/virtual-tour/originals/x.jpg",
      privacyBlurs: blurs,
      canvasDataForGuards: { aiPatchLastBakedAt: "2026-11-16T00:00:00.000Z" },
      displayWidth: 6000,
    });
    assert.equal(d.status, "skipped");
  });
});
