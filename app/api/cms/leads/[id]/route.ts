import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;

  try {
    await prisma.tenantLead.delete({ where: { id } });
    return NextResponse.json({ message: "Lead dihapus" });
  } catch {
    return NextResponse.json({ error: "Lead tidak ditemukan" }, { status: 404 });
  }
}
