/**
 * Penyimpan arah kamera kecil (yaw/HFOV) agar minimap bisa ikut berputar tanpa me-render ulang
 * seluruh halaman tur setiap kali kamera bergerak.
 */
export type MinimapView = { yaw: number; hfov: number };

export type MinimapViewStore = {
  get: () => MinimapView;
  set: (view: MinimapView) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createMinimapViewStore(initial: MinimapView = { yaw: 0, hfov: 100 }): MinimapViewStore {
  let view = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => view,
    set: (next) => {
      if (Math.abs(next.yaw - view.yaw) < 0.2 && Math.abs(next.hfov - view.hfov) < 0.2) return;
      view = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
