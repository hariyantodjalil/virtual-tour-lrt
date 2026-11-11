import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ENTITY_TYPES = ["COMMERCIAL_SPACE", "TRAIN_RENTAL_SPACE"] as const;
type EntityType = (typeof ENTITY_TYPES)[number];

function parseDate(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Riwayat perubahan data tenant — sumber data cycle time pembaruan informasi tenant. */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const search = request.nextUrl.searchParams;
  const entityTypeParam = search.get("entityType");
  const entityType = ENTITY_TYPES.includes(entityTypeParam as EntityType) ? (entityTypeParam as EntityType) : undefined;
  const from = parseDate(search.get("from"));
  const to = parseDate(search.get("to"));
  const limit = Math.min(Math.max(Number(search.get("limit")) || 100, 1), 500);

  const logs = await prisma.tenantChangeLog.findMany({
    where: {
      ...(entityType ? { entityType } : {}),
      ...(search.get("entityId") ? { entityId: search.get("entityId") as string } : {}),
      ...(search.get("stationId") ? { stationId: search.get("stationId") as string } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json(logs);
}
