import assert from "node:assert/strict";
import { NextRequest } from "next/server";

// This script writes fixtures only to a dedicated disposable local database.
const databaseUrl = process.env.SPATIAL_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("SPATIAL_TEST_DATABASE_URL is required (disposable local DB).");
const target = new URL(databaseUrl);
if (target.hostname !== "127.0.0.1" || target.port !== "6147" || target.pathname !== "/lrt_spatial_test") {
  throw new Error("Refusing to run outside 127.0.0.1:6147/lrt_spatial_test.");
}
process.env.DATABASE_URL = databaseUrl;
process.env.NEXTAUTH_SECRET = "local-spatial-verification-only-secret-32-characters";
process.env.CMS_SPATIAL_HOTSPOT = "1";
process.env.NEXT_PUBLIC_CMS_SPATIAL_HOTSPOT = "1";

const { prisma } = await import("../lib/prisma");
const { signToken } = await import("../lib/auth");
const { PUT } = await import("../app/api/cms/virtual-tour/[stationId]/[sceneId]/route");
const { getStationBySlug } = await import("../lib/stations-data");
const suffix = Date.now().toString(36);
let checks = 0;
function pass(label: string) { checks++; console.log(`PASS ${label}`); }
try {
  const user = await prisma.user.create({ data: {
    email: `spatial-${suffix}@example.invalid`, password: "unused-test-password", name: "Local test", role: "EDITOR",
  }, select: { id: true, email: true } });
  const station = await prisma.station.create({ data: {
    name: "Spatial verification", slug: `spatial-test-${suffix}`, address: "Local test", line: "Test",
  } });
  const otherStation = await prisma.station.create({ data: {
    name: "Other station", slug: `other-${suffix}`, address: "Local test", line: "Test",
  } });
  const unit = await prisma.commercialSpace.create({ data: {
    stationId: station.id, code: "TEST-001", name: "Unit test", area: 10, monthlyRent: 100, location: "Test",
  } });
  const otherUnit = await prisma.commercialSpace.create({ data: {
    stationId: otherStation.id, code: "OTHER-001", name: "Other unit", area: 10, monthlyRent: 100, location: "Test",
  } });
  const scene = await prisma.virtualTourScene.create({ data: {
    stationId: station.id, sceneId: "test-scene", title: "Scene test", panoramaUrl: "/test.jpg",
    hotspots: [{ type: "space", spaceCode: unit.code, yaw: 0, pitch: 0 }],
  } });
  const token = signToken({ userId: user.id, email: user.email, role: "EDITOR" });
  const entity = {
    id: "test-area", kind: "SPATIAL_AREA", sceneId: scene.sceneId,
    unitId: unit.id, spaceCode: unit.code, label: "Test area", enabled: true,
    schemaVersion: 1, revision: 1, action: { type: "unit_detail", targetId: unit.id },
    geometry: { type: "spherical_polygon", vertices: [
      { yaw: -10, pitch: 10 }, { yaw: 10, pitch: 10 },
      { yaw: 10, pitch: -10 }, { yaw: -10, pitch: -10 },
    ] }, style: { fillColor: "#10B981" },
  };
  const context = { params: Promise.resolve({ stationId: station.id, sceneId: scene.sceneId }) };
  async function put(body: unknown, auth = token) {
    return PUT(new NextRequest("http://localhost/api/cms/virtual-tour/test/test-scene", {
      method: "PUT", headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      body: JSON.stringify(body),
    }), context);
  }
  const body = { spatialEntities: [entity], spatialRevision: 0, spatialOperation: "draft" };
  assert.equal((await put(body, "")).status, 401); pass("anonymous write rejected");
  const mitra = await prisma.user.create({ data: {
    email: `mitra-${suffix}@example.invalid`, password: "unused", name: "Mitra", role: "MITRA",
  }, select: { id: true, email: true } });
  assert.equal((await put(body, signToken({ userId: mitra.id, email: mitra.email, role: "MITRA" }))).status, 403);
  pass("non-CMS role rejected");
  assert.equal((await put(body)).status, 200); pass("valid draft saves");
  const draft = await prisma.virtualTourScene.findUniqueOrThrow({ where: { id: scene.id } });
  assert.equal(draft.spatialRevision, 1);
  assert.equal(Array.isArray(draft.spatialEntities) && draft.spatialEntities.length, 1);
  assert.deepEqual(draft.publishedSpatialEntities, []);
  assert.deepEqual(draft.hotspots, scene.hotspots); pass("draft persists without changing live areas or legacy pin");
  const publicDraft = await getStationBySlug(station.slug);
  assert.equal(publicDraft?.scenes[0]?.spatialEntities?.length, 0); pass("public loader does not expose draft");
  assert.equal((await put(body)).status, 409); pass("stale revision rejected");
  assert.equal((await put({ ...body, spatialRevision: 1, spatialEntities: [{ ...entity, unitId: otherUnit.id }] })).status, 400);
  pass("cross-station unit rejected");
  assert.equal((await put({ ...body, spatialRevision: 1, spatialEntities: [{ ...entity, sceneId: "other" }] })).status, 400);
  pass("wrong scene rejected");
  assert.equal((await put({ ...body, spatialRevision: 1, spatialEntities: [{ ...entity, action: { type: "open_scene", targetId: "missing" } }] })).status, 400);
  pass("invalid scene action rejected");
  assert.equal((await put({ ...body, spatialRevision: 1, spatialEntities: [{ ...entity, geometry: {
    ...entity.geometry, vertices: entity.geometry.vertices.map((p) => ({ ...p, yaw: 1e20 })),
  } }] })).status, 400); pass("huge coordinates rejected without hanging");
  assert.equal((await put({ ...body, spatialRevision: 1, spatialOperation: "publish" })).status, 200);
  const published = await getStationBySlug(station.slug);
  assert.equal(published?.scenes[0]?.spatialEntities?.length, 1); pass("explicit publication updates public snapshot");
  const race = await Promise.all([
    put({ ...body, spatialRevision: 2, spatialEntities: [{ ...entity, label: "Editor A" }] }),
    put({ ...body, spatialRevision: 2, spatialEntities: [{ ...entity, label: "Editor B" }] }),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]); pass("concurrent editors cannot silently overwrite");
  assert.equal((await put({ ...body, spatialRevision: 3, spatialEntities: [] })).status, 200);
  const stillPublished = await getStationBySlug(station.slug);
  assert.equal(stillPublished?.scenes[0]?.spatialEntities?.length, 1); pass("draft deletion does not remove published area");
  await prisma.virtualTourScene.create({ data: {
    stationId: station.id, sceneId: "inactive", title: "Inactive", panoramaUrl: "/test.jpg", isActive: false,
  } });
  assert.equal((await put({ ...body, spatialRevision: 4, spatialOperation: "publish", spatialEntities: [{
    ...entity, action: { type: "open_scene", targetId: "inactive" },
  }] })).status, 400); pass("publishing navigation to inactive scene rejected");
  const { GET: listScenes } = await import("../app/api/cms/virtual-tour/[stationId]/route");
  const listed = await listScenes(new NextRequest("http://localhost/api/cms/virtual-tour/test", {
    headers: { Authorization: `Bearer ${token}` },
  }), { params: Promise.resolve({ stationId: station.id }) });
  const list = await listed.json();
  assert.equal(list.find((s: { sceneId: string }) => s.sceneId === scene.sceneId).spatialRevision, 4);
  pass("existing scene list exposes current CAS revision");
  process.env.CMS_SPATIAL_HOTSPOT = "0";
  assert.equal((await put({ ...body, spatialRevision: 4 })).status, 403);
  const hidden = await getStationBySlug(station.slug);
  assert.equal(hidden?.scenes[0]?.spatialEntities?.length, 0); pass("server kill switch overrides enabled public build flag");
  assert.equal((await put({ title: "Legacy pin save" })).status, 200); pass("legacy scene save still works with spatial disabled");
  console.log(`${checks} integration checks passed against disposable PostgreSQL.`);
} finally {
  await prisma.$disconnect();
}
