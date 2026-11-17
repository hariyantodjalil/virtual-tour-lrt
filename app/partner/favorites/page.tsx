"use client";

import FavoritesSection from "@/components/partner/FavoritesSection";
import { usePartnerPortal } from "@/components/partner/PartnerPortalShell";

/** Sub-halaman Unit Favorit Portal Mitra (`/partner/favorites`). */
export default function PartnerFavoritesPage() {
  const {
    displayName,
    favorites,
    openStationPicker,
    pickerStations,
    removeFavorite,
  } = usePartnerPortal();

  return (
    <FavoritesSection
      displayName={displayName}
      favorites={favorites}
      onExplore={openStationPicker}
      pickerReady={pickerStations.length > 0}
      onRemove={removeFavorite}
    />
  );
}
