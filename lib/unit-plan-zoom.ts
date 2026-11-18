export const UNIT_PLAN_MIN_ZOOM = 1;
export const UNIT_PLAN_MAX_ZOOM = 2;

export type ZoomViewport = {
  zoom: number;
  cx: number;
  cy: number;
};

export type ViewportInsets = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

function normalizeInsets(insets?: ViewportInsets) {
  return {
    top: insets?.top ?? 0,
    right: insets?.right ?? 0,
    bottom: insets?.bottom ?? 0,
    left: insets?.left ?? 0,
  };
}

export function computeBaseScale(
  rectW: number,
  rectH: number,
  viewW: number,
  viewH: number,
  insets?: ViewportInsets
) {
  if (rectW <= 0 || rectH <= 0 || viewW <= 0 || viewH <= 0) return 1;
  const { top, right, bottom, left } = normalizeInsets(insets);
  const availW = Math.max(1, rectW - left - right);
  const availH = Math.max(1, rectH - top - bottom);
  return Math.min(availW / viewW, availH / viewH);
}

export function createInitialZoomViewport(
  viewW: number,
  viewH: number,
  rectW = 0,
  rectH = 0,
  insets?: ViewportInsets
): ZoomViewport {
  if (rectW <= 0 || rectH <= 0) {
    return {
      zoom: UNIT_PLAN_MIN_ZOOM,
      cx: viewW / 2,
      cy: viewH / 2,
    };
  }
  const { cx, cy } = clampZoomViewportCenter(
    viewW / 2,
    viewH / 2,
    UNIT_PLAN_MIN_ZOOM,
    rectW,
    rectH,
    viewW,
    viewH,
    insets
  );
  return { zoom: UNIT_PLAN_MIN_ZOOM, cx, cy };
}

export function clampZoomViewportCenter(
  cx: number,
  cy: number,
  zoom: number,
  rectW: number,
  rectH: number,
  viewW: number,
  viewH: number,
  insets?: ViewportInsets
) {
  if (rectW <= 0 || rectH <= 0 || viewW <= 0 || viewH <= 0) {
    return { cx: viewW / 2, cy: viewH / 2 };
  }
  const { top, right, bottom, left } = normalizeInsets(insets);
  const scale = zoom * computeBaseScale(rectW, rectH, viewW, viewH, insets);

  const minCx = (rectW / 2 - left) / scale;
  const maxCx = viewW - (rectW / 2 - right) / scale;
  const nextCx =
    minCx > maxCx ? (minCx + maxCx) / 2 : Math.min(maxCx, Math.max(minCx, cx));

  const minCy = (rectH / 2 - top) / scale;
  const maxCy = viewH - (rectH / 2 - bottom) / scale;
  const nextCy =
    minCy > maxCy ? (minCy + maxCy) / 2 : Math.min(maxCy, Math.max(minCy, cy));

  return { cx: nextCx, cy: nextCy };
}

export function clampZoomViewport(
  viewport: ZoomViewport,
  rectW: number,
  rectH: number,
  viewW: number,
  viewH: number,
  insets?: ViewportInsets
): ZoomViewport {
  const zoom = Math.min(UNIT_PLAN_MAX_ZOOM, Math.max(UNIT_PLAN_MIN_ZOOM, viewport.zoom));
  const { cx, cy } = clampZoomViewportCenter(viewport.cx, viewport.cy, zoom, rectW, rectH, viewW, viewH, insets);
  return { zoom, cx, cy };
}

export function zoomViewportAtPoint(
  prev: ZoomViewport,
  {
    deltaPx,
    pointerX,
    pointerY,
    rectW,
    rectH,
    viewW,
    viewH,
    insets,
    sensitivity = 0.002,
  }: {
    deltaPx: number;
    pointerX: number;
    pointerY: number;
    rectW: number;
    rectH: number;
    viewW: number;
    viewH: number;
    insets?: ViewportInsets;
    sensitivity?: number;
  }
): ZoomViewport {
  if (rectW <= 0 || rectH <= 0 || deltaPx === 0) return prev;
  return pinchZoomViewport(prev, {
    scaleRatio: Math.exp(-deltaPx * sensitivity),
    anchorX: pointerX,
    anchorY: pointerY,
    panDx: 0,
    panDy: 0,
    rectW,
    rectH,
    viewW,
    viewH,
    insets,
  });
}

