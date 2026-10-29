import { prisma } from "@/lib/prisma";
import DashboardClient from "@/app/dashboard/DashboardClient";

async function getDashboardData() {
  const errors: string[] = [];
  async function settle<T>(key: string, query: Promise<T>, fallback: T): Promise<T> {
    try {
      return await query;
    } catch (error) {
      console.error(`Failed to load dashboard section: ${key}`, error);
      errors.push(key);
      return fallback;
    }
  }

  const [
    totalVisits, totalLeads, totalSpaces, availableSpaces,
    eventsByType, recentLeads, stationVisits, leadsByStatus, dailyVisits,
  ] = await Promise.all([
    settle("totalVisits", prisma.visitEvent.count(), null),
    settle("totalLeads", prisma.tenantLead.count(), null),
    settle("totalSpaces", prisma.commercialSpace.count(), null),
    settle(
      "availableSpaces",
      prisma.commercialSpace.count({ where: { status: "TERSEDIA" } }),
      null
    ),
    settle(
      "eventsByType",
      prisma.visitEvent.groupBy({ by: ["eventType"], _count: { id: true } }),
      []
    ),
    settle(
      "recentLeads",
      prisma.tenantLead.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { space: { include: { station: { select: { name: true, slug: true } } } } },
      }),
      []
    ),
    settle(
      "topStations",
      prisma.visitEvent.groupBy({
        by: ["stationId"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 8,
        where: { stationId: { not: null }, eventType: "STATION_VIEW" },
      }),
      []
    ),
    settle(
      "leadsByStatus",
      prisma.tenantLead.groupBy({ by: ["status"], _count: { id: true } }),
      []
    ),
    settle(
      "dailyVisits",
      prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE("createdAt")::text as date, COUNT(*)::bigint as count
        FROM visit_events
        WHERE "createdAt" >= NOW() - INTERVAL '7 days'
          AND "eventType" = 'STATION_VIEW'
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
      []
    ),
  ]);

  const stationIds = stationVisits.map((sv) => sv.stationId!).filter(Boolean);
  const stations = stationIds.length > 0
    ? await settle(
        "topStations",
        prisma.station.findMany({
          where: { id: { in: stationIds } },
          select: { id: true, name: true },
        }),
        []
      )
    : [];
  const stationMap = Object.fromEntries(stations.map((s) => [s.id, s.name]));
  const occupiedSpaces =
    totalSpaces !== null && availableSpaces !== null
      ? totalSpaces - availableSpaces
      : null;

  return {
    stats: {
      totalVisits,
      totalLeads,
      totalSpaces,
      availableSpaces,
      occupiedSpaces,
      occupancyRate:
        occupiedSpaces !== null && totalSpaces !== null && totalSpaces > 0
          ? Number(((occupiedSpaces / totalSpaces) * 100).toFixed(1))
          : totalSpaces === 0
            ? 0
            : null,
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
    dailyVisits: dailyVisits.map((d) => ({
      date: d.date,
      count: Number(d.count),
    })),
    errors: [...new Set(errors)],
  };
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
