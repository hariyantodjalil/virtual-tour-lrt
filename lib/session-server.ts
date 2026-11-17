import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

/**
 * Membaca sesi user aktif dari cookie `cms-token` pada Server Component.
 * Mengembalikan `null` jika token tidak ada, tidak valid, atau akun nonaktif.
 */
export async function getServerSessionUser(): Promise<SessionUser | null> {
  try {
    const token = (await cookies()).get("cms-token")?.value;
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
