import sharp from "sharp";
import bcrypt from "bcryptjs";

const databaseUrl = process.env.SPATIAL_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("SPATIAL_TEST_DATABASE_URL required.");
const target = new URL(databaseUrl);
if (target.hostname !== "127.0.0.1" || target.port !== "6147" || target.pathname !== "/lrt_spatial_test") {
  throw new Error("Only the disposable local spatial test database is allowed.");
}
process.env.DATABASE_URL = databaseUrl;
const { prisma } = await import("../lib/prisma");
try {
  const password = await bcrypt.hash("Local-Spatial-Only!2026", 10);
  await prisma.user.upsert({
    where: { email: "spatial-browser@example.invalid" },
    create: { email: "spatial-browser@example.invalid", name: "Local browser test", password, role: "ADMIN" },
    update: { password, isActive: true }, select: { id: true },
  });
  const station = await prisma.station.upsert({
    where: { slug: "spatial-browser-test" },
    create: { id: "spatial-browser-station", slug: "spatial-browser-test", name: "Cawang (uji lokal)", line: "Test", address: "Isolated fixture" },
    update: {},
  });
  const level = await prisma.virtualTourLevel.upsert({
    where: { stationId_slug: { stationId: station.id, slug: "concourse" } },
    create: { stationId: station.id, slug: "concourse", label: "Concourse", order: 0 }, update: {},
  });
  const area = await prisma.virtualTourArea.upsert({
    where: { stationId_slug: { stationId: station.id, slug: "unpaid" } },
    create: { stationId: station.id, levelId: level.id, slug: "unpaid", label: "Unpaid", order: 0 }, update: {},
  });
  const unit = await prisma.commercialSpace.upsert({
    where: { stationId_code: { stationId: station.id, code: "TEST-UNIT-001" } },
    create: { stationId: station.id, code: "TEST-UNIT-001", name: "Unit fixture", area: 10, monthlyRent: 100, location: "Fixture", status: "TERSEDIA" }, update: {},
  });
  const image = await sharp({ create: { width: 2048, height: 1024, channels: 3, background: "#365466" } }).png().toBuffer();
  const panoramaUrl = `data:image/png;base64,${image.toString("base64")}`;
  for (const [order, sceneId] of ["scene-a", "scene-b"].entries()) {
    const data = {
      title: `Checkpoint ${order + 1}`, panoramaUrl, level: "concourse", levelId: level.id, areaId: area.id, order,
      hotspots: [{ type: "space", spaceCode: unit.code, yaw: -30, pitch: -10 }],
      canvasData: { initialView: { yaw: 0, pitch: 0, hfov: 100 } },
      spatialEntities: [], publishedSpatialEntities: [], spatialRevision: 0,
    };
    await prisma.virtualTourScene.upsert({
      where: { stationId_sceneId: { stationId: station.id, sceneId } },
      create: { stationId: station.id, sceneId, ...data }, update: data,
    });
  }
  console.log("Browser fixture ready: /cms/virtual-tour/spatial-browser-station (isolated local DB only).");
} finally {
  await prisma.$disconnect();
}
