"use client";

import { useRouter } from "next/navigation";
import AccountSettingsSection from "@/components/partner/AccountSettingsSection";
import { usePartnerPortal } from "@/components/partner/PartnerPortalShell";

/** Sub-halaman Pengaturan Akun Portal Mitra (`/partner/account`). */
export default function PartnerAccountPage() {
  const router = useRouter();
  const { user, setUser, displayName, logout } = usePartnerPortal();

  return (
    <AccountSettingsSection
      user={user}
      displayName={displayName}
      onLogout={logout}
      onOpenPengajuan={() => router.push("/partner/inquiries")}
      onOpenBantuan={() => router.push("/partner/help")}
      onUserUpdated={setUser}
    />
  );
}
