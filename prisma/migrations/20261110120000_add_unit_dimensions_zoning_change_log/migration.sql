-- CreateEnum
CREATE TYPE "SpaceAreaKind" AS ENUM ('FIXED', 'ZONE', 'ZONE_ALLOCATION');

-- CreateEnum
CREATE TYPE "TenantChangeEntity" AS ENUM ('COMMERCIAL_SPACE', 'TRAIN_RENTAL_SPACE');

-- CreateEnum
CREATE TYPE "TenantChangeAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- AlterTable
ALTER TABLE "commercial_spaces" ADD COLUMN     "areaKind" "SpaceAreaKind" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "heightM" DOUBLE PRECISION,
ADD COLUMN     "lengthM" DOUBLE PRECISION,
ADD COLUMN     "parentZoneId" TEXT,
ADD COLUMN     "widthM" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "train_rental_spaces" ADD COLUMN     "heightM" DOUBLE PRECISION,
ADD COLUMN     "lengthM" DOUBLE PRECISION,
ADD COLUMN     "widthM" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "tenant_change_logs" (
    "id" TEXT NOT NULL,
    "entityType" "TenantChangeEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityLabel" TEXT NOT NULL,
    "stationId" TEXT,
    "action" "TenantChangeAction" NOT NULL,
    "changedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hotspotsAffected" INTEGER NOT NULL DEFAULT 0,
    "performedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_change_logs_entityType_entityId_createdAt_idx" ON "tenant_change_logs"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "tenant_change_logs_createdAt_idx" ON "tenant_change_logs"("createdAt");

-- CreateIndex
CREATE INDEX "commercial_spaces_parentZoneId_idx" ON "commercial_spaces"("parentZoneId");

-- AddForeignKey
ALTER TABLE "commercial_spaces" ADD CONSTRAINT "commercial_spaces_parentZoneId_fkey" FOREIGN KEY ("parentZoneId") REFERENCES "commercial_spaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

