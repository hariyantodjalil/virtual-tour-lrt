import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/auth";
import { cmsLeadDetailHref } from "../lib/cms-leads-shared";

// Read-only HTTP verification; only disposable local role fixtures are created/deleted.
const base = process.env.CMS_DETAIL_SMOKE_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Local application required");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname), "Local database required");
assert.ok(process.env.CMS_SMOKE_EMAIL && process.env.CMS_SMOKE_PASSWORD, "Supply CMS_SMOKE_EMAIL and CMS_SMOKE_PASSWORD for this process only");
const prefix = `cms-detail-smoke-${randomUUID()}`;
const fixtureIds: string[] = [];
let passed = 0;
async function get(path: string, authorization?: string, cookie?: string) {
  return fetch(`${base}${path}`, { redirect: "manual", signal: AbortSignal.timeout(90000), headers: { ...(authorization ? { authorization: `Bearer ${authorization}` } : {}), ...(cookie ? { cookie } : {}) } });
}
async function roleUser(role: "EDITOR" | "MITRA", active = true) {
  const user = await prisma.user.create({ data: { email: `${prefix}-${fixtureIds.length}@example.invalid`, password: `!disabled-${randomUUID()}`, name: "Disposable CMS detail role fixture", role, isActive: active } });
  fixtureIds.push(user.id);
  return signToken({ userId: user.id, email: user.email, role });
}
function check(condition: unknown, label: string) { assert.ok(condition, label); passed++; console.log(`PASS ${label}`); }
try {
  const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: process.env.CMS_SMOKE_EMAIL, password: process.env.CMS_SMOKE_PASSWORD }), signal: AbortSignal.timeout(90000) });
  assert.equal(login.status, 200, "Provided admin login must succeed");
  const account = await login.json(); assert.equal(account.user?.role, "ADMIN");
  const cookie = login.headers.getSetCookie().map(value => value.split(";")[0]).find(value => value.startsWith("cms-token=")); assert.ok(cookie);
  const list = await get("/api/cms/leads", undefined, cookie); assert.equal(list.status, 200);
  const rows = await list.json(); assert.ok(Array.isArray(rows) && rows.length);
  const id = rows[0].id as string;
  const api = `/api/cms/leads/${encodeURIComponent(id)}`;
  check((await get(api)).status === 401, "anonymous detail API denied");
  const mitra = await roleUser("MITRA"), editor = await roleUser("EDITOR"), inactive = await roleUser("EDITOR", false);
  check((await get(api, mitra)).status === 403, "MITRA detail API denied");
  check((await get(api, inactive)).status === 401, "inactive staff detail API denied");
  const editorResponse = await get(api, editor); check(editorResponse.status === 200, "EDITOR can read detail");
  const response = await get(api, undefined, cookie); check(response.status === 200, "ADMIN can read detail");
  const data = await response.json();
  check(data.id === id && !Array.isArray(data) && typeof data.createdAt === "string", "single-inquiry DTO and serialized dates");
  check(response.headers.get("cache-control") === "private, no-store", "staff detail API forbids shared caching");
  const missing = await get(`/api/cms/leads/nonexistent-${randomUUID()}`, undefined, cookie); check(missing.status === 404, "unknown inquiry returns 404");
  const detailPath = cmsLeadDetailHref(id);
  const anonymousPage = await get(detailPath); check([302, 303, 307, 308].includes(anonymousPage.status) && new URL(anonymousPage.headers.get("location")!, base).pathname === "/login", "anonymous detail page redirects to login");
  const page = await get(detailPath, undefined, cookie); const html = await page.text();
  check(page.status === 200 && html.includes('aria-label="Breadcrumb"') && html.includes(data.inquiryCode), "dedicated detail page renders breadcrumb");
  const pageList = await get("/cms/leads", undefined, cookie); const listHtml = await pageList.text();
  check(pageList.status === 200 && listHtml.includes(detailPath) && !listHtml.includes("Buka semua"), "list links to details without accordion controls");
  console.log(JSON.stringify({ passed, mutationsToInquiries: 0 }));
} finally {
  await prisma.user.deleteMany({ where: { id: { in: fixtureIds }, email: { startsWith: prefix } } });
  await prisma.$disconnect();
  console.log("Disposable local role fixtures cleaned up");
}
