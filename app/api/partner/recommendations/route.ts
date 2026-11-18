import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["MITRA"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const spaces = await prisma.commercialSpace.findMany({
    where: { status: "TERSEDIA", station: { isActive: true } },
    orderBy: [{ exposure: "desc" }, { updatedAt: "desc" }],
    take: 6,
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      area: true,
      lengthM: true,
      widthM: true,
      heightM: true,
      areaKind: true,
      exposure: true,
      floor: true,
      location: true,
      panoramaUrl: true,
      station: { select: { name: true, slug: true } },
    },
  });

  return NextResponse.json(spaces);
}
