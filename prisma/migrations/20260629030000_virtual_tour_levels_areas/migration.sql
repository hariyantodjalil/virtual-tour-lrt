-- Level & Area hierarchy untuk virtual tour editor

CREATE TABLE "virtual_tour_levels" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#10b981',
    "hint" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "virtual_tour_levels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "virtual_tour_areas" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "virtual_tour_areas_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "virtual_tour_scenes" ADD COLUMN "levelId" TEXT;
ALTER TABLE "virtual_tour_scenes" ADD COLUMN "areaId" TEXT;

CREATE UNIQUE INDEX "virtual_tour_levels_stationId_slug_key" ON "virtual_tour_levels"("stationId", "slug");
CREATE UNIQUE INDEX "virtual_tour_areas_stationId_slug_key" ON "virtual_tour_areas"("stationId", "slug");

ALTER TABLE "virtual_tour_levels" ADD CONSTRAINT "virtual_tour_levels_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "virtual_tour_areas" ADD CONSTRAINT "virtual_tour_areas_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "virtual_tour_areas" ADD CONSTRAINT "virtual_tour_areas_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "virtual_tour_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "virtual_tour_scenes" ADD CONSTRAINT "virtual_tour_scenes_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "virtual_tour_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "virtual_tour_scenes" ADD CONSTRAINT "virtual_tour_scenes_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "virtual_tour_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
