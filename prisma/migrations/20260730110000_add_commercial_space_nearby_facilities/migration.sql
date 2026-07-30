-- AlterTable
ALTER TABLE "commercial_spaces" ADD COLUMN "nearbyFacilities" TEXT[] DEFAULT ARRAY[]::TEXT[];
