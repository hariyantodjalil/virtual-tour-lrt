import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { authCookieName } from "@/lib/auth-cookie";
import { prisma } from "@/lib/prisma";

export async function getCmsSessionUser() {
  try {
    const token = (await cookies()).get(authCookieName())?.value;
    if (!token) return null;

    const payload = verifyToken(token);
    if (!payload) return null;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  } catch {
    return null;
  }
}
