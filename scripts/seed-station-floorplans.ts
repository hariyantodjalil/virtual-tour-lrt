/**
 * Upsert station_floorplans.data dari katalog tipikal S3 (portal-floorplan-assets.json).
 *   node scripts/bin.mjs tsx scripts/seed-station-floorplans.ts
 */
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";
import { emptyFloorplanData, layersFromCatalog, parseStationFloorplanData } from "../lib/station-floorplan";

loadEnv({ path: ".env", override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const stations = await prisma.station.findMany({
    select: { id: true, slug: true, name: true },
    orderBy: { order: "asc" },
  });

  let created = 0;
  let updated = 0;
  for (const station of stations) {
    const layers = layersFromCatalog(station.slug);
    if (layers.length === 0) {
      console.log(`skip ${station.slug}: no catalog layers`);
      continue;
    }

    const existing = await prisma.stationFloorplan.findUnique({
      where: { stationId: station.id },
      select: { id: true, data: true },
    });

    if (!existing) {
      await prisma.stationFloorplan.create({
        data: {
          stationId: station.id,
          data: { ...emptyFloorplanData(), floorPlans: layers },
        },
      });
      created += 1;
      console.log(`create ${station.slug} (${layers.length} layers)`);
      continue;
    }

    const current = parseStationFloorplanData(existing.data);
    if (current.floorPlans.length > 0) {
      console.log(`keep ${station.slug}: already has ${current.floorPlans.length} layers`);
      continue;
    }

    await prisma.stationFloorplan.update({
      where: { id: existing.id },
      data: { data: { ...current, floorPlans: layers } },
    });
    updated += 1;
    console.log(`fill ${station.slug} (${layers.length} layers)`);
  }

  console.log(JSON.stringify({ stations: stations.length, created, updated }));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
