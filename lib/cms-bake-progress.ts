/** NDJSON events for CMS privacy-blur bake progress (station + train). */

export type BakeProgressEvent = {
  type: "progress";
  percent: number;
  label: string;
};

export type BakeDoneEvent = {
  type: "done";
  message: string;
  scene: unknown;
  panoramaUrl?: string;
  thumbnailUrl?: string;
  hd?: { status?: string; reason?: string };
  optimization?: Record<string, unknown>;
};

export type BakeErrorEvent = {
  type: "error";
  error: string;
};

export type BakeStreamEvent = BakeProgressEvent | BakeDoneEvent | BakeErrorEvent;

export function clampBakePercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Map region bake index into the mid-band of overall progress (20–55%). */
export function bakeRegionPercent(done: number, total: number): number {
  if (total <= 0) return 55;
  const t = Math.min(1, Math.max(0, done / total));
  return clampBakePercent(20 + t * 35);
}
