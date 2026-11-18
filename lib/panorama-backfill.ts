import { Prisma } from "@prisma/client";

/** Merge into the current row, never a canvas snapshot collected before tile generation. */
export function panoramaProfileUpdateQuery(opts: {
  kind: "station" | "train";
  id: string;
  panoramaUrl: string;
  previousProfiles: unknown;
  profiles: unknown;
}) {
  const table = opts.kind === "station"
    ? Prisma.sql`"virtual_tour_scenes"`
    : Prisma.sql`"train_tour_scenes"`;
  return Prisma.sql`
    UPDATE ${table}
    SET "canvasData" = jsonb_set(
      CASE WHEN jsonb_typeof("canvasData"::jsonb) = 'object'
        THEN "canvasData"::jsonb ELSE '{}'::jsonb END,
      '{multiResProfiles}', ${JSON.stringify(opts.profiles)}::jsonb, true
    ), "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${opts.id} AND "panoramaUrl" = ${opts.panoramaUrl}
      AND COALESCE("canvasData"::jsonb->'multiResProfiles', 'null'::jsonb)
        = ${JSON.stringify(opts.previousProfiles ?? null)}::jsonb
  `;
}

/**
 * Merge atomik untuk profil HD (canvasData.multiResProfilesHd) — kontrak reader:
 * lib/panorama-hd-profile.ts. Publikasi hanya boleh lewat sini; guard memastikan
 * panorama, status blur, patch AI, dan metadata HD tidak berubah sejak dibaca.
 * rowCount 0 berarti konflik: muat ulang baris dan ulangi scene.
 */
export function panoramaHdProfileUpdateQuery(opts: {
  kind: "station" | "train";
  id: string;
  panoramaUrl: string;
  privacyBlurLastBakedAt: string | null;
  aiPatchLastBakedAt: string | null;
  /** Nilai canvasData.privacyBlurs saat dibaca (JSON-able; undefined → []). */
  privacyBlurs: unknown;
  /** Nilai canvasData.multiResProfilesHd saat dibaca (null bila belum ada). */
  previousHd: unknown;
  hd: Record<string, unknown>;
}) {
  const table = opts.kind === "station"
    ? Prisma.sql`"virtual_tour_scenes"`
    : Prisma.sql`"train_tour_scenes"`;
  return Prisma.sql`
    UPDATE ${table}
    SET "canvasData" = jsonb_set(
      CASE WHEN jsonb_typeof("canvasData"::jsonb) = 'object'
        THEN "canvasData"::jsonb ELSE '{}'::jsonb END,
      '{multiResProfilesHd}', ${JSON.stringify(opts.hd)}::jsonb, true
    ), "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${opts.id}
      AND "panoramaUrl" = ${opts.panoramaUrl}
      AND COALESCE("canvasData"::jsonb->>'privacyBlurLastBakedAt','') = ${opts.privacyBlurLastBakedAt ?? ""}
      AND COALESCE("canvasData"::jsonb->>'aiPatchLastBakedAt','') = ${opts.aiPatchLastBakedAt ?? ""}
      AND COALESCE("canvasData"::jsonb->'privacyBlurs','[]'::jsonb) = ${JSON.stringify(opts.privacyBlurs ?? [])}::jsonb
      AND COALESCE("canvasData"::jsonb->'multiResProfilesHd','null'::jsonb) = ${JSON.stringify(opts.previousHd ?? null)}::jsonb
  `;
}
