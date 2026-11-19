import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { parseJsonRequest } from "@/lib/api-validation";
import { CONCOURSE_ACCESS, CONCOURSE_SECTIONS, concourseLayout } from "@/lib/concourse-plan";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ stationId: string }> };

const publicSlotFields = {
  id: true, spaceId: true, access: true, kind: true, section: true, sequence: true, row: true, position: true,
} satisfies Prisma.ConcourseSlotSelect;

const slotInput = z.object({
  id: z.string().min(1).max(128).optional(),
  spaceId: z.string().min(1).max(128).nullable(),
  access: z.enum(["PAD", "UNP"]),
  kind: z.enum(["F", "Z"]),
  section: z.enum(CONCOURSE_SECTIONS),
  sequence: z.number().int().min(1).max(999),
  row: z.number().int().min(0).max(2),
  position: z.number().int().min(1).max(999),
}).strict();

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { stationId } = await params;
  const station = await prisma.station.findUnique({
    where: { id: stationId },
    select: {
      name: true, code: true, assetCodePrefix: true, concourseLayout: true,
      concourseSlots: { orderBy: [{ access: "asc" }, { sequence: "asc" }], select: publicSlotFields },
      commercialSpaces: { orderBy: { code: "asc" }, select: { id: true, code: true, name: true } },
    },
  });
  if (!station) return NextResponse.json({ error: "Stasiun tidak ditemukan." }, { status: 404 });
  return NextResponse.json(station, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: NextRequest, { params }: Context) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = await parseJsonRequest(request, slotInput);
  if (!parsed.success) return parsed.response;
  const { stationId } = await params;
  const { id, ...slot } = parsed.data;
  const station = await prisma.station.findUnique({
    where: { id: stationId },
    select: { code: true, assetCodePrefix: true, concourseLayout: true },
  });
  if (!station) return NextResponse.json({ error: "Stasiun tidak ditemukan." }, { status: 404 });
  const layout = concourseLayout(station.concourseLayout);
  if (!layout || !(station.assetCodePrefix || station.code)) {
    return NextResponse.json({ error: "Tipe dan kode stasiun diperlukan." }, { status: 400 });
  }
  if (layout !== "C" && CONCOURSE_ACCESS[layout][slot.section] !== slot.access) {
    return NextResponse.json({ error: "Akses harus sesuai zona pada denah stasiun." }, { status: 400 });
  }
  try {
    const saved = await prisma.$transaction(async tx => {
      if (slot.spaceId && !(await tx.commercialSpace.count({ where: { id: slot.spaceId, stationId } }))) {
        return null;
      }
      if (!id) return tx.concourseSlot.create({ data: { ...slot, stationId }, select: publicSlotFields });
      const result = await tx.concourseSlot.updateMany({ where: { id, stationId }, data: slot });
      return result.count ? tx.concourseSlot.findUnique({ where: { id }, select: publicSlotFields }) : null;
    });
    if (!saved) return NextResponse.json({ error: "Aset atau unit tidak ditemukan di stasiun ini." }, { status: 404 });
    return NextResponse.json(saved);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Nomor sudah dipakai pada akses tersebut atau unit sudah terhubung ke aset lain." }, { status: 409 });
    }
    throw error;
  }
}
