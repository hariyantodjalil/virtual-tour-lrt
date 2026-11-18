BEGIN;

ALTER TABLE "pipeline_steps" ADD COLUMN "showInSummary" BOOLEAN NOT NULL DEFAULT false;
UPDATE "pipeline_steps" SET "showInSummary" = true
WHERE "leadStatus" IN ('RDS_OFFER', 'SITE_CHECK', 'PKS');

CREATE TABLE "trainsets" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "trainId" TEXT NOT NULL REFERENCES "trains"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "code" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "trainsets_trainId_code_key" ON "trainsets"("trainId", "code");
CREATE INDEX "trainsets_trainId_isActive_order_idx" ON "trainsets"("trainId", "isActive", "order");

-- Preserve the fleet catalog previously offered by the application, once only.
INSERT INTO "trainsets" ("id", "trainId", "code", "order", "updatedAt")
SELECT 'fleet-' || t."id" || '-' || n, t."id", 'TS' || LPAD(n::text, 2, '0'), n - 1, CURRENT_TIMESTAMP
FROM "trains" t CROSS JOIN generate_series(1, 31) n;

-- Preserve additional codes already configured in rental availability.
WITH codes AS (
  SELECT r."trainId", unnest(r."availableTrainsets") AS code FROM "train_rental_spaces" r
  UNION
  SELECT r."trainId", jsonb_array_elements_text(CASE WHEN jsonb_typeof(v.value) = 'array' THEN v.value ELSE '[]'::jsonb END)
  FROM "train_rental_spaces" r,
    LATERAL jsonb_each(CASE WHEN jsonb_typeof(r."availableByCar") = 'object' THEN r."availableByCar" ELSE '{}'::jsonb END) v
)
INSERT INTO "trainsets" ("id", "trainId", "code", "order", "updatedAt")
SELECT 'fleet-import-' || md5("trainId" || code), "trainId", code, 1000, CURRENT_TIMESTAMP
FROM codes WHERE code ~ '^TS[0-9]+$'
ON CONFLICT ("trainId", "code") DO NOTHING;

COMMIT;
