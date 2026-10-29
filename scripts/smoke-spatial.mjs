import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const testEntity = {
  id: "smoke-spatial-001",
  kind: "SPATIAL_AREA",
  sceneId: "tmp",
  label: "Smoke Area",
  geometry: {
    type: "spherical_polygon",
    vertices: [
      { yaw: -12, pitch: -4 },
      { yaw: 12, pitch: -4 },
      { yaw: 12, pitch: -14 },
      { yaw: -12, pitch: -14 },
    ],
  },
  style: {
    fillColor: "#10B981",
    fillOpacity: 0.2,
    strokeColor: "#34D399",
    strokeOpacity: 0.9,
    strokeWidthPx: 2,
  },
  action: { type: "none" },
  enabled: true,
  schemaVersion: 1,
  revision: 1,
};

async function main() {
  const scene = await prisma.virtualTourScene.findFirst({
    where: { isActive: true },
    select: {
      id: true,
      stationId: true,
      sceneId: true,
      spatialEntities: true,
      hotspots: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!scene) throw new Error("no active scene");

  const before = scene.spatialEntities;
  const payload = [{ ...testEntity, sceneId: scene.sceneId }];

  await prisma.virtualTourScene.update({
    where: { id: scene.id },
    data: { spatialEntities: payload },
  });

  const after = await prisma.virtualTourScene.findUnique({
    where: { id: scene.id },
    select: { spatialEntities: true, hotspots: true },
  });

  const saved = after?.spatialEntities;
  const okArray = Array.isArray(saved) && saved.length === 1 && saved[0].id === "smoke-spatial-001";
  const pinsOk = JSON.stringify(after?.hotspots) === JSON.stringify(scene.hotspots);

  await prisma.virtualTourScene.update({
    where: { id: scene.id },
    data: { spatialEntities: before ?? [] },
  });

  // Confirm column exists via raw
  const col = await prisma.$queryRaw`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'virtual_tour_scenes' AND column_name = 'spatialEntities'
  `;

  console.log(
    JSON.stringify(
      {
        ok: okArray && pinsOk,
        sceneId: scene.sceneId,
        stationId: scene.stationId,
        savedOk: okArray,
        pinsUnchanged: pinsOk,
        restored: true,
        column: col,
      },
      null,
      2
    )
  );

  if (!okArray || !pinsOk) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
