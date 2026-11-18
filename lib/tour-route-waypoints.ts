import type { Hotspot, TourLevelPublic } from "@/lib/tour-types";
import { findScenePlacement } from "@/lib/public-tour-structure";

/** Nilai Dari = ikuti scene aktif (seperti “lokasi saya” di maps). */
export const ROUTE_ORIGIN_CURRENT = "__current__";

/** Titik tujuan bermakna (area / level), bukan tiap scene panorama. */
export type RouteStop = {
  id: string;
  label: string;
  levelId: string;
  levelLabel: string;
  sceneId: string;
  kind?: "area" | "current";
};

export type RouteWaypoint = {
  key: string;
  label: string;
  sceneId: string;
};

export type BuildTourRouteOptions = {
  /** Mulai tepat dari scene ini (posisi sekarang), bukan sembarang scene di area yang sama. */
  originExact?: boolean;
  /** Akhiri tepat di scene tujuan (bukan sembarang scene di area tujuan). */
  destinationExact?: boolean;
};

type SceneNode = {
  id: string;
  hotspots: Hotspot[];
};

type WeightedEdge = { to: string; weight: number };

/** Daftar tujuan untuk Dari/Ke — satu entri per area ber-scene, atau per level jika tanpa area. */
export function listRouteStops(levels: TourLevelPublic[]): RouteStop[] {
  const stops: RouteStop[] = [];
  for (const level of levels) {
    const levelLabel = level.label.trim() || "Level";
    const areasWithScenes = level.areas.filter((area) => area.sceneIds.length > 0);
    if (areasWithScenes.length > 0) {
      for (const area of areasWithScenes) {
        stops.push({
          id: area.id,
          label: area.label.trim() || levelLabel,
          levelId: level.id,
          levelLabel,
          sceneId: area.sceneIds[0],
          kind: "area",
        });
      }
      continue;
    }
    if (level.sceneIds.length > 0) {
      stops.push({
        id: `level:${level.id}`,
        label: levelLabel,
        levelId: level.id,
        sceneId: level.sceneIds[0],
        levelLabel,
        kind: "area",
      });
    }
  }
  return stops;
}

export function isRouteOriginCurrent(value: string): boolean {
  return value === ROUTE_ORIGIN_CURRENT;
}

/** Stop virtual “Posisi saat ini” — value Dari mengikuti scene aktif di client. */
export function currentPositionStop(
  activeSceneId: string,
  levels: TourLevelPublic[]
): RouteStop {
  const placement = findScenePlacement(levels, activeSceneId);
  const here =
    placement?.area?.label.trim() ||
    placement?.level.label.trim() ||
    "titik ini";
  return {
    id: ROUTE_ORIGIN_CURRENT,
    label: `Posisi saat ini · ${here}`,
    levelId: "",
    levelLabel: "Navigasi",
    sceneId: ROUTE_ORIGIN_CURRENT,
    kind: "current",
  };
}

/** Anchor scene tujuan yang mewakili area/level tempat scene berada. */
export function resolveRouteStopAnchor(
  sceneId: string,
  levels: TourLevelPublic[],
  stops: RouteStop[]
): string {
  if (isRouteOriginCurrent(sceneId)) return ROUTE_ORIGIN_CURRENT;
  const placement = findScenePlacement(levels, sceneId);
  if (placement?.area) {
    const match = stops.find((stop) => stop.id === placement.area!.id);
    if (match) return match.sceneId;
  }
  if (placement?.level) {
    const match = stops.find((stop) => stop.id === `level:${placement.level.id}`);
    if (match) return match.sceneId;
  }
  const byScene = stops.find((stop) => stop.sceneId === sceneId);
  return byScene?.sceneId ?? stops[0]?.sceneId ?? sceneId;
}

function stopKeyForScene(sceneId: string, levels: TourLevelPublic[]): { key: string; label: string } {
  const placement = findScenePlacement(levels, sceneId);
  if (placement?.area) {
    return {
      key: placement.area.id,
      label: placement.area.label.trim() || placement.level.label.trim() || "Area",
    };
  }
  if (placement?.level) {
    return {
      key: `level:${placement.level.id}`,
      label: placement.level.label.trim() || "Level",
    };
  }
  return { key: `scene:${sceneId}`, label: "Titik" };
}

function scenesForStop(
  anchorSceneId: string,
  levels: TourLevelPublic[],
  allSceneIds: string[]
): string[] {
  const placement = findScenePlacement(levels, anchorSceneId);
  if (placement?.area?.sceneIds.length) {
    return placement.area.sceneIds.filter((id) => allSceneIds.includes(id));
  }
  if (placement?.level) {
    const ids = [
      ...placement.level.areas.flatMap((area) => area.sceneIds),
      ...placement.level.sceneIds,
    ];
    return ids.filter((id) => allSceneIds.includes(id));
  }
  return allSceneIds.includes(anchorSceneId) ? [anchorSceneId] : [];
}

