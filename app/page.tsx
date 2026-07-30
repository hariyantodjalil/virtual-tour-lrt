/*
  Homepage sesuai frame Figma node 178:1069 —
  hero station → intro → kenapa LRT → virtual tour → langkah → area komersial → footer.
*/
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import { HomeReveal, HomeShell } from "@/components/home/HomeMotion";
import CommercialSpaceGrid from "./CommercialSpaceGrid";

/** Runtime DB fetch — jangan prerender saat docker build (DATABASE_URL palsu → list kosong). */
export const dynamic = "force-dynamic";

const TRANSPORT = [
  { label: "KRL", icon: "/brand/landing/icons/transport-krl.png" },
  { label: "MRT", icon: "/brand/landing/icons/transport-mrt.png" },
  { label: "Trans Jakarta", icon: "/brand/landing/icons/transport-tj.png" },
  { label: "Angkutan Lainnya", icon: "/brand/landing/icons/transport-other.png" },
] as const;

const WHY_CARDS = [
  {
    title: "Mobilitas Penumpang Tinggi",
    body: "Menjangkau lebih dari +500.000 penumpang setiap hari, memberikan peluang eksposur yang luas bagi bisnis dan media promosi anda.",
    icon: "/brand/landing/icons/feature-mobility.png",
  },
  {
    title: "Lokasi Strategis",
    body: "Berada di kawasan strategis yang mencakup pusat aktivitas, perkantoran, permukiman, dan pusat perbelanjaan, dengan fasilitas stasiun yang mendukung kenyamanan perjalanan.",
    icon: "/brand/landing/icons/feature-location.png",
  },
  {
    title: "Peluang Bisnis",
    body: "Menjangkau lebih dari +500.000 penumpang setiap hari, memberikan peluang eksposur yang luas bagi bisnis dan media promosi anda.",
    icon: "/brand/landing/icons/feature-business.png",
  },
] as const;

const STEPS = [
  {
    n: "1",
    title: "Pilih Space dan Kategori",
    body: "Temukan area komersial yang sesuai dengan kebutuhan Anda, mulai dari tenant, media promosi, hingga ruang usaha lainnya.",
    icon: "/brand/landing/steps/step-1.png",
  },
  {
    n: "2",
    title: "Ajukan Penyewaan",
    body: "Isi formulir pengajuan secara online dengan melengkapi data yang diperlukan.",
    icon: "/brand/landing/steps/step-2.png",
  },
  {
    n: "3",
    title: "Tunggu Konfirmasi Dari Petugas",
    body: "Petugas akan meninjau pengajuan Anda dan menghubungi Anda untuk proses selanjutnya.",
    icon: "/brand/landing/steps/step-3.png",
  },
  {
    n: "4",
    title: "Penyewaan Berhasil",
    body: "Proses pengajuan Anda telah selesai dan area komersial siap digunakan.",
    icon: "/brand/landing/steps/step-4.png",
  },
] as const;

const CHART_BARS = [
  { label: "S", h: "38%" },
  { label: "S", h: "55%" },
  { label: "R", h: "72%" },
  { label: "K", h: "48%" },
  { label: "J", h: "85%" },
  { label: "J", h: "63%" },
  { label: "A", h: "70%" },
] as const;

const FOOTER_LINKS = [
  { href: "#kontak", label: "Testimoni" },
  { href: "#tentang", label: "Tentang Kami" },
  { href: "#kontak", label: "Kebijakan Privasi" },
  { href: "#kontak", label: "Syarat Dan Ketentuan" },
] as const;

const SOCIAL = [
  { href: "https://www.instagram.com/", icon: "/brand/landing/social/instagram.svg", label: "Instagram" },
  { href: "https://www.facebook.com/", icon: "/brand/landing/social/facebook.svg", label: "Facebook" },
  { href: "https://www.tiktok.com/", icon: "/brand/landing/social/tiktok.svg", label: "TikTok" },
  { href: "https://www.youtube.com/", icon: "/brand/landing/social/youtube.svg", label: "YouTube" },
] as const;

