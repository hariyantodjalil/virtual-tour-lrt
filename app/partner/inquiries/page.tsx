"use client";

import ApplicationsSection from "@/components/partner/ApplicationsSection";
import { usePartnerPortal } from "@/components/partner/PartnerPortalShell";

/** Sub-halaman daftar Pengajuan Sewa Portal Mitra (`/partner/inquiries`). */
export default function PartnerInquiriesPage() {
  const { displayName, loading, leads, openStationPicker, pickerStations } =
    usePartnerPortal();

  return (
    <ApplicationsSection
      displayName={displayName}
      loading={loading}
      leads={leads}
      onExplore={openStationPicker}
      pickerReady={pickerStations.length > 0}
    />
  );
}
