"use client";

import HelpSection from "@/components/partner/HelpSection";
import { usePartnerPortal } from "@/components/partner/PartnerPortalShell";

/** Sub-halaman Bantuan Portal Mitra (`/partner/help`). */
export default function PartnerHelpPage() {
  const { displayName } = usePartnerPortal();

  return <HelpSection displayName={displayName} title="Bantuan" />;
}