async function getCommercialListings() {
  try {
    const [spaces, totalSpaces, totalStations] = await Promise.all([
      prisma.commercialSpace.findMany({
        where: { station: { isActive: true } },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 8,
        include: {
          station: { select: { name: true, slug: true, order: true, line: true } },
          occupancy: {
            select: {
              tenant: {
                select: { brandName: true, isActive: true },
              },
            },
          },
        },
      }),
      prisma.commercialSpace.count({ where: { station: { isActive: true } } }),
      prisma.station.count({ where: { isActive: true } }),
    ]);

    return {
      totalSpaces,
      totalStations,
      spaces: spaces.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        type: s.type,
        status: s.status,
        area: s.area,
        monthlyRent: s.monthlyRent,
        stationName: s.station.name,
        stationSlug: s.station.slug,
        stationOrder: s.station.order,
        stationLine: s.station.line,
        tenantBrand:
          s.status === "TERISI" && s.occupancy?.tenant.isActive
            ? s.occupancy.tenant.brandName
            : null,
      })),
    };
  } catch (error) {
    console.error("getCommercialListings failed:", error);
    return { totalSpaces: 0, totalStations: 18, spaces: [] };
  }
}

async function CommercialSection() {
  const data = await getCommercialListings();
  return (
    <CommercialSpaceGrid
      spaces={data.spaces}
      totalSpaces={data.totalSpaces}
      totalStations={data.totalStations}
    />
  );
}

/** Stasiun pertama yang punya scene tour aktif — entry point CTA homepage */
async function getDefaultTourHref() {
  try {
    const station = await prisma.station.findFirst({
      where: {
        isActive: true,
        virtualTourScenes: { some: { isActive: true } },
      },
      orderBy: { order: "asc" },
      select: { slug: true },
    });
    return station ? `/station/${station.slug}?pilih=1` : "#area-komersial";
  } catch {
    return "#area-komersial";
  }
}

async function VirtualTourSection() {
  const tourHref = await getDefaultTourHref();

  return (
    <section id="virtual-tour" className="bg-[#d32f2f] py-16 md:py-20">
      <div className="mx-auto flex max-w-5xl flex-col items-center px-5 text-center md:px-10">
        <HomeReveal>
          <h2 className="font-display text-3xl font-bold text-white md:text-[36px]">
            Temukan dan Rasakan Lokasi yang Tepat
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-white md:text-[20px] md:tracking-tight">
            Jelajahi setiap sudut stasiun melalui Virtual Tour 360° untuk menemukan fasilitas, area
            komersial, media promosi, dan berbagai peluang yang tersedia di LRT Jabodebek.
          </p>
          <Link
            href={tourHref}
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white underline underline-offset-4"
          >
            Klik Gambar Berikut Untuk Memulai Virtual Tour
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/landing/icons/click.svg"
              alt=""
              width={24}
              height={24}
              className="size-6 brightness-0 invert"
            />
          </Link>
        </HomeReveal>

        <HomeReveal delayMs={120} className="relative mt-10 w-full">
          <Link
            href={tourHref}
            className="group relative block aspect-[1017/549] w-full overflow-hidden rounded-[15px] shadow-[0_4px_24px_rgba(0,0,0,0.45)]"
          >
            <Image
              src="/brand/landing/tour-360.jpg"
              alt="Preview virtual tour 360 stasiun LRT"
              fill
              sizes="(max-width: 1024px) 100vw, 1017px"
              className="object-cover transition duration-500 group-hover:scale-[1.02]"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
              <span className="relative flex size-[110px] items-center justify-center rounded-full border-[3px] border-white/90 bg-white/35 shadow-[0_0_40px_rgba(255,255,255,0.35)] backdrop-blur-[6px] transition group-hover:scale-105">
                <svg
                  viewBox="0 0 64 64"
                  className="size-[52px] text-white"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M50 22.5A21 21 0 1 0 53 36"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                  <path
                    d="M42 14h14v14"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div className="mt-4 flex flex-col items-center text-center text-white">
                <p className="text-sm font-bold tracking-[0.56px]">Mulai Virtual Tour</p>
                <p className="mt-0.5 text-[9px] tracking-[0.56px] underline underline-offset-2">
                  Klik Untuk Memulai Virtual Tour 360°
                </p>
              </div>
            </div>
          </Link>
        </HomeReveal>
      </div>
    </section>
  );
}

function CommercialSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl bg-white/20">
          <div className="aspect-[200/176] animate-pulse bg-white/30" />
          <div className="h-16 animate-pulse bg-white/20" />
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <HomeShell>
      <Navbar variant="dark" />

      {/* Hero */}
      <section className="relative flex min-h-[640px] items-center justify-center overflow-hidden bg-[#1a1a1a] pt-28 pb-16 md:min-h-[700px]">
        <div className="pointer-events-none absolute inset-0">
          <Image
            src="/brand/landing/hero-station.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-black/55" />
        </div>

        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-5 text-center md:px-10">
          <HomeReveal>
            <h1 className="font-display text-3xl font-bold leading-tight text-white md:text-[40px] md:leading-[50px]">
              Temukan Ruang Komersial Terbaik di Area{" "}
              <span className="text-[#d32f2f]">LRT Jabodebek</span>
            </h1>
          </HomeReveal>
          <HomeReveal delayMs={100}>
            <p className="mt-6 max-w-3xl text-sm leading-relaxed text-white/95 md:text-[15px]">
              Cari berbagai pilihan ruang komersial, media iklan, dan area usaha di stasiun LRT
              Jabodebek. Lihat lokasinya lewat Virtual Tour 360° sebelum mengajukan penyewaan.
            </p>
          </HomeReveal>
          <HomeReveal delayMs={180}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#area-komersial"
                className="inline-flex h-12 min-w-[164px] items-center justify-center rounded-xl border border-[#d32f2f] bg-white/95 px-5 text-xs font-semibold tracking-wide text-[#d32f2f] shadow-[0_8px_32px_rgba(0,0,0,0.35)] transition hover:bg-white"
              >
                Jelajahi Sekarang
              </a>
              <a
                href="#langkah"
                className="inline-flex h-12 min-w-[164px] items-center justify-center rounded-xl bg-white px-5 text-xs font-semibold tracking-wide text-[#d32f2f] transition hover:bg-[#fff5f5]"
              >
                Tutorial
              </a>
            </div>
          </HomeReveal>
        </div>
      </section>

      {/* Intro + Kenapa */}
      <section id="tentang" className="bg-[#f8f8f8] py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-10">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
            <HomeReveal>
              <div className="flex items-center gap-4">
                <span className="h-[3px] w-16 bg-[#D81435]" aria-hidden />
                <p className="font-display text-lg font-bold tracking-tight text-[#d32f2f] md:text-[20px]">
                  LRT JABODEBEK
                </p>
              </div>
              <h2 className="mt-5 font-display text-2xl font-bold text-black md:text-[32px] md:leading-snug">
                Menghubungkan Perjalanan, Membuka Peluang
              </h2>
              <p className="mt-5 text-base leading-relaxed text-black/85 md:text-[20px] md:tracking-tight">
                LRT Jabodebek menghubungkan berbagai kawasan strategis di Jabodetabek melalui layanan
                transportasi yang modern dan terintegrasi. Selain mendukung mobilitas masyarakat, setiap
                stasiun juga menghadirkan fasilitas serta area komersial yang dapat dimanfaatkan oleh
                masyarakat maupun mitra usaha.
              </p>
            </HomeReveal>
            <HomeReveal delayMs={120}>
              <div className="relative aspect-[595/422] overflow-hidden rounded-none shadow-md lg:rounded-l-none">
                <Image
                  src="/brand/landing/intro-train.jpg"
                  alt="Kereta LRT Jabodebek di stasiun"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            </HomeReveal>
          </div>

          <div className="mt-20">
            <HomeReveal>
              <h2 className="text-center font-display text-2xl font-bold text-black md:text-[32px]">
                Kenapa Harus Memilih <span className="text-[#d32f2f]">LRT JABODEBEK?</span>
              </h2>
            </HomeReveal>

            <HomeReveal delayMs={80}>
              <div className="mx-auto mt-10 max-w-4xl rounded-xl border border-white bg-white/60 px-4 py-6 shadow-sm backdrop-blur-sm md:px-8">
                <p className="mb-6 text-center text-sm font-bold text-black">
                  Terintegrasi dengan Tranportasi lainnya
                </p>
                <div className="flex w-full flex-nowrap items-start justify-between gap-1 sm:gap-2">
                  {TRANSPORT.map((item, i) => (
                    <div key={item.label} className="contents">
                      <div className="flex min-w-0 flex-1 flex-col items-center gap-3">
                        <div className="relative size-[52px] shrink-0 overflow-hidden rounded-full sm:size-[60px]">
                          <Image src={item.icon} alt="" fill sizes="60px" className="object-contain" />
                        </div>
                        <p className="px-1 text-center text-[11px] font-bold leading-tight text-black sm:text-sm">
                          {item.label}
                        </p>
                      </div>
                      {i < TRANSPORT.length - 1 && (
                        <div
                          className="mt-[26px] h-px w-4 shrink-0 border-t border-dashed border-[#d32f2f] sm:mt-[30px] sm:w-8 md:w-14 lg:w-20"
                          aria-hidden
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </HomeReveal>

            <div className="mt-10 grid gap-6 lg:grid-cols-[410px_1fr] lg:items-stretch">
              <HomeReveal>
                <div className="flex h-full flex-col rounded-xl border border-[#d32f2f] bg-white p-4 pt-8 shadow-sm">
                  <div className="flex flex-1 items-end gap-2 border-b border-black/10 px-2 pb-2">
                    {CHART_BARS.map((bar, i) => (
                      <div key={`${bar.label}-${i}`} className="flex flex-1 flex-col items-center gap-2">
                        <div
                          className="w-full rounded-sm bg-[#d32f2f]"
                          style={{ height: bar.h, minHeight: 24 }}
                        />
                        <span className="text-[12px] text-black/70">{bar.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-2 text-[12px] text-black/70">
                    <span className="inline-block size-3 border border-white bg-[#d32f2f]" />
                    2026
                  </div>
                </div>
              </HomeReveal>

              <div className="flex flex-col gap-4">
                {WHY_CARDS.map((card, i) => (
                  <HomeReveal key={card.title} delayMs={i * 80}>
                    <div className="flex items-center gap-5 rounded-xl border border-[#d32f2f] bg-white/60 px-4 py-4 backdrop-blur-sm">
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-xl">
                        <Image src={card.icon} alt="" fill sizes="56px" className="object-contain" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-black">{card.title}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-black/80">{card.body}</p>
                      </div>
                    </div>
                  </HomeReveal>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Virtual Tour CTA → langsung ke tour 360° */}
      <Suspense fallback={<section id="virtual-tour" className="min-h-[480px] bg-[#d32f2f]" />}>
        <VirtualTourSection />
      </Suspense>

      {/* Steps — maskot kiri + timeline nomor di tengah kartu */}
      <section id="langkah" className="bg-[#f8f8f8] py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-10">
          <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-end lg:gap-10 xl:gap-12">
            <HomeReveal className="shrink-0">
              <div className="relative mx-auto h-[260px] w-[200px] lg:mx-0 lg:h-[320px] lg:w-[240px] xl:h-[339px] xl:w-[284px]">
                <Image
                  src="/brand/landing/mascot-reno-steps.png"
                  alt="Reno, maskot LRT Jabodebek"
                  fill
                  sizes="284px"
                  className="object-contain object-bottom"
                  unoptimized
                />
              </div>
            </HomeReveal>

            <div className="min-w-0 w-full flex-1">
              <HomeReveal>
                <div className="text-center lg:text-left">
                  <h2 className="font-display text-2xl font-bold text-black md:text-[36px] md:leading-tight">
                    Langkah Langkah Untuk Memulai Bisnis Anda
                  </h2>
                  <p className="mx-auto mt-3 max-w-[788px] text-sm text-black md:text-[15px] lg:mx-auto lg:text-center">
                    Ikuti langkah-langkah berikut untuk menjelajahi area komersial dan mengajukan
                    penyewaan dengan mudah melalui platform LRT Jabodebek.
                  </p>
                </div>
              </HomeReveal>

              {/* Timeline: satu garis kontinu, nomor di tengah tiap kolom kartu */}
              <div className="relative mt-8 mb-4 hidden h-10 lg:block">
                <div
                  className="absolute top-1/2 right-[12.5%] left-[12.5%] h-px -translate-y-1/2 bg-[#d32f2f]"
                  aria-hidden
                />
                <div className="relative z-10 grid h-full grid-cols-4 gap-3 xl:gap-3">
                  {STEPS.map((step) => (
                    <div key={step.n} className="flex items-center justify-center">
                      <span className="flex size-10 items-center justify-center rounded-full border-2 border-[#d32f2f] bg-white text-2xl leading-none text-[#d32f2f]">
                        {step.n}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-0 lg:grid-cols-4 lg:gap-3">
                {STEPS.map((step, i) => (
                  <HomeReveal key={step.n} delayMs={i * 70} className="h-full">
                    <div className="flex h-full min-h-[270px] flex-col items-center rounded-[15px] border-[0.2px] border-[#898989] bg-white px-3 pt-3 pb-4 text-center shadow-sm">
                      <div className="relative size-[70px] shrink-0 overflow-hidden rounded-full">
                        <Image src={step.icon} alt="" fill sizes="70px" className="object-contain" />
                      </div>

                      <div className="mt-2 flex w-full flex-1 flex-col items-center gap-2 px-1">
                        <h3 className="min-h-[2.5em] text-[15px] leading-normal font-bold text-black">
                          {step.title}
                        </h3>
                        <div className="h-px w-[117px] shrink-0 bg-[#d32f2f]" aria-hidden />
                        <p className="text-[11px] leading-normal text-black">{step.body}</p>
                      </div>
                    </div>
                  </HomeReveal>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Area komersial */}
      <section id="area-komersial" className="bg-[#d32f2f] py-14 md:py-16">
        <div className="mx-auto max-w-7xl px-5 md:px-10">
          <Suspense fallback={<CommercialSkeleton />}>
            <CommercialSection />
          </Suspense>
        </div>
      </section>

      {/* Footer */}
      <footer id="kontak" className="relative overflow-hidden bg-white py-14 md:py-16">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] opacity-[0.12]">
          <Image
            src="/brand/landing/footer-train.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-bottom"
          />
        </div>

        <div className="relative z-10 mx-auto grid max-w-7xl gap-10 px-5 md:grid-cols-3 md:px-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative h-10 w-24">
                <Image
                  src="/brand/landing/logo-kai-footer.png"
                  alt="KAI"
                  fill
                  sizes="96px"
                  className="object-contain object-left"
                />
              </span>
              <span className="relative h-11 w-24">
                <Image
                  src="/brand/landing/logo-lrt-footer.png"
                  alt="LRT Jabodebek"
                  fill
                  sizes="96px"
                  className="object-contain object-left"
                />
              </span>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-black md:text-[12px]">
              KAI Divisi LRT Jabodebek
              <br />
              Jatimulya, Bekasi Timur, Bekasi Regency, West Java
            </p>
            <a
              href="tel:121"
              className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-black"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/landing/icons/phone.svg" alt="" width={16} height={16} className="size-4" />
              Call Center 121
            </a>
          </div>

          <div className="text-center md:px-4">
            <p className="font-display text-lg font-bold text-black md:text-xl">
              Transportasi Cerdas, Mobilitas Tanpa Batas
            </p>
            <p className="mt-3 text-sm leading-relaxed text-black/70">
              Jelajahi stasiun LRT Jabodebek melalui Virtual Tour 360° untuk melihat fasilitas, area
              komersial, dan media promosi secara interaktif dalam satu platform.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              {SOCIAL.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex size-10 items-center justify-center rounded-full border border-black/10 bg-white transition hover:border-[#d32f2f]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.icon} alt="" width={20} height={20} className="size-5 object-contain" />
                </a>
              ))}
            </div>
          </div>

          <div className="md:text-right">
            <ul className="space-y-2 text-sm text-black/75">
              {FOOTER_LINKS.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="transition hover:text-[#d32f2f]">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-xs text-black/50">
              © {new Date().getFullYear()} LRT Jabodebek Virtual Tour
            </p>
          </div>
        </div>
      </footer>
    </HomeShell>
  );
}