export function pinchZoomViewport(
  prev: ZoomViewport,
  {
    scaleRatio,
    anchorX,
    anchorY,
    panDx = 0,
    panDy = 0,
    rectW,
    rectH,
    viewW,
    viewH,
    insets,
  }: {
    scaleRatio: number;
    anchorX: number;
    anchorY: number;
    panDx?: number;
    panDy?: number;
    rectW: number;
    rectH: number;
    viewW: number;
    viewH: number;
    insets?: ViewportInsets;
  }
): ZoomViewport {
  if (rectW <= 0 || rectH <= 0 || !Number.isFinite(scaleRatio) || scaleRatio <= 0) return prev;

  let nextZoom = Math.min(UNIT_PLAN_MAX_ZOOM, Math.max(UNIT_PLAN_MIN_ZOOM, prev.zoom * scaleRatio));
  if (scaleRatio < 1 && nextZoom < UNIT_PLAN_MIN_ZOOM + 0.01) nextZoom = UNIT_PLAN_MIN_ZOOM;
  if (scaleRatio > 1 && nextZoom > UNIT_PLAN_MAX_ZOOM - 0.01) nextZoom = UNIT_PLAN_MAX_ZOOM;

  if (nextZoom === prev.zoom && panDx === 0 && panDy === 0) return prev;

  const baseScale = computeBaseScale(rectW, rectH, viewW, viewH, insets);
  const prevScale = prev.zoom * baseScale;
  const nextScale = nextZoom * baseScale;

  const clampedPrev = clampZoomViewportCenter(prev.cx, prev.cy, prev.zoom, rectW, rectH, viewW, viewH, insets);
  const svgX = clampedPrev.cx + (anchorX - panDx - rectW / 2) / prevScale;
  const svgY = clampedPrev.cy + (anchorY - panDy - rectH / 2) / prevScale;
  const rawCx = svgX - (anchorX - rectW / 2) / nextScale;
  const rawCy = svgY - (anchorY - rectH / 2) / nextScale;
  const { cx, cy } = clampZoomViewportCenter(rawCx, rawCy, nextZoom, rectW, rectH, viewW, viewH, insets);

  return { zoom: nextZoom, cx, cy };
}

export function panZoomViewport(
  prev: ZoomViewport,
  {
    dx,
    dy,
    rectW,
    rectH,
    viewW,
    viewH,
    insets,
  }: {
    dx: number;
    dy: number;
    rectW: number;
    rectH: number;
    viewW: number;
    viewH: number;
    insets?: ViewportInsets;
  }
): ZoomViewport {
  if (prev.zoom <= UNIT_PLAN_MIN_ZOOM || rectW <= 0 || rectH <= 0) return prev;
  const scale = prev.zoom * computeBaseScale(rectW, rectH, viewW, viewH, insets);
  const clampedPrev = clampZoomViewportCenter(prev.cx, prev.cy, prev.zoom, rectW, rectH, viewW, viewH, insets);
  const { cx, cy } = clampZoomViewportCenter(
    clampedPrev.cx - dx / scale,
    clampedPrev.cy - dy / scale,
    prev.zoom,
    rectW,
    rectH,
    viewW,
    viewH,
    insets
  );
  if (cx === clampedPrev.cx && cy === clampedPrev.cy) return prev;
  return { ...prev, cx, cy };
}

export function viewportToViewBox(
  viewport: ZoomViewport,
  viewW: number,
  viewH: number,
  rectW = 0,
  rectH = 0,
  insets?: ViewportInsets
): string {
  if (rectW <= 0 || rectH <= 0) {
    if (viewport.zoom <= UNIT_PLAN_MIN_ZOOM) return `0 0 ${viewW} ${viewH}`;
    const vw = viewW / viewport.zoom;
    const vh = viewH / viewport.zoom;
    return `${(viewport.cx - vw / 2).toFixed(3)} ${(viewport.cy - vh / 2).toFixed(3)} ${vw.toFixed(3)} ${vh.toFixed(3)}`;
  }

  const clamped = clampZoomViewport(viewport, rectW, rectH, viewW, viewH, insets);
  const scale = clamped.zoom * computeBaseScale(rectW, rectH, viewW, viewH, insets);
  const vw = rectW / scale;
  const vh = rectH / scale;
  const vx = clamped.cx - vw / 2;
  const vy = clamped.cy - vh / 2;
  return `${vx.toFixed(3)} ${vy.toFixed(3)} ${vw.toFixed(3)} ${vh.toFixed(3)}`;
}
