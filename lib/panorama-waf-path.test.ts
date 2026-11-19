import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPanoramaMultiresBlockedByEdge,
  isWafSafePanoramaBasePath,
  newPanoramaTileRevisionId,
  selectSceneMultiRes,
} from "./panorama-profile";

const base = {
  path: "/%l/%s%y_%x" as const,
  extension: "jpg" as const,
  tileResolution: 512 as const,
  maxLevel: 3,
  cubeResolution: 2048 as const,
};

describe("panorama WAF-safe tile paths", () => {
  it("rejects UUID segments that F5 prod blocks", () => {
    const uuid = "9f904489-68cd-49b5-84d5-bae8416c9087";
    assert.equal(
      isWafSafePanoramaBasePath(`/virtual-tour/panorama-tiles/train/x/${uuid}/mobile`),
      false,
    );
    assert.equal(
      isWafSafePanoramaBasePath(`/virtual-tour/panorama-tiles/train/x/hd-${uuid}/mobile`),
      false,
    );
  });

  it("generates revision ids without UUID shape for economy and hd", () => {
    const economy = newPanoramaTileRevisionId("economy", 1_700_000_000_000, Buffer.from("abcde"));
    const hd = newPanoramaTileRevisionId("hd", 1_700_000_000_000, Buffer.from("abcde"));
    assert.match(economy, /^t[a-z0-9]+$/i);
    assert.match(hd, /^hdt[a-z0-9]+$/i);
    assert.equal(isWafSafePanoramaBasePath(`/virtual-tour/panorama-tiles/st/sc/${economy}/mobile`), true);
    assert.equal(isWafSafePanoramaBasePath(`/virtual-tour/panorama-tiles/st/sc/${hd}/desktop`), true);
  });

  it("skips UUID multiRes so viewer can fall back to equirectangular", () => {
    const uuidPath = "/virtual-tour/panorama-tiles/train/x/9f904489-68cd-49b5-84d5-bae8416c9087/mobile";
    assert.equal(selectSceneMultiRes({ multiRes: { ...base, basePath: uuidPath } }, 800), undefined);
    const safe = "/virtual-tour/panorama-tiles/train/x/tk1abc/mobile";
    assert.equal(
      selectSceneMultiRes({ multiRes: { ...base, basePath: safe } }, 800)?.basePath,
      safe,
    );
  });

  it("honors NEXT_PUBLIC_PANORAMA_BLOCK_MULTIRES for edge WAF lock", () => {
    const prev = process.env.NEXT_PUBLIC_PANORAMA_BLOCK_MULTIRES;
    process.env.NEXT_PUBLIC_PANORAMA_BLOCK_MULTIRES = "1";
    assert.equal(isPanoramaMultiresBlockedByEdge(), true);
    assert.equal(isWafSafePanoramaBasePath("/virtual-tour/panorama-tiles/train/x/tk1abc/mobile"), false);
    process.env.NEXT_PUBLIC_PANORAMA_BLOCK_MULTIRES = "0";
    assert.equal(isPanoramaMultiresBlockedByEdge(), false);
    assert.equal(isWafSafePanoramaBasePath("/virtual-tour/panorama-tiles/train/x/tk1abc/mobile"), true);
    if (prev === undefined) delete process.env.NEXT_PUBLIC_PANORAMA_BLOCK_MULTIRES;
    else process.env.NEXT_PUBLIC_PANORAMA_BLOCK_MULTIRES = prev;
  });
});
