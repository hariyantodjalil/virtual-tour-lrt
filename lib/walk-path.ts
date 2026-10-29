import type { HotspotItem } from "@/lib/hotspot-types";

type SceneRef = {
  sceneId: string;
  title: string;
  order: number;
  hotspots: Omit<HotspotItem, "_id">[];
};

/** Buat tautan scene berurutan dalam satu area (jalur jalan POV). */
export function buildWalkPathHotspots(
  scenes: SceneRef[],
  options?: { yaw?: number; pitch?: number }
): Map<string, Omit<HotspotItem, "_id">[]> {
  const yaw = options?.yaw ?? 0;
  const pitch = options?.pitch ?? -12;
  const sorted = [...scenes].sort((a, b) => a.order - b.order);
  const result = new Map<string, Omit<HotspotItem, "_id">[]>();

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const prev = sorted[i - 1];
    const existing = [...(current.hotspots ?? [])];

    const withoutWalk = existing.filter(
      (h) =>
        !(
          h.type === "scene" &&
          (h.text?.startsWith("→ ") || h.text?.startsWith("← ")) &&
          sorted.some((s) => s.sceneId === h.sceneId)
        )
    );

    if (next) {
      const hasForward = withoutWalk.some(
        (h) => h.type === "scene" && h.sceneId === next.sceneId
      );
      if (!hasForward) {
        withoutWalk.push({
          pitch,
          yaw,
          type: "scene",
          text: `→ ${next.title}`,
          sceneId: next.sceneId,
          targetView: existing.find((h) => h.type === "scene" && h.sceneId === next.sceneId)?.targetView,
        });
      }
    }

    if (prev) {
      const backYaw = yaw + 180 > 180 ? yaw - 180 : yaw + 180;
      const hasBack = withoutWalk.some(
        (h) => h.type === "scene" && h.sceneId === prev.sceneId
      );
      if (!hasBack) {
        withoutWalk.push({
          pitch,
          yaw: backYaw,
          type: "scene",
          text: `← ${prev.title}`,
          sceneId: prev.sceneId,
          targetView: existing.find((h) => h.type === "scene" && h.sceneId === prev.sceneId)?.targetView,
        });
      }
    }

    result.set(current.sceneId, withoutWalk);
  }

  return result;
}
