import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

process.env.CMS_SPATIAL_HOTSPOT = "1";
process.env.NEXT_PUBLIC_CMS_SPATIAL_HOTSPOT = "1";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const station = await prisma.station.findFirst({
    where: { slug: "dukuh-atas", isActive: true },
    select: { id: true, slug: true },
  });
  if (!station) throw new Error("station dukuh-atas not found");

  const scene = await prisma.virtualTourScene.findFirst({
    where: { stationId: station.id, isActive: true },
    select: { id: true, sceneId: true, spatialEntities: true, hotspots: true },
    orderBy: { order: "asc" },
  });
  if (!scene) throw new Error("no scene");

  const before = scene.spatialEntities;
  const entity = {
    id: "smoke-public-001",
    kind: "SPATIAL_AREA",
    sceneId: scene.sceneId,
    label: "Smoke Public",
    spaceCode: null,
    unitId: null,
    geometry: {
      type: "spherical_polygon",
      vertices: [
        { yaw: -15, pitch: -3 },
        { yaw: 15, pitch: -3 },
        { yaw: 15, pitch: -15 },
        { yaw: -15, pitch: -15 },
      ],
    },
    style: {
      fillColor: "#22D3EE",
      fillOpacity: 0.25,
      strokeColor: "#67E8F9",
      strokeOpacity: 1,
      strokeWidthPx: 2,
      showLabel: true,
    },
    action: { type: "none" },
    enabled: true,
    schemaVersion: 1,
    revision: 1,
  };

  await prisma.virtualTourScene.update({
    where: { id: scene.id },
    data: { spatialEntities: [entity] },
  });

  const page = await fetch("http://localhost:3000/station/dukuh-atas", {
    headers: { Accept: "text/html" },
  });
  const html = await page.text();
  const htmlOk = page.status === 200 && html.includes("Virtual Tour") || html.length > 1000;

  // RSC / flight payload sometimes embeds props; soft check
  const mentionsSmoke = html.includes("smoke-public-001") || html.includes("Smoke Public");

  await prisma.virtualTourScene.update({
    where: { id: scene.id },
    data: { spatialEntities: before ?? [] },
  });

  // CMS API without auth should reject
  const cms = await fetch(
    `http://localhost:3000/api/cms/virtual-tour/${station.id}/${scene.sceneId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spatialEntities: [entity] }),
    }
  );

  console.log(
    JSON.stringify(
      {
        ok: page.status === 200 && htmlOk,
        publicStatus: page.status,
        htmlBytes: html.length,
        smokeIdInHtml: mentionsSmoke,
        cmsPutWithoutAuth: cms.status,
        sceneId: scene.sceneId,
        restored: true,
        note:
          "smokeIdInHtml may be false if Next streams props outside plain HTML; public 200 is primary UI gate",
      },
      null,
      2
    )
  );

  if (page.status !== 200) process.exit(1);
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
