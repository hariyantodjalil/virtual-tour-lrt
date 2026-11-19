BEGIN;

ALTER TABLE "stations"
  ADD COLUMN "concourseLayout" TEXT CHECK ("concourseLayout" IN ('A', 'B', 'C')),
  ADD COLUMN "assetCodePrefix" TEXT;

UPDATE "stations" AS s
SET "concourseLayout" = v.layout, "assetCodePrefix" = v.prefix
FROM (VALUES
  ('harjamukti', 'A', 'HJM'), ('tmii', 'A', NULL),
  ('kampung-rambutan', 'A', NULL), ('ciracas', 'A', NULL),
  ('jatibening-baru', 'A', NULL), ('cikunir-1', 'A', NULL),
  ('cikunir-2', 'A', NULL), ('bekasi-barat', 'A', NULL),
  ('jatimulya', 'A', NULL), ('halim', 'A', NULL),
  ('dukuh-atas', 'B', NULL), ('setiabudi', 'B', NULL),
  ('rasuna-said', 'B', NULL), ('kuningan', 'B', NULL),
  ('pancoran-bank-bjb', 'B', NULL), ('cikoko', 'B', NULL),
  ('ciliwung', 'B', NULL), ('cawang', 'C', NULL)
) AS v(slug, layout, prefix)
WHERE s.slug = v.slug;

CREATE TABLE "concourse_slots" (
  "id" TEXT PRIMARY KEY,
  "stationId" TEXT NOT NULL REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "spaceId" TEXT REFERENCES "commercial_spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "access" TEXT NOT NULL CHECK ("access" IN ('PAD', 'UNP')),
  "kind" TEXT NOT NULL CHECK ("kind" IN ('F', 'Z')),
  "sequence" INTEGER NOT NULL CHECK ("sequence" BETWEEN 1 AND 999),
  "section" TEXT NOT NULL CHECK ("section" IN ('LEFT', 'CENTER', 'RIGHT')),
  "row" INTEGER NOT NULL CHECK ("row" BETWEEN 0 AND 2),
  "position" INTEGER NOT NULL CHECK ("position" BETWEEN 1 AND 999)
);
CREATE UNIQUE INDEX "concourse_slots_spaceId_key" ON "concourse_slots"("spaceId");
CREATE UNIQUE INDEX "concourse_slots_stationId_access_sequence_key" ON "concourse_slots"("stationId", "access", "sequence");

-- The prototype diagrams define schematic positions, not inventory or availability.
INSERT INTO "concourse_slots" ("id", "stationId", "spaceId", "access", "kind", "sequence", "section", "row", "position")
SELECT 'concourse-' || s.slug || '-' || v.access || '-' || v.seq, s.id, u.id,
  v.access, v.kind, v.seq, v.section, v.row, v.pos
FROM (VALUES
  ('harjamukti', 'PAD', 'F', 1, 'LEFT', 2, 1),
  ('harjamukti', 'PAD', 'F', 2, 'LEFT', 1, 2),
  ('harjamukti', 'PAD', 'F', 3, 'RIGHT', 1, 1),
  ('harjamukti', 'PAD', 'F', 4, 'RIGHT', 0, 2),
  ('harjamukti', 'UNP', 'F', 1, 'CENTER', 0, 1),
  ('harjamukti', 'UNP', 'F', 2, 'CENTER', 0, 2),
  ('harjamukti', 'UNP', 'F', 3, 'CENTER', 0, 3),
  ('harjamukti', 'UNP', 'F', 4, 'CENTER', 2, 2),
  ('harjamukti', 'UNP', 'F', 5, 'CENTER', 2, 3),
  ('dukuh-atas', 'UNP', 'F', 1, 'LEFT', 2, 1),
  ('dukuh-atas', 'UNP', 'F', 2, 'LEFT', 0, 2),
  ('dukuh-atas', 'UNP', 'F', 3, 'LEFT', 0, 3),
  ('dukuh-atas', 'UNP', 'F', 4, 'RIGHT', 2, 1),
  ('dukuh-atas', 'UNP', 'F', 5, 'RIGHT', 0, 2),
  ('dukuh-atas', 'PAD', 'F', 1, 'CENTER', 1, 1),
  ('dukuh-atas', 'PAD', 'F', 2, 'CENTER', 2, 2),
  ('dukuh-atas', 'PAD', 'F', 3, 'CENTER', 1, 2),
  ('dukuh-atas', 'PAD', 'Z', 4, 'CENTER', 0, 2),
  ('dukuh-atas', 'PAD', 'F', 5, 'CENTER', 1, 3),
  ('cawang', 'UNP', 'F', 2, 'CENTER', 1, 1)
) AS v(slug, access, kind, seq, section, row, pos)
JOIN "stations" s ON s.slug = v.slug
LEFT JOIN "commercial_spaces" u ON u."stationId" = s.id
  AND u.code = COALESCE(s."assetCodePrefix", s.code) || '-CON-' || v.access || '-' || v.kind || '-' || LPAD(v.seq::text, 3, '0')
  AND u."location" ~* '(unpaid|paid|concourse)';

COMMIT;
