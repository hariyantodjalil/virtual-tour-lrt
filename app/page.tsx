/*
  THESIS: Homepage void maroon LRT — brand sebagai hero, alur ketersediaan → tour.
  OWN-WORLD: maroon gelap #1C0A0E (bukan hitam), signal #E31E2D, panel #3A161C; Chakra Petch + Source Sans 3.
  STORY: Mitra masuk dari portal immersif, paham alur, pilih stasiun, masuk tour / hubungi tim.
  FIRST VIEWPORT: atmosphere full-bleed + brand + headline italic accent + CTA pill. Tanpa stats.
  FORM: Superdesign structure adapted to LRT product truth (bukan clone Superdesign.).
*/
import { Suspense } from "react";
import Image from "next/image";
import { ArrowUpRight, Star } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/utils";
import StationGrid from "./StationGrid";
import Navbar from "@/components/Navbar";
import {
  HomeHeroParallax,
  HomeJakartaClock,
  HomeReveal,
  HomeShell,
} from "@/components/home/HomeMotion";

async function getStationsWithStats() {
  try {
    const stations = await prisma.station.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      include: {
        commercialSpaces: { select: { status: true } },
      },
    });

    return stations.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      line: s.line,
      address: s.address,
      dailyPassengers: s.dailyPassengers,
      order: s.order,
      spaceStats: {
        total: s.commercialSpaces.length,
        available: s.commercialSpaces.filter((sp) => sp.status === "TERSEDIA").length,
        occupied: s.commercialSpaces.filter((sp) => sp.status === "TERISI").length,
      },
    }));
  } catch {
    return [];
  }
}

async function getSummaryStats() {
  try {
    const [totalSpaces, availableSpaces, totalStations, totalPassengers] = await Promise.all([
      prisma.commercialSpace.count({ where: { station: { isActive: true } } }),
      prisma.commercialSpace.count({
        where: { status: "TERSEDIA", station: { isActive: true } },
      }),
      prisma.station.count({ where: { isActive: true } }),
      prisma.station.aggregate({ where: { isActive: true }, _sum: { dailyPassengers: true } }),
    ]);
    return {
      totalSpaces,
      availableSpaces,
      totalStations,
      totalPassengers: totalPassengers._sum.dailyPassengers ?? 0,
    };
  } catch {
    return { totalSpaces: 0, availableSpaces: 0, totalStations: 18, totalPassengers: 0 };
  }
}

async function InventoryPulse() {
  const stats = await getSummaryStats();
  const items = [
    { label: "Stasiun aktif", value: stats.totalStations.toString() },
    { label: "Unit komersial", value: stats.totalSpaces.toString() },
    { label: "Unit tersedia", value: stats.availableSpaces.toString(), live: true },
    { label: "Penumpang / hari", value: formatNumber(stats.totalPassengers) },
  ];

  return (
    <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((item, i) => (
        <HomeReveal key={item.label} delayMs={i * 80}>
          <div className="rounded-3xl border border-[color:rgb(255_214_218_/_0.14)] bg-[#3A161C] px-5 py-5">
            <dt className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
              {item.label}
            </dt>
            <dd className="mt-3 flex items-center gap-2 font-display text-3xl font-semibold tracking-tight text-white">
              {item.live && <span className="h-2 w-2 rounded-full bg-[#34d399]" aria-hidden />}
              {item.value}
            </dd>
          </div>
        </HomeReveal>
      ))}
    </dl>
  );
}

async function StationGridSection() {
  const stations = await getStationsWithStats();
  return <StationGrid stations={stations} />;
}

function PulseSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-[104px] animate-pulse rounded-3xl border border-[color:rgb(255_214_218_/_0.14)] bg-[#3A161C]" />
      ))}
    </div>
  );
}

function StationGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="aspect-[5/4] animate-pulse rounded-3xl bg-[#3A161C]" />
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <HomeShell>
      <Navbar variant="dark" />

      {/* Hero */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#1C0A0E] pt-28 pb-20">
        <div className="pointer-events-none absolute inset-0 z-0 select-none">
          <div className="absolute inset-0 opacity-70 mix-blend-screen">
            <Image
              src="/brand/home-night-rail-hero.png"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-center opacity-80"
            />
          </div>
          <div className="absolute inset-0 z-10 bg-gradient-to-b from-transparent via-[#1C0A0E]/40 to-[#1C0A0E]" />
        </div>

        {/* Floating geometric orbs (adapted from surrealist floats) */}
        <div
          aria-hidden
          className="home-float-left pointer-events-none absolute -left-[8%] top-[-8%] z-10 h-[42vw] max-h-[520px] w-[42vw] max-w-[520px] rounded-full border border-white/10 bg-[radial-gradient(circle_at_30%_30%,rgba(227,30,45,0.35),transparent_62%)] opacity-80 mix-blend-hard-light"
        />
        <div
          aria-hidden
          className="home-float-right pointer-events-none absolute -right-[6%] bottom-[-6%] z-10 h-[38vw] max-h-[460px] w-[38vw] max-w-[460px] rounded-full border border-white/10 bg-[radial-gradient(circle_at_70%_40%,rgba(27,58,107,0.55),transparent_65%)] opacity-80 mix-blend-hard-light"
        />

        <div className="relative z-20 container mx-auto flex h-full flex-col items-center justify-center px-6 text-center">
          <HomeHeroParallax>
            <div className="mx-auto max-w-4xl">
              <HomeReveal>
                <h1
                  className="font-display text-5xl font-medium leading-[1.08] tracking-tight text-[#ffe0e0] mix-blend-overlay md:text-7xl"
                  style={{ textShadow: "0 0 12px rgba(255,255,255,0.55)" }}
                >
                  LRT Jabodebek.
                  <br />
                  <span className="font-light italic text-[#ffe0e0]">Virtual tour komersial.</span>
                </h1>
              </HomeReveal>

              <HomeReveal delayMs={180}>
                <div className="mt-10 flex flex-col items-center gap-5">
                  <a
                    href="#deck"
                    className="group relative inline-flex cursor-pointer items-center"
                  >
                    <span className="absolute inset-0 rounded-full bg-[#E31E2D]/25 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-50" />
                    <span className="relative flex items-center gap-3 rounded-full border border-white/20 bg-white/5 px-6 py-2.5 font-display text-xs uppercase tracking-[0.2em] text-white/80 backdrop-blur-sm transition-colors duration-300 hover:bg-white/10 md:text-sm">
                      Cari lokasi brand Anda
                    </span>
                  </a>
                  <HomeJakartaClock />
                </div>
              </HomeReveal>
            </div>
          </HomeHeroParallax>
        </div>
      </section>

      {/* Mission / alur */}
      <section id="alur" className="relative py-28 md:py-36">
        <div className="container mx-auto px-6">
          <HomeReveal>
            <div className="mx-auto max-w-4xl text-center">
              <h2 className="font-display text-3xl leading-tight text-white/90 md:text-5xl lg:text-6xl">
                Temukan spot sewa di jalur penumpang — tanpa survei lapangan dulu.
              </h2>
              <p className="mt-10 font-light text-xl leading-relaxed text-neutral-500 md:text-2xl">
                Bandingkan stasiun, cek unit yang masih terbuka, lalu rasakan lokasinya lewat tour 360°. Keputusan mitra jadi lebih cepat dan percaya diri.
              </p>
            </div>
          </HomeReveal>
        </div>
      </section>

      {/* Define presence cards */}
      <section className="relative overflow-hidden py-24 md:py-36">
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle, #5c2a32 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative z-10 container mx-auto px-6">
          <HomeReveal>
            <h2 className="mb-20 text-center font-display text-5xl md:mb-28 md:text-7xl">
              Mulai dari
              <br />
              <span className="italic">peluang nyata</span>
            </h2>
          </HomeReveal>

          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2">
            <div className="home-parallax-down">
              <HomeReveal>
                <a
                  href="#deck"
                  className="group flex aspect-[4/5] cursor-pointer flex-col justify-between rounded-3xl bg-[#E31E2D] p-8 shadow-2xl transition-all duration-500 hover:shadow-[0_20px_50px_rgba(227,30,45,0.3)] md:p-12"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/10 transition-transform duration-500 group-hover:rotate-45">
                      <Star className="h-6 w-6 text-black" />
                    </div>
                    <span className="rounded-full border border-black/20 px-3 py-1 text-sm font-medium text-black">
                      01
                    </span>
                  </div>
                  <div>
                    <h3 className="font-display text-4xl leading-none tracking-tight text-black md:text-5xl">
                      Lihat unit
                      <br />
                      yang terbuka
                    </h3>
                    <p className="mt-4 text-lg leading-snug text-black/70">
                      Status ketersediaan live di koridor Jabodebek — pilih stasiun dengan peluang sewa yang masih ada.
                    </p>
                  </div>
                  <div className="mt-8 h-px w-full bg-black/10" />
                </a>
              </HomeReveal>
            </div>

            <div className="home-parallax-up md:mt-24">
              <HomeReveal delayMs={140}>
                <a
                  href="#deck"
                  className="group flex aspect-[4/5] cursor-pointer flex-col justify-between rounded-3xl border border-[color:rgb(255_214_218_/_0.14)] bg-[#3A161C] p-8 shadow-2xl transition-all duration-500 hover:border-[#E31E2D]/50 md:p-12"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 transition-transform duration-500 group-hover:scale-110">
                      <ArrowUpRight className="h-6 w-6 -rotate-45 text-white" />
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-sm font-medium text-white/50">
                      02
                    </span>
                  </div>
                  <div>
                    <h3 className="font-display text-4xl leading-none tracking-tight text-white md:text-5xl">
                      Rasakan
                      <br />
                      lokasinya
                    </h3>
                    <p className="mt-4 text-lg leading-snug text-neutral-400">
                      Masuk tour 360°, tinjau unit di tempatnya, lalu ajukan minat sewa ke tim komersial.
                    </p>
                  </div>
                  <div className="mt-8 h-px w-full bg-white/10" />
                </a>
              </HomeReveal>
            </div>
          </div>
        </div>
      </section>

      {/* Deck */}
      <main id="deck" className="relative container mx-auto px-6 py-24 md:py-32">
        <HomeReveal>
          <div className="mb-12 max-w-2xl">
            <h2 className="font-display text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Pilih stasiun untuk brand Anda
            </h2>
            <p className="mt-4 text-lg text-white/45">
              Data penumpang dan unit tersedia siap pakai. Saat lokasi cocok, langsung masuk virtual tour dari kartu stasiun.
            </p>
          </div>
        </HomeReveal>

        <div className="mb-12">
          <Suspense fallback={<PulseSkeleton />}>
            <InventoryPulse />
          </Suspense>
        </div>

        <Suspense fallback={<StationGridSkeleton />}>
          <StationGridSection />
        </Suspense>
      </main>

      {/* Footer / contact */}
      <footer
        id="kontak"
        className="relative overflow-hidden border-t border-[color:rgb(255_214_218_/_0.1)] bg-[#1C0A0E] py-20"
      >
        <div className="relative z-10 container mx-auto px-6">
          <div className="flex flex-col items-start justify-between gap-12 md:flex-row md:items-end">
            <div>
              <HomeReveal>
                <h2 className="pointer-events-none select-none font-display text-[12vw] leading-[0.8] font-bold tracking-tighter text-white/10 md:text-[8vw]">
                  LRT.
                </h2>
              </HomeReveal>
              <HomeReveal delayMs={100}>
                <p className="mt-6 max-w-md text-white/50">
                  Siap diskusi lokasi dan paket sewa? Tim komersial LRT Jabodebek siap menyesuaikan stasiun dan unit dengan kebutuhan brand Anda.
                </p>
                <a
                  href="https://wa.me/628118012012?text=Halo%2C%20saya%20tertarik%20dengan%20ruang%20komersial%20LRT%20Jabodebek"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-[#E31E2D] px-6 font-display text-sm font-bold text-white transition hover:bg-[#c41926]"
                >
                  Hubungi via WhatsApp
                </a>
              </HomeReveal>
            </div>
            <div className="flex flex-col gap-3 text-right text-neutral-500">
              <a href="tel:+622180800000" className="transition-colors hover:text-white">
                Telepon tim
              </a>
              <a href="#deck" className="transition-colors hover:text-white">
                Deck stasiun
              </a>
              <p className="mt-4 text-sm text-neutral-600">© {new Date().getFullYear()} LRT Jabodebek Virtual Tour</p>
            </div>
          </div>
        </div>
      </footer>
    </HomeShell>
  );
}
