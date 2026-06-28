-- Selaraskan schema virtual-tour-lrt dengan pola portal-lrt (station_floorplans)

-- Station: tambah field resmi portal-lrt, hapus kolom floorplan yang tidak dipakai
ALTER TABLE "stations" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "stations" ADD COLUMN IF NOT EXISTS "nameId" TEXT;
ALTER TABLE "stations" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "stations" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "stations" DROP COLUMN IF EXISTS "floorPlanUrl";
ALTER TABLE "stations" DROP COLUMN IF EXISTS "floorPlanData";
CREATE UNIQUE INDEX IF NOT EXISTS "stations_code_key" ON "stations"("code");

-- Virtual tour scenes: tambah kolom editor
ALTER TABLE "virtual_tour_scenes" ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;
ALTER TABLE "virtual_tour_scenes" ADD COLUMN IF NOT EXISTS "canvasData" JSONB;

-- Tabel agregat konfigurasi virtual tour per stasiun (paralel station_floorplans)
CREATE TABLE IF NOT EXISTS "station_virtual_tours" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "station_virtual_tours_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "station_virtual_tours_stationId_key" ON "station_virtual_tours"("stationId");

ALTER TABLE "station_virtual_tours" DROP CONSTRAINT IF EXISTS "station_virtual_tours_stationId_fkey";
ALTER TABLE "station_virtual_tours" ADD CONSTRAINT "station_virtual_tours_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
