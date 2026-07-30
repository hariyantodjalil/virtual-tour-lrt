import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Session probe for public UI (navbar, forms).
 * Unauthenticated visitors get 200 + authenticated:false — not 401 —
 * so browsers don't treat a normal anonymous homepage visit as an error.
 * Use 401 only on protected routes that require a session.
 */
export async function GET(request: NextRequest) {
  const payload = getUserFromRequest(request);
  if (!payload) {
    return NextResponse.json({ authenticated: false });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    user: { ...user, avatarUrl: null as string | null },
  });
}
