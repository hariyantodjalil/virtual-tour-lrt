import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { parseJsonRequest } from "@/lib/api-validation";
import { prisma } from "@/lib/prisma";

const optionInput = z.object({
  kind: z.enum(["APPLICANT_STATUS", "BUSINESS_CATEGORY"]),
  label: z.string().trim().min(2).max(120), order: z.number().int().min(0).max(10000),
  isActive: z.boolean(), allowsRepresentedBrand: z.boolean(), requiresDetail: z.boolean(),
}).strict().refine(value => value.kind === "APPLICANT_STATUS" ? !value.requiresDetail : !value.allowsRepresentedBrand, {
  message: "Pengaturan kolom tambahan tidak sesuai jenis pilihan.",
});

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const options = await prisma.advertisingFormOption.findMany({ orderBy: [{ kind: "asc" }, { order: "asc" }, { id: "asc" }] });
  return NextResponse.json(options, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = await parseJsonRequest(request, z.object({ option: optionInput }).strict());
  if (!parsed.success) return parsed.response;
  try {
    const option = await prisma.advertisingFormOption.create({ data: parsed.data.option });
    return NextResponse.json(option, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Nama pilihan sudah digunakan." }, { status: 409 });
    throw error;
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = await parseJsonRequest(request, z.object({ id: z.string().min(1).max(128), updatedAt: z.iso.datetime(), option: optionInput }).strict());
  if (!parsed.success) return parsed.response;
  try {
    const { id, updatedAt, option } = parsed.data;
    const saved = await prisma.advertisingFormOption.updateMany({
      where: { id, kind: option.kind, updatedAt: new Date(updatedAt) }, data: option,
    });
    if (!saved.count) return NextResponse.json({ error: "Data telah berubah. Muat ulang pilihan sebelum menyimpan." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Nama pilihan sudah digunakan." }, { status: 409 });
    throw error;
  }
}
