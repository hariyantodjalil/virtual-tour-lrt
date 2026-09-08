-- CreateEnum
CREATE TYPE "TrainRentalStatus" AS ENUM ('TERSEDIA', 'TERBATAS', 'PENUH');

-- AlterTable
ALTER TABLE "train_rental_spaces" ADD COLUMN "availableTrainsets" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "train_rental_spaces" ADD COLUMN "howToOrder" TEXT;
ALTER TABLE "train_rental_spaces" ADD COLUMN "status" "TrainRentalStatus" NOT NULL DEFAULT 'TERSEDIA';
ALTER TABLE "train_rental_spaces" ADD COLUMN "monthlyRent" DOUBLE PRECISION;
