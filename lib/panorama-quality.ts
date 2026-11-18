export type PanoramaQuality = "economy" | "hd";
export type ConnectionHint = { saveData?: boolean; effectiveType?: string };
export type TileTransfer = { start: number; end: number; bytes: number };

/** Measurements are transient and local to this tab; no speed-test downloads. */
export class PanoramaQualityEstimator {
  private samples: TileTransfer[] = [];
  private failures: number[] = [];
  private quality: PanoramaQuality = "economy";
  private promotedAt = -Infinity;

  record(sample: TileTransfer) {
    if (![sample.start, sample.end, sample.bytes].every(Number.isFinite) ||
        sample.bytes < 8192 || sample.end <= sample.start) return;
    this.samples.push(sample);
    this.samples = this.samples.filter(s => s.end >= sample.end - 15000).slice(-80);
  }

  fail(now: number) {
    this.failures = [...this.failures.filter(t => t >= now - 15000), now].slice(-4);
    this.quality = "economy";
    this.promotedAt = now;
  }

  choose(now: number, viewportWidth: number, connection: ConnectionHint = {}): PanoramaQuality {
    const samples = this.samples.filter(s => s.end >= now - 15000);
    const failures = this.failures.filter(t => t >= now - 15000);
    if (connection.saveData || ["slow-2g", "2g", "3g"].includes(connection.effectiveType ?? "") ||
        failures.length >= 2 || !samples.length) {
      if (this.quality === "hd") this.promotedAt = now;
      this.quality = "economy";
      return this.quality;
    }

    // Merge overlapping requests: summing individual transfer rates exaggerates bandwidth.
    const ranges = samples.map(s => [s.start, s.end]).sort((a, b) => a[0] - b[0]);
    let activeMs = 0;
    let [start, end] = ranges[0];
    for (const [nextStart, nextEnd] of ranges.slice(1)) {
      if (nextStart <= end) end = Math.max(end, nextEnd);
      else { activeMs += end - start; [start, end] = [nextStart, nextEnd]; }
    }
    activeMs += end - start;
    const bytes = samples.reduce((sum, s) => sum + s.bytes, 0);
    const mbps = bytes * 8 / activeMs / 1000;
    const desktop = viewportWidth >= 1024;
    const recent = samples.filter(s => s.end >= now - 8000);
    const recentSpan = recent.length ? Math.max(...recent.map(s => s.end)) - Math.min(...recent.map(s => s.start)) : 0;
    if (samples.length >= 3 && bytes >= 131072 && mbps < (desktop ? 4 : 2)) {
      this.quality = "economy";
      this.promotedAt = now; // Cool down after a downgrade instead of immediately bouncing back.
    } else if (this.quality === "economy" && failures.length === 0 &&
        recent.length >= 6 && recentSpan >= 2000 && bytes >= 262144 &&
        mbps >= (desktop ? 12 : 6) && now - this.promotedAt >= 20000) {
      this.quality = "hd";
      this.promotedAt = now;
    }
    return this.quality;
  }
}

const estimator = new PanoramaQualityEstimator();
let observers = 0;
let observer: PerformanceObserver | undefined;

function connectionHint(): ConnectionHint {
  return typeof navigator === "undefined" ? {} :
    (navigator as Navigator & { connection?: ConnectionHint }).connection ?? {};
}

export function getAutomaticPanoramaQuality(viewportWidth: number): PanoramaQuality {
  return estimator.choose(typeof performance === "undefined" ? 0 : performance.now(), viewportWidth, connectionHint());
}

export function isPanoramaTileUrl(url: string): boolean {
  if (typeof location === "undefined") return false;
  try {
    const parsed = new URL(url, location.href);
    return parsed.origin === location.origin && parsed.pathname.startsWith("/api/s3-proxy/virtual-tour/panorama-tiles/");
  } catch { return false; }
}

export function recordPanoramaTileFailure(url?: string) {
  if (!url || isPanoramaTileUrl(url)) estimator.fail(performance.now());
}

/** Observe only real tile transfers; cached resources must not look like very fast internet. */
export function observePanoramaNetwork(): () => void {
  observers++;
  if (!observer && typeof PerformanceObserver !== "undefined") {
    try {
      observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
          if (!isPanoramaTileUrl(entry.name)) continue;
          const status = (entry as PerformanceResourceTiming & { responseStatus?: number }).responseStatus;
          if (status && status >= 400) { estimator.fail(entry.responseEnd); continue; }
          if (entry.transferSize <= 0 || entry.encodedBodySize <= 0 || entry.transferSize < entry.encodedBodySize) continue;
          estimator.record({ start: entry.requestStart || entry.startTime, end: entry.responseEnd, bytes: entry.encodedBodySize });
        }
      });
      observer.observe({ type: "resource", buffered: false });
    } catch { observer?.disconnect(); observer = undefined; }
  }
  return () => {
    observers = Math.max(0, observers - 1);
    if (!observers) { observer?.disconnect(); observer = undefined; }
  };
}
