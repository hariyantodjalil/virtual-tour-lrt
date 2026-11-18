import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canRestoreAiPatch, isAiPatchApplied, markAiPatchBaked,
  markAiPatchRestored, resetAiPatchForNewPanorama,
} from "./ai-patch-normalize";

const record = {
  prompt: "Remove temporary sign", yaw: 0, pitch: 0, hfov: 90,
  patchWidth: 512, patchHeight: 512, model: "test", createdAt: "2026-11-15T01:00:00Z",
};
const blurred = {
  privacyBlurLastBakedAt: "2026-11-14T01:00:00Z",
  privacyBlurSourcePanoramaUrl: "/private-master",
  privacyBlurs: [{ yaw: 1, pitch: 2 }],
};

describe("AI restore privacy safety", () => {
  it("allows restore when the applied privacy version matches", () => {
    const patched = markAiPatchBaked(blurred, "/blurred-image", record);
    assert.equal(canRestoreAiPatch(patched), true);
    assert.equal(isAiPatchApplied(patched), true);
    const restored = markAiPatchRestored(patched);
    assert.equal(isAiPatchApplied(restored), false);
    assert.deepEqual(restored.privacyBlurs, blurred.privacyBlurs);
    assert.equal(restored.privacyBlurLastBakedAt, blurred.privacyBlurLastBakedAt);
    assert.equal(restored.aiPatchPrivacySnapshot, undefined);
  });

  it("blocks restore after another privacy bake or a changed master", () => {
    const patched = markAiPatchBaked(blurred, "/blurred-image", record);
    assert.equal(canRestoreAiPatch({ ...patched, privacyBlurLastBakedAt: record.createdAt }), false);
    assert.equal(canRestoreAiPatch({ ...patched, privacyBlurSourcePanoramaUrl: "/other" }), false);
  });

  it("draft blur edits do not prevent restoring AI before the next privacy bake", () => {
    const patched = markAiPatchBaked(blurred, "/blurred-image", record);
    assert.equal(canRestoreAiPatch({ ...patched, privacyBlurs: [{ yaw: 30, pitch: 2 }] }), true);
  });

  it("keeps the first privacy snapshot over multiple patches", () => {
    const first = markAiPatchBaked(blurred, "/blurred-image", record);
    const second = markAiPatchBaked({ ...first, privacyBlurLastBakedAt: record.createdAt }, "/blurred-image", record);
    assert.deepEqual(second.aiPatchPrivacySnapshot, first.aiPatchPrivacySnapshot);
    assert.equal(canRestoreAiPatch(second), false);
  });

  it("does not invent provenance for legacy AI history", () => {
    const legacy = { ...blurred, aiPatchSourcePanoramaUrl: "/old", aiPatchLastBakedAt: record.createdAt };
    assert.equal(canRestoreAiPatch(legacy), false);
    assert.equal(markAiPatchBaked(legacy, "/old", record).aiPatchPrivacySnapshot, undefined);
    assert.equal(canRestoreAiPatch({ ...legacy, privacyBlurLastBakedAt: null }), true);
  });

  it("tracks an unblurred source and resets provenance on a new upload", () => {
    const patched = markAiPatchBaked({}, "/image", record);
    assert.equal(canRestoreAiPatch(patched), true);
    assert.equal(canRestoreAiPatch({ ...patched, privacyBlurLastBakedAt: record.createdAt }), false);
    const reset = resetAiPatchForNewPanorama(patched);
    assert.equal(reset.aiPatchPrivacySnapshot, undefined);
    assert.equal(reset.aiPatchSourcePanoramaUrl, undefined);
  });
});
