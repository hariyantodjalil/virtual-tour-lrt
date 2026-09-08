-- AlterTable
ALTER TABLE "train_rental_spaces" ADD COLUMN IF NOT EXISTS "availableByCar" JSONB NOT NULL DEFAULT '{}';
