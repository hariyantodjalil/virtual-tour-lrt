import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import PartnerPortalShell from "@/components/partner/PartnerPortalShell";
import { getServerSessionUser } from "@/lib/session-server";

/** Layout bersama untuk seluruh rute Portal Mitra (`/partner/*`). */
export default async function PartnerLayout({ children }: { children: ReactNode }) {
  const initialUser = await getServerSessionUser();
  if (!initialUser) redirect("/login?reason=expired");
  if (
    initialUser.role !== "MITRA" &&
    initialUser.role !== "ADMIN" &&
    initialUser.role !== "EDITOR"
  ) {
    redirect("/cms/dashboard");
  }
  return <PartnerPortalShell initialUser={initialUser}>{children}</PartnerPortalShell>;
}
