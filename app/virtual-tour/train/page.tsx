import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import TrainRentalSpacesCarousel from "@/components/train/TrainRentalSpacesCarousel";
import VirtualTourNavbar from "@/components/VirtualTourNavbar";
import VirtualTourStartOverlay from "@/components/tour/VirtualTourStartOverlay";
import CommercialContactDetails from "@/components/commercial/CommercialContactDetails";
import SocialIconLinks from "@/components/home/SocialIconLinks";
import { HomeReveal, HomeShell } from "@/components/home/HomeMotion";
import { getDefaultTrainTourHref } from "@/lib/train-tour-entry";
import { getTrainRentalSpaces } from "@/lib/train-rental-spaces";

export const metadata = {
  title: "Train Virtual Tour - LRT Jabodebek",
  description:
    "Jelajahi interior kereta LRT Jabodebek secara virtual 360° — gerbong, fasilitas penumpang, dan pengalaman perjalanan.",
};

export const dynamic = "force-dynamic";

const FEATURE_CARDS = [
  {
    title: "Interior Gerbong",
    body: "Telusuri setiap gerbong kereta LRT Jabodebek dari dalam — lihat tata letak kursi, ruang berdiri, dan area penumpang secara detail.",
    icon: "/brand/landing/icons/train.svg",
  },
  {
    title: "Fasilitas Penumpang",
    body: "Kenali fasilitas yang tersedia di dalam kereta, mulai dari area duduk, pegangan, hingga informasi keselamatan perjalanan.",
    icon: "/brand/landing/icons/mobility-full.svg",
  },
  {
    title: "Pengalaman 360°",
    body: "Nikmati pengalaman virtual tour interaktif yang memungkinkan Anda melihat interior kereta dari berbagai sudut pandang.",
    icon: "/brand/landing/icons/tour-360.svg",
  },
] as const;

const FOOTER_LINKS = [
  { href: "#kontak", label: "Testimoni" },
  { href: "#tentang", label: "Tentang Kami" },
  { href: "#kontak", label: "Kebijakan Privasi" },
  { href: "#kontak", label: "Syarat Dan Ketentuan" },
] as const;


async function VirtualTourSection() {
  const tourHref = await getDefaultTrainTourHref();

  return (
    <section id="virtual-tour" className="scroll-mt-28 bg-[#d32f2f] py-16 md:py-20">
      <div className="mx-auto flex max-w-5xl flex-col items-center px-5 text-center md:px-10">
        <HomeReveal>
          <h2 id="rasakan-kereta" className="scroll-mt-28 font-display text-3xl font-bold text-white md:text-[36px]">
            Rasakan Pengalaman di Dalam Kereta
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-white md:text-[20px] md:tracking-tight">
            Masuki interior kereta LRT Jabodebek melalui Virtual Tour 360°. Jelajahi gerbong, fasilitas
            penumpang, dan setiap detail perjalanan sebelum Anda naik kereta.
          </p>
          <Link
            href={tourHref}
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white underline underline-offset-4"
          >
            Mulai Train Virtual Tour
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
              src="/brand/landing/hero-train-station.jpg"
              alt="Preview train virtual tour 360 LRT Jabodebek"
              fill
              sizes="(max-width: 1024px) 100vw, 1017px"
              className="object-cover transition duration-500 group-hover:scale-[1.02]"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
              <VirtualTourStartOverlay
                title="Train Virtual Tour"
                className="transition group-hover:scale-[1.02]"
              />
            </div>
          </Link>
        </HomeReveal>
      </div>
    </section>
  );
}

