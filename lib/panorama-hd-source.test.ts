import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideHdSource, solveContextForExtent } from "./panorama-hd-source";
import {
  isPanoramaMultiResProfilesHd,
  withoutHdPanoramaProfiles,
} from "./panorama-profile";

const validProfile = {
  basePath: "/virtual-tour/panorama-tiles/st/scene/hd-1/mobile",
  path: "/%l/%s%y_%x",
  extension: "jpg",
  tileResolution: 512,
  maxLevel: 4,
  cubeResolution: 4096,
};

function hdShape(overrides: Record<string, unknown> = {}) {
  return {
    version: "jpeg85-v1",
    desktop: { ...validProfile, basePath: ".../desktop", tileResolution: 1024, maxLevel: 3 },
    mobile: validProfile,
    privacyVerified: true,
    sourcePanoramaUrl: "/virtual-tour/panoramas/st/p.webp",
    provenance: {
      source: "original",
      sourceKey: "/virtual-tour/originals/st/o.jpg",
      sourceDimensions: "11904x5952",
      generator: { jpegQuality: 85, cubeResolution: 4096, tileResolutions: { mobile: 512, desktop: 1024 } },
      createdAt: "2026-11-15T00:00:00.000Z",
    },
    ...overrides,
  };
}

describe("decideHdSource", () => {
  it("tanpa blur → original", () => {
    assert.equal(decideHdSource({}).kind, "original");
    assert.equal(decideHdSource(null).kind, "original");
  });

  it("blur draft (belum baked) → original, sama seperti Hemat", () => {
    const decision = decideHdSource({ privacyBlurs: [{ yaw: 1, pitch: 2 }] });
    assert.equal(decision.kind, "original");
  });

  it("blur baked → original-reblur (perlu re-bake native + verifikasi)", () => {
    const decision = decideHdSource({
      privacyBlurs: [{ yaw: 1, pitch: 2 }],
      privacyBlurLastBakedAt: "2026-09-01T04:23:37.257Z",
    });
    assert.equal(decision.kind, "original-reblur");
  });

  it("AI patch aktif → skip, master native tidak membawa patch", () => {
    const decision = decideHdSource({
      aiPatchLastBakedAt: "2026-11-15T05:00:00.000Z",
      aiPatchSourcePanoramaUrl: "/old.webp",
    });
    assert.equal(decision.kind, "skip");
    assert.match(decision.reason, /AI patch/);
  });

  it("blur baked tapi region hilang → skip (tak bisa direproduksi)", () => {
    const decision = decideHdSource({
      privacyBlurLastBakedAt: "2026-09-01T04:23:37.257Z",
      privacyBlurs: [],
    });
    assert.equal(decision.kind, "skip");
    assert.match(decision.reason, /region metadata tidak tersedia/);
  });

  it("solveContextForExtent mengatur extent tanpa mengubah width/scale (sigma setara)", () => {
    const blur = { yaw: 10, pitch: -2, width: 100, height: 72, intensity: 14, radius: 36, scale: 0.1 };
    const { context, region } = solveContextForExtent(blur, 2.5, 1.8);
    // Region dipertahankan: width×scale tetap → basis sigma tak berubah.
    assert.equal(region.width, 100);
    assert.equal(region.scale, 0.1);
    // halfYaw = (screenW/viewerW)×hfov → viewerW = 100×(100×0.1)/3.7 ≈ 2703
    const screenW = 100 * 0.1;
    const halfYaw = (screenW / context.viewerWidth) * context.hfov;
    assert.ok(Math.abs(halfYaw - 3.7) < 0.05, `halfYaw ${halfYaw}`);
    // Pitch target tercapai lewat bisection viewerH.
    const vfov = 2 * Math.atan((context.viewerHeight / context.viewerWidth) * Math.tan((context.hfov * Math.PI) / 360)) * 180 / Math.PI;
    const halfPitch = ((72 * 0.1) * vfov) / context.viewerHeight;
    assert.ok(Math.abs(halfPitch - 2.6) < 0.1, `halfPitch ${halfPitch}`);
  });
});

describe("kontrak metadata HD (reader: panorama-hd-profile)", () => {
  it("menerima bentuk valid", () => {
    assert.equal(isPanoramaMultiResProfilesHd(hdShape()), true);
  });

  it("menolak versi non-jpeg85-v1 (reader Hemat yang memvalidasi)", () => {
    assert.equal(isPanoramaMultiResProfilesHd(hdShape({ version: "hd-jpeg85-v1" })), false);
  });

  it("menolak tanpa privacyVerified / sourcePanoramaUrl / provenance", () => {
    const noVerified = { ...hdShape() };
    delete (noVerified as Record<string, unknown>).privacyVerified;
    assert.equal(isPanoramaMultiResProfilesHd(noVerified), false);
    const noSource = { ...hdShape() };
    delete (noSource as Record<string, unknown>).sourcePanoramaUrl;
    assert.equal(isPanoramaMultiResProfilesHd(noSource), false);
    const noProvenance = { ...hdShape() };
    delete (noProvenance as Record<string, unknown>).provenance;
    assert.equal(isPanoramaMultiResProfilesHd(noProvenance), false);
  });

  it("menolak tile bukan 512/1024", () => {
    assert.equal(isPanoramaMultiResProfilesHd(hdShape({
      desktop: { ...validProfile, tileResolution: 512 },
    })), false);
  });

  it("withoutHdPanoramaProfiles menghapus hanya kunci HD", () => {
    const canvas = {
      initialView: { yaw: 10 },
      multiResProfiles: { version: "jpeg85-v1" },
      multiResProfilesHd: hdShape(),
    };
    const cleaned = withoutHdPanoramaProfiles(canvas);
    assert.equal("multiResProfilesHd" in cleaned, false);
    assert.deepEqual(cleaned.multiResProfiles, { version: "jpeg85-v1" });
    assert.deepEqual(cleaned.initialView, { yaw: 10 });
    assert.deepEqual(withoutHdPanoramaProfiles(null), {});
  });
});
