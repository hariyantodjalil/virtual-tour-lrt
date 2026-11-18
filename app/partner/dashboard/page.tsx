"use client";

import DashboardOverview from "@/components/partner/DashboardOverview";
import { usePartnerPortal } from "@/components/partner/PartnerPortalShell";

/** Sub-halaman Dashboard Portal Mitra (`/partner/dashboard`). */
export default function PartnerDashboardPage() {
  const {
    displayName,
    loading,
    leads,
    favorites,
    summary,
    openStationPicker,
    pickerStations,
  } = usePartnerPortal();

  return (
    <DashboardOverview
      displayName={displayName}
      loading={loading}
      leads={leads}
      favorites={favorites}
      summary={summary}
      onExplore={openStationPicker}
      pickerReady={pickerStations.length > 0}
    />
  );
}
