import { prisma } from "@/lib/prisma";
import {
  LEAD_STATUS_LABELS,
  SPACE_HOLD_STATUSES,
  type CommercialLeadStatus,
} from "@/lib/commercial-pipeline";
import DashboardClient from "@/app/dashboard/DashboardClient";

type DashboardPhaseKey =
  | "PHASE_NEW"
  | "PHASE_IN_PROGRESS"
  | "PHASE_RESERVED"
  | "PHASE_FIT_OUT"
  | "PHASE_WON"
  | "PHASE_LOST";

const PHASE_ORDER: DashboardPhaseKey[] = [
  "PHASE_NEW",
  "PHASE_IN_PROGRESS",
  "PHASE_RESERVED",
  "PHASE_FIT_OUT",
  "PHASE_WON",
  "PHASE_LOST",
];

function resolveLeadPhaseKey(input: {
  status: string;
  currentStepOrder: number;
  steps?: Array<{ stepOrder: number; spaceEffect: string }>;
}): DashboardPhaseKey {
  if (input.status === "CLOSED_WON" || input.status === "COMMERCIAL_OPERATION") {
    return "PHASE_WON";
  }
  if (input.status === "CLOSED_LOST") {
    return "PHASE_LOST";
  }

  const activeStep = input.steps?.find((s) => s.stepOrder === input.currentStepOrder);
  const effect = activeStep?.spaceEffect;

  if (effect === "FIT_OUT_SPACE" || input.status === "FIT_OUT_HANDOVER") {
    return "PHASE_FIT_OUT";
  }
  if (
    effect === "RESERVE_SPACE" ||
    SPACE_HOLD_STATUSES.includes(input.status as (typeof SPACE_HOLD_STATUSES)[number])
  ) {
    return "PHASE_RESERVED";
  }
  if (input.currentStepOrder <= 1 && input.status === "NEW") {
    return "PHASE_NEW";
  }
  return "PHASE_IN_PROGRESS";
}

function resolveLeadStageLabel(input: {
  status: string;
  currentStepOrder: number;
  steps?: Array<{ stepOrder: number; title: string }>;
}): string {
  if (input.status === "CLOSED_WON") return "Selesai";
  if (input.status === "CLOSED_LOST") return "Dihentikan";

  const activeStep = input.steps?.find((s) => s.stepOrder === input.currentStepOrder);
  if (activeStep) {
    return `Tahap ${activeStep.stepOrder}: ${activeStep.title}`;
  }

  return LEAD_STATUS_LABELS[input.status as CommercialLeadStatus] ?? input.status;
}

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
        include: {
          space: { include: { station: { select: { name: true, slug: true } } } },
          workflowVersion: {
            select: {
              steps: {
                select: { stepOrder: true, title: true, spaceEffect: true },
              },
            },
          },
        },
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
      prisma.tenantLead.findMany({
        select: {
          status: true,
          currentStepOrder: true,
          workflowVersion: {
            select: {
              steps: {
                select: { stepOrder: true, spaceEffect: true },
              },
            },
          },
        },
      }),
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

  const phaseCounts = new Map<DashboardPhaseKey, number>();
  for (const row of leadsByStatus) {
    const phase = resolveLeadPhaseKey({
      status: row.status,
      currentStepOrder: row.currentStepOrder,
      steps: row.workflowVersion?.steps,
    });
    phaseCounts.set(phase, (phaseCounts.get(phase) ?? 0) + 1);
  }
  const aggregatedPhases = PHASE_ORDER.filter((key) => (phaseCounts.get(key) ?? 0) > 0).map(
    (key) => ({
      status: key,
      count: phaseCounts.get(key) ?? 0,
    })
  );

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
    recentLeads: recentLeads.map((l) => {
      const steps = l.workflowVersion?.steps;
      return {
        id: l.id,
        companyName: l.companyName,
        contactName: l.contactName,
        phone: l.phone,
        email: l.email,
        businessType: l.businessType,
        status: resolveLeadPhaseKey({
          status: l.status,
          currentStepOrder: l.currentStepOrder,
          steps,
        }),
        stageLabel: resolveLeadStageLabel({
          status: l.status,
          currentStepOrder: l.currentStepOrder,
          steps,
        }),
        spaceName: l.space?.name ?? "-",
        stationName: l.space?.station?.name ?? "-",
        stationSlug: l.space?.station?.slug ?? "",
        createdAt: l.createdAt.toISOString(),
      };
    }),
    topStations: stationVisits.map((sv) => ({
      stationId: sv.stationId!,
      stationName: stationMap[sv.stationId!] ?? sv.stationId!,
      visits: sv._count.id,
    })),
    leadsByStatus: aggregatedPhases,
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
