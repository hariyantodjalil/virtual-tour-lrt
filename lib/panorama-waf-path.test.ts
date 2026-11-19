import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isWafSafePanoramaBasePath,
  selectSceneMultiRes,
} from "./panorama-profile";
import { sampleTileKeyLength, WAF_MAX_S3_KEY_LENGTH } from "./panorama-tile-path";
import { newPanoramaTileRevisionId, shortTileBasePath } from "./panorama-tile-revision";

const base = {
  path: "/%l/%s%y_%x" as const,
  extension: "jpg" as const,
  tileResolution: 512 as const,
  maxLevel: 3,
  cubeResolution: 2048 as const,
};

describe("panorama WAF-safe tile paths", () => {
  it("rejects long legacy tile paths that F5 prod blocks by length", () => {
    const long =
      "/virtual-tour/panorama-tiles/train-lrt-jabodebek/gerbong-1-utama-01/9f904489-68cd-49b5-84d5-bae8416c9087/mobile";
    assert.equal(isWafSafePanoramaBasePath(long), false);
    assert.ok(sampleTileKeyLength(long) > WAF_MAX_S3_KEY_LENGTH);
  });

  it("short virtual-tour/pt paths stay under the WAF limit", () => {
    const rev = newPanoramaTileRevisionId("economy", 1_700_000_000_000, Buffer.from("abcd"));
    const path = shortTileBasePath("train-lrt-jabodebek", "gerbong-1-utama-01", rev, "economy", "mobile");
    assert.match(path, /^\/virtual-tour\/pt\/[a-f0-9]{12}\/[a-z0-9]+\/m$/i);
    assert.equal(isWafSafePanoramaBasePath(path), true);
    assert.ok(sampleTileKeyLength(path) <= WAF_MAX_S3_KEY_LENGTH);
  });

  it("selects only length-safe multiRes (no equirect fallback in selector)", () => {
    const long =
      "/virtual-tour/panorama-tiles/train-lrt-jabodebek/gerbong-1-utama-01/9f904489-68cd-49b5-84d5-bae8416c9087/mobile";
    assert.equal(selectSceneMultiRes({ multiRes: { ...base, basePath: long } }, 800), undefined);
    const short = "/virtual-tour/pt/abcdef123456/tabc1234/m";
    assert.equal(
      selectSceneMultiRes({ multiRes: { ...base, basePath: short } }, 800)?.basePath,
      short,
    );
  });
});
