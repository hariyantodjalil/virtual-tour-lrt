import type { SpatialEntity } from "./types";

/** Resolve links against the authoritative station master before any write. */
export function validateSpatialLinks(
  entities: SpatialEntity[],
  sceneId: string,
  units: { id: string; code: string }[],
  sceneIds: string[]
): { ok: true; entities: SpatialEntity[] } | { ok: false; error: string } {
  const ids = new Set<string>();
  const resolved: SpatialEntity[] = [];
  for (const entity of entities) {
    if (ids.has(entity.id)) return { ok: false, error: "ID Spatial Area harus unik dalam scene." };
    ids.add(entity.id);
    if (entity.sceneId !== sceneId) return { ok: false, error: "Spatial Area bukan milik scene ini." };
    const unit = entity.unitId
      ? units.find((u) => u.id === entity.unitId)
      : entity.spaceCode ? units.find((u) => u.code === entity.spaceCode) : undefined;
    if ((entity.unitId || entity.spaceCode) && !unit) {
      return { ok: false, error: "Unit Spatial Area tidak ditemukan pada stasiun ini." };
    }
    if (unit && entity.spaceCode && unit.code !== entity.spaceCode) {
      return { ok: false, error: "Kode unit dan ID unit Spatial Area tidak cocok." };
    }
    if (entity.action.type === "unit_detail" && (!unit || (entity.action.targetId && entity.action.targetId !== unit.id))) {
      return { ok: false, error: "Target detail unit Spatial Area tidak valid." };
    }
    if (entity.action.type === "open_scene" && !sceneIds.includes(entity.action.targetId ?? "")) {
      return { ok: false, error: "Target scene Spatial Area tidak ditemukan pada stasiun ini." };
    }
    resolved.push({
      ...entity,
      unitId: unit?.id ?? null,
      spaceCode: unit?.code ?? null,
      action: entity.action.type === "unit_detail" ? { type: "unit_detail", targetId: unit?.id } : entity.action,
    });
  }
  return { ok: true, entities: resolved };
}
