"use client";

export type EditorPanoramaPreviewMode = "display" | "hemat" | "hd";

type EditorPanoramaPreviewToggleProps = {
  value: EditorPanoramaPreviewMode;
  onChange: (mode: EditorPanoramaPreviewMode) => void;
  hasHematTiles: boolean;
  hasHdTiles: boolean;
  hasHdOriginal: boolean;
  /** compact = sidebar; canvas = overlay di viewer */
  size?: "compact" | "canvas";
  className?: string;
};

/**
 * Pilih manual preview Display / Hemat / HD untuk cek hasil bake di editor.
 * Lebar tiap tombol tetap supaya ganti mode tidak melebar/mengecil.
 */
export function EditorPanoramaPreviewToggle({
  value,
  onChange,
  hasHematTiles,
  hasHdTiles,
  hasHdOriginal,
  size = "compact",
  className = "",
}: EditorPanoramaPreviewToggleProps) {
  const hasHdPreview = hasHdTiles || hasHdOriginal;
  const options: Array<{
    id: EditorPanoramaPreviewMode;
    label: string;
    title: string;
    disabled: boolean;
    ready: boolean;
  }> = [
    {
      id: "display",
      label: "Display",
      title: "Gambar display — tempat set & bake blur",
      disabled: false,
      ready: true,
    },
    {
      id: "hemat",
      label: "Hemat",
      title: hasHematTiles
        ? "Tile Hemat hasil bake — blur di piksel"
        : "Tile Hemat belum ada — pakai gambar display",
      disabled: false,
      ready: hasHematTiles,
    },
    {
      id: "hd",
      label: "HD",
      title: hasHdTiles
        ? "Tile HD hasil bake — blur di piksel"
        : hasHdOriginal
          ? "Tile HD belum siap — tampil original + overlay"
          : "Original / tile HD belum ada",
      disabled: !hasHdPreview,
      ready: hasHdTiles,
    },
  ];

  return (
    <div className={className}>
      {size === "compact" ? (
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--work-muted)]">
          Preview hasil bake
        </p>
      ) : null}
      <div
        className={`inline-flex h-8 shrink-0 items-center gap-0.5 rounded-lg border border-[var(--work-line)] bg-[var(--work-subtle)]/90 p-0.5 ${
          size === "canvas" ? "backdrop-blur" : ""
        }`}
        role="group"
        aria-label="Preview kualitas panorama"
      >
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={opt.disabled}
              title={opt.title}
              onClick={() => onChange(opt.id)}
              className={`inline-flex h-7 w-[4.75rem] shrink-0 items-center justify-center gap-1 rounded-md text-[10px] font-semibold leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                active
                  ? "bg-[#E31E2D] text-white"
                  : "bg-transparent text-[var(--work-muted)] hover:bg-[var(--work-subtle)] hover:text-[var(--work-text)]"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  opt.ready
                    ? active
                      ? "bg-white"
                      : "bg-emerald-400"
                    : active
                      ? "bg-[var(--work-subtle)]0"
                      : "bg-[#5A3038]"
                }`}
                aria-hidden
              />
              <span className="tabular-nums">{opt.label}</span>
            </button>
          );
        })}
      </div>
      {size === "compact" ? (
        <p className="mt-1 text-[10px] leading-relaxed text-[var(--work-muted)]">
          Titik hijau = tile hasil bake siap. Pilih Hemat/HD untuk cek blur di piksel.
        </p>
      ) : null}
    </div>
  );
}
