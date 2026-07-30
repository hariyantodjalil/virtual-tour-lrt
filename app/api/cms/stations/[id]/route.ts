import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { stationUpdateSchema } from "@/lib/api-schemas";
import { Prisma } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const station = await prisma.station.findUnique({
    where: { id },
    include: { commercialSpaces: true, virtualTourScenes: { orderBy: { order: "asc" } } },
  });
  if (!station) return NextResponse.json({ error: "Stasiun tidak ditemukan" }, { status: 404 });
  return NextResponse.json(station);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const parsed = await parseJsonRequest(request, stationUpdateSchema);
  if (!parsed.success) return parsed.response;
  try {
    const station = await prisma.station.update({ where: { id }, data: parsed.data });
    return NextResponse.json(station);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Stasiun tidak ditemukan" }, { status: 404 });
      }
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Kode atau slug stasiun sudah digunakan." },
          { status: 409 }
        );
      }
    }
    return NextResponse.json({ error: "Gagal memperbarui stasiun" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  try {
    await prisma.station.delete({ where: { id } });
    return NextResponse.json({ message: "Stasiun dihapus" });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Stasiun tidak ditemukan" }, { status: 404 });
      }
      if (error.code === "P2003") {
        return NextResponse.json(
          { error: "Stasiun masih memiliki data terkait yang tidak dapat dihapus." },
          { status: 409 }
        );
      }
    }
    return NextResponse.json({ error: "Gagal menghapus stasiun" }, { status: 500 });
  }
}
