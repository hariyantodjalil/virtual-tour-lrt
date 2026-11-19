import { z } from "zod";

export const primaryUnitHotspotSchema = z.object({
  sceneId: z.string().min(1).max(128),
  kind: z.enum(["pin", "spatial"]),
  hotspotId: z.string().min(1).max(160),
}).strict();

export type PrimaryUnitHotspot = z.infer<typeof primaryUnitHotspotSchema>;

export function parsePrimaryUnitHotspot(raw: unknown): PrimaryUnitHotspot | null {
  const result = primaryUnitHotspotSchema.safeParse(raw);
  return result.success ? result.data : null;
}
