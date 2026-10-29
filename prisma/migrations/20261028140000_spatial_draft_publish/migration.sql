-- Additive. Keep all spatial data when rolling back the application image.
ALTER TABLE "virtual_tour_scenes"
  ADD COLUMN "publishedSpatialEntities" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "spatialRevision" INTEGER NOT NULL DEFAULT 0;

-- Existing saved areas were already live under the old contract. Preserve that
-- public snapshot once; subsequent edits only change the draft until published.
UPDATE "virtual_tour_scenes"
SET "publishedSpatialEntities" = "spatialEntities";
