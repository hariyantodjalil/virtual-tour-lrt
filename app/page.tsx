import PublicContactFab from "@/components/PublicContactFab";
import TourLanguageProvider from "@/components/tour/TourLanguageProvider";
import { getTourLanguageData, getTourTranslator } from "@/lib/tour-translated-content";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { STATION_TOUR_ENTRY, TRAIN_TOUR_LANDING } from "@/lib/tour-nav";
import VirtualTourNavbar from "@/components/VirtualTourNavbar";
import { HomeReveal, HomeShell } from "@/components/home/HomeMotion";
import { MapPinned, TrainFront } from "lucide-react";

export async function generateMetadata() {
  const t = await getTourTranslator();
  return { title: t("Virtual Tour - LRT Jabodebek"), description: t("Pilih Station Virtual Tour atau Train Virtual Tour LRT Jabodebek.") };
}

export const dynamic = "force-dynamic";

async function getStationCount() {
  try {
    return await prisma.station.count({
      where: { isActive: true, virtualTourScenes: { some: { isActive: true } } },
    });
  } catch {
    return 0;
  }
}

export default async function VirtualTourLandingPage() {
  const t = await getTourTranslator();
  const stationCount = await getStationCount();

  return (
    <TourLanguageProvider {...await getTourLanguageData()}>
      <HomeShell>
        <VirtualTourNavbar />

        <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-[#1a1a1a] pt-24 pb-16">
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

          <div className="relative z-10 mx-auto w-full max-w-5xl px-5 md:px-10">
            <HomeReveal>
              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">LRT Jabodebek</p>
                <h1 className="mt-3 font-display text-2xl font-bold leading-tight text-white sm:text-3xl md:text-[40px]">
                  {t("Pilih Pengalaman Virtual Tour")}
                </h1>
                <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/90 md:text-base">
                  {t("Jelajahi interior stasiun atau kabin kereta LRT Jabodebek dalam tampilan 360° interaktif.")}
                </p>
              </div>
            </HomeReveal>

            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              <HomeReveal delayMs={80}>
                <Link
                  href={STATION_TOUR_ENTRY}
                  className="group relative flex min-h-[280px] flex-col overflow-hidden rounded-2xl border border-white/15 bg-black/40 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm transition hover:border-[#d32f2f]/60 hover:bg-black/50"
                >
                  <div className="relative h-40 w-full overflow-hidden">
                    <Image
                      src="/brand/landing/tour-360.jpg"
                      alt="Station Virtual Tour"
                      fill
                      sizes="(max-width: 640px) 100vw, 50vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center gap-2 text-[#ff8a8a]">
                      <MapPinned className="h-5 w-5" />
                      <span className="text-xs font-semibold uppercase tracking-wide">{t("Stasiun")}</span>
                    </div>
                    <h2 className="mt-2 font-display text-xl font-bold text-white">Station Virtual Tour</h2>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-white/75">
                      {t("Telusuri concourse, peron, fasilitas, dan area komersial di {count} stasiun LRT Jabodebek.", { count: stationCount || 18 })}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white group-hover:text-[#ff8a8a]">
                      {t("Pilih Stasiun")}
                      <span aria-hidden className="transition group-hover:translate-x-1">
                        →
                      </span>
                    </span>
                  </div>
                </Link>
              </HomeReveal>

              <HomeReveal delayMs={160}>
                <Link
                  href={TRAIN_TOUR_LANDING}
                  className="group relative flex min-h-[280px] flex-col overflow-hidden rounded-2xl border border-white/15 bg-black/40 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm transition hover:border-[#d32f2f]/60 hover:bg-black/50"
                >
                  <div className="relative h-40 w-full overflow-hidden">
                    <Image
                      src="/brand/landing/hero-train-station.jpg"
                      alt="Train Virtual Tour"
                      fill
                      sizes="(max-width: 640px) 100vw, 50vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center gap-2 text-[#ff8a8a]">
                      <TrainFront className="h-5 w-5" />
                      <span className="text-xs font-semibold uppercase tracking-wide">{t("Kereta")}</span>
                    </div>
                    <h2 className="mt-2 font-display text-xl font-bold text-white">Train Virtual Tour</h2>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-white/75">
                      {t("Masuki interior kereta LRT Jabodebek — jelajahi gerbong dan fasilitas penumpang secara virtual.")}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white group-hover:text-[#ff8a8a]">
                      {t("Jelajahi Kereta")}
                      <span aria-hidden className="transition group-hover:translate-x-1">
                        →
                      </span>
                    </span>
                  </div>
                </Link>
              </HomeReveal>
            </div>
          </div>
        </section>
      </HomeShell>
      <PublicContactFab localized />
    </TourLanguageProvider>
  );
}
