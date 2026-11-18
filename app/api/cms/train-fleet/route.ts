import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { parseJsonRequest } from "@/lib/api-validation";
import { prisma } from "@/lib/prisma";
import { ensureDefaultTrain } from "@/lib/default-train";
import { getTrainFleet } from "@/lib/train-fleet";

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const train = await prisma.train.findFirst({ where: { isActive: true }, orderBy: [{ order: "asc" }, { id: "asc" }] });
  return NextResponse.json(train ? await getTrainFleet(train.id, true) : { trainId: "", cars: [], trainsets: [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = await parseJsonRequest(request, z.object({ code: z.string().trim().toUpperCase().regex(/^TS\d{2,6}$/) }).strict());
  if (!parsed.success) return parsed.response;
  const train = await ensureDefaultTrain();
  const existing = await prisma.trainset.findUnique({ where: { trainId_code: { trainId: train.id, code: parsed.data.code } } });
  if (existing) return NextResponse.json({ error: "Kode train set sudah ada." }, { status: 409 });
  const last = await prisma.trainset.aggregate({ where: { trainId: train.id }, _max: { order: true } });
  const trainset = await prisma.trainset.create({ data: { trainId: train.id, code: parsed.data.code, order: (last._max.order ?? -1) + 1 } });
  return NextResponse.json(trainset, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = await parseJsonRequest(request, z.union([
    z.object({ id: z.string().min(1).max(128), isActive: z.boolean() }).strict(),
    z.object({ advertisingCapacity: z.number().int().min(0).max(999).nullable() }).strict(),
  ]));
  if (!parsed.success) return parsed.response;
  const train = await ensureDefaultTrain();
  if ("advertisingCapacity" in parsed.data) {
    await prisma.train.update({ where: { id: train.id }, data: { advertisingCapacity: parsed.data.advertisingCapacity } });
    return NextResponse.json({ ok: true });
  }
  const result = await prisma.trainset.updateMany({ where: { id: parsed.data.id, trainId: train.id }, data: { isActive: parsed.data.isActive } });
  if (!result.count) return NextResponse.json({ error: "Train set tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
