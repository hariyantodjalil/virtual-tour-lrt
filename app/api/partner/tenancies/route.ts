import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["MITRA"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const tenants = await prisma.tenant.findMany({
    where: {
      userId: auth.user.userId,
      isActive: true,
      station: { isActive: true },
      occupancies: { some: { endDate: null } },
    },
    orderBy: [{ station: { name: "asc" } }, { brandName: "asc" }],
    select: {
      id: true,
      brandName: true,
      logoUrl: true,
      contactName: true,
      phone: true,
      email: true,
      station: {
        select: {
          id: true,
          name: true,
          slug: true,
          line: true,
        },
      },
      occupancies: {
        where: { endDate: null },
        orderBy: { startDate: "asc" },
        select: {
          id: true,
          startDate: true,
          space: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              area: true,
              floor: true,
              location: true,
              panoramaUrl: true,
              status: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json(tenants);
}
