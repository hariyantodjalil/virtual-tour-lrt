import type { ReactNode } from "react";
import TourLanguageProvider from "@/components/tour/TourLanguageProvider";
import { getTourLanguageData, getTourTranslator } from "@/lib/tour-translated-content";

export async function generateMetadata() {
  const t = await getTourTranslator();
  return { title: t("Login Akun") };
}

export default async function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <TourLanguageProvider {...await getTourLanguageData()}>
      {children}
    </TourLanguageProvider>
  );
}
