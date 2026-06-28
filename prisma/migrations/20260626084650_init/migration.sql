-- CreateEnum
CREATE TYPE "SpaceType" AS ENUM ('KIOS', 'RUKO', 'ATM', 'VENDING', 'MEDIA_IKLAN', 'AREA_PROMOSI');

-- CreateEnum
CREATE TYPE "SpaceStatus" AS ENUM ('TERSEDIA', 'TERISI', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'NEGOTIATING', 'CLOSED_WON', 'CLOSED_LOST');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('STATION_VIEW', 'SPACE_VIEW', 'TOUR_START', 'FORM_SUBMIT', 'WHATSAPP_CLICK', 'PDF_DOWNLOAD');

-- CreateTable
CREATE TABLE "stations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "dailyPassengers" INTEGER NOT NULL DEFAULT 0,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "imageUrl" TEXT,
    "floorPlanUrl" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_spaces" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SpaceType" NOT NULL DEFAULT 'KIOS',
    "status" "SpaceStatus" NOT NULL DEFAULT 'TERSEDIA',
    "area" DOUBLE PRECISION NOT NULL,
    "monthlyRent" DOUBLE PRECISION NOT NULL,
    "deposit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "floor" TEXT NOT NULL DEFAULT 'G',
    "location" TEXT NOT NULL,
    "nearestExit" TEXT,
    "exposure" INTEGER NOT NULL DEFAULT 0,
    "powerSupply" TEXT,
    "waterAccess" BOOLEAN NOT NULL DEFAULT false,
    "airConditioning" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "panoramaUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commercial_spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_leads" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "spaceRequirement" TEXT,
    "message" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "followUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_events" (
    "id" TEXT NOT NULL,
    "stationId" TEXT,
    "spaceId" TEXT,
    "eventType" "EventType" NOT NULL,
    "sessionId" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stations_slug_key" ON "stations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "commercial_spaces_stationId_code_key" ON "commercial_spaces"("stationId", "code");

-- AddForeignKey
ALTER TABLE "commercial_spaces" ADD CONSTRAINT "commercial_spaces_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_leads" ADD CONSTRAINT "tenant_leads_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "commercial_spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_events" ADD CONSTRAINT "visit_events_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_events" ADD CONSTRAINT "visit_events_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "commercial_spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
