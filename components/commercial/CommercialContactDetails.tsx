"use client";

import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { useCommercialProfile } from "@/components/commercial/CommercialProfileProvider";
import { getWhatsAppUrl } from "@/lib/utils";

export default function CommercialContactDetails() {
  const profile = useCommercialProfile();
  const whatsappUrl = getWhatsAppUrl(
    profile.whatsappNumber,
    profile.defaultWhatsappMessage
  );

  return (
    <div className="mt-5 border-t border-black/10 pt-4">
      <p className="text-xs font-bold text-black">{profile.teamName}</p>
      {profile.contactPersonName && (
        <p className="mt-1 text-xs text-black/65">{profile.contactPersonName}</p>
      )}
      <div className="mt-2 space-y-1.5 text-xs text-black/70">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 transition hover:text-[#d32f2f]"
        >
          <MessageCircle className="size-3.5" />
          WhatsApp {profile.whatsappNumber}
        </a>
        {profile.phoneNumber && (
          <a
            href={`tel:${profile.phoneNumber}`}
            className="flex items-center gap-2 transition hover:text-[#d32f2f]"
          >
            <Phone className="size-3.5" />
            {profile.phoneNumber}
          </a>
        )}
        {profile.email && (
          <a
            href={`mailto:${profile.email}`}
            className="flex items-center gap-2 transition hover:text-[#d32f2f]"
          >
            <Mail className="size-3.5" />
            {profile.email}
          </a>
        )}
        {profile.officeAddress && (
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            {profile.officeAddress}
          </p>
        )}
      </div>
    </div>
  );
}
