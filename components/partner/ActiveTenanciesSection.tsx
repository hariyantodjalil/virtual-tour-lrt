"use client";

import Image from "next/image";
import Link from "next/link";
import { Building2, CalendarDays, Glasses, MapPin, Store } from "lucide-react";
import { getS3ProxyUrl } from "@/lib/s3-utils";

export type ActiveTenancy = {
  id: string;
  brandName: string;
  logoUrl: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  station: {
    id: string;
    name: string;
    slug: string;
    line: string;
  };
  occupancies: Array<{
    id: string;
    startDate: string | null;
    space: {
      id: string;
      code: string;
      name: string;
      type: string;
      area: number;
      floor: string;
      location: string;
      panoramaUrl: string | null;
      status: string;
    };
  }>;
};

function formatDate(value: string | null) {
  if (!value) return "Tanggal mulai belum dicatat";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ActiveTenanciesSection({
  displayName,
  tenancies,
  loading,
}: {
  displayName: string;
  tenancies: ActiveTenancy[];
  loading: boolean;
}) {
  const totalUnits = tenancies.reduce(
    (total, tenant) => total + tenant.occupancies.length,
    0
  );

  return (
    <>
      <div>
        <p className="text-base text-slate-600 md:text-lg">
          Halo, <span className="font-semibold text-[#101828]">{displayName}</span>
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#101828] md:text-[28px]">
          Unit Aktif Saya
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Daftar brand dan ruang komersial yang sudah memasuki tahap operasional.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Building2 className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Brand Aktif
              </p>
              <p className="text-2xl font-bold text-[#101828]">{tenancies.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <Store className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Unit Beroperasi
              </p>
              <p className="text-2xl font-bold text-[#101828]">{totalUnits}</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
          Memuat unit aktif...
        </div>
      ) : tenancies.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <Building2 className="mx-auto size-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-bold text-[#101828]">
            Belum ada unit yang beroperasi
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Unit akan muncul otomatis ketika admin mengubah pengajuan Anda ke
            Operasional Komersial.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {tenancies.map((tenant) => (
            <section
              key={tenant.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  {tenant.logoUrl ? (
                    <span className="relative size-12 overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <Image
                        src={getS3ProxyUrl(tenant.logoUrl)}
                        alt={tenant.brandName}
                        fill
                        sizes="48px"
                        className="object-contain p-1"
                        unoptimized={getS3ProxyUrl(tenant.logoUrl).startsWith("/api/")}
                      />
                    </span>
                  ) : (
                    <span className="flex size-12 items-center justify-center rounded-xl bg-[#c41230]/10 font-bold text-[#c41230]">
                      {tenant.brandName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <h2 className="font-bold text-[#101828]">{tenant.brandName}</h2>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="size-3.5" />
                      {tenant.station.name} · {tenant.station.line}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Operasional
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {tenant.occupancies.map((occupancy) => (
                  <div
                    key={occupancy.id}
                    className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-[#101828]">
                        {occupancy.space.code} — {occupancy.space.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {occupancy.space.floor} · {occupancy.space.location} ·{" "}
                        {occupancy.space.area} m²
                      </p>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                        <CalendarDays className="size-3.5 text-emerald-600" />
                        Aktif sejak {formatDate(occupancy.startDate)}
                      </p>
                    </div>
                    <Link
                      href={`/station/${tenant.station.slug}?unit=${occupancy.space.id}`}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#c41230] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                    >
                      <Glasses className="size-4" />
                      Lihat di Virtual Tour
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
