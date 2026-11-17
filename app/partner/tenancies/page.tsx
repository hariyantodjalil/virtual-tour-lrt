"use client";

import ActiveTenanciesSection from "@/components/partner/ActiveTenanciesSection";
import { usePartnerPortal } from "@/components/partner/PartnerPortalShell";

/** Sub-halaman Unit Aktif Saya Portal Mitra (`/partner/tenancies`). */
export default function PartnerTenanciesPage() {
  const { displayName, tenancies, loading } = usePartnerPortal();

  return (
    <ActiveTenanciesSection
      displayName={displayName}
      tenancies={tenancies}
      loading={loading}
    />
  );
}
