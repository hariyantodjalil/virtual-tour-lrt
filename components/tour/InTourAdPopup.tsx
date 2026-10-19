"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { Megaphone, MessageCircle, X } from "lucide-react";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import { getWhatsAppUrl } from "@/lib/utils";
import { useCommercialProfile } from "@/components/commercial/CommercialProfileProvider";

type Props = {
  title: string;
  creativeTitle?: string;
  creativeUrl?: string;
  spaceCode?: string;
  spaceName?: string;
  brandName?: string;
  stationName: string;
  contactPhone?: string;
  onClose: () => void;
};

export default function InTourAdPopup({
  title,
  creativeTitle,
  creativeUrl,
  spaceCode,
  spaceName,
  brandName,
  stationName,
  contactPhone,
  onClose,
}: Props) {
  const commercialProfile = useCommercialProfile();
  const resolvedContactPhone =
    contactPhone || commercialProfile.whatsappNumber;
  const displayTitle = creativeTitle || title || spaceName || "Media Iklan";
  const waMessage = `Halo, saya tertarik dengan slot media iklan${spaceCode ? ` ${spaceCode}` : ""} di Stasiun ${stationName}. Mohon informasi lebih lanjut.`;
  const waUrl = getWhatsAppUrl(resolvedContactPhone, waMessage);
  const imageSrc = creativeUrl ? getS3ProxyUrl(creativeUrl) : null;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#1C0A0E]/65 p-3 sm:items-center sm:p-6">
      <div className="tour-panel-in relative w-full max-w-md overflow-hidden rounded-2xl border border-[color:rgb(255_214_218_/_0.14)] bg-[#3A161C] shadow-[0_24px_60px_rgba(28,10,14,0.55)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-[#1C0A0E]/70 p-1.5 text-[#F8ECEE]/80 hover:bg-[#1C0A0E]"
        >
          <X className="h-4 w-4" />
        </button>

        {imageSrc ? (
          <div className="relative h-48 w-full">
            <Image
              src={imageSrc}
              alt={displayTitle}
              fill
              className="object-cover"
              sizes="(max-width: 448px) 100vw, 448px"
            />
          </div>
        ) : (
          <div className="flex h-36 items-center justify-center bg-gradient-to-br from-[#1C0A0E] to-[#3A161C]">
            <Megaphone className="h-10 w-10 text-[#E31E2D]/80" />
          </div>
        )}

        <div className="space-y-3 p-5">
          <div>
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E31E2D]">
              Media Iklan
            </p>
            <h3 className="mt-1 font-display text-lg font-semibold text-[#F8ECEE]">{displayTitle}</h3>
            {brandName && (
              <p className="mt-0.5 text-sm text-[#C4A8AD]">
                Tenant: <span className="font-semibold text-white">{brandName}</span>
              </p>
            )}
            {(spaceCode || spaceName) && (
              <p className="mt-1 text-xs text-[#C4A8AD]/70">
                {spaceCode}
                {spaceName ? ` · ${spaceName}` : ""}
              </p>
            )}
          </div>

          <p className="text-sm text-[#F8ECEE]/70">
            Slot media di Stasiun {stationName}. Hubungi {commercialProfile.teamName} untuk
            ketersediaan dan paket penempatan.
          </p>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 w-full items-center justify-center rounded-full bg-[#25D366] px-4 font-display text-sm font-semibold text-white hover:bg-[#1ebe57]"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Tanya via WhatsApp
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}
