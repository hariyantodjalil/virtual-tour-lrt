import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { config } from "dotenv";
import { Client } from "pg";
import { panoramaProfileUpdateQuery } from "./panorama-backfill";

// Explicit opt-in; every write targets connection-scoped temporary tables only.
config({ quiet: true });
const enabled = process.env.PANORAMA_TEST_LOCAL_DB === "1";
describe("atomic panorama profile publication", { skip: !enabled }, () => {
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
    it(`${kind}: preserves newer camera/blur metadata and refuses stale publications`, async () => {
      const current = { initialView: { yaw: 95 }, privacyBlurs: [{ yaw: 12 }], multiRes: { basePath: "/legacy" } };
      await client.query(`INSERT INTO "${table}" ("id", "panoramaUrl", "canvasData") VALUES ($1,$2,$3)`, [kind, "/safe", current]);
      const publish = (panoramaUrl: string, previousProfiles: unknown, profiles: unknown) => {
        const sql = panoramaProfileUpdateQuery({ kind, id: kind, panoramaUrl, previousProfiles, profiles });
        return client.query(sql.text, sql.values);
      };
      assert.equal((await publish("/old-image", undefined, { version: "wrong" })).rowCount, 0);
      assert.equal((await publish("/safe", undefined, { version: "first" })).rowCount, 1);
      const row = (await client.query(`SELECT "canvasData" FROM "${table}" WHERE "id"=$1`, [kind])).rows[0];
      assert.deepEqual(row.canvasData, { ...current, multiResProfiles: { version: "first" } });
      assert.equal((await publish("/safe", undefined, { version: "stale" })).rowCount, 0);
      assert.equal((await publish("/safe", { version: "first" }, { version: "second" })).rowCount, 1);
    });
  }

  it("handles null or non-object canvas data without replacing other rows", async () => {
    for (const [id, canvas] of [["null", null], ["array", []], ["scalar", "invalid"]] as const) {
      await client.query('INSERT INTO "virtual_tour_scenes" ("id", "panoramaUrl", "canvasData") VALUES ($1,$2,$3)', [id, "/safe", JSON.stringify(canvas)]);
      const sql = panoramaProfileUpdateQuery({ kind: "station", id, panoramaUrl: "/safe", previousProfiles: null, profiles: { version: "new" } });
      assert.equal((await client.query(sql.text, sql.values)).rowCount, 1);
      const result = await client.query('SELECT "canvasData" FROM "virtual_tour_scenes" WHERE "id"=$1', [id]);
      assert.deepEqual(result.rows[0].canvasData, { multiResProfiles: { version: "new" } });
    }
  });
});
