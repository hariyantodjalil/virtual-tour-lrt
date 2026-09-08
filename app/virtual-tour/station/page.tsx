import Image from "next/image";
import Link from "next/link";
import { MapPinned, ArrowLeft } from "lucide-react";
import VirtualTourNavbar from "@/components/VirtualTourNavbar";
import StationPickerCard from "@/components/tour/StationPickerCard";
import { HomeReveal, HomeShell } from "@/components/home/HomeMotion";
import { getPickerStations } from "@/lib/station-picker-data";
import { STATION_TOUR_ENTRY } from "@/lib/tour-nav";

export const metadata = {
  title: "Pilih Stasiun - Virtual Tour LRT Jabodebek",
  description: "Pilih stasiun LRT Jabodebek untuk memulai virtual tour 360°.",
};

export const dynamic = "force-dynamic";

/** Halaman pemilih stasiun — diakses dari CTA Virtual Tour di landing komersial. */
export default async function StationPickerPage() {
  const stations = await getPickerStations();

  return (
    <HomeShell>
      <VirtualTourNavbar />

      <section className="relative min-h-[100svh] overflow-hidden bg-[#1a1a1a] pt-24 pb-16">
        <div className="pointer-events-none absolute inset-0">
          <Image
            src="/brand/landing/hero-station.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-6xl px-5 md:px-10">
          <HomeReveal>
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                Virtual Tour 360°
              </p>
              <h1 className="mt-3 font-display text-2xl font-bold leading-tight text-white sm:text-3xl md:text-[40px]">
                Pilih <span className="text-[#ff6b6b]">Stasiun</span>
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/90 md:text-base">
                Pilih stasiun untuk memulai pengalaman virtual tour interaktif.
              </p>
            </div>
          </HomeReveal>

          <HomeReveal delayMs={60}>
            <div className="mt-6 flex justify-center">
              <Link
                href={STATION_TOUR_ENTRY}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-4 py-2 text-xs font-medium text-white/90 backdrop-blur-sm transition hover:border-white/40 hover:bg-black/45"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Kembali ke beranda komersial
              </Link>
            </div>
          </HomeReveal>

          {stations.length > 0 ? (
            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {stations.map((station, index) => (
                <HomeReveal key={station.slug} delayMs={80 + (index % 3) * 60}>
                  <Link href={`/station/${station.slug}`} className="group block h-full">
                    <StationPickerCard station={station} variant="dark" />
                  </Link>
                </HomeReveal>
              ))}
            </div>
          ) : (
            <HomeReveal delayMs={120}>
              <div className="mt-12 rounded-2xl border border-white/15 bg-black/40 px-6 py-14 text-center backdrop-blur-sm">
                <MapPinned className="mx-auto h-10 w-10 text-[#ff8a8a]" />
                <p className="mt-4 text-sm text-white/80">
                  Belum ada stasiun dengan virtual tour yang aktif.
                </p>
              </div>
            </HomeReveal>
          )}
        </div>
      </section>
    </HomeShell>
  );
}
