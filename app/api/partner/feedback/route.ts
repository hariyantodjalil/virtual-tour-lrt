import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";

const feedbackSchema = z
  .object({
    topic: z.enum(["Portal Mitra", "Pengajuan Sewa", "Virtual Tour", "Lainnya"]),
    message: z.string().trim().min(10).max(2000),
  })
  .strict();

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["MITRA"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonRequest(request, feedbackSchema);
  if (!parsed.success) return parsed.response;

  const feedback = await prisma.partnerFeedback.create({
    data: {
      userId: auth.user.userId,
      topic: parsed.data.topic,
      message: parsed.data.message,
    },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({ feedback }, { status: 201 });
}
