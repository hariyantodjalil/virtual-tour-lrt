"use client";

import { createPortal } from "react-dom";
import { Megaphone, MessageCircle, X } from "lucide-react";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import { getWhatsAppUrl } from "@/lib/utils";

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
  contactPhone = "628118012012",
  onClose,
}: Props) {
  const displayTitle = creativeTitle || title || spaceName || "Media Iklan";
  const waMessage = `Halo, saya tertarik dengan slot media iklan${spaceCode ? ` ${spaceCode}` : ""} di Stasiun ${stationName}. Mohon informasi lebih lanjut.`;
  const waUrl = getWhatsAppUrl(contactPhone, waMessage);
  const imageSrc = creativeUrl ? getS3ProxyUrl(creativeUrl) : null;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-3 sm:items-center sm:p-6">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a] shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-1.5 text-white/80 hover:bg-black/70"
        >
          <X className="h-4 w-4" />
        </button>

        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc} alt={displayTitle} className="h-48 w-full object-cover" />
        ) : (
          <div className="flex h-36 items-center justify-center bg-gradient-to-br from-purple-950 to-slate-900">
            <Megaphone className="h-10 w-10 text-purple-300/80" />
          </div>
        )}

        <div className="space-y-3 p-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-300">
              Media Iklan
            </p>
            <h3 className="mt-1 text-lg font-bold text-white">{displayTitle}</h3>
            {brandName && (
              <p className="mt-0.5 text-sm text-slate-300">
                Tenant: <span className="font-semibold text-white">{brandName}</span>
              </p>
            )}
            {(spaceCode || spaceName) && (
              <p className="mt-1 text-xs text-slate-500">
                {spaceCode}
                {spaceName ? ` · ${spaceName}` : ""}
              </p>
            )}
          </div>

          <p className="text-sm text-slate-400">
            Slot media di Stasiun {stationName}. Hubungi tim komersial untuk ketersediaan dan paket
            penempatan.
          </p>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#25D366] px-4 text-sm font-semibold text-white hover:bg-[#1ebe57]"
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
