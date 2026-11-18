import assert from "node:assert/strict";
import test from "node:test";
import { cmsLeadDetailHref, isCmsLeadId } from "./cms-leads-shared";

test("CMS detail links use a dedicated path with encoded identifiers", () => {
  assert.equal(cmsLeadDetailHref("cmw-example_123"), "/cms/leads/cmw-example_123");
  assert.equal(cmsLeadDetailHref("lead/other?x#hash"), "/cms/leads/lead%2Fother%3Fx%23hash");
});

test("CMS inquiry identifiers accept existing opaque IDs and reject paths/unbounded values", () => {
  for (const id of ["cmwk123456789", "ca5f0472fbe431683314f6d79", "7bfa1a70-95a5-4b60-8120-ff7d34401455"]) assert.equal(isCmsLeadId(id), true);
  for (const id of ["", "..", "lead/id", "lead?id", "lead#id", "<script>", " ", "a".repeat(129)]) assert.equal(isCmsLeadId(id), false);
});
