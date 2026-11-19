import test from "node:test";
import assert from "node:assert/strict";
import {
  generateInquiryDocumentKey,
  inquiryDocumentPrefix,
  INQUIRY_DOCUMENT_STORAGE_ROOT,
  isInquiryDocumentKey,
  safeInquiryDocumentFilename,
  inquiryDocumentDisposition,
  validateInquiryPdf,
  MAX_INQUIRY_DOCUMENT_BYTES,
  MAX_INQUIRY_MULTIPART_BYTES,
  readInquiryMultipart,
} from "./inquiry-document-storage";
import {
  inquiryDocumentPatchSchema,
  inquiryDocumentUploadSchema,
  isInquiryDocumentLocked,
} from "./inquiry-media";

const uuid = "12345678-1234-4123-8123-123456789abc";

test("canonical root lives under inquiries/documents on the project bucket", () => {
  assert.equal(INQUIRY_DOCUMENT_STORAGE_ROOT, "inquiries/documents");
  assert.equal(inquiryDocumentPrefix(), "inquiries/documents");
});

test("storage keys use server UUID under the dedicated private folder", () => {
  const key = generateInquiryDocumentKey("lead-123", "LOI", uuid);
  assert.equal(key, `inquiries/documents/lead-123/LOI/${uuid}.pdf`);
  assert.ok(isInquiryDocumentKey(key, "lead-123", "LOI"));
  assert.equal(isInquiryDocumentKey(key, "another-lead", "LOI"), false);
  assert.equal(isInquiryDocumentKey(key, "lead-123", "OTHER"), false);
  assert.equal(isInquiryDocumentKey(`${key}/../other.pdf`, "lead-123", "LOI"), false);
  assert.equal(isInquiryDocumentKey(key.replace("LOI", "FAKE"), "lead-123", "FAKE"), false);
  assert.throws(() => generateInquiryDocumentKey("../lead", "LOI", uuid));
  assert.throws(() => generateInquiryDocumentKey("lead", "LOI", "../../file"));
});

test("legacy keys remain readable for verify/download/delete", () => {
  const legacyVtour = `vtour/inquiries/lead-123/LOI/${uuid}.pdf`;
  const legacyRoot = `inquiries/lead-123/LOI/${uuid}.pdf`;
  assert.ok(isInquiryDocumentKey(legacyVtour, "lead-123", "LOI"));
  assert.ok(isInquiryDocumentKey(legacyRoot, "lead-123", "LOI"));
  assert.equal(isInquiryDocumentKey(legacyRoot, "lead-123", "OTHER"), false);
});

test("attachment filenames cannot inject paths, quotes or headers", () => {
  assert.equal(safeInquiryDocumentFilename("C:\\tmp\\proposal.pdf"), "proposal.pdf");
  assert.equal(safeInquiryDocumentFilename("../../proposal.pdf"), "proposal.pdf");
  const disposition = inquiryDocumentDisposition('quote"\r\nX-Header: evil.pdf');
  assert.ok(disposition.startsWith('inline; filename="'));
  assert.equal(/[\r\n]/.test(disposition), false);
  assert.equal(disposition.split('"').length, 3);
  assert.ok(
    inquiryDocumentDisposition("x.pdf", "attachment").startsWith('attachment; filename="')
  );
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
  assert.throws(() =>
    validateInquiryPdf(Buffer.alloc(MAX_INQUIRY_DOCUMENT_BYTES + 1), "x.pdf", "application/pdf")
  );
});

test("multipart parser enforces actual stream length even without Content-Length", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_INQUIRY_MULTIPART_BYTES + 1));
      controller.close();
    },
  });
  const request = new Request("https://example.test", {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=test" },
    body: stream,
    duplex: "half",
  } as RequestInit);
  await assert.rejects(readInquiryMultipart(request), /10 MB/);
  const body = new FormData();
  body.set("file", new File(["%PDF-1.7\n%%EOF"], "x.pdf", { type: "application/pdf" }));
  body.set("documentType", "LOI");
  const parsed = await readInquiryMultipart(
    new Request("https://example.test", { method: "POST", body })
  );
  assert.equal(parsed.get("documentType"), "LOI");
});

test("metadata schemas reject invalid types, coerced booleans and privileged fields", () => {
  assert.equal(
    inquiryDocumentUploadSchema.safeParse({ documentType: "LOI", isVisibleToMitra: "false" }).data
      ?.isVisibleToMitra,
    false
  );
  assert.equal(inquiryDocumentUploadSchema.safeParse({ documentType: "FAKE" }).success, false);
  assert.equal(inquiryDocumentPatchSchema.safeParse({ id: "doc", verified: "false" }).success, false);
  assert.equal(
    inquiryDocumentPatchSchema.safeParse({ id: "doc", verified: true, storageKey: "other" }).success,
    false
  );
  assert.equal(inquiryDocumentPatchSchema.safeParse({ id: "doc" }).success, false);
  for (const status of [
    "BA_SIGNED",
    "DESIGN_REVIEW",
    "PKS",
    "BILLING",
    "FIT_OUT_HANDOVER",
    "COMMERCIAL_OPERATION",
    "CLOSED_WON",
  ]) {
    assert.ok(isInquiryDocumentLocked(status));
  }
  assert.equal(isInquiryDocumentLocked("NEW"), false);
});
