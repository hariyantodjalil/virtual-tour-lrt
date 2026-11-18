import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const feedbacks = await prisma.partnerFeedback.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return NextResponse.json(
    feedbacks.map((item) => ({
      id: item.id,
      topic: item.topic,
      message: item.message,
      createdAt: item.createdAt.toISOString(),
      user: item.user,
    }))
  );
}
