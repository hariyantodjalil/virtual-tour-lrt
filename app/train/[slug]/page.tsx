import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { getCmsSessionUser } from "@/lib/cms-session";
import { getTrainBySlug } from "@/lib/trains-data";
import { getTrainRentalSpaces } from "@/lib/train-rental-spaces";
import { DEFAULT_TRAIN_SLUG } from "@/lib/train-constants";
import TrainTourClient from "./TrainTourClient";
import TourLanguageProvider from "@/components/tour/TourLanguageProvider";
import { translateTourMessage } from "@/lib/tour-language";
import { getTourLanguage, getTourLanguageData } from "@/lib/tour-translated-content";
import VirtualTourNavbar from "@/components/VirtualTourNavbar";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const [train, language] = await Promise.all([getTrainBySlug(slug === "default" ? DEFAULT_TRAIN_SLUG : slug), getTourLanguage()]);
  if (!train) return { title: translateTourMessage(language, "Kereta Tidak Ditemukan") };
  return {
    title: `Train Virtual Tour ${train.name} - LRT Jabodebek`,
    description: translateTourMessage(language, "Jelajahi interior kereta {name} LRT Jabodebek secara virtual 360°.", { name: train.name }),
  };
}

export default async function TrainPage({ params }: Props) {
  const { slug } = await params;
  const resolvedSlug = slug === "default" ? DEFAULT_TRAIN_SLUG : slug;
  const [trainInfo, rentalSpaces, session, languageData] = await Promise.all([
    getTrainBySlug(resolvedSlug),
    getTrainRentalSpaces(resolvedSlug),
    getCmsSessionUser(),
    getTourLanguageData(),
  ]);

  if (!trainInfo) {
    if (slug !== DEFAULT_TRAIN_SLUG) redirect(`/train/${DEFAULT_TRAIN_SLUG}`);
    notFound();
  }

  if (trainInfo.scenes.length === 0) {
    const t = (text: string) => translateTourMessage(languageData.initialLanguage, text);
    return (
      <div className="min-h-screen bg-[#1a1a1a]">
        <VirtualTourNavbar />
        <div className="mx-auto flex min-h-[100svh] max-w-lg flex-col items-center justify-center px-5 text-center">
          <p className="text-sm font-semibold tracking-wide text-[#E31E2D]">Train Virtual Tour</p>
          <h1 className="mt-2 text-2xl font-bold text-white">{trainInfo.name}</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            {t("Panorama 360° kereta belum diunggah di database ini. Buka CMS Train Virtual Tour, upload panorama gerbong, lalu simpan scene-nya.")}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/cms/virtual-train"
              className="inline-flex rounded-xl bg-[#E31E2D] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#c41926]"
            >
              {t("Buka CMS Train Tour")}
            </Link>
            <Link
              href="/virtual-tour/train"
              className="inline-flex rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/5"
            >
              {t("Kembali")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const editorHref = trainInfo.slug === DEFAULT_TRAIN_SLUG && (session?.role === "ADMIN" || session?.role === "EDITOR")
    ? "/cms/virtual-train" : undefined;
  return (
    <Suspense fallback={<div className="h-[100dvh] bg-[#1a1a1a]" />}>
      <TourLanguageProvider {...languageData}>
        <TrainTourClient trainInfo={trainInfo} rentalSpaces={rentalSpaces} editorHref={editorHref} />
      </TourLanguageProvider>
    </Suspense>
  );
}
