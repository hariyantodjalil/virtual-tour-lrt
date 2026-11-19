import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/auth";
import { inquiryCreationData } from "../lib/partner-inquiries";
import { inquiryDocumentPrefix } from "../lib/inquiry-document-storage";
import { jakartaDate } from "../lib/inquiry-workflow";

// Destructive cleanup is restricted to synthetic IDs created by THIS run.
// Refuse remote databases. --storage explicitly opts into synthetic S3 PDF writes.
const db = new URL(process.env.DATABASE_URL ?? "");
assert.ok(["localhost", "127.0.0.1", "::1", "[::1]"].includes(db.hostname), "Smoke test requires a local database");
const base = process.env.INQUIRY_SMOKE_URL ?? "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Smoke test requires a local application");
const withStorage = process.argv.includes("--storage");
const prefix = `workflow-smoke-${randomUUID()}`;
const users: string[] = [];
const leads: string[] = [];
const keys: string[] = [];
let stationId: string | undefined;
let trainId: string | undefined;
const s3 = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION || "us-east-1", forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! } });
let checks = 0;
async function request(path: string, token?: string, method = "GET", body?: unknown) {
  return fetch(`${base}${path}`, { method, redirect: "manual", signal: AbortSignal.timeout(90000), headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body && !(body instanceof FormData) ? { "content-type": "application/json" } : {}) }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
}
async function expect(response: Response, status: number, label: string) {
  const text = await response.text();
  assert.equal(response.status, status, `${label}: HTTP ${response.status}: ${text.slice(0, 300)}`);
  checks++; console.log(`PASS ${label}`);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}
