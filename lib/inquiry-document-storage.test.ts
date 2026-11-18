import test from "node:test";
import assert from "node:assert/strict";
import {
  generateInquiryDocumentKey, inquiryDocumentPrefix, isInquiryDocumentKey,
  safeInquiryDocumentFilename, inquiryDocumentDisposition, validateInquiryPdf,
  MAX_INQUIRY_DOCUMENT_BYTES, MAX_INQUIRY_MULTIPART_BYTES, readInquiryMultipart,
} from "./inquiry-document-storage";
import { inquiryDocumentPatchSchema, inquiryDocumentUploadSchema, isInquiryDocumentLocked } from "./inquiry-media";

const uuid = "12345678-1234-4123-8123-123456789abc";

test("private namespace uses existing vtour root once", () => {
  assert.equal(inquiryDocumentPrefix("virtual-tour-lrt", "https://s3.example.com"), "vtour/inquiries");
  assert.equal(inquiryDocumentPrefix("vtour", "https://s3.example.com"), "inquiries");
  assert.equal(inquiryDocumentPrefix("bucket/vtour/", "https://s3.example.com"), "inquiries");
  assert.equal(inquiryDocumentPrefix("bucket", "https://s3.example.com/vtour/"), "inquiries");
});

test("storage keys use server UUID and reject traversal or mismatched ownership/type", () => {
  const key = generateInquiryDocumentKey("lead-123", "LOI", uuid, "vtour/inquiries");
  assert.equal(key, `vtour/inquiries/lead-123/LOI/${uuid}.pdf`);
  assert.ok(isInquiryDocumentKey(key, "lead-123", "LOI", "vtour/inquiries"));
  assert.equal(isInquiryDocumentKey(key, "another-lead", "LOI", "vtour/inquiries"), false);
  assert.equal(isInquiryDocumentKey(key, "lead-123", "OTHER", "vtour/inquiries"), false);
  assert.equal(isInquiryDocumentKey(`${key}/../other.pdf`, "lead-123", "LOI", "vtour/inquiries"), false);
  assert.equal(isInquiryDocumentKey(key.replace("LOI", "FAKE"), "lead-123", "FAKE", "vtour/inquiries"), false);
  assert.throws(() => generateInquiryDocumentKey("../lead", "LOI", uuid));
  assert.throws(() => generateInquiryDocumentKey("lead", "LOI", "../../file"));
});

test("attachment filenames cannot inject paths, quotes or headers", () => {
  assert.equal(safeInquiryDocumentFilename("C:\\tmp\\proposal.pdf"), "proposal.pdf");
  assert.equal(safeInquiryDocumentFilename("../../proposal.pdf"), "proposal.pdf");
  const disposition = inquiryDocumentDisposition('quote"\r\nX-Header: evil.pdf');
  assert.ok(disposition.startsWith('attachment; filename="'));
  assert.equal(/[\r\n]/.test(disposition), false);
  assert.equal(disposition.split('"').length, 3);
  assert.ok(safeInquiryDocumentFilename("a".repeat(300) + ".pdf").length <= 144);
});

test("PDF upload validates real signature, MIME, extension and max 10 MB", () => {
  const valid = Buffer.from("%PDF-1.7\n1 0 obj\n%%EOF");
  assert.doesNotThrow(() => validateInquiryPdf(valid, "proposal.PDF", "application/pdf"));
  assert.doesNotThrow(() => validateInquiryPdf(Buffer.from("%PDF-2.0\n%%EOF"), "x.pdf", "application/pdf"));
  assert.throws(() => validateInquiryPdf(Buffer.from("<html>not PDF</html>"), "x.pdf", "application/pdf"));
  assert.throws(() => validateInquiryPdf(valid, "x.html", "application/pdf"));
  assert.throws(() => validateInquiryPdf(valid, "x.pdf", "text/html"));
  assert.throws(() => validateInquiryPdf(Buffer.alloc(0), "x.pdf", "application/pdf"));
  const boundary = Buffer.alloc(MAX_INQUIRY_DOCUMENT_BYTES);
  valid.copy(boundary);
  assert.doesNotThrow(() => validateInquiryPdf(boundary, "x.pdf", "application/pdf"));
  assert.throws(() => validateInquiryPdf(Buffer.alloc(MAX_INQUIRY_DOCUMENT_BYTES + 1), "x.pdf", "application/pdf"));
});

test("multipart parser enforces actual stream length even without Content-Length", async () => {
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(MAX_INQUIRY_MULTIPART_BYTES + 1)); controller.close(); } });
  const request = new Request("https://example.test", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=test" }, body: stream, duplex: "half" } as RequestInit);
  await assert.rejects(readInquiryMultipart(request), /10 MB/);
  const body = new FormData();
  body.set("file", new File(["%PDF-1.7\n%%EOF"], "x.pdf", { type: "application/pdf" }));
  body.set("documentType", "LOI");
  const parsed = await readInquiryMultipart(new Request("https://example.test", { method: "POST", body }));
  assert.equal(parsed.get("documentType"), "LOI");
});

test("metadata schemas reject invalid types, coerced booleans and privileged fields", () => {
  assert.equal(inquiryDocumentUploadSchema.safeParse({ documentType: "LOI", isVisibleToMitra: "false" }).data?.isVisibleToMitra, false);
  assert.equal(inquiryDocumentUploadSchema.safeParse({ documentType: "FAKE" }).success, false);
  assert.equal(inquiryDocumentPatchSchema.safeParse({ id: "doc", verified: "false" }).success, false);
  assert.equal(inquiryDocumentPatchSchema.safeParse({ id: "doc", verified: true, storageKey: "other" }).success, false);
  assert.equal(inquiryDocumentPatchSchema.safeParse({ id: "doc" }).success, false);
  for (const status of ["BA_SIGNED", "DESIGN_REVIEW", "PKS", "BILLING", "FIT_OUT_HANDOVER", "COMMERCIAL_OPERATION", "CLOSED_WON"]) assert.ok(isInquiryDocumentLocked(status));
  assert.equal(isInquiryDocumentLocked("NEW"), false);
});
