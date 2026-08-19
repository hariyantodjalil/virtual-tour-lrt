import Image from "next/image";
import Link from "next/link";
import { ShieldAlert, Clock, ArrowRight, MessageSquare, Wrench } from "lucide-react";
import { getMaintenanceConfig } from "@/lib/maintenance";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MaintenancePage() {
  const config = await getMaintenanceConfig();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#070e1b] px-4 py-12 text-slate-100 selection:bg-rose-500 selection:text-white">
      {/* Background radial glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-rose-600/15 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-sky-600/10 blur-[140px]" />

      <div className="relative z-10 mx-auto w-full max-w-xl text-center">
        {/* Logo LRT Jabodebek */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white p-1.5 shadow-lg shadow-white/10 ring-1 ring-white/20">
            <div className="relative h-full w-full">
              <Image
                src="/brand/landing/logo-lrt-footer.png"
                alt="LRT Jabodebek"
                fill
                priority
                className="object-contain"
                sizes="44px"
              />
            </div>
          </div>
          <div className="text-left">
            <h2 className="text-sm font-bold tracking-tight text-white">LRT JABODEBEK</h2>
            <p className="text-[11px] font-medium text-slate-400">Platform Virtual Tour & Ruang Komersial</p>
          </div>
        </div>

        {/* Main Card */}
        <div className="relative rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl md:p-10">
          {/* Mascot Reno Announce */}
          <div className="relative mx-auto -mt-2 mb-4 flex justify-center">
            <div className="relative h-44 w-44 sm:h-52 sm:w-52 transition-transform duration-300 hover:scale-105">
              <Image
                src="/brand/landing/mascot-reno-announce.png"
                alt="Maskot Reno LRT Jabodebek"
                fill
                priority
                className="object-contain drop-shadow-[0_15px_25px_rgba(227,30,45,0.25)]"
                sizes="(max-width: 640px) 176px, 208px"
              />
            </div>
          </div>

          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3.5 py-1 text-xs font-semibold text-rose-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
            </span>
            <Wrench className="h-3 w-3" />
            Mode Pemeliharaan Sistem
          </div>

          <h1 className="mb-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Sistem Sedang Ditingkatkan
          </h1>

          <p className="mb-6 text-xs leading-relaxed text-slate-300 sm:text-sm">
            {config.maintenanceMessage}
          </p>

          {/* Info Features */}
          <div className="mb-6 grid gap-2.5 text-left sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-slate-950/60 p-3.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
              <div>
                <h3 className="text-xs font-semibold text-slate-200">Peningkatan Performa</h3>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Optimalisasi aset 3D 360° & keandalan server virtual tour.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-slate-950/60 p-3.5">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <div>
                <h3 className="text-xs font-semibold text-slate-200">Data Aman Terjaga</h3>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Seluruh data unit dan survei tetap aman di database.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <a
              href="https://wa.me/628118012012?text=Halo%20Tim%20Komersial%20LRT%20Jabodebek%2C%20saya%20ingin%20menanyakan%20informasi%20ruang%20komersial."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition-all hover:bg-emerald-500 shadow-lg shadow-emerald-900/30"
            >
              <MessageSquare className="h-4 w-4" />
              Hubungi Tim Komersial via WhatsApp
            </a>

            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 transition-all hover:border-slate-600 hover:bg-slate-700 hover:text-white"
            >
              Login Administrator
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-[11px] text-slate-500">
          © {new Date().getFullYear()} PT Kereta Api Indonesia (Persero) — Divisi LRT Jabodebek
        </p>
      </div>
    </div>
  );
}
