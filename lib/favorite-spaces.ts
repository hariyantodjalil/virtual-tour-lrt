export const FAVORITES_UPDATED_EVENT = "lrt-favorites-updated";

const LEGACY_STORAGE_KEY = "lrt-partner-favorite-spaces";

export type FavoriteSpace = {
  spaceId: string;
  code: string;
  name: string;
  type: string;
  status: string;
  area: number;
  location?: string | null;
  floor?: string | null;
  panoramaUrl?: string | null;
  stationSlug: string;
  stationName: string;
  savedAt: string;
};

export type FavoritesFetchResult =
  | { kind: "ready"; items: FavoriteSpace[] }
  | { kind: "unauthenticated" }
  | { kind: "forbidden" };

export class FavoriteAuthError extends Error {
  status: 401 | 403;

  constructor(status: 401 | 403, message: string) {
    super(message);
    this.status = status;
  }
}

export function clearLegacyFavoriteStorage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Abaikan jika browser membatasi akses storage.
  }
}

export function notifyFavoritesUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FAVORITES_UPDATED_EVENT));
}

export async function fetchPartnerFavorites(options?: {
  signal?: AbortSignal;
}): Promise<FavoritesFetchResult> {
  clearLegacyFavoriteStorage();
  const res = await fetch("/api/partner/favorites", {
    method: "GET",
    cache: "no-store",
    signal: options?.signal,
  });
  if (res.status === 401) return { kind: "unauthenticated" };
  if (res.status === 403) return { kind: "forbidden" };
  if (!res.ok) {
    throw new Error("Gagal memuat daftar favorit.");
  }
  const items = (await res.json()) as FavoriteSpace[];
  return { kind: "ready", items: Array.isArray(items) ? items : [] };
}

export async function addPartnerFavorite(spaceId: string): Promise<FavoriteSpace> {
  const res = await fetch("/api/partner/favorites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spaceId }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) {
    throw new FavoriteAuthError(
      res.status,
      typeof data.error === "string"
        ? data.error
        : "Login sebagai akun Mitra untuk menyimpan favorit."
    );
  }
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Gagal menyimpan unit ke favorit."
    );
  }
  notifyFavoritesUpdated();
  return data as FavoriteSpace;
}

export async function removePartnerFavorite(spaceId: string): Promise<void> {
  const res = await fetch(`/api/partner/favorites/${encodeURIComponent(spaceId)}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) {
    throw new FavoriteAuthError(
      res.status,
      typeof data.error === "string"
        ? data.error
        : "Login sebagai akun Mitra untuk mengelola favorit."
    );
  }
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Gagal menghapus unit dari favorit."
    );
  }
  notifyFavoritesUpdated();
}
