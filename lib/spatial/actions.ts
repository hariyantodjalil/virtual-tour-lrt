import type { SpatialEntity } from "./types";

/** Shared by CMS preview and the public viewer; `none` never triggers a unit. */
export function runSpatialAction(entity: SpatialEntity, handlers: {
  openUnit: (code: string) => void;
  openScene: (sceneId: string) => void;
  openInfo: (title: string, description: string) => void;
}) {
  switch (entity.action.type) {
    case "unit_detail":
      if (entity.spaceCode) handlers.openUnit(entity.spaceCode);
      break;
    case "open_scene":
      if (entity.action.targetId) handlers.openScene(entity.action.targetId);
      break;
    case "info_detail":
      handlers.openInfo(entity.action.title || entity.label || "Informasi area", entity.action.description || "");
      break;
    case "none":
      break;
  }
}
