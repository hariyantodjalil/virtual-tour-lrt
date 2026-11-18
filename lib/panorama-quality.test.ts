import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PanoramaQualityEstimator } from "./panorama-quality";
import { selectQualityMultiRes } from "./panorama-quality-profile";
import { extractHdMultiResProfilesFromCanvasData } from "./panorama-hd-profile";
import type { PanoramaMultiResProfiles, PannellumMultiRes } from "./panorama-profile";
import { buildPannellumSceneConfig, scenePreviewUrls } from "./pannellum-tour-config";
import { getAutomaticPanoramaQuality, observePanoramaNetwork } from "./panorama-quality";

function fastSamples(estimator: PanoramaQualityEstimator, start = 0) {
  for (let i = 0; i < 8; i++) {
    estimator.record({ start: start + i * 350, end: start + i * 350 + 100, bytes: 262144 });
  }
}

function profiles(basePath: string, cubeResolution: number): PanoramaMultiResProfiles {
  const profile = (tileResolution: number): PannellumMultiRes => ({
    basePath: `${basePath}/${tileResolution}`, tileResolution, cubeResolution,
    maxLevel: Math.log2(cubeResolution / tileResolution) + 1, extension: "jpg", path: "/%l/%s%y_%x",
  });
  return { version: "jpeg85-v1", desktop: profile(1024), mobile: profile(512) };
}

