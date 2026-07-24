import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const stationSlug = req.nextUrl.searchParams.get("station");
  if (!stationSlug) {
    return NextResponse.json({ error: "Parameter station diperlukan" }, { status: 400 });
  }

  try {
    const station = await prisma.station.findFirst({
      where: { slug: stationSlug, isActive: true },
      include: {
        commercialSpaces: {
          orderBy: [{ floor: "asc" }, { code: "asc" }],
        },
      },
    });

    if (!station) {
      return NextResponse.json({ error: "Stasiun tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(station.commercialSpaces);
  } catch {
    return NextResponse.json({ error: "Gagal mengambil data ruang" }, { status: 500 });
  }
}
