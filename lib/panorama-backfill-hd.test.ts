import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { config } from "dotenv";
import { Client } from "pg";
import { panoramaHdProfileUpdateQuery } from "./panorama-backfill";

// Explicit opt-in; every write targets connection-scoped temporary tables only.
config({ quiet: true });
const enabled = process.env.PANORAMA_TEST_LOCAL_DB === "1";

const HD = {
  version: "jpeg85-v1",
  desktop: {
    basePath: "/t/desktop", path: "/%l/%s%y_%x", extension: "jpg",
    tileResolution: 1024, maxLevel: 3, cubeResolution: 4096,
  },
  mobile: {
    basePath: "/t/mobile", path: "/%l/%s%y_%x", extension: "jpg",
    tileResolution: 512, maxLevel: 4, cubeResolution: 4096,
  },
  privacyVerified: true,
  sourcePanoramaUrl: "/panorama.webp",
  provenance: {
    source: "original", sourceKey: "/originals/o.jpg", sourceDimensions: "11904x5952",
    generator: { jpegQuality: 85, cubeResolution: 4096, tileResolutions: { mobile: 512, desktop: 1024 } },
    createdAt: "2026-11-15T00:00:00.000Z",
  },
};

describe("atomic HD profile publication", { skip: !enabled }, () => {
  let client: Client;
  before(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Tests require a local database");
    url.searchParams.delete("schema");
    client = new Client({ connectionString: url.toString() });
    await client.connect();
    for (const name of ["virtual_tour_scenes", "train_tour_scenes"]) {
      await client.query(`CREATE TEMP TABLE "${name}" (
        "id" text PRIMARY KEY, "panoramaUrl" text, "canvasData" jsonb,
        "updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP
      )`);
    }
  });
  after(async () => { await client?.end(); });

  for (const kind of ["station", "train"] as const) {
    const table = kind === "station" ? "virtual_tour_scenes" : "train_tour_scenes";

    it(`${kind}: publish mempertahankan kunci canvasData lain`, async () => {
      const current = {
        initialView: { yaw: 5, pitch: -3 },
        multiRes: { basePath: "/legacy" },
        multiResProfiles: { version: "jpeg85-v1" },
        privacyBlurs: [{ yaw: 1, pitch: 2, width: 100, height: 72, intensity: 14, radius: 36, scale: 0.1 }],
        privacyBlurLastBakedAt: "2026-09-01T04:23:37.257Z",
      };
      await client.query(`INSERT INTO "${table}" ("id","panoramaUrl","canvasData") VALUES ('merge','/safe',$1)`,
        [JSON.stringify(current)]);
      const sql = panoramaHdProfileUpdateQuery({
        kind, id: "merge", panoramaUrl: "/safe",
        privacyBlurLastBakedAt: "2026-09-01T04:23:37.257Z", aiPatchLastBakedAt: null,
        privacyBlurs: current.privacyBlurs, previousHd: null, hd: HD,
      });
      assert.equal((await client.query(sql.text, sql.values)).rowCount, 1);
      const row = (await client.query(`SELECT "canvasData" FROM "${table}" WHERE "id"='merge'`)).rows[0];
      assert.equal(row.canvasData.multiResProfilesHd.version, "jpeg85-v1");
      assert.equal(row.canvasData.multiResProfilesHd.privacyVerified, true);
      assert.deepEqual(row.canvasData.multiResProfiles, { version: "jpeg85-v1" });
      assert.deepEqual(row.canvasData.initialView, { yaw: 5, pitch: -3 });
      assert.deepEqual(row.canvasData.multiRes, { basePath: "/legacy" });
    });

    it(`${kind}: menolak panorama yang berganti selama proses`, async () => {
      await client.query(`INSERT INTO "${table}" ("id","panoramaUrl","canvasData") VALUES ('stale','/old',$1)`,
        [JSON.stringify({ privacyBlurs: [] })]);
      const sql = panoramaHdProfileUpdateQuery({
        kind, id: "stale", panoramaUrl: "/new-image",
        privacyBlurLastBakedAt: null, aiPatchLastBakedAt: null,
        privacyBlurs: [], previousHd: null, hd: HD,
      });
      assert.equal((await client.query(sql.text, sql.values)).rowCount, 0);
    });

    it(`${kind}: menolak bila blur berubah (draft region ditambah editor)`, async () => {
      await client.query(`INSERT INTO "${table}" ("id","panoramaUrl","canvasData") VALUES ('blur','/safe',$1)`,
        [JSON.stringify({ privacyBlurs: [{ yaw: 1 }] })]);
      const sql = panoramaHdProfileUpdateQuery({
        kind, id: "blur", panoramaUrl: "/safe",
        privacyBlurLastBakedAt: null, aiPatchLastBakedAt: null,
        privacyBlurs: [{ yaw: 1 }, { yaw: 2 }], previousHd: null, hd: HD,
      });
      assert.equal((await client.query(sql.text, sql.values)).rowCount, 0);
    });

    it(`${kind}: menolak bila status bake/AI berubah, dan bila HD sudah ada`, async () => {
      const base = { privacyBlurs: [], privacyBlurLastBakedAt: null };
      await client.query(`INSERT INTO "${table}" ("id","panoramaUrl","canvasData") VALUES ('guard','/safe',$1)`,
        [JSON.stringify(base)]);
      const publish = (o: Partial<Parameters<typeof panoramaHdProfileUpdateQuery>[0]>) =>
        client.query(...(() => {
          const sql = panoramaHdProfileUpdateQuery({
            kind, id: "guard", panoramaUrl: "/safe",
            privacyBlurLastBakedAt: null, aiPatchLastBakedAt: null,
            privacyBlurs: [], previousHd: null, hd: HD, ...o,
          });
          return [sql.text, sql.values] as const;
        })());
      assert.equal((await publish({ privacyBlurLastBakedAt: "2026-11-15T00:00:00.000Z" })).rowCount, 0);
      assert.equal((await publish({ aiPatchLastBakedAt: "2026-11-15T00:00:00.000Z" })).rowCount, 0);
      assert.equal((await publish({})).rowCount, 1);
      // HD sudah terpasang — publikasi ulang dengan previousHd null harus ditolak.
      assert.equal((await publish({})).rowCount, 0);
      const row = (await client.query(`SELECT "canvasData"->'multiResProfilesHd' hd FROM "${table}" WHERE "id"='guard'`)).rows[0];
      assert.equal(row.hd.provenance.sourceKey, "/originals/o.jpg");
    });
  }
});
