/**
 * Shared CMS surface tokens — tema terang mengikuti Panel Mitra (putih, abu-abu slate, merah #c41230).
 */
export const cmsUi = {
  card: "border-slate-200 bg-white text-[#101828] shadow-sm",
  cardSoft: "border-slate-200 bg-white/80 text-[#101828]",
  nested: "border-slate-200 bg-slate-50",
  void: "bg-[#f3f4f6]",
  panel: "bg-white",
  surface: "bg-slate-100",
  ink: "text-[#101828]",
  muted: "text-slate-600",
  faint: "text-slate-500",
  hairline: "border-slate-200",
  input:
    "border-slate-300 bg-white text-[#101828] placeholder:text-slate-400 focus-visible:border-[#c41230] focus-visible:ring-[#c41230]/20",
  select:
    "border-slate-300 bg-white text-[#101828] focus:border-[#c41230] focus:ring-[#c41230]/20",
  outlineBtn:
    "border-slate-300 bg-white text-[#101828] hover:bg-slate-50 hover:text-[#101828]",
  primaryBtn: "bg-[#c41230] text-white hover:bg-[#a30f28]",
  successBadge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  inactiveBadge: "border-slate-200 bg-slate-100 text-slate-600",
  outlineBadge: "border-slate-300 bg-transparent text-slate-700",
  softBadge: "border-transparent bg-slate-100 text-slate-600",
  modal: "border-slate-200 bg-white text-[#101828]",
} as const;
