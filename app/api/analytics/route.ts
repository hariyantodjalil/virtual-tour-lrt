import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { eventType, stationId, spaceId, sessionId } = await req.json();

    await prisma.visitEvent.create({
      data: {
        eventType,
        stationId: stationId ?? undefined,
        spaceId: spaceId ?? undefined,
        sessionId: sessionId ?? req.headers.get("x-forwarded-for") ?? "unknown",
        userAgent: req.headers.get("user-agent") ?? undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan event" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const [
      totalVisits,
      totalLeads,
      totalSpaces,
      availableSpaces,
      eventsByType,
      recentLeads,
      topStations,
    ] = await Promise.all([
      prisma.visitEvent.count(),
      prisma.tenantLead.count(),
      prisma.commercialSpace.count(),
      prisma.commercialSpace.count({ where: { status: "TERSEDIA" } }),
      prisma.visitEvent.groupBy({
        by: ["eventType"],
        _count: { id: true },
      }),
      prisma.tenantLead.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          space: {
            include: { station: { select: { name: true } } },
          },
        },
      }),
      prisma.visitEvent.groupBy({
        by: ["stationId"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
        where: { stationId: { not: null } },
      }),
    ]);

    return NextResponse.json({
      totalVisits,
      totalLeads,
      totalSpaces,
      availableSpaces,
      occupiedSpaces: totalSpaces - availableSpaces,
      occupancyRate: totalSpaces > 0 ? ((totalSpaces - availableSpaces) / totalSpaces * 100).toFixed(1) : 0,
      eventsByType,
      recentLeads,
      topStations,
    });
  } catch {
    return NextResponse.json({ error: "Gagal mengambil data analitik" }, { status: 500 });
  }
}
