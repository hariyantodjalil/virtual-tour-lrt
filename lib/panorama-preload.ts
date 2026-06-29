/** Cache decode panorama equirectangular sebelum transisi scene. */

const readyCache = new Map<string, Promise<void>>();

export function preloadPanoramaUrl(url: string): Promise<void> {
  if (!url) return Promise.resolve();

  const cached = readyCache.get(url);
  if (cached) return cached;

  const task = new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";

    const finish = () => resolve();
    const fail = () => {
      readyCache.delete(url);
      reject(new Error(`Gagal preload panorama: ${url}`));
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
