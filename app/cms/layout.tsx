import { redirect } from "next/navigation";
import { getCmsSessionUser } from "@/lib/cms-session";
import CmsShell from "./CmsShell";

export default async function CmsLayout({ children }: { children: React.ReactNode }) {
  const initialUser = await getCmsSessionUser();
  if (!initialUser) redirect("/login?reason=expired");
  if (initialUser.role !== "ADMIN" && initialUser.role !== "EDITOR") redirect("/partner");
  return <CmsShell initialUser={initialUser}>{children}</CmsShell>;
}
