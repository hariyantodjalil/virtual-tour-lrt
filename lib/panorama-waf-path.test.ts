import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectSceneMultiRes } from "./panorama-profile";
import { panoramaTileUrlBase, tileAliasId, WAF_MAX_S3_KEY_LENGTH } from "./panorama-tile-path";

const base = {
  path: "/%l/%s%y_%x" as const,
  extension: "jpg" as const,
  tileResolution: 512,
  maxLevel: 3,
  cubeResolution: 2048,
};

const long =
  "/virtual-tour/panorama-tiles/train-lrt-jabodebek/gerbong-1-utama-01/9f904489-68cd-49b5-84d5-bae8416c9087/mobile";

describe("panorama tile alias URLs", () => {
  it("keeps long multiRes selectable", () => {
    assert.equal(selectSceneMultiRes({ multiRes: { ...base, basePath: long } }, 800)?.basePath, long);
  });

  it("requests every tile through a short alias that stays under the prod WAF limit", () => {
    const aliased = panoramaTileUrlBase(long);
    assert.match(aliased, /^\/api\/t\/[0-9a-f]{16}$/);
    assert.equal(aliased, `/api/t/${tileAliasId(`${long}/`)}`);
    assert.ok(`${aliased}/1/f0_0.jpg`.length <= WAF_MAX_S3_KEY_LENGTH);
    assert.equal(panoramaTileUrlBase("/virtual-tour/panorama-tiles/st/sc/t1/mobile").startsWith("/api/t/"), true);
  });

  it("leaves already-resolved URLs untouched", () => {
    assert.equal(panoramaTileUrlBase("/api/t/0123456789abcdef/"), "/api/t/0123456789abcdef");
    assert.equal(panoramaTileUrlBase("https://cdn.example/tiles/"), "https://cdn.example/tiles");
  });
});
