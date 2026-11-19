-- Denah canvas 2D per stasiun (pola portal station_floorplans).

CREATE TABLE "station_floorplans" (
  "id" TEXT NOT NULL,
  "stationId" TEXT NOT NULL,
  "data" JSONB NOT NULL DEFAULT '{}',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "station_floorplans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "station_floorplans_stationId_key" ON "station_floorplans"("stationId");

ALTER TABLE "station_floorplans"
  ADD CONSTRAINT "station_floorplans_stationId_fkey"
  FOREIGN KEY ("stationId") REFERENCES "stations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
