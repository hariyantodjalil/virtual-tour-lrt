import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["MITRA"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const leads = await prisma.tenantLead.findMany({
    where: { userId: auth.user.userId },
    orderBy: { createdAt: "desc" },
    include: {
      space: {
        include: {
          station: { select: { name: true, slug: true } },
        },
      },
    },
  });

  return NextResponse.json(leads);
}
