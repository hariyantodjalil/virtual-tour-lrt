import assert from "node:assert/strict";
import test from "node:test";
import {
  UNIT_PLAN_MAX_ZOOM,
  UNIT_PLAN_MIN_ZOOM,
  clampZoomViewport,
  computeBaseScale,
  createInitialZoomViewport,
  panZoomViewport,
  pinchZoomViewport,
  viewportToViewBox,
  zoomViewportAtPoint,
} from "./unit-plan-zoom";

const VIEW_W = 360;
const VIEW_H = 230;
const INSETS = { top: 48, right: 12, bottom: 36, left: 12 };
const RECT = { rectW: 522, rectH: 252, viewW: VIEW_W, viewH: VIEW_H, insets: INSETS };

test("frames 1x diagram inside safe insets while SVG spans full container", () => {
  const vp = createInitialZoomViewport(VIEW_W, VIEW_H, RECT.rectW, RECT.rectH, INSETS);
  assert.equal(vp.zoom, UNIT_PLAN_MIN_ZOOM);
  const baseScale = computeBaseScale(RECT.rectW, RECT.rectH, VIEW_W, VIEW_H, INSETS);
  assert.ok(Math.abs(baseScale - 168 / 230) < 1e-9);

  const [vx, vy, vw, vh] = viewportToViewBox(vp, VIEW_W, VIEW_H, RECT.rectW, RECT.rectH, INSETS)
    .split(" ")
    .map(Number);
  assert.ok(vx < 0 && vx + vw > VIEW_W);
  assert.ok(Math.abs(vw / vh - RECT.rectW / RECT.rectH) < 1e-3);

  // SVG y=0 sits at y_screen=48 (top inset) and y=230 sits at y_screen=216 (252 - 36)
  const yTopPx = ((0 - vy) / vh) * RECT.rectH;
  const yBottomPx = ((VIEW_H - vy) / vh) * RECT.rectH;
  assert.ok(Math.abs(yTopPx - INSETS.top) < 0.2);
  assert.ok(Math.abs(yBottomPx - (RECT.rectH - INSETS.bottom)) < 0.2);
});

test("scrolling up zooms in up to 2x and never exceeds 2x", () => {
  let vp = createInitialZoomViewport(VIEW_W, VIEW_H, RECT.rectW, RECT.rectH, INSETS);
  for (let i = 0; i < 10; i++) {
    vp = zoomViewportAtPoint(vp, { ...RECT, deltaPx: -120, pointerX: 261, pointerY: 132 });
  }
  assert.equal(vp.zoom, UNIT_PLAN_MAX_ZOOM);
});

test("scrolling down zooms out back down to 1x and stops at 1x", () => {
  let vp = createInitialZoomViewport(VIEW_W, VIEW_H, RECT.rectW, RECT.rectH, INSETS);
  for (let i = 0; i < 6; i++) {
    vp = zoomViewportAtPoint(vp, { ...RECT, deltaPx: -120, pointerX: 261, pointerY: 60 });
  }
  assert.equal(vp.zoom, UNIT_PLAN_MAX_ZOOM);

  for (let i = 0; i < 10; i++) {
    vp = zoomViewportAtPoint(vp, { ...RECT, deltaPx: 120, pointerX: 261, pointerY: 180 });
  }
  assert.equal(vp.zoom, UNIT_PLAN_MIN_ZOOM);
  const initial = createInitialZoomViewport(VIEW_W, VIEW_H, RECT.rectW, RECT.rectH, INSETS);
  assert.ok(Math.abs(vp.cx - initial.cx) < 1e-6);
  assert.ok(Math.abs(vp.cy - initial.cy) < 1e-6);
});

