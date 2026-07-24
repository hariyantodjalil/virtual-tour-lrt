import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CmsShell, { type CmsUser } from "./CmsShell";

async function getCmsUser(): Promise<CmsUser | null> {
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

export default async function CmsLayout({ children }: { children: React.ReactNode }) {
  const initialUser = await getCmsUser();
  if (!initialUser) redirect("/login?reason=expired");
  if (initialUser.role !== "ADMIN" && initialUser.role !== "EDITOR") redirect("/partner");
  return <CmsShell initialUser={initialUser}>{children}</CmsShell>;
}
