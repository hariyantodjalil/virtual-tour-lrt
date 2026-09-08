-- Tabel penyewa aktif & occupancy — harus ada sebelum add_commercial_pipeline mengubah tenants.

CREATE TABLE IF NOT EXISTS "tenants" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "logoUrl" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "space_occupancies" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "space_occupancies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tenants_stationId_idx" ON "tenants"("stationId");

CREATE UNIQUE INDEX IF NOT EXISTS "space_occupancies_spaceId_key" ON "space_occupancies"("spaceId");

CREATE INDEX IF NOT EXISTS "space_occupancies_tenantId_idx" ON "space_occupancies"("tenantId");

ALTER TABLE "tenants" DROP CONSTRAINT IF EXISTS "tenants_stationId_fkey";
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_stationId_fkey"
  FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "space_occupancies" DROP CONSTRAINT IF EXISTS "space_occupancies_spaceId_fkey";
ALTER TABLE "space_occupancies" ADD CONSTRAINT "space_occupancies_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "commercial_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "space_occupancies" DROP CONSTRAINT IF EXISTS "space_occupancies_tenantId_fkey";
ALTER TABLE "space_occupancies" ADD CONSTRAINT "space_occupancies_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
