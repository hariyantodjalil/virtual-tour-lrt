import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { z } from "zod";
import { parseJsonRequest } from "@/lib/api-validation";
import { consumeRateLimit, getClientIdentifier, rateLimitHeaders } from "@/lib/rate-limit";

const analyticsEventSchema = z.object({
  eventType: z.enum([
    "STATION_VIEW",
    "SPACE_VIEW",
    "TOUR_START",
    "FORM_SUBMIT",
    "WHATSAPP_CLICK",
    "PDF_DOWNLOAD",
  ]),
  stationId: z.string().trim().min(1).max(128).optional().nullable(),
  spaceId: z.string().trim().min(1).max(128).optional().nullable(),
  sessionId: z.string().trim().min(1).max(160).optional().nullable(),
}).strict();

export async function POST(req: NextRequest) {
  const rateLimit = consumeRateLimit(req, "analytics-write", {
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Terlalu banyak event" },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    );
  }

  try {
    const parsed = await parseJsonRequest(req, analyticsEventSchema);
    if (!parsed.success) return parsed.response;
    const { eventType, stationId, spaceId, sessionId } = parsed.data;

    await prisma.visitEvent.create({
      data: {
        eventType,
        stationId: stationId ?? undefined,
        spaceId: spaceId ?? undefined,
        sessionId: sessionId ?? getClientIdentifier(req),
        userAgent: req.headers.get("user-agent")?.slice(0, 512) ?? undefined,
      },
    });

    return NextResponse.json({ ok: true }, { headers: rateLimitHeaders(rateLimit) });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan event" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["ADMIN", "EDITOR"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

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
