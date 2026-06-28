import { prisma } from "@/lib/prisma";
import DashboardClient from "@/app/dashboard/DashboardClient";

async function getDashboardData() {
  try {
    const [
      totalVisits, totalLeads, totalSpaces, availableSpaces,
      eventsByType, recentLeads, stationVisits, leadsByStatus, dailyVisits,
    ] = await Promise.all([
      prisma.visitEvent.count(),
      prisma.tenantLead.count(),
      prisma.commercialSpace.count(),
      prisma.commercialSpace.count({ where: { status: "TERSEDIA" } }),
      prisma.visitEvent.groupBy({ by: ["eventType"], _count: { id: true } }),
      prisma.tenantLead.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { space: { include: { station: { select: { name: true, slug: true } } } } },
      }),
      prisma.visitEvent.groupBy({
        by: ["stationId"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 8,
        where: { stationId: { not: null }, eventType: "STATION_VIEW" },
      }),
      prisma.tenantLead.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE(created_at)::text as date, COUNT(*)::bigint as count
        FROM visit_events
        WHERE created_at >= NOW() - INTERVAL '7 days'
          AND event_type = 'STATION_VIEW'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `.catch(() => []),
    ]);

    const stationIds = stationVisits.map((sv) => sv.stationId!).filter(Boolean);
    const stations = await prisma.station.findMany({
      where: { id: { in: stationIds } },
      select: { id: true, name: true },
    });
    const stationMap = Object.fromEntries(stations.map((s) => [s.id, s.name]));

    return {
      stats: {
        totalVisits,
        totalLeads,
        totalSpaces,
        availableSpaces,
        occupiedSpaces: totalSpaces - availableSpaces,
        occupancyRate:
          totalSpaces > 0
            ? Number((((totalSpaces - availableSpaces) / totalSpaces) * 100).toFixed(1))
            : 0,
      },
      eventsByType: eventsByType.map((e) => ({ type: e.eventType, count: e._count.id })),
      recentLeads: recentLeads.map((l) => ({
        id: l.id,
        companyName: l.companyName,
        contactName: l.contactName,
        phone: l.phone,
        email: l.email,
        businessType: l.businessType,
        status: l.status,
        spaceName: l.space?.name ?? "-",
        stationName: l.space?.station?.name ?? "-",
        stationSlug: l.space?.station?.slug ?? "",
        createdAt: l.createdAt.toISOString(),
      })),
      topStations: stationVisits.map((sv) => ({
        stationId: sv.stationId!,
        stationName: stationMap[sv.stationId!] ?? sv.stationId!,
        visits: sv._count.id,
      })),
      leadsByStatus: leadsByStatus.map((l) => ({ status: l.status, count: l._count.id })),
      dailyVisits: (dailyVisits as { date: string; count: bigint }[]).map((d) => ({
        date: d.date,
        count: Number(d.count),
      })),
    };
  } catch {
    return {
      stats: {
        totalVisits: 0,
        totalLeads: 0,
        totalSpaces: 0,
        availableSpaces: 0,
        occupiedSpaces: 0,
        occupancyRate: 0,
      },
      eventsByType: [],
      recentLeads: [],
      topStations: [],
      leadsByStatus: [],
      dailyVisits: [],
    };
  }
}

export const dynamic = "force-dynamic";

export default async function CmsDashboardPage() {
  const data = await getDashboardData();
  return (
    <div>
      <DashboardClient data={data} />
    </div>
  );
}
