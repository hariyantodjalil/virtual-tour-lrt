/**
 * Kamera tersimpan (bookmark POV) per scene — khusus admin CMS untuk berpindah sudut pandang
 * dengan cepat saat menata hotspot. Disimpan di canvasData.cameraBookmarks; tidak dipakai tour publik.
 */
export type CameraBookmark = {
  id: string;
  label: string;
  yaw: number;
  pitch: number;
  hfov: number;
};

export const MAX_CAMERA_BOOKMARKS = 12;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

export function extractCameraBookmarks(canvasData: unknown): CameraBookmark[] {
  const raw = asRecord(canvasData).cameraBookmarks;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const row = asRecord(item);
    const yaw = Number(row.yaw);
    const pitch = Number(row.pitch);
    const hfov = Number(row.hfov);
    if (![yaw, pitch, hfov].every(Number.isFinite)) return [];
    return [
      {
        id: typeof row.id === "string" && row.id ? row.id : `cam-${Math.random().toString(36).slice(2, 8)}`,
        label: typeof row.label === "string" && row.label.trim() ? row.label.trim().slice(0, 40) : "Kamera",
        yaw,
        pitch,
        hfov,
      },
    ];
  }).slice(0, MAX_CAMERA_BOOKMARKS);
}

export function mergeCameraBookmarksIntoCanvasData(
  canvasData: unknown,
  bookmarks: CameraBookmark[]
): Record<string, unknown> {
  return { ...asRecord(canvasData), cameraBookmarks: bookmarks.slice(0, MAX_CAMERA_BOOKMARKS) };
}

export function newCameraBookmark(
  view: { yaw: number; pitch: number; hfov: number },
  existing: CameraBookmark[]
): CameraBookmark {
  // Nomor berikutnya mengikuti label "Kamera N" yang sudah ada agar tidak ganda setelah ada yang dihapus.
  const used = existing
    .map((b) => /^Kamera (\d+)$/.exec(b.label)?.[1])
    .filter(Boolean)
    .map(Number);
  const next = used.length ? Math.max(...used) + 1 : existing.length + 1;
  return {
    id: `cam-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    label: `Kamera ${next}`,
    yaw: Math.round(view.yaw * 10) / 10,
    pitch: Math.round(view.pitch * 10) / 10,
    hfov: Math.round(view.hfov * 10) / 10,
  };
}

/** Batas arah tiba yang diterima tour publik (lihat sceneEntryViewSchema). */
const ENTRY_HFOV_MIN = 50;
const ENTRY_HFOV_MAX = 120;
const ENTRY_PITCH_LIMIT = 58;

/** Ubah kamera tersimpan menjadi arah kamera saat tiba yang valid untuk tour publik. */
export function bookmarkToEntryView(bookmark: CameraBookmark) {
  return {
    yaw: Math.max(-180, Math.min(180, bookmark.yaw)),
    pitch: Math.max(-ENTRY_PITCH_LIMIT, Math.min(ENTRY_PITCH_LIMIT, bookmark.pitch)),
    hfov: Math.max(ENTRY_HFOV_MIN, Math.min(ENTRY_HFOV_MAX, bookmark.hfov)),
  };
}

/** Kamera tersimpan yang sama dengan arah tiba hotspot (toleransi pembulatan), bila ada. */
export function findBookmarkForView(
  view: { yaw: number; pitch: number; hfov?: number } | undefined,
  bookmarks: CameraBookmark[]
) {
  if (!view) return undefined;
  return bookmarks.find((bookmark) => {
    const entry = bookmarkToEntryView(bookmark);
    return (
      Math.abs(entry.yaw - view.yaw) < 0.11 &&
      Math.abs(entry.pitch - view.pitch) < 0.11 &&
      Math.abs(entry.hfov - (view.hfov ?? ENTRY_HFOV_MAX)) < 0.11
    );
  });
}
