"use client";

import PartnerSectionHeader from "@/components/partner/PartnerSectionHeader";

/** Halaman pusat bantuan Portal Mitra. */
export default function HelpSection({
  displayName,
  title = "Bantuan",
}: {
  displayName: string;
  title?: string;
}) {
  return (
    <>
      <PartnerSectionHeader
        displayName={displayName}
        title={title}
        subtitle="Panduan penggunaan Portal Mitra dan akses dukungan tim komersial"
        action={null}
      />
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
        <h2 className="text-base font-semibold text-[#101828]">Pusat Bantuan Mitra</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Fitur ini segera hadir. Sementara itu, pantau pengajuan sewa atau jelajahi virtual tour.
        </p>
      </div>
    </>
  );
}