test("cursor-anchored zoom keeps point under pointer steady within bounds", () => {
  const start = createInitialZoomViewport(VIEW_W, VIEW_H, RECT.rectW, RECT.rectH, INSETS);
  const pointerX = 261;
  const pointerY = 96;
  const zoomed = zoomViewportAtPoint(start, { ...RECT, deltaPx: -120, pointerX, pointerY });

  const baseScale = computeBaseScale(RECT.rectW, RECT.rectH, VIEW_W, VIEW_H, INSETS);
  const svgYBefore = start.cy + (pointerY - RECT.rectH / 2) / (start.zoom * baseScale);
  const svgYAfter = zoomed.cy + (pointerY - RECT.rectH / 2) / (zoomed.zoom * baseScale);

  assert.ok(Math.abs(svgYAfter - svgYBefore) < 1e-6);
});

test("pinch zoom scales proportionally from 1x to 2x and back", () => {
  const start = createInitialZoomViewport(VIEW_W, VIEW_H, RECT.rectW, RECT.rectH, INSETS);
  const pinchedIn = pinchZoomViewport(start, {
    ...RECT,
    scaleRatio: 1.5,
    anchorX: 261,
    anchorY: 132,
  });
  assert.ok(Math.abs(pinchedIn.zoom - 1.5) < 1e-6);

  const clampedMax = pinchZoomViewport(pinchedIn, {
    ...RECT,
    scaleRatio: 3,
    anchorX: 261,
    anchorY: 132,
  });
  assert.equal(clampedMax.zoom, UNIT_PLAN_MAX_ZOOM);

  const backToMin = pinchZoomViewport(clampedMax, {
    ...RECT,
    scaleRatio: 0.2,
    anchorX: 261,
    anchorY: 132,
  });
  assert.equal(backToMin.zoom, UNIT_PLAN_MIN_ZOOM);
});

test("panning is ignored at 1x and clamped within inset bounds at 2x", () => {
  const base = createInitialZoomViewport(VIEW_W, VIEW_H, RECT.rectW, RECT.rectH, INSETS);
  assert.equal(panZoomViewport(base, { ...RECT, dx: 50, dy: 50 }), base);

  let zoomed = base;
  for (let i = 0; i < 10; i++) {
    zoomed = zoomViewportAtPoint(zoomed, { ...RECT, deltaPx: -120, pointerX: 261, pointerY: 132 });
  }
  const pannedDown = panZoomViewport(zoomed, { ...RECT, dx: 0, dy: 500 });
  const [, vyDown, , vhDown] = viewportToViewBox(pannedDown, VIEW_W, VIEW_H, RECT.rectW, RECT.rectH, INSETS)
    .split(" ")
    .map(Number);
  assert.ok(Math.abs(((0 - vyDown) / vhDown) * RECT.rectH - INSETS.top) < 0.2);

  const pannedUp = panZoomViewport(zoomed, { ...RECT, dx: 0, dy: -500 });
  const [, vyUp, , vhUp] = viewportToViewBox(pannedUp, VIEW_W, VIEW_H, RECT.rectW, RECT.rectH, INSETS)
    .split(" ")
    .map(Number);
  assert.ok(Math.abs(((VIEW_H - vyUp) / vhUp) * RECT.rectH - (RECT.rectH - INSETS.bottom)) < 0.2);
});

test("taller resized container scales 1x diagram up proportionally", () => {
  const smallScale = computeBaseScale(522, 252, VIEW_W, VIEW_H, INSETS);
  const tallScale = computeBaseScale(522, 440, VIEW_W, VIEW_H, INSETS);
  assert.ok(tallScale > smallScale * 1.8);

  const clamped = clampZoomViewport(
    createInitialZoomViewport(VIEW_W, VIEW_H, 522, 252, INSETS),
    522,
    440,
    VIEW_W,
    VIEW_H,
    INSETS
  );
  assert.equal(clamped.zoom, 1);
});

test("ignores zero delta or zero-sized rect", () => {
  const base = createInitialZoomViewport(VIEW_W, VIEW_H, RECT.rectW, RECT.rectH, INSETS);
  assert.equal(zoomViewportAtPoint(base, { ...RECT, deltaPx: 0, pointerX: 100, pointerY: 50 }), base);
  assert.equal(
    zoomViewportAtPoint(base, { ...RECT, rectW: 0, deltaPx: -100, pointerX: 0, pointerY: 0 }),
    base
  );
});
