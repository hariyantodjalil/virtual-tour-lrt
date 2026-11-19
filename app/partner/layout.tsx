import type { ReactNode } from "react";
import TourLanguageProvider from "@/components/tour/TourLanguageProvider";
import { getTourLanguageData, getTourTranslator } from "@/lib/tour-translated-content";

export async function generateMetadata() {
  const t = await getTourTranslator();
  return { title: t("Portal Mitra") };
}

export default async function PartnerLayout({ children }: { children: ReactNode }) {
  return (
    <TourLanguageProvider {...await getTourLanguageData()}>
      {children}
    </TourLanguageProvider>
  );
}