export default async function TrainVirtualTourLandingPage() {
  const rentalSpaces = await getTrainRentalSpaces();

  return (
    <HomeShell>
      <VirtualTourNavbar />

      {/* Hero */}
      <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-[#1a1a1a] pt-24 pb-16">
        <div className="pointer-events-none absolute inset-0">
          <Image
            src="/brand/landing/hero-train-station.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_60%]"
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-4xl px-5 text-center md:px-10">
          <HomeReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
              LRT Jabodebek
            </p>
            <h1 className="mt-3 font-display text-2xl font-bold leading-tight text-white sm:text-3xl md:text-[40px]">
              Jelajahi Interior Kereta{" "}
              <span className="text-[#ff6b6b]">LRT Jabodebek</span>
            </h1>
          </HomeReveal>
          <HomeReveal delayMs={100}>
            <p className="mx-auto mt-4 max-w-3xl text-sm leading-relaxed text-white/90 md:text-base">
              Masuki kabin kereta LRT Jabodebek melalui Virtual Tour 360°. Lihat gerbong, fasilitas
              penumpang, dan pengalaman perjalanan secara interaktif sebelum Anda berangkat.
            </p>
          </HomeReveal>
          <HomeReveal delayMs={180}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#rasakan-kereta"
                className="inline-flex h-12 min-w-[180px] items-center justify-center gap-2 rounded-full bg-[#E31E2D] px-6 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(227,30,45,0.45)] transition hover:brightness-110"
              >
                Jelajahi Sekarang
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            </div>
          </HomeReveal>
        </div>
      </section>

      {/* Intro */}
      <section id="tentang" className="bg-[#f8f8f8] py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-10">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
            <HomeReveal>
              <div className="flex items-center gap-4">
                <span className="h-[3px] w-16 bg-[#D81435]" aria-hidden />
                <p className="font-display text-lg font-bold tracking-tight text-[#d32f2f] md:text-[20px]">
                  TRAIN VIRTUAL TOUR
                </p>
              </div>
              <h2 className="mt-5 font-display text-2xl font-bold text-black md:text-[32px] md:leading-snug">
                Kenali Kereta Sebelum Anda Naik
              </h2>
              <p className="mt-5 text-base leading-relaxed text-black/85 md:text-[20px] md:tracking-tight">
                LRT Jabodebek menghadirkan pengalaman perjalanan yang modern dan nyaman. Melalui train
                virtual tour, Anda dapat melihat interior kereta, memahami tata letak gerbong, dan
                mengetahui fasilitas penumpang tanpa harus berada di stasiun.
              </p>
            </HomeReveal>
            <HomeReveal delayMs={120}>
              <div className="relative aspect-[595/422] overflow-hidden rounded-none lg:rounded-l-none">
                <Image
                  src="/brand/landing/train-intro-interior.jpg"
                  alt="Interior gerbong LRT Jabodebek"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover object-[center_45%]"
                />
              </div>
            </HomeReveal>
          </div>
        </div>
      </section>

      <TrainRentalSpacesCarousel spaces={rentalSpaces} tourHref={tourHref} />

      <section className="bg-[#f8f8f8] py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-10">
          <div className="grid gap-5 md:grid-cols-3">
            {FEATURE_CARDS.map((card, i) => (
              <HomeReveal key={card.title} delayMs={i * 80}>
                <div className="flex h-full flex-col items-center rounded-xl border border-[#d32f2f] bg-white/60 px-5 py-6 text-center backdrop-blur-sm">
                  <div className="inline-flex size-14 items-center justify-center rounded-full bg-[#d32f2f]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={card.icon} alt="" width={28} height={28} className="size-7" />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-black">{card.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-black/80">{card.body}</p>
                </div>
              </HomeReveal>
            ))}
          </div>
        </div>
      </section>

      <VirtualTourSection />

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
            <CommercialContactDetails />
          </div>

          <div className="text-center md:px-4">
            <p className="font-display text-lg font-bold text-black md:text-xl">
              Transportasi Cerdas, Mobilitas Tanpa Batas
            </p>
            <p className="mt-3 text-sm leading-relaxed text-black/70">
              Jelajahi interior kereta LRT Jabodebek melalui Train Virtual Tour 360° untuk melihat
              gerbong, fasilitas penumpang, dan pengalaman perjalanan secara interaktif.
            </p>
            <SocialIconLinks />
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
