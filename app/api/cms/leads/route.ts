import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const leads = await prisma.tenantLead.findMany({
    orderBy: { createdAt: "desc" },
    include: { space: { include: { station: true } } },
  });
  return NextResponse.json(leads);
}

export async function PATCH(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id, status, notes, followUpAt } = await request.json();
  if (!id) return NextResponse.json({ error: "ID wajib diisi" }, { status: 400 });

  const lead = await prisma.tenantLead.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(notes !== undefined && { notes }),
      ...(followUpAt !== undefined && { followUpAt: followUpAt ? new Date(followUpAt) : null }),
    },
  });
  return NextResponse.json(lead);
}
