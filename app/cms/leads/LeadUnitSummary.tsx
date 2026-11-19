"use client";

import Image from "next/image";
import Link from "next/link";
import { Building2, Compass, Layers, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LeadItem } from "@/lib/cms-leads-shared";
import {
  SITE_VISIT_STATUS_LABELS,
  SPACE_TYPE_LABELS,
  STANDARD_FIT_OUT_TERMS,
  STANDARD_LEASING_MODEL,
  type CommercialSiteVisitStatus,
} from "@/lib/commercial-pipeline";
import { resolveStationCover, stationCoverUnoptimized } from "@/lib/station-images";
import { resolvePublicAssetUrl, shouldUnoptimizeImage } from "@/lib/s3-utils";
import { formatArea } from "@/lib/unit-dimensions";

function Fact({
  label,
  value,
  subValue,
}: {
  label: string;
  value: string;
  subValue?: string | null;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[var(--work-muted)]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-[var(--work-text)]">
        {value}
        {subValue ? (
          <span className="mt-0.5 block break-words text-xs font-normal text-[var(--work-muted)]">
            {subValue}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function whatsappHref(phone: string, companyName: string, inquiryCode: string) {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("62")
    ? digits
    : digits.startsWith("0")
      ? `62${digits.slice(1)}`
      : digits;
  const text = encodeURIComponent(
    `Halo ${companyName}, terkait pengajuan ${inquiryCode} di Virtual Tour LRT Jabodebek.`
  );
  return `https://wa.me/${normalized}?text=${text}`;
}

function unitCover(lead: LeadItem): { src: string; alt: string; unoptimized: boolean } | null {
  const mediaImage = lead.trainInquiry?.media?.imageUrl?.trim();
  if (mediaImage) {
    const src = resolvePublicAssetUrl(mediaImage);
    return {
      src,
      alt: `${lead.trainInquiry?.mediaTitle ?? "Media"} · ${lead.trainInquiry?.mediaCode ?? ""}`,
      unoptimized: shouldUnoptimizeImage(src),
    };
  }

  const panorama = lead.space?.panoramaUrl?.trim();
  if (panorama) {
    const src = resolvePublicAssetUrl(panorama);
    return {
      src,
      alt: `${lead.space?.code ?? "Unit"} · ${lead.space?.name ?? ""}`,
      unoptimized: shouldUnoptimizeImage(src),
    };
  }

  if (lead.space?.station.slug) {
    const src = resolveStationCover(lead.space.station.slug, 0, lead.space.station.imageUrl);
    return {
      src,
      alt: `Stasiun ${lead.space.station.name}`,
      unoptimized: stationCoverUnoptimized(src),
    };
  }

  return null;
}

export default function LeadUnitSummary({ lead }: { lead: LeadItem }) {
  const cover = unitCover(lead);
  const unitTitle = lead.space
    ? `${lead.space.code} · ${lead.space.name}`
    : lead.trainInquiry
      ? `${lead.trainInquiry.mediaCode} · ${lead.trainInquiry.mediaTitle}`
      : "Unit belum terikat";

  return (
    <div className="space-y-5">
      <header className="border-b border-[var(--work-line)] pb-4">
        <h4 className="text-lg font-semibold">Unit & pemohon</h4>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-[var(--work-muted)]">
          Ringkasan unit yang diajukan beserta data kontak mitra untuk referensi saat mengelola tahap.
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-[var(--work-line)] bg-[var(--work-subtle)]">
        <div className="relative aspect-[21/9] min-h-40 bg-slate-200 sm:aspect-[2.4/1]">
          {cover ? (
            <Image
              src={cover.src}
              alt={cover.alt}
              fill
              sizes="(max-width: 1024px) 100vw, 720px"
              className="object-cover"
              unoptimized={cover.unoptimized}
            />
          ) : (
            <div className="flex h-full min-h-40 items-center justify-center gap-2 text-sm text-[var(--work-muted)]">
              <Building2 className="size-4" aria-hidden />
              Belum ada gambar unit
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 pb-3 pt-10 text-white">
            <p className="text-sm font-semibold [overflow-wrap:anywhere]">{unitTitle}</p>
            <p className="mt-0.5 text-xs text-white/85">
              {lead.space
                ? `${lead.space.station.name}${lead.space.station.code ? ` (${lead.space.station.code})` : ""}`
                : lead.trainInquiry?.train.name ?? "Pengajuan tanpa unit spesifik"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <section className="min-w-0">
          <h5 className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="size-4 text-[var(--work-accent)]" aria-hidden />
            Unit diajukan
          </h5>
          {lead.space ? (
            <>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <Fact
                  label="Stasiun"
                  value={`${lead.space.station.name}${lead.space.station.code ? ` (${lead.space.station.code})` : ""}`}
                  subValue={lead.space.station.line ? `LRT ${lead.space.station.line}` : null}
                />
                <Fact label="Kode · nama" value={`${lead.space.code} · ${lead.space.name}`} />
                <Fact
                  label="Area & lantai"
                  value={`Lantai ${lead.space.floor} · ${lead.space.location}`}
                />
                <Fact
                  label="Tipe · luas"
                  value={`${SPACE_TYPE_LABELS[lead.space.type] ?? lead.space.type} · ${formatArea(lead.space.area)}`}
                  subValue={lead.space.nearestExit ? `Exit ${lead.space.nearestExit}` : null}
                />
                <Fact label="Model sewa" value={STANDARD_LEASING_MODEL} />
              </dl>
              <div className="mt-4 space-y-2 border-t border-[var(--work-line)] pt-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Layers className="size-4 text-[var(--work-accent)]" aria-hidden />
                  Spesifikasi teknis & K3
                </p>
                <dl className="grid gap-3 sm:grid-cols-3">
                  <Fact label="Kelistrikan" value={lead.space.powerSupply || "—"} />
                  <Fact
                    label="Akses air"
                    value={lead.space.waterAccess ? "Tersedia" : "Tidak tersedia"}
                  />
                  <Fact
                    label="AC / Exhaust"
                    value={lead.space.airConditioning ? "Tersedia" : "Tidak tersedia"}
                  />
                </dl>
                <p className="text-xs leading-relaxed text-[var(--work-muted)]">
                  {STANDARD_FIT_OUT_TERMS}
                </p>
              </div>
              {lead.space.station.slug ? (
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link
                    href={`/station/${lead.space.station.slug}?unit=${lead.space.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Compass className="size-4 text-[var(--work-accent)]" aria-hidden />
                    Lihat unit di 360°
                  </Link>
                </Button>
              ) : null}
            </>
          ) : lead.trainInquiry ? (
            <dl className="mt-3 grid gap-3 sm:grid-cols-3">
              <Fact label="Media" value={lead.trainInquiry.mediaTitle} />
              <Fact label="Kode media" value={lead.trainInquiry.mediaCode} />
              <Fact label="Kereta" value={lead.trainInquiry.train.name} />
            </dl>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-[var(--work-muted)]">
              Pengajuan ini belum terikat ke unit stasiun spesifik.
            </p>
          )}
        </section>

        <section className="min-w-0 border-t border-[var(--work-line)] pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h5 className="flex items-center gap-2 text-sm font-semibold">
              <User className="size-4 text-[var(--work-accent)]" aria-hidden />
              Pemohon & kontak mitra
            </h5>
            <Button asChild variant="outline" size="sm">
              <a
                href={whatsappHref(lead.phone, lead.companyName, lead.inquiryCode)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Phone className="size-4 text-emerald-600" aria-hidden />
                WhatsApp
              </a>
            </Button>
          </div>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Fact label="Brand / perusahaan" value={lead.companyName} />
            <Fact label="Nama PIC" value={lead.contactName} />
            <Fact label="Jenis usaha" value={lead.businessType} />
            <Fact label="Telepon / WA" value={lead.phone} subValue={lead.email} />
            <Fact
              label="Site visit"
              value={
                SITE_VISIT_STATUS_LABELS[lead.siteVisitStatus as CommercialSiteVisitStatus] ??
                lead.siteVisitStatus
              }
              subValue={
                lead.siteVisitScheduledAt
                  ? new Date(lead.siteVisitScheduledAt).toLocaleString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Asia/Jakarta",
                    })
                  : null
              }
            />
            <Fact
              label="Diajukan"
              value={new Date(lead.createdAt).toLocaleString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Jakarta",
              })}
            />
          </dl>
          {lead.message ? (
            <p className="mt-3 text-sm leading-relaxed text-[var(--work-text)]">
              <span className="font-semibold">Pesan pemohon: </span>
              {lead.message}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
