import test from "node:test";
import assert from "node:assert/strict";
import { PUBLIC_LEAD_PROCESS_STEPS, publicLeadStageIndex, completedLeadStageIndex } from "./commercial-pipeline";
import { hasVerifiedDocument, inquiryTransitionError, jakartaDate, leaseExpiryReminder, REQUIRED_INQUIRY_DOCUMENTS } from "./inquiry-workflow";

const now = new Date("2026-11-17T03:00:00Z");
const documents = REQUIRED_INQUIRY_DOCUMENTS.map(document => ({ documentType: document.type, storageKey: `private/${document.type}`, verifiedAt: now }));
const state = {
  status: "PKS" as const,
  leaseStartAt: new Date("2026-11-16T17:00:00Z"),
  leaseEndAt: new Date("2027-11-17T16:59:59Z"),
  paymentVerifiedAt: now,
  siteVisitStatus: "NONE",
  mediaAttachments: documents,
};

test("public workflow is exactly six milestones with legacy statuses folded in", () => {
  assert.deepEqual(PUBLIC_LEAD_PROCESS_STEPS.map(step => step.status), ["NEW", "CONTACTED", "BA_SIGNED", "DESIGN_REVIEW", "PKS", "COMMERCIAL_OPERATION"]);
  for (const status of ["RDS_OFFER", "NEGOTIATING", "SITE_CHECK"]) {
    assert.equal(publicLeadStageIndex(status), 2);
    assert.equal(completedLeadStageIndex(status), 1);
  }
  for (const status of ["BILLING", "FIT_OUT_HANDOVER"]) assert.equal(publicLeadStageIndex(status), 4);
  assert.equal(publicLeadStageIndex("CLOSED_WON"), 5);
  assert.equal(completedLeadStageIndex("NEW"), 0);
  assert.equal(publicLeadStageIndex("CLOSED_LOST"), -1);
});

test("contact confirmation cannot be skipped and confirmed milestones cannot regress", () => {
  assert.equal(inquiryTransitionError("NEW", "CONTACTED", state, now), null);
  assert.ok(inquiryTransitionError("NEW", "BA_SIGNED", state, now));
  assert.ok(inquiryTransitionError("CONTACTED", "DESIGN_REVIEW", state, now));
  assert.ok(inquiryTransitionError("PKS", "DESIGN_REVIEW", state, now));
  assert.equal(inquiryTransitionError("CONTACTED", "BA_SIGNED", state, now), null);
});

test("negotiation requires every verified storage-backed evidence type", () => {
  const negotiation = documents.filter(document => ["LOI", "NEGOTIATION_LETTER", "NEGOTIATION_MINUTES"].includes(document.documentType));
  assert.equal(inquiryTransitionError("NEGOTIATING", "BA_SIGNED", { ...state, mediaAttachments: negotiation }, now), null);
  for (const missing of negotiation) {
    assert.match(inquiryTransitionError("NEGOTIATING", "BA_SIGNED", { ...state, mediaAttachments: negotiation.filter(document => document !== missing) }, now)!, /dokumen/i);
    assert.equal(hasVerifiedDocument([{ ...missing, storageKey: null }], missing.documentType), false);
    assert.equal(hasVerifiedDocument([{ ...missing, verifiedAt: null }], missing.documentType), false);
  }
});

test("open site visits block negotiation completion but not contact confirmation", () => {
  for (const siteVisitStatus of ["REQUESTED", "SCHEDULED"]) {
    assert.match(inquiryTransitionError("NEGOTIATING", "BA_SIGNED", { ...state, siteVisitStatus }, now)!, /site visit/i);
    assert.equal(inquiryTransitionError("NEW", "CONTACTED", { ...state, siteVisitStatus }, now), null);
  }
  for (const siteVisitStatus of ["NONE", "COMPLETED", "CANCELLED"]) assert.equal(inquiryTransitionError("NEGOTIATING", "BA_SIGNED", { ...state, siteVisitStatus }, now), null);
});

test("design and final PKS require their own verified documents", () => {
  assert.ok(inquiryTransitionError("BA_SIGNED", "DESIGN_REVIEW", { ...state, mediaAttachments: documents.filter(document => document.documentType !== "DESIGN_APPROVAL") }, now));
  assert.ok(inquiryTransitionError("DESIGN_REVIEW", "PKS", { ...state, mediaAttachments: documents.filter(document => document.documentType !== "PKS_FINAL") }, now));
  assert.equal(inquiryTransitionError("DESIGN_REVIEW", "PKS", state, now), null);
});

test("PKS requires both lease dates in chronological order", () => {
  assert.ok(inquiryTransitionError("DESIGN_REVIEW", "PKS", { ...state, leaseStartAt: null }, now));
  assert.ok(inquiryTransitionError("DESIGN_REVIEW", "PKS", { ...state, leaseEndAt: null }, now));
  assert.ok(inquiryTransitionError("DESIGN_REVIEW", "PKS", { ...state, leaseEndAt: "2026-01-01" }, now));
});

test("activation requires verified payment and an effective Jakarta lease date", () => {
  assert.ok(inquiryTransitionError("PKS", "COMMERCIAL_OPERATION", { ...state, paymentVerifiedAt: null }, now));
  const boundary = { ...state, leaseStartAt: "2026-11-17T17:00:00Z" };
  assert.match(inquiryTransitionError("PKS", "COMMERCIAL_OPERATION", boundary, new Date("2026-11-17T16:59:59Z"))!, /efektif/i);
  assert.equal(inquiryTransitionError("PKS", "COMMERCIAL_OPERATION", boundary, new Date("2026-11-17T17:00:00Z")), null);
  assert.equal(jakartaDate("2026-11-17T17:00:00Z"), "2026-11-18");
  assert.ok(inquiryTransitionError("PKS", "COMMERCIAL_OPERATION", { ...state, leaseEndAt: "2026-11-16T16:59:59Z" }, now));
});

test("closed inquiries cannot reopen and active leases cannot be dropped as leads", () => {
  assert.ok(inquiryTransitionError("CLOSED_LOST", "NEW", state, now));
  assert.ok(inquiryTransitionError("COMMERCIAL_OPERATION", "CLOSED_LOST", state, now));
  assert.ok(inquiryTransitionError("CLOSED_WON", "CLOSED_LOST", state, now));
  assert.equal(inquiryTransitionError("NEGOTIATING", "CLOSED_LOST", state, now), null);
});

test("internal lease reminders use H90/H60/H30 Jakarta calendar thresholds", () => {
  const baseline = new Date("2026-01-01T17:00:00Z");
  function end(days: number) { return new Date(baseline.getTime() + days * 86_400_000); }
  assert.equal(leaseExpiryReminder(null, baseline), null);
  assert.equal(leaseExpiryReminder(end(91), baseline), null);
  for (const [days, threshold] of [[90, 90], [61, 90], [60, 60], [31, 60], [30, 30], [0, 30]]) {
    const reminder = leaseExpiryReminder(end(days), baseline)!;
    assert.equal(reminder.remainingDays, days);
    assert.equal(reminder.threshold, threshold);
    assert.equal(reminder.label, `Pengingat H-${threshold}`);
  }
  assert.equal(leaseExpiryReminder(end(-1), baseline)?.label, "Masa sewa berakhir");
});
