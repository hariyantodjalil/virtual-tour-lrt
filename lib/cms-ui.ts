/**
 * Shared CMS surface tokens — light operate workspace (matches the inquiry/detail modal).
 * Resolves inside `.cms-light` on the CMS shell; keep values in sync with globals.css.
 */
export const cmsUi = {
  card: "border-[var(--work-line)] bg-[var(--work-surface)] text-[var(--work-text)]",
  cardSoft: "border-[var(--work-line)] bg-[var(--work-surface)] text-[var(--work-text)]",
  nested: "border-[var(--work-line)] bg-[var(--work-subtle)]",
  void: "bg-[var(--work-subtle)]",
  panel: "bg-[var(--work-surface)]",
  surface: "bg-[var(--work-subtle)]",
  ink: "text-[var(--work-text)]",
  muted: "text-[var(--work-muted)]",
  faint: "text-[var(--work-muted)]",
  hairline: "border-[var(--work-line)]",
  input:
    "border-[var(--work-control)] bg-[var(--work-surface)] text-[var(--work-text)] placeholder:text-[var(--work-muted)] focus-visible:border-[#D81435] focus-visible:ring-[#D81435]/25",
  select:
    "border-[var(--work-control)] bg-[var(--work-surface)] text-[var(--work-text)] focus:border-[#D81435] focus:ring-[#D81435]/25",
  outlineBtn:
    "border-[var(--work-control)] bg-transparent text-[var(--work-text)] hover:bg-[var(--work-subtle)]",
  primaryBtn: "bg-[#D81435] text-white hover:bg-[#B8112D]",
  successBadge: "border-emerald-200 bg-emerald-50 text-emerald-800",
  inactiveBadge: "border-[var(--work-line)] bg-[var(--work-subtle)] text-[var(--work-muted)]",
  outlineBadge: "border-[var(--work-line)] bg-transparent text-[var(--work-muted)]",
  softBadge: "border-transparent bg-[var(--work-subtle)] text-[var(--work-muted)]",
  modal: "border-[var(--work-line)] bg-[var(--work-surface)] text-[var(--work-text)]",
} as const;
