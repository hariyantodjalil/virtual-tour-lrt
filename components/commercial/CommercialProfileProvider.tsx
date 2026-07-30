"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  COMMERCIAL_PROFILE_UPDATED_EVENT,
  DEFAULT_COMMERCIAL_PROFILE,
  mergeCommercialProfile,
  type CommercialProfileData,
} from "@/lib/commercial-profile-shared";

const CommercialProfileContext = createContext<CommercialProfileData>(
  DEFAULT_COMMERCIAL_PROFILE
);

export function CommercialProfileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, setProfile] = useState(DEFAULT_COMMERCIAL_PROFILE);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await fetch("/api/commercial-profile", {
        cache: "no-store",
      }).catch(() => null);
      if (!response?.ok || cancelled) return;
      const data = (await response.json().catch(() => null)) as
        | Partial<CommercialProfileData>
        | null;
      if (!cancelled) setProfile(mergeCommercialProfile(data));
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleUpdate(event: Event) {
      const detail = (event as CustomEvent<Partial<CommercialProfileData>>).detail;
      if (detail) setProfile(mergeCommercialProfile(detail));
    }

    window.addEventListener(COMMERCIAL_PROFILE_UPDATED_EVENT, handleUpdate);
    return () =>
      window.removeEventListener(COMMERCIAL_PROFILE_UPDATED_EVENT, handleUpdate);
  }, []);

  return (
    <CommercialProfileContext.Provider value={profile}>
      {children}
    </CommercialProfileContext.Provider>
  );
}

export function useCommercialProfile() {
  return useContext(CommercialProfileContext);
}
