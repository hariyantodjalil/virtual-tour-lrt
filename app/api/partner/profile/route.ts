import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";

const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
  })
  .strict();

export async function PATCH(request: NextRequest) {
  const auth = await requireRole(request, ["MITRA"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonRequest(request, profileUpdateSchema);
  if (!parsed.success) return parsed.response;

  const user = await prisma.user.update({
    where: { id: auth.user.userId },
    data: { name: parsed.data.name },
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json({ user: { ...user, avatarUrl: null as string | null } });
}
