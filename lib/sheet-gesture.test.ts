import assert from "node:assert/strict";
import test from "node:test";
import { resolveSheetSwipe } from "./sheet-gesture";

const compact = { deltaX: 0, deltaY: 0, elapsedMs: 500, sheetHeight: 590, expanded: false };

test("an upward swipe expands the compact sheet", () => {
  assert.equal(resolveSheetSwipe({ ...compact, deltaY: -90 }), "expand");
});
test("downward swipes collapse first and dismiss only from compact", () => {
  assert.equal(resolveSheetSwipe({ ...compact, expanded: true, deltaY: 120 }), "collapse");
  assert.equal(resolveSheetSwipe({ ...compact, deltaY: 120 }), "dismiss");
});
test("a short tap or a small slow movement does not change the sheet", () => {
  for (const deltaY of [0, 7, -7, 30, -30]) {
    assert.equal(resolveSheetSwipe({ ...compact, deltaY }), "none");
  }
});
test("horizontal and diagonal drags do not dismiss", () => {
  assert.equal(resolveSheetSwipe({ ...compact, deltaX: 180, deltaY: 120 }), "none");
  assert.equal(resolveSheetSwipe({ ...compact, deltaX: 90, deltaY: 90 }), "none");
});
test("a deliberate short fast flick can expand or dismiss", () => {
  assert.equal(resolveSheetSwipe({ ...compact, deltaY: -36, elapsedMs: 50 }), "expand");
  assert.equal(resolveSheetSwipe({ ...compact, deltaY: 36, elapsedMs: 50 }), "dismiss");
  assert.equal(resolveSheetSwipe({ ...compact, deltaY: 15, elapsedMs: 10 }), "none");
});
test("swiping upward on an expanded sheet leaves it expanded", () => {
  assert.equal(resolveSheetSwipe({ ...compact, expanded: true, deltaY: -140 }), "none");
});
