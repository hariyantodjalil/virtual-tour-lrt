/**
 * Shared CMS surface tokens — align with CmsShell / Leads Void Portal maroon.
 * Prefer these over slate-* so list pages don't read as cool blue-gray.
 */
export const cmsUi = {
  card: "border-[rgba(255,214,218,0.14)] bg-[#3A161C] text-[#F8ECEE]",
  cardSoft: "border-[rgba(255,214,218,0.14)] bg-[#3A161C]/60 text-[#F8ECEE]",
  nested: "border-[rgba(255,214,218,0.14)] bg-[#261015]",
  void: "bg-[#1C0A0E]",
  panel: "bg-[#3A161C]",
  surface: "bg-[#261015]",
  ink: "text-[#F8ECEE]",
  muted: "text-[#C4A8AD]",
  faint: "text-[#A88990]",
  hairline: "border-[rgba(255,214,218,0.14)]",
  input:
    "border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] text-[#F8ECEE] placeholder:text-[#C4A8AD] focus-visible:border-[#E31E2D] focus-visible:ring-[#E31E2D]/25",
  select:
    "border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] text-[#F8ECEE] focus:border-[#E31E2D] focus:ring-[#E31E2D]/25",
  outlineBtn:
    "border-[rgba(255,214,218,0.14)] bg-transparent text-[#F8ECEE] hover:bg-[#261015] hover:text-[#F8ECEE]",
  primaryBtn: "bg-[#E31E2D] text-white hover:bg-[#c41926]",
  successBadge: "border-emerald-700/50 bg-emerald-950/40 text-emerald-300",
  inactiveBadge: "border-[rgba(255,214,218,0.14)] bg-[#261015] text-[#C4A8AD]",
  outlineBadge: "border-[rgba(255,214,218,0.18)] bg-transparent text-[#F0DDE1]",
  softBadge: "border-transparent bg-[#261015] text-[#C4A8AD]",
  modal: "border-[rgba(255,214,218,0.18)] bg-[#261015] text-[#F8ECEE]",
} as const;
