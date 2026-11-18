/** Cache decode panorama equirectangular sebelum transisi scene. */
import { recordPanoramaTileFailure } from "./panorama-quality";

const readyCache = new Map<string, Promise<boolean>>();
const MAX_CACHE_ENTRIES = 24;

function evictOldestEntry() {
  if (readyCache.size < MAX_CACHE_ENTRIES) return;
  const oldestKey = readyCache.keys().next().value;
  if (oldestKey) readyCache.delete(oldestKey);
}

export function preloadPanoramaUrl(url: string): Promise<boolean> {
  if (!url) return Promise.resolve(true);

  const cached = readyCache.get(url);
  if (cached) return cached;

  evictOldestEntry();
  const task = new Promise<boolean>((resolve) => {
    const img = new Image();
    img.decoding = "async";

    let done = false;
    const finish = (success = true) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      if (!success) {
        img.src = "";
        readyCache.delete(url);
        recordPanoramaTileFailure(url);
      }
      resolve(success);
    };
    const timer = setTimeout(() => finish(false), 10000);
    const fail = () => {
      // Soft-fail: S3/proxy sering down di lokal — jangan unhandledRejection
      console.warn(`Gagal preload panorama: ${url}`);
      finish(false);
    };

    img.onload = () => {
      if (typeof img.decode === "function") {
        img.decode().then(() => finish()).catch(() => finish());
      } else {
        finish();
      }
    };
    img.onerror = fail;
    img.src = url;
  });

  readyCache.set(url, task);
  return task;
}

export function preloadPanoramaUrls(urls: string[]) {
  const unique = [...new Set(urls.filter(Boolean))];
  return Promise.allSettled(unique.map(preloadPanoramaUrl));
}

export function isPanoramaReady(url: string) {
  return readyCache.has(url);
}
