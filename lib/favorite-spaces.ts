export type FavoriteSpace = {
  spaceId: string;
  code: string;
  name: string;
  type: string;
  status: string;
  area: number;
  monthlyRent?: number;
  location?: string;
  floor?: string;
  panoramaUrl?: string | null;
  stationSlug: string;
  stationName: string;
  savedAt: string;
};

const STORAGE_KEY = "lrt-partner-favorite-spaces";
export const FAVORITES_UPDATED_EVENT = "lrt-favorites-updated";

function canUseStorage() {
  return typeof window !== "undefined";
}

function notifyFavoritesUpdated() {
  if (!canUseStorage()) return;
  window.dispatchEvent(new CustomEvent(FAVORITES_UPDATED_EVENT));
}

export function readFavoriteSpaces(): FavoriteSpace[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FavoriteSpace[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFavoriteSpaces(items: FavoriteSpace[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  notifyFavoritesUpdated();
}

export function isFavoriteSpace(spaceId: string): boolean {
  return readFavoriteSpaces().some((item) => item.spaceId === spaceId);
}

export function toggleFavoriteSpace(
  entry: Omit<FavoriteSpace, "savedAt">
): boolean {
  const items = readFavoriteSpaces();
  const index = items.findIndex((item) => item.spaceId === entry.spaceId);

  if (index >= 0) {
    items.splice(index, 1);
    writeFavoriteSpaces(items);
    return false;
  }

  writeFavoriteSpaces([
    {
      ...entry,
      savedAt: new Date().toISOString(),
    },
    ...items,
  ]);
  return true;
}

export function removeFavoriteSpace(spaceId: string) {
  writeFavoriteSpaces(readFavoriteSpaces().filter((item) => item.spaceId !== spaceId));
}
