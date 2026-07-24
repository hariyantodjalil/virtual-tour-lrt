/** Cache decode panorama equirectangular sebelum transisi scene. */

const readyCache = new Map<string, Promise<void>>();
const MAX_CACHE_ENTRIES = 24;

function evictOldestEntry() {
  if (readyCache.size < MAX_CACHE_ENTRIES) return;
  const oldestKey = readyCache.keys().next().value;
  if (oldestKey) readyCache.delete(oldestKey);
}

export function preloadPanoramaUrl(url: string): Promise<void> {
  if (!url) return Promise.resolve();

  const cached = readyCache.get(url);
  if (cached) return cached;

  evictOldestEntry();
  const task = new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = "async";

    const finish = () => resolve();
    const fail = () => {
      // Soft-fail: S3/proxy sering down di lokal — jangan unhandledRejection
      readyCache.delete(url);
      console.warn(`Gagal preload panorama: ${url}`);
      resolve();
    };

    img.onload = () => {
      if (typeof img.decode === "function") {
        img.decode().then(finish).catch(finish);
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
