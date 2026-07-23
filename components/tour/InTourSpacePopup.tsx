"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle,
  Download,
  Droplets,
  MapPin,
  MessageCircle,
  Users,
  Wind,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber, formatRupiah, getWhatsAppUrl } from "@/lib/utils";
import TenantInterestForm from "./TenantInterestForm";

type CommercialSpace = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: "TERSEDIA" | "TERISI" | "MAINTENANCE";
  area: number;
  deposit: number;
  floor: string;
  location: string;
  nearestExit: string | null;
  exposure: number;
  powerSupply: string | null;
  waterAccess: boolean;
  airConditioning: boolean;
  description: string | null;
  tenantBrand?: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  KIOS: "Kios",
  RUKO: "Ruko",
  ATM: "ATM",
  VENDING: "Vending Machine",
  MEDIA_IKLAN: "Media Iklan",
  AREA_PROMOSI: "Area Promosi",
};

type Props = {
  space: CommercialSpace;
  stationName: string;
  contactPhone?: string;
  onClose: () => void;
  returnToList?: boolean;
};

export default function InTourSpacePopup({ space, stationName, contactPhone = "628118012012", onClose, returnToList = false }: Props) {
  const [showInterestModal, setShowInterestModal] = useState(false);
  const waMessage = `Halo, saya tertarik dengan unit komersial ${space.code} (${space.name}) di Stasiun ${stationName}. Mohon informasi lebih lanjut.`;
  const waUrl = getWhatsAppUrl(contactPhone, waMessage);

  const statusConfig = {
    TERSEDIA: {
      label: "Tersedia",
      variant: "available" as const,
      icon: <CheckCircle className="h-3.5 w-3.5" />,
    },
    TERISI: {
      label: "Terisi",
      variant: "occupied" as const,
      icon: <XCircle className="h-3.5 w-3.5" />,
    },
    MAINTENANCE: {
      label: "Maintenance",
      variant: "maintenance" as const,
      icon: <AlertCircle className="h-3.5 w-3.5" />,
    },
  }[space.status];

  const trackEvent = async (eventType: string) => {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, spaceId: space.id }),
    }).catch(() => null);
  };

  useEffect(() => {
    trackEvent("SPACE_VIEW");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space.id]);

  const handleDownloadSummary = () => {
    trackEvent("PDF_DOWNLOAD");
    const popup = window.open("", "_blank", "width=900,height=1200");
    if (!popup) return;

    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Ringkasan ${space.code} - ${stationName}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; margin: 40px; }
            .brand { color: #E31E2D; font-weight: 800; letter-spacing: .08em; font-size: 12px; text-transform: uppercase; }
            h1 { margin: 8px 0 4px; font-size: 30px; color: #17355f; }
            .muted { color: #6b7280; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin: 24px 0; }
            .box { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; }
            .label { color: #6b7280; font-size: 12px; margin-bottom: 4px; }
            .value { font-size: 18px; font-weight: 800; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            td { border-bottom: 1px solid #e5e7eb; padding: 10px 0; }
            td:first-child { color: #6b7280; width: 38%; }
            .cta { margin-top: 28px; padding: 18px; background: #17355f; color: white; border-radius: 14px; }
          </style>
        </head>
        <body>
          <div class="brand">LRT Jabodebek - Virtual Tour Komersial</div>
          <h1>${space.name}</h1>
          <div class="muted">${space.code} - Stasiun ${stationName} - ${TYPE_LABELS[space.type] ?? space.type}</div>
          <div class="grid">
            <div class="box"><div class="label">Status</div><div class="value">${statusConfig.label}</div></div>
            <div class="box"><div class="label">Luas</div><div class="value">${space.area} m2</div></div>
            <div class="box"><div class="label">Eksposur</div><div class="value">${formatNumber(Math.round(space.exposure))} orang/hari</div></div>
          </div>
          <table>
            <tr><td>Lokasi</td><td>${space.location}</td></tr>
            <tr><td>Lantai</td><td>${space.floor}</td></tr>
            <tr><td>Exit Terdekat</td><td>${space.nearestExit ?? "-"}</td></tr>
            <tr><td>Deposit</td><td>${formatRupiah(space.deposit)}</td></tr>
            <tr><td>Daya Listrik</td><td>${space.powerSupply ?? "-"}</td></tr>
            <tr><td>Air Bersih</td><td>${space.waterAccess ? "Tersedia" : "Tidak tersedia"}</td></tr>
            <tr><td>AC</td><td>${space.airConditioning ? "Tersedia" : "Tidak tersedia"}</td></tr>
            <tr><td>Catatan</td><td>${space.description ?? "Unit siap dievaluasi melalui virtual tour 360."}</td></tr>
          </table>
          <div class="cta">Hubungi tim komersial: ${contactPhone}. Ringkasan ini dibuat otomatis dari data aset virtual tour.</div>
          <script>window.onload = () => setTimeout(() => window.print(), 250);</script>
        </body>
      </html>
    `);
    popup.document.close();
  };

  return (
    <div className="pointer-events-auto absolute inset-x-3 bottom-4 top-20 z-50 overflow-hidden rounded-2xl border border-[color:rgb(255_214_218_/_0.14)] bg-[#F8ECEE] shadow-[0_24px_60px_rgba(28,10,14,0.5)] backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:top-24 sm:bottom-6 sm:w-[410px] lg:w-[420px]">
      <div className="flex h-full max-h-[inherit] flex-col">
        <div className="flex items-start justify-between bg-[#1C0A0E] px-5 py-4 text-[#F8ECEE]">
          <div className="min-w-0 flex-1">
            {returnToList && (
              <button
                type="button"
                onClick={onClose}
                className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white/70 transition-colors hover:text-white"
              >
                <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                Kembali ke Daftar Unit
              </button>
            )}
            <div className="mb-2 flex items-center gap-2">
              <Badge variant={statusConfig.variant} className="flex items-center gap-1 border-white/20 bg-white/95">
                {statusConfig.icon}
                {statusConfig.label}
              </Badge>
              <span className="font-mono text-xs text-white/60">{space.code}</span>
            </div>
            <h3 className="text-xl font-black leading-tight">{space.name}</h3>
            {space.tenantBrand && space.status === "TERISI" && (
              <p className="mt-1 text-sm font-semibold text-[#E31E2D]">
                Tenant: {space.tenantBrand}
              </p>
            )}
            <p className="text-sm text-white/70">{stationName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Tutup detail unit"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {space.description && <p className="text-sm leading-relaxed text-gray-600">{space.description}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Luas</p>
              <p className="text-lg font-black text-gray-900">{space.area} m2</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Lantai</p>
              <p className="text-lg font-black text-gray-900">Lantai {space.floor}</p>
            </div>
            {space.deposit > 0 && (
              <div className="col-span-2 rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Deposit</p>
                <p className="text-lg font-black text-gray-900">{formatRupiah(space.deposit)}</p>
              </div>
            )}
          </div>

          <div className="grid gap-3 text-sm">
            <div className="flex items-center gap-3 text-gray-600">
              <Building2 className="h-4 w-4 shrink-0 text-[#17355f]" />
              <div>
                <span className="block text-xs text-gray-400">Tipe</span>
                <span className="font-medium">{TYPE_LABELS[space.type] ?? space.type}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <MapPin className="h-4 w-4 shrink-0 text-[#17355f]" />
              <div>
                <span className="block text-xs text-gray-400">Lokasi</span>
                <span className="font-medium">
                  {space.location}
                  {space.nearestExit && ` - ${space.nearestExit}`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <Users className="h-4 w-4 shrink-0 text-[#E31E2D]" />
              <div>
                <span className="block text-xs text-gray-400">Eksposur Penumpang</span>
                <span className="font-black text-[#E31E2D]">{formatNumber(Math.round(space.exposure))} orang/hari</span>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Fasilitas</p>
            <div className="flex flex-wrap gap-2">
              {space.powerSupply && (
                <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                  <Zap className="h-3 w-3" />
                  {space.powerSupply}
                </div>
              )}
              {space.waterAccess && (
                <div className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                  <Droplets className="h-3 w-3" />
                  Air Bersih
                </div>
              )}
              {space.airConditioning && (
                <div className="flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-700">
                  <Wind className="h-3 w-3" />
                  AC
                </div>
              )}
            </div>
          </div>

        </div>

        <div className="space-y-2 border-t border-gray-100 bg-white p-4">
          {space.status === "TERSEDIA" ? (
            <>
              <Button
                className="w-full"
                onClick={() => {
                  setShowInterestModal(true);
                }}
              >
                Ajukan Minat Sewa
                <ArrowRight className="h-4 w-4" />
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="whatsapp" size="sm" asChild>
                  <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent("WHATSAPP_CLICK")}>
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </a>
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadSummary}>
                  <Download className="h-4 w-4" />
                  Unduh PDF
                </Button>
              </div>
            </>
          ) : (
            <Button variant="outline" className="w-full" asChild>
              <a href={waUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" />
                Tanya Tim Komersial
              </a>
            </Button>
          )}
        </div>
      </div>

      {showInterestModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#020817]/78 p-4 backdrop-blur-md sm:p-6">
          <div className="relative grid max-h-[calc(100vh-48px)] w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/20 bg-white shadow-2xl md:grid-cols-[390px_minmax(0,1fr)]">
            <div className="hidden bg-[#102a4d] p-8 text-white md:block">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/12 px-3 py-1 text-xs font-black text-emerald-200">
                {statusConfig.icon}
                {statusConfig.label}
              </div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/45">Formulir Tenant</p>
              <h2 className="mt-3 text-4xl font-black leading-tight">{space.name}</h2>
              {space.tenantBrand && space.status === "TERISI" && (
                <p className="mt-2 text-lg font-semibold text-[#E31E2D]">
                  Tenant: {space.tenantBrand}
                </p>
              )}
              <p className="mt-4 text-lg leading-relaxed text-white/68">
                {space.code} - Stasiun {stationName}
              </p>

              <div className="mt-10 space-y-4">
                <div className="rounded-2xl bg-white/10 p-5">
                  <p className="text-sm text-white/50">Luas</p>
                  <p className="text-3xl font-black">{space.area} m2</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-5">
                  <p className="text-sm text-white/50">Eksposur</p>
                  <p className="text-3xl font-black">{formatNumber(Math.round(space.exposure))}</p>
                  <p className="text-lg font-black">orang/hari</p>
                </div>
              </div>

              <p className="mt-10 text-base leading-relaxed text-white/65">
                Isi data kontak di sebelah kanan. Setelah terkirim, lead akan tersimpan di database dan masuk pipeline CMS.
              </p>
            </div>

            <div className="max-h-[calc(100vh-48px)] overflow-y-auto p-6 sm:p-8 lg:p-10">
              <button
                type="button"
                onClick={() => setShowInterestModal(false)}
                className="absolute right-5 top-5 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                aria-label="Tutup formulir minat"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mb-8 pr-10">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#E31E2D]">Ajukan Minat Sewa</p>
                <h3 className="mt-2 text-4xl font-black leading-tight text-gray-950">Data Calon Tenant</h3>
                <p className="mt-3 max-w-xl text-base leading-relaxed text-gray-500">
                  Form ini khusus untuk unit {space.code} di Stasiun {stationName}.
                </p>
              </div>

              <TenantInterestForm
                spaceId={space.id}
                spaceCode={space.code}
                stationName={stationName}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
