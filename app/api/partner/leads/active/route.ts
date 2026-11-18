import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { activeInquiryWhere } from "@/lib/active-inquiry";
import { prisma } from "@/lib/prisma";

const targetSchema = z.object({
  spaceId: z.string().trim().min(1).max(128).optional(),
  trainRentalSpaceId: z.string().trim().min(1).max(128).optional(),
}).refine(value => Boolean(value.spaceId) !== Boolean(value.trainRentalSpaceId));

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["MITRA"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const target = targetSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!target.success) return NextResponse.json({ error: "Pilih satu unit pengajuan." }, { status: 400 });
  const { spaceId, trainRentalSpaceId } = target.data;
  const inquiry = await prisma.tenantLead.findFirst({
    where: activeInquiryWhere(auth.user.userId, spaceId
      ? { kind: "space", id: spaceId }
      : { kind: "train", id: trainRentalSpaceId! }),
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return NextResponse.json(inquiry, { headers: { "Cache-Control": "private, no-store" } });
}
