-- Virtual Train parallel stack (gerbong → zona → scene 360°)

CREATE TABLE "trains" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "formation" TEXT,
    "imageUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trains_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trains_slug_key" ON "trains"("slug");
CREATE INDEX "trains_isActive_order_idx" ON "trains"("isActive", "order");

CREATE TABLE "train_virtual_tours" (
    "id" TEXT NOT NULL,
    "trainId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "train_virtual_tours_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "train_virtual_tours_trainId_key" ON "train_virtual_tours"("trainId");

CREATE TABLE "train_tour_cars" (
    "id" TEXT NOT NULL,
    "trainId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "hint" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "train_tour_cars_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "train_tour_cars_trainId_slug_key" ON "train_tour_cars"("trainId", "slug");

CREATE TABLE "train_tour_zones" (
    "id" TEXT NOT NULL,
    "trainId" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "train_tour_zones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "train_tour_zones_trainId_slug_key" ON "train_tour_zones"("trainId", "slug");

CREATE TABLE "train_tour_scenes" (
    "id" TEXT NOT NULL,
    "trainId" TEXT NOT NULL,
    "carId" TEXT,
    "zoneId" TEXT,
    "sceneId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "panoramaUrl" TEXT NOT NULL,
    "originalPanoramaUrl" TEXT,
    "car" TEXT NOT NULL DEFAULT 'gerbong-1',
    "thumbnailUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "hotspots" JSONB NOT NULL DEFAULT '[]',
    "canvasData" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "train_tour_scenes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "train_tour_scenes_trainId_sceneId_key" ON "train_tour_scenes"("trainId", "sceneId");

ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'TRAIN_VIEW';

ALTER TABLE "train_virtual_tours" ADD CONSTRAINT "train_virtual_tours_trainId_fkey" FOREIGN KEY ("trainId") REFERENCES "trains"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "train_tour_cars" ADD CONSTRAINT "train_tour_cars_trainId_fkey" FOREIGN KEY ("trainId") REFERENCES "trains"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "train_tour_zones" ADD CONSTRAINT "train_tour_zones_trainId_fkey" FOREIGN KEY ("trainId") REFERENCES "trains"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "train_tour_zones" ADD CONSTRAINT "train_tour_zones_carId_fkey" FOREIGN KEY ("carId") REFERENCES "train_tour_cars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "train_tour_scenes" ADD CONSTRAINT "train_tour_scenes_trainId_fkey" FOREIGN KEY ("trainId") REFERENCES "trains"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "train_tour_scenes" ADD CONSTRAINT "train_tour_scenes_carId_fkey" FOREIGN KEY ("carId") REFERENCES "train_tour_cars"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "train_tour_scenes" ADD CONSTRAINT "train_tour_scenes_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "train_tour_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
