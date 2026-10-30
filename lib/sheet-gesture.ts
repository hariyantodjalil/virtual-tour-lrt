type SheetSwipe = {
  deltaX: number;
  deltaY: number;
  elapsedMs: number;
  sheetHeight: number;
  expanded: boolean;
};

export function resolveSheetSwipe({ deltaX, deltaY, elapsedMs, sheetHeight, expanded }: SheetSwipe): "expand" | "collapse" | "dismiss" | "none" {
  if (Math.abs(deltaY) <= Math.abs(deltaX) * 1.2) return "none";
  const fast = Math.abs(deltaY) >= 32 && Math.abs(deltaY) / Math.max(elapsedMs, 1) >= 0.5;
  if (deltaY <= -40 || (deltaY < 0 && fast)) return expanded ? "none" : "expand";
  const threshold = expanded ? 60 : Math.min(96, sheetHeight * 0.18);
  if (deltaY >= threshold || (deltaY > 0 && fast)) return expanded ? "collapse" : "dismiss";
  return "none";
}
