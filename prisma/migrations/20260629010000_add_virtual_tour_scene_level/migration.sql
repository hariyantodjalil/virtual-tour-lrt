ALTER TABLE "virtual_tour_scenes"
ADD COLUMN IF NOT EXISTS "level" TEXT NOT NULL DEFAULT 'CONCOURSE';

UPDATE "virtual_tour_scenes"
SET "level" = CASE
  WHEN LOWER("sceneId") LIKE '%platform%' OR LOWER("sceneId") LIKE '%peron%' THEN 'PLATFORM'
  WHEN LOWER("sceneId") LIKE '%outdoor%' OR LOWER("sceneId") LIKE '%outside%' OR LOWER("sceneId") LIKE '%drop%' THEN 'OUTDOOR'
  WHEN LOWER("sceneId") LIKE '%commercial%' OR LOWER("sceneId") LIKE '%tenant%' OR LOWER("sceneId") LIKE '%retail%' THEN 'COMMERCIAL'
  ELSE 'CONCOURSE'
END;
