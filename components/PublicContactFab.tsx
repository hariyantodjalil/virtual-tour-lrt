"use client";

import { usePathname } from "next/navigation";
import ContactPersonFab from "@/components/tour/ContactPersonFab";

/** FAB contact di halaman publik (bukan CMS / partner / login). */
export default function PublicContactFab() {
  const pathname = usePathname();
  if (
    pathname.startsWith("/cms") ||
    pathname.startsWith("/partner") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/station") ||
    pathname.startsWith("/train")
  ) {
    // /station & /train punya FAB sendiri di dalam tour
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[80]">
      <ContactPersonFab className="fixed bottom-6 right-4 sm:bottom-8 sm:right-6" />
    </div>
  );
}
