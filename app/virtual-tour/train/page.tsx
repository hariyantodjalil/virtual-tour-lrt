import { getTourTranslator } from "@/lib/tour-translated-content";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import TrainRentalSpacesCarousel from "@/components/train/TrainRentalSpacesCarousel";
import VirtualTourNavbar from "@/components/VirtualTourNavbar";
import CommercialContactDetails from "@/components/commercial/CommercialContactDetails";
import SocialIconLinks from "@/components/home/SocialIconLinks";
import { HomeReveal, HomeShell } from "@/components/home/HomeMotion";
import { getDefaultTrainTourHref } from "@/lib/train-tour-entry";
import { getTrainRentalSpaces } from "@/lib/train-rental-spaces";

export async function generateMetadata() {
  const t = await getTourTranslator();
  return { title: t("Train Virtual Tour - LRT Jabodebek"), description: t("Jelajahi interior kereta LRT Jabodebek secara virtual 360° — gerbong, fasilitas penumpang, dan pengalaman perjalanan.") };
}

export const dynamic = "force-dynamic";

const FOOTER_LINKS = [
  { href: "#tentang", label: "Tentang Kami" },
  { href: "#ruang-sewa", label: "Media Iklan" },
  { href: "#kontak", label: "Hubungi Kami" },
] as const;


export default async function TrainVirtualTourLandingPage() {
  const t = await getTourTranslator();
  const [rentalSpaces, tourHref] = await Promise.all([
    getTrainRentalSpaces(),
    getDefaultTrainTourHref(),
  ]);

  return (
    <HomeShell>
      <VirtualTourNavbar />

      {/* Hero */}
      <section className="relative flex min-h-[min(80svh,46rem)] items-center justify-center overflow-hidden bg-[#1a1a1a] pt-24 pb-16">
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
            <h1 className="font-display text-2xl font-bold leading-tight text-white sm:text-3xl md:text-[40px]">
              {t("Jelajahi Interior Kereta")}{" "}
              <span className="text-[#ff6b6b]">LRT Jabodebek</span>
            </h1>
          </HomeReveal>
          <HomeReveal delayMs={80}>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={tourHref}
                className="inline-flex h-12 min-w-[180px] items-center justify-center gap-2 rounded-full bg-[#E31E2D] px-6 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(227,30,45,0.45)] transition hover:brightness-110"
              >
                {t("Jelajahi Sekarang")}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </HomeReveal>
        </div>
      </section>

      {/* Intro */}
      <section id="tentang" className="bg-[#f8f8f8] py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-10">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
            <HomeReveal>
              <h2 className="font-display text-2xl font-bold text-black md:text-[32px] md:leading-snug">
                {t("Kenali Kereta Sebelum Anda Naik")}
              </h2>
              <p className="mt-3 max-w-prose text-base leading-relaxed text-black/80">
                {t("Telusuri setiap gerbong kereta LRT Jabodebek dari dalam — lihat tata letak kursi, ruang berdiri, dan area penumpang secara detail.")}
              </p>
            </HomeReveal>
            <HomeReveal delayMs={120}>
              <div className="relative aspect-[595/422] overflow-hidden rounded-none lg:rounded-l-none">
                <Image
                  src="/brand/landing/train-intro-interior.jpg"
                  alt={t("Interior gerbong LRT Jabodebek")}
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
              {t("KAI Divisi LRT Jabodebek")}
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

          <div className="md:px-4"><SocialIconLinks /></div>

          <div className="md:text-right">
            <ul className="space-y-2 text-sm text-black/75">
              {FOOTER_LINKS.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="transition hover:text-[#d32f2f]">
                    {t(link.label)}
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