describe("automatic panorama quality", () => {
  it("starts economy and requires sustained real measurements to promote", () => {
    const estimator = new PanoramaQualityEstimator();
    assert.equal(estimator.choose(0, 1440, { effectiveType: "4g" }), "economy");
    estimator.record({ start: 0, end: 1, bytes: 1048576 });
    assert.equal(estimator.choose(2, 1440), "economy");
    fastSamples(estimator);
    assert.equal(estimator.choose(3000, 1440), "hd");
    assert.equal(estimator.choose(40000, 1440), "economy");
  });

  it("obeys save data and slow connection hints even after promotion", () => {
    const estimator = new PanoramaQualityEstimator();
    fastSamples(estimator);
    assert.equal(estimator.choose(3000, 1440), "hd");
    assert.equal(estimator.choose(3001, 1440, { saveData: true }), "economy");
    assert.equal(estimator.choose(3002, 1440, { effectiveType: "3g" }), "economy");
  });

  it("does not add individual concurrent request rates together", () => {
    const estimator = new PanoramaQualityEstimator();
    for (let i = 0; i < 8; i++) estimator.record({ start: 0, end: 3000, bytes: 65536 });
    assert.equal(estimator.choose(3001, 1440), "economy");
  });

  it("downgrades after failures and recovers with fresh measurements", () => {
    const estimator = new PanoramaQualityEstimator();
    fastSamples(estimator);
    assert.equal(estimator.choose(3000, 1440), "hd");
    estimator.fail(3500);
    estimator.fail(4000);
    assert.equal(estimator.choose(4001, 1440), "economy");
    fastSamples(estimator, 25000);
    assert.equal(estimator.choose(28000, 1440), "hd");
  });

  it("downgrades slow transfers and enforces a promotion cooldown", () => {
    const estimator = new PanoramaQualityEstimator();
    fastSamples(estimator);
    assert.equal(estimator.choose(3000, 1440), "hd");
    for (let i = 0; i < 8; i++) estimator.record({ start: 20000, end: 24000 + i * 100, bytes: 32768 });
    assert.equal(estimator.choose(25000, 1440), "economy");
    fastSamples(estimator, 26000);
    assert.equal(estimator.choose(29000, 1440), "economy");
    fastSamples(estimator, 48000);
    assert.equal(estimator.choose(51000, 1440), "hd");
  });

  it("selects HD per viewport with economy/legacy fallbacks", () => {
    const economy = profiles("/economy", 2048);
    const hd = profiles("/hd", 4096);
    assert.equal(selectQualityMultiRes({ multiResProfiles: economy, multiResProfilesHd: hd }, 1440, "hd"), hd.desktop);
    assert.equal(selectQualityMultiRes({ multiResProfiles: economy, multiResProfilesHd: hd }, 390, "hd"), hd.mobile);
    assert.equal(selectQualityMultiRes({ multiResProfiles: economy }, 1440, "hd"), economy.desktop);
    assert.equal(selectQualityMultiRes({ multiRes: economy.mobile }, 1440, "hd"), economy.mobile);
    assert.equal(selectQualityMultiRes({ multiResProfiles: economy, multiResProfilesHd: economy }, 1440, "hd"), economy.desktop);
  });

  it("rejects stale/unverified HD after an upload or privacy/AI bake", () => {
    const hd = { ...profiles("/hd", 4096), sourcePanoramaUrl: "/current", privacyVerified: true,
      privacyBlurLastBakedAt: "blur-version", aiPatchLastBakedAt: null,
      provenance: { source: "original-reblur", sourceKey: "/native", createdAt: "2026-11-15T00:00:00Z" } };
    const canvas = { multiResProfilesHd: hd, privacyBlurLastBakedAt: "blur-version" };
    assert.ok(extractHdMultiResProfilesFromCanvasData(canvas, "/current"));
    assert.equal(extractHdMultiResProfilesFromCanvasData(canvas, "/new"), undefined);
    assert.equal(extractHdMultiResProfilesFromCanvasData({ ...canvas, privacyBlurLastBakedAt: "new" }, "/current"), undefined);
    assert.equal(extractHdMultiResProfilesFromCanvasData({ ...canvas, aiPatchLastBakedAt: "new" }, "/current"), undefined);
    assert.equal(extractHdMultiResProfilesFromCanvasData({ ...canvas, multiResProfilesHd: { ...hd, privacyVerified: false } }, "/current"), undefined);
  });

  it("uses matching tile profiles for scene configuration and preloads, preserving entry view and hotspots", () => {
    const scene = {
      id: "destination", title: "Destination", panoramaUrl: "/image",
      multiResProfiles: profiles("/virtual-tour/panorama-tiles/economy", 2048),
      multiResProfilesHd: profiles("/virtual-tour/panorama-tiles/hd", 4096),
      initialView: { yaw: 35, pitch: -12, hfov: 100 },
      hotspots: [{ type: "space" as const, spaceCode: "UNIT-01", text: "Tenant", yaw: 20, pitch: -5 }],
    };
    const handlers = { onSceneHotspot() {}, onSpaceClick() {}, onInfoClick() {} };
    for (const width of [390, 1440]) {
      for (const quality of ["economy", "hd"] as const) {
        const config = buildPannellumSceneConfig(scene, [scene], handlers, width, quality);
        const preloads = scenePreviewUrls(scene, width, quality);
        assert.equal(preloads.length, 6);
        assert.ok("multiRes" in config);
        const selected = config.multiRes;
        assert.ok(preloads.every(url => url.startsWith(selected.basePath)));
        assert.equal(selected.tileResolution, width >= 1024 ? 1024 : 512);
        assert.equal(selected.cubeResolution, quality === "hd" ? 4096 : 2048);
        assert.equal(config.yaw, 35);
        assert.equal(config.pitch, -12);
        assert.equal(config.hfov, 100);
        assert.equal(config.hotSpots.length, 1);
        assert.equal(config.hotSpots[0].yaw, 20);
      }
    }
  });

  it("browser observer ignores cache hits and tracks real network transfers and errors", () => {
    const observerDescriptor = Object.getOwnPropertyDescriptor(globalThis, "PerformanceObserver");
    const locationDescriptor = Object.getOwnPropertyDescriptor(globalThis, "location");
    let callback: PerformanceObserverCallback;
    let disconnected = 0;
    class FakeObserver {
      constructor(handler: PerformanceObserverCallback) { callback = handler; }
      observe() {}
      disconnect() { disconnected++; }
    }
    Object.defineProperty(globalThis, "PerformanceObserver", { configurable: true, value: FakeObserver });
    Object.defineProperty(globalThis, "location", { configurable: true, value: new URL("http://localhost:3000/") });
    const now = performance.now();
    const entries = Array.from({ length: 8 }, (_, i) => ({
      name: `http://localhost:3000/api/s3-proxy/virtual-tour/panorama-tiles/test/1/f0_${i}.jpg`,
      requestStart: now - 3000 + i * 350, startTime: now - 3000 + i * 350,
      responseEnd: now - 2900 + i * 350, encodedBodySize: 262144, transferSize: 262444,
    }));
    const emit = (resources: unknown[]) => callback({ getEntries: () => resources } as PerformanceObserverEntryList, {} as PerformanceObserver);
    const stop = observePanoramaNetwork();
    try {
      emit(entries.map(entry => ({ ...entry, transferSize: 0 })));
      assert.equal(getAutomaticPanoramaQuality(1440), "economy");
      emit(entries);
      assert.equal(getAutomaticPanoramaQuality(1440), "hd");
      emit(entries.slice(0, 2).map(entry => ({ ...entry, responseStatus: 404, responseEnd: performance.now() })));
      assert.equal(getAutomaticPanoramaQuality(1440), "economy");
    } finally {
      stop();
      assert.equal(disconnected, 1);
      if (observerDescriptor) Object.defineProperty(globalThis, "PerformanceObserver", observerDescriptor);
      else Reflect.deleteProperty(globalThis, "PerformanceObserver");
      if (locationDescriptor) Object.defineProperty(globalThis, "location", locationDescriptor);
      else Reflect.deleteProperty(globalThis, "location");
    }
  });
});
