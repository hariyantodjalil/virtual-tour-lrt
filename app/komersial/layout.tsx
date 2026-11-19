import PublicContactFab from "@/components/PublicContactFab";
import type { ReactNode } from "react";
import TourLanguageProvider from "@/components/tour/TourLanguageProvider";
import { getTourLanguageData } from "@/lib/tour-translated-content";

export default async function CommercialLayout({ children }: { children: ReactNode }) {
  return (
    <TourLanguageProvider {...await getTourLanguageData()}>
      {children}
      <PublicContactFab localized />
    </TourLanguageProvider>
  );
}
