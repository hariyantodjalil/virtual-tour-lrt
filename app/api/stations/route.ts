import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const stations = await prisma.station.findMany({
      orderBy: { order: "asc" },
      include: {
        _count: { select: { commercialSpaces: true } },
        commercialSpaces: {
          select: { status: true },
        },
      },
    });

    const data = stations.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      line: s.line,
      address: s.address,
      dailyPassengers: s.dailyPassengers,
      order: s.order,
      description: s.description,
      spaceStats: {
        total: s.commercialSpaces.length,
        available: s.commercialSpaces.filter((sp) => sp.status === "TERSEDIA").length,
        occupied: s.commercialSpaces.filter((sp) => sp.status === "TERISI").length,
      },
    }));

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Gagal mengambil data stasiun" }, { status: 500 });
  }
}