async function user(role: "ADMIN" | "EDITOR" | "MITRA", suffix: string) {
  const row = await prisma.user.create({ data: { email: `${prefix}-${suffix}@example.invalid`, password: `!disabled-${randomUUID()}`, name: `Synthetic workflow test ${suffix}`, role } });
  users.push(row.id);
  return { ...row, token: signToken({ userId: row.id, email: row.email, role }) };
}
try {
  const admin = await user("ADMIN", "admin"), owner = await user("MITRA", "owner"), other = await user("MITRA", "other"), editor = await user("EDITOR", "editor");
  const station = await prisma.station.create({ data: { name: "Synthetic workflow smoke (inactive)", slug: prefix, line: "TEST", address: "Synthetic test", isActive: false } }); stationId = station.id;
  const space = await prisma.commercialSpace.create({ data: { stationId, code: prefix, name: "Synthetic smoke unit", area: 1, location: "TEST" } });
  const train = await prisma.train.create({ data: { name: "Synthetic workflow train (inactive)", slug: prefix, isActive: false, trainsets: { create: { code: "TS01" } } } }); trainId = train.id;
  const workflow = await prisma.pipelineWorkflowVersion.findUniqueOrThrow({
    where: { id: "verified-leasing-20261117" },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });
  assert.equal(workflow.steps.length, 6);
  const today = jakartaDate(new Date()), end = jakartaDate(new Date(Date.now() + 95 * 86400000));
  for (const kind of ["station", "train"] as const) {
    const lead = await prisma.tenantLead.create({ data: { ...inquiryCreationData(owner.id, { id: workflow.id, first: workflow.steps[0] }), companyName: `Synthetic ${kind} workflow test`, contactName: "Synthetic test", phone: "080000000000", email: owner.email, businessType: "TEST", userId: owner.id, ...(kind === "station" ? { spaceId: space.id } : { trainInquiry: { create: { trainId, mediaCode: "TEST", mediaTitle: "Synthetic media", mode: "MEDIA", requestedTrainsetCount: 1, allocatedTrainsets: ["TS01"] } } }) } }); leads.push(lead.id);
    const path = `/api/cms/leads/${lead.id}/media`, detail = `/api/partner/inquiries/${lead.id}`;
    const patch = (body: Record<string, unknown>, token = admin.token) => request("/api/cms/leads", token, "PATCH", { id: lead.id, ...body });
    const advance = (order: number) => patch({ advance: { fromStepId: workflow.steps[order - 1].id, toStepId: workflow.steps[order].id } });
    await expect(await request(path), 401, `${kind} anonymous documents denied`);
    await expect(await request(detail, other.token), 404, `${kind} other owner denied`);
    await expect(await patch({ status: "CONTACTED" }, editor.token), 403, `${kind} editor mutation denied`);
    await expect(await patch({ status: "PKS" }), 409, `${kind} skipping milestones denied`);
    await expect(await advance(1), 200, `${kind} contact confirmed`);
    await expect(await request(detail, owner.token, "PATCH", { surveyPreference: "Synthetic smoke site visit request" }), 200, `${kind} owner requests site visit`);
    await expect(await advance(2), 200, `${kind} negotiation started`);
    await expect(await advance(3), 409, `${kind} missing verified evidence denied`);
    if (!withStorage) continue;
    for (const documentType of ["LOI", "NEGOTIATION_LETTER", "NEGOTIATION_MINUTES", "DESIGN_APPROVAL", "PKS_FINAL"]) {
      if (documentType === "DESIGN_APPROVAL") {
        await expect(await advance(3), 409, `${kind} open visit blocks completion`);
        await expect(await patch({ siteVisitStatus: "COMPLETED" }), 200, `${kind} visit completed`);
        await expect(await advance(3), 200, `${kind} negotiation complete`);
      }
      const form = new FormData(); form.set("documentType", documentType); form.set("file", new File(["%PDF-1.4\n% Synthetic workflow smoke test, no personal data\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n"], "synthetic-test.pdf", { type: "application/pdf" }));
      const media = await expect(await request(path, admin.token, "POST", form), 201, `${kind} ${documentType} upload`);
      const row = await prisma.inquiryMedia.findUniqueOrThrow({ where: { id: media.id } }); assert.ok(row.storageKey); keys.push(row.storageKey);
      assert.ok(row.storageKey.startsWith(`${inquiryDocumentPrefix()}/${lead.id}/${documentType}/`));
      await expect(await request(media.mediaLink, owner.token), 404, `${kind} hidden document denied`);
      await expect(await request(path, admin.token, "PATCH", { id: media.id, verified: true }), 200, `${kind} ${documentType} verified`);
      if (documentType === "DESIGN_APPROVAL") {
        await expect(await advance(4), 200, `${kind} design approved`);
      }
      if (documentType === "LOI") {
        const anonymous = await fetch(`${process.env.S3_ENDPOINT?.replace(/\/$/, "")}/${process.env.S3_BUCKET}/${row.storageKey}`, { redirect: "manual", signal: AbortSignal.timeout(30000) });
        assert.ok([401, 403, 404].includes(anonymous.status), "Anonymous S3 read must be denied"); checks++; console.log("PASS anonymous direct S3 access denied"); await anonymous.body?.cancel();
        await expect(await request(`/api/s3-proxy/${row.storageKey}`), 404, "Anonymous public proxy cannot expose inquiry PDF");
        await expect(await request(path, admin.token, "PATCH", { id: media.id, isVisibleToMitra: true }), 200, "Admin shares file");
        const download = await request(media.mediaLink, owner.token); assert.equal(download.status, 307); assert.equal(download.headers.get("cache-control"), "private, no-store"); const signed = download.headers.get("location"); assert.ok(signed); const object = await fetch(signed, { signal: AbortSignal.timeout(30000) }); assert.equal(object.status, 200); assert.match(object.headers.get("content-disposition") ?? "", /^attachment;/); await object.body?.cancel(); checks++; console.log("PASS owner signed attachment download");
        await expect(await request(media.mediaLink, other.token), 404, "Other account shared download denied");
      }
    }
    const locked = await prisma.inquiryMedia.findFirstOrThrow({ where: { tenantLeadId: lead.id, documentType: "LOI" } });
    await expect(await request(path, admin.token, "PATCH", { id: locked.id, verified: false }), 409, `${kind} evidence verification locked`);
    await expect(await request(`/api/cms/leads/${lead.id}`, admin.token, "DELETE"), 409, `${kind} evidence audit history retained`);
    await expect(await advance(5), 409, `${kind} activation without lease dates denied`);
    await expect(await patch({ leaseStartAt: today, leaseEndAt: end }), 200, `${kind} lease dates saved`);
    await expect(await advance(5), 409, `${kind} unpaid activation denied`);
    await expect(await patch({ paymentVerified: true }), 200, `${kind} payment verified`);
    await expect(await advance(5), 200, `${kind} effective paid lease activated`);
    const projection = await expect(await request(detail, owner.token), 200, `${kind} owner reads progress`);
    assert.equal(projection.workflowVersion.steps.length, 6); assert.ok(!JSON.stringify(projection).includes("storageKey")); assert.ok(!Object.hasOwn(projection, "paymentVerifiedByAdmin")); checks++; console.log("PASS six public milestones and private projection");
    if (kind === "station") { const occupancy = await prisma.spaceOccupancy.findUniqueOrThrow({ where: { spaceId: space.id } }); assert.equal(occupancy.startDate?.toISOString().slice(0, 10), today); assert.equal(occupancy.endDate?.toISOString().slice(0, 10), end); checks++; console.log("PASS occupancy preserves PKS dates"); }
  }
  console.log(JSON.stringify({ passed: checks, storage: withStorage }));
} finally {
  for (const key of keys) {
    assert.ok(leads.some(id => key.startsWith(`${inquiryDocumentPrefix()}/${id}/`)), "Refuse cleanup outside synthetic lead namespace");
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
  }
  await prisma.tenantLead.deleteMany({ where: { id: { in: leads } } });
  if (stationId) await prisma.station.delete({ where: { id: stationId } });
  if (trainId) await prisma.train.delete({ where: { id: trainId } });
  await prisma.user.deleteMany({ where: { id: { in: users }, email: { startsWith: prefix } } });
  await prisma.$disconnect();
  console.log("Synthetic fixtures cleaned up");
}
