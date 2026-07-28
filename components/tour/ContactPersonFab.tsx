"use client";

import { getWhatsAppUrl } from "@/lib/utils";

type Props = {
  phone?: string;
  stationName?: string;
  /** Override posisi (mis. fixed di homepage) */
  className?: string;
};

const DEFAULT_PHONE = "628118012012";

export default function ContactPersonFab({
  phone = DEFAULT_PHONE,
  stationName,
  className = "absolute bottom-6 right-3 sm:bottom-8 sm:right-5",
}: Props) {
  const message = stationName
    ? `Halo, saya tertarik ruang komersial di Stasiun ${stationName}. Mohon info lebih lanjut.`
    : "Halo, saya tertarik ruang komersial LRT Jabodebek. Mohon info lebih lanjut.";
  const waUrl = getWhatsAppUrl(phone, message);

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Hubungi contact person"
      title="Hubungi contact person"
      className={`group pointer-events-auto z-[70] flex items-end gap-2.5 ${className}`}
    >
      <span className="relative z-10 flex size-[45px] shrink-0 items-center justify-center rounded-full bg-[#D81435] shadow-[0_8px_24px_rgba(216,20,53,0.45)] transition group-hover:scale-105 group-hover:brightness-110">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/tour-contact/phone.svg"
          alt=""
          width={22}
          height={22}
          className="size-[22px]"
        />
      </span>

      <span className="relative mb-0.5 h-[38px] w-[41px] shrink-0 transition group-hover:-translate-y-0.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/tour-contact/mascot-head.png"
          alt=""
          width={41}
          height={38}
          className="h-full w-full object-contain object-bottom drop-shadow-[0_3px_8px_rgba(0,0,0,0.28)]"
          draggable={false}
        />
      </span>
    </a>
  );
}
