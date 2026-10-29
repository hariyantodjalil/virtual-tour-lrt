import type { SpatialEntity } from "./types";

/** Share interaction across unit faces; unlinked areas retain their own identity. */
export function spatialUnitInteractionKeys(entities: readonly SpatialEntity[]): Map<string, string> {
  const idsByCode = new Map<string, string | null>();
  for (const entity of entities) {
    const code = entity.spaceCode?.trim().toUpperCase();
    const id = entity.unitId?.trim();
    if (!code || !id) continue;
    const known = idsByCode.get(code);
    idsByCode.set(code, known === undefined || known === id ? id : null);
  }
  return new Map(entities.map((entity) => {
    const code = entity.spaceCode?.trim().toUpperCase();
    const id = entity.unitId?.trim() || (code ? idsByCode.get(code) : null);
    const key = id ? `unit:${id}` : code ? `code:${code}` : `area:${entity.id}`;
    return [entity.id, key];
  }));
}