function levelOrderForScene(sceneId: string, levels: TourLevelPublic[]): number {
  const placement = findScenePlacement(levels, sceneId);
  return placement?.level.order ?? 999;
}

function areaKeyForScene(sceneId: string, levels: TourLevelPublic[]): string | null {
  const placement = findScenePlacement(levels, sceneId);
  if (placement?.area) return placement.area.id;
  if (placement?.level) return `level:${placement.level.id}`;
  return null;
}

/** Hitung tautan undirected antar-area dari hotspot pinpoint. */
function countAreaLinks(
  scenes: SceneNode[],
  levels: TourLevelPublic[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const scene of scenes) {
    const fromArea = areaKeyForScene(scene.id, levels);
    if (!fromArea) continue;
    for (const hotspot of scene.hotspots) {
      if (hotspot.type !== "scene" || !hotspot.sceneId) continue;
      const toArea = areaKeyForScene(hotspot.sceneId, levels);
      if (!toArea || toArea === fromArea) continue;
      const key = [fromArea, toArea].sort().join("::");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Bobot “jalan” antar pinpoint — murni dari struktur graf, tanpa threshold stasiun.
 * Koridor padat (banyak pinpoint) lebih murah; lompatan level jauh lebih mahal.
 */
function pinpointEdgeWeight(
  jump: number,
  sameArea: boolean,
  areaLinkCount: number
): number {
  if (sameArea) return 1;
  const density = Math.max(areaLinkCount, 1);
  return 1 + (jump * jump) / density;
}

/**
 * Graf berbobot undirected dari hotspot scene↔scene (pinpoint = jalan).
 */
export function buildTourSceneGraph(
  scenes: SceneNode[],
  levels: TourLevelPublic[] = []
): Map<string, WeightedEdge[]> {
  const adj = new Map<string, Map<string, number>>();
  const ensure = (id: string) => {
    if (!adj.has(id)) adj.set(id, new Map());
  };
  for (const scene of scenes) ensure(scene.id);

  const areaLinks = levels.length ? countAreaLinks(scenes, levels) : null;

  const link = (a: string, b: string, weight: number) => {
    const forward = adj.get(a)!;
    const backward = adj.get(b)!;
    forward.set(b, Math.min(forward.get(b) ?? Infinity, weight));
    backward.set(a, Math.min(backward.get(a) ?? Infinity, weight));
  };

  for (const scene of scenes) {
    for (const hotspot of scene.hotspots) {
      if (hotspot.type !== "scene" || !hotspot.sceneId) continue;
      const target = hotspot.sceneId;
      if (!adj.has(target)) continue;

      if (!levels.length) {
        link(scene.id, target, 1);
        continue;
      }

      const fromArea = areaKeyForScene(scene.id, levels);
      const toArea = areaKeyForScene(target, levels);
      const sameArea = Boolean(fromArea && toArea && fromArea === toArea);
      const jump = Math.abs(
        levelOrderForScene(scene.id, levels) - levelOrderForScene(target, levels)
      );
      let areaLinkCount = 0;
      if (fromArea && toArea && fromArea !== toArea && areaLinks) {
        areaLinkCount = areaLinks.get([fromArea, toArea].sort().join("::")) ?? 0;
      }
      link(scene.id, target, pinpointEdgeWeight(jump, sameArea, areaLinkCount));
    }
  }

  return new Map(
    [...adj.entries()].map(([id, edges]) => [
      id,
      [...edges.entries()].map(([to, weight]) => ({ to, weight })),
    ])
  );
}

/** Dijkstra — jalur termurah antar pinpoint (mirip navigasi maps). */
function shortestWeightedPath(
  graph: Map<string, WeightedEdge[]>,
  starts: string[],
  goals: string[]
): string[] | null {
  const goal = new Set(goals);
  const startSet = [...new Set(starts)].filter((id) => graph.has(id));
  if (!startSet.length || !goal.size) return null;

  const hitStart = startSet.find((id) => goal.has(id));
  if (hitStart) return [hitStart];

  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const pending = new Set<string>();

  for (const id of graph.keys()) {
    dist.set(id, Infinity);
    prev.set(id, null);
  }
  for (const id of startSet) {
    dist.set(id, 0);
    pending.add(id);
  }

  while (pending.size) {
    let current: string | null = null;
    let best = Infinity;
    for (const id of pending) {
      const d = dist.get(id) ?? Infinity;
      if (d < best) {
        best = d;
        current = id;
      }
    }
    if (current == null || best === Infinity) break;
    pending.delete(current);

    if (goal.has(current)) {
      const path: string[] = [];
      let node: string | null = current;
      while (node) {
        path.unshift(node);
        node = prev.get(node) ?? null;
      }
      return path;
    }

    for (const edge of graph.get(current) ?? []) {
      const nextDist = best + edge.weight;
      if (nextDist >= (dist.get(edge.to) ?? Infinity)) continue;
      dist.set(edge.to, nextDist);
      prev.set(edge.to, current);
      pending.add(edge.to);
    }
  }

  return null;
}

function linearFallback(sceneIds: string[], from: string, to: string): string[] {
  const fi = sceneIds.indexOf(from);
  const ti = sceneIds.indexOf(to);
  if (fi < 0 || ti < 0) return sceneIds.slice(0, 1);
  return fi <= ti ? sceneIds.slice(fi, ti + 1) : sceneIds.slice(ti, fi + 1).reverse();
}

function toWeightedAdj(adj: Map<string, Map<string, number>>): Map<string, WeightedEdge[]> {
  return new Map(
    [...adj.entries()].map(([id, edges]) => [
      id,
      [...edges.entries()].map(([to, weight]) => ({ to, weight })),
    ])
  );
}

/** Hanya jalan di dalam satu area (untuk ekspansi lokal seperti street-level maps). */
function intraAreaGraph(
  sceneGraph: Map<string, WeightedEdge[]>,
  levels: TourLevelPublic[],
  areaKey: string
): Map<string, WeightedEdge[]> {
  const adj = new Map<string, WeightedEdge[]>();
  for (const [from, edges] of sceneGraph) {
    if (areaKeyForScene(from, levels) !== areaKey) continue;
    const local = edges.filter((edge) => areaKeyForScene(edge.to, levels) === areaKey);
    adj.set(from, local);
  }
  return adj;
}

/**
 * Routing hierarkis ala maps:
 * 1) pilih jalur area lewat pinpoint antar-area,
 * 2) expand ke scene via portal + jalan lokal di tiap area.
 * Mencegah muter keluar-masuk area karena graf scene tidak rapat.
 */
function routeViaAreaPinpoints(
  sceneGraph: Map<string, WeightedEdge[]>,
  levels: TourLevelPublic[],
  starts: string[],
  goals: string[]
): string[] | null {
  const areaOf = (sceneId: string) => areaKeyForScene(sceneId, levels);
  const startAreas = [...new Set(starts.map(areaOf).filter(Boolean))] as string[];
  const goalAreas = [...new Set(goals.map(areaOf).filter(Boolean))] as string[];
  if (!startAreas.length || !goalAreas.length) return null;

  const areaAdj = new Map<string, Map<string, number>>();
  const portals = new Map<string, { from: string; to: string; weight: number }[]>();
  const touchArea = (id: string) => {
    if (!areaAdj.has(id)) areaAdj.set(id, new Map());
  };

  for (const [from, edges] of sceneGraph) {
    const fromArea = areaOf(from);
    if (!fromArea) continue;
    touchArea(fromArea);
    for (const edge of edges) {
      const toArea = areaOf(edge.to);
      if (!toArea || toArea === fromArea) continue;
      touchArea(toArea);
      const prev = areaAdj.get(fromArea)!.get(toArea) ?? Infinity;
      areaAdj.get(fromArea)!.set(toArea, Math.min(prev, edge.weight));
      const key = `${fromArea}=>${toArea}`;
      const list = portals.get(key) ?? [];
      list.push({ from, to: edge.to, weight: edge.weight });
      portals.set(key, list);
    }
  }

  const sameAreaHit = startAreas.find((area) => goalAreas.includes(area));
  if (sameAreaHit) {
    const localStarts = starts.filter((id) => areaOf(id) === sameAreaHit);
    const localGoals = goals.filter((id) => areaOf(id) === sameAreaHit);
    return shortestWeightedPath(
      intraAreaGraph(sceneGraph, levels, sameAreaHit),
      localStarts,
      localGoals
    );
  }

  const areaPath = shortestWeightedPath(toWeightedAdj(areaAdj), startAreas, goalAreas);
  if (!areaPath?.length) return null;

  let current =
    starts.find((id) => areaOf(id) === areaPath[0]) ??
    starts[0];
  const path: string[] = [current];

  for (let i = 0; i < areaPath.length - 1; i += 1) {
    const fromArea = areaPath[i];
    const toArea = areaPath[i + 1];
    const portalList = portals.get(`${fromArea}=>${toArea}`) ?? [];
    if (!portalList.length) return null;

    const localGraph = intraAreaGraph(sceneGraph, levels, fromArea);
    let best: { leg: string[]; crossTo: string; score: number } | null = null;
    for (const portal of portalList) {
      const leg =
        current === portal.from
          ? [current]
          : shortestWeightedPath(localGraph, [current], [portal.from]);
      if (!leg?.length) continue;
      const score = leg.length + portal.weight;
      if (!best || score < best.score) {
        best = { leg, crossTo: portal.to, score };
      }
    }
    if (!best) return null;
    path.push(...best.leg.slice(1), best.crossTo);
    current = best.crossTo;
  }

  const lastArea = areaPath[areaPath.length - 1];
  const finishGoals = goals.filter((id) => areaOf(id) === lastArea);
  const finish = shortestWeightedPath(
    intraAreaGraph(sceneGraph, levels, lastArea),
    [current],
    finishGoals
  );
  if (!finish?.length) return null;
  path.push(...finish.slice(1));
  return path;
}

/**
 * Jalur panorama Dari→Ke = scanning pinpoint hotspot (maps-style),
 * dari posisi/titik ke tujuan mengikuti jalan pinpoint yang dipasang.
 */
export function buildTourRoute(
  scenes: SceneNode[],
  levels: TourLevelPublic[],
  fromSceneId: string,
  toSceneId: string,
  options: BuildTourRouteOptions = {}
): string[] {
  const sceneIds = scenes.map((scene) => scene.id);
  if (!sceneIds.length) return [];
  if (fromSceneId === toSceneId) return [fromSceneId];

  const starts = options.originExact
    ? sceneIds.includes(fromSceneId)
      ? [fromSceneId]
      : []
    : scenesForStop(fromSceneId, levels, sceneIds);
  const goals = options.destinationExact
    ? sceneIds.includes(toSceneId)
      ? [toSceneId]
      : []
    : scenesForStop(toSceneId, levels, sceneIds);

  if (!starts.length || !goals.length) {
    return linearFallback(sceneIds, fromSceneId, toSceneId);
  }

  const graph = buildTourSceneGraph(scenes, levels);
  const hierarchical = routeViaAreaPinpoints(graph, levels, starts, goals);
  if (hierarchical?.length) return hierarchical;

  const flat = shortestWeightedPath(graph, starts, goals);
  if (flat?.length) return flat;

  return linearFallback(sceneIds, fromSceneId, toSceneId);
}

/**
 * Tujuan default: stop dengan jalur pinpoint terpanjang dari origin.
 * Data-driven (graf hotspot), tanpa cocokkan label stasiun.
 */
export function defaultRouteDestination(
  scenes: SceneNode[],
  levels: TourLevelPublic[],
  stops: RouteStop[],
  fromSceneId: string
): string | undefined {
  if (!stops.length) return undefined;
  if (stops.length === 1) return stops[0].sceneId;

  let best: RouteStop | undefined;
  let bestLength = -1;
  for (const stop of stops) {
    if (stop.sceneId === fromSceneId) continue;
    const length = buildTourRoute(scenes, levels, fromSceneId, stop.sceneId).length;
    if (length > bestLength) {
      bestLength = length;
      best = stop;
    }
  }
  return best?.sceneId ?? stops.at(-1)?.sceneId;
}

/**
 * Ringkas jalur scene → waypoint area/level (titik masuk tiap area di jalur).
 * Scene intermediate tetap di autoplay.
 */
export function collapseRouteToWaypoints(
  routeSceneIds: string[],
  levels: TourLevelPublic[]
): RouteWaypoint[] {
  const waypoints: RouteWaypoint[] = [];
  for (const sceneId of routeSceneIds) {
    const { key, label } = stopKeyForScene(sceneId, levels);
    const last = waypoints[waypoints.length - 1];
    if (last?.key === key) continue;
    waypoints.push({ key, label, sceneId });
  }
  return waypoints;
}

export function formatStopOptionLabel(stop: RouteStop): string {
  if (stop.label.toLocaleLowerCase("id-ID") === stop.levelLabel.toLocaleLowerCase("id-ID")) {
    return stop.label;
  }
  return `${stop.levelLabel} · ${stop.label}`;
}

export function isWaypointActive(
  point: RouteWaypoint,
  activeSceneId: string,
  levels: TourLevelPublic[]
): boolean {
  const placement = findScenePlacement(levels, activeSceneId);
  if (placement?.area) return point.key === placement.area.id;
  if (placement?.level) return point.key === `level:${placement.level.id}`;
  return point.sceneId === activeSceneId;
}
