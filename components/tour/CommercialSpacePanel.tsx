"use client";

import { useEffect, useState } from "react";
import {
  X, Building2, MapPin, Zap, Droplets, Wind, Users,
  MessageCircle, Download, CheckCircle, XCircle, AlertCircle, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRupiah, formatNumber, getWhatsAppUrl } from "@/lib/utils";
import TenantInterestForm from "./TenantInterestForm";
import type { SpaceAvailabilityStatus } from "@/lib/space-availability";
import { useCommercialProfile } from "@/components/commercial/CommercialProfileProvider";

type CommercialSpace = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: SpaceAvailabilityStatus;
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
};

export default function CommercialSpacePanel({ space, stationName, contactPhone, onClose }: Props) {
  const commercialProfile = useCommercialProfile();
  const resolvedContactPhone =
    contactPhone || commercialProfile.whatsappNumber;
  const [showForm, setShowForm] = useState(false);

  const waMessage = `Halo, saya tertarik dengan unit komersial ${space.code} (${space.name}) di Stasiun ${stationName}. Mohon informasi lebih lanjut.`;
  const waUrl = getWhatsAppUrl(resolvedContactPhone, waMessage);
  const statusConfig = {
    TERSEDIA: {
      label: "Tersedia",
      variant: "available" as const,
      icon: <CheckCircle className="h-3.5 w-3.5" />,
      color: "text-emerald-600",
    },
    TERISI: {
      label: "Terisi",
      variant: "occupied" as const,
      icon: <XCircle className="h-3.5 w-3.5" />,
      color: "text-red-600",
    },
    RESERVED: {
      label: "Reserved",
      variant: "occupied" as const,
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      color: "text-indigo-600",
    },
    FIT_OUT: {
      label: "Fit-Out",
      variant: "maintenance" as const,
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      color: "text-violet-600",
    },
    MAINTENANCE: {
      label: "Maintenance",
      variant: "maintenance" as const,
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      color: "text-amber-600",
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
            .brand { color: #D81435; font-weight: 800; letter-spacing: .08em; font-size: 12px; text-transform: uppercase; }
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
            @media print { body { margin: 28px; } }
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
          <div class="cta">
            Hubungi ${commercialProfile.teamName}: ${resolvedContactPhone}. Ringkasan ini dibuat otomatis dari data aset virtual tour.
          </div>
          <script>window.onload = () => setTimeout(() => window.print(), 250);</script>
        </body>
      </html>
    `);
    popup.document.close();
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl overflow-hidden border border-gray-200 shadow-lg">
      {/* Header */}
      <div className="bg-[#1B3A6B] px-5 py-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={statusConfig.variant} className="flex items-center gap-1">
              {statusConfig.icon}
              {statusConfig.label}
            </Badge>
            <span className="text-xs text-white/60 font-mono">{space.code}</span>
          </div>
          <h3 className="text-lg font-bold text-white">{space.name}</h3>
          <p className="text-sm text-white/70">{stationName}</p>
        </div>
        <button
          onClick={onClose}
          className="ml-4 rounded-full p-1.5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Description */}
        {space.description && (
          <p className="text-sm text-gray-600 leading-relaxed">{space.description}</p>
        )}

        {/* Key specs grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500 mb-1">Luas</p>
            <p className="text-lg font-bold text-gray-900">{space.area} m²</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500 mb-1">Lantai</p>
            <p className="text-lg font-bold text-gray-900">Lantai {space.floor}</p>
          </div>
          {space.deposit > 0 && (
            <div className="rounded-lg bg-gray-50 p-3 col-span-2">
              <p className="text-xs text-gray-500 mb-1">Deposit</p>
              <p className="text-lg font-bold text-gray-900">{formatRupiah(space.deposit)}</p>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3 text-gray-600">
            <Building2 className="h-4 w-4 shrink-0 text-[#1B3A6B]" />
            <div>
              <span className="text-xs text-gray-400 block">Tipe</span>
              <span className="font-medium">{TYPE_LABELS[space.type] ?? space.type}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-gray-600">
            <MapPin className="h-4 w-4 shrink-0 text-[#1B3A6B]" />
            <div>
              <span className="text-xs text-gray-400 block">Lokasi</span>
              <span className="font-medium">
                {space.location}
                {space.nearestExit && ` · ${space.nearestExit}`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-gray-600">
            <Users className="h-4 w-4 shrink-0 text-[#D81435]" />
            <div>
              <span className="text-xs text-gray-400 block">Eksposur Penumpang</span>
              <span className="font-bold text-[#D81435]">{formatNumber(Math.round(space.exposure))} orang/hari</span>
            </div>
          </div>
        </div>

        {/* Facilities */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Fasilitas</p>
          <div className="flex flex-wrap gap-2">
            {space.powerSupply && (
              <div className="flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-700 font-medium">
                <Zap className="h-3 w-3" />
                {space.powerSupply}
              </div>
            )}
            {space.waterAccess && (
              <div className="flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs text-blue-700 font-medium">
                <Droplets className="h-3 w-3" />
                Air Bersih
              </div>
            )}
            {space.airConditioning && (
              <div className="flex items-center gap-1.5 rounded-full bg-cyan-50 border border-cyan-200 px-3 py-1.5 text-xs text-cyan-700 font-medium">
                <Wind className="h-3 w-3" />
                AC
              </div>
            )}
          </div>
        </div>

        {/* Form expand */}
        {showForm && space.status === "TERSEDIA" && (
          <TenantInterestForm spaceId={space.id} spaceCode={space.code} stationName={stationName} onSuccess={() => setShowForm(false)} />
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-100 space-y-2">
        {space.status === "TERSEDIA" ? (
          <>
            <Button
              className="w-full"
              onClick={() => { setShowForm(!showForm); trackEvent("FORM_SUBMIT"); }}
            >
              {showForm ? "Tutup Formulir" : "Ajukan Minat Sewa"}
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
          <div className="text-center py-2">
            <p className="text-sm text-gray-500 mb-3">
              {space.status === "TERISI" ? "Unit ini sedang dihuni. Daftarkan minat Anda untuk mendapat notifikasi." : "Unit sedang dalam perbaikan."}
            </p>
            <Button variant="outline" className="w-full" asChild>
              <a href={waUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" />
                Tanya Tim Komersial
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
