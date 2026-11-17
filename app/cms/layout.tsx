import { redirect } from "next/navigation";
import { getServerSessionUser } from "@/lib/session-server";
import CmsShell, { type CmsUser } from "./CmsShell";

export default async function CmsLayout({ children }: { children: React.ReactNode }) {
  const initialUser: CmsUser | null = await getServerSessionUser();
  if (!initialUser) redirect("/login?reason=expired");
  if (initialUser.role !== "ADMIN" && initialUser.role !== "EDITOR") redirect("/partner/dashboard");
  return <CmsShell initialUser={initialUser}>{children}</CmsShell>;
}
