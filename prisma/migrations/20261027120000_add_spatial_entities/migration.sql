-- Additive: Spatial Area Hotspot entities per scene (JSON array). Rollback = DROP COLUMN.
ALTER TABLE "virtual_tour_scenes" ADD COLUMN IF NOT EXISTS "spatialEntities" JSONB NOT NULL DEFAULT '[]';
