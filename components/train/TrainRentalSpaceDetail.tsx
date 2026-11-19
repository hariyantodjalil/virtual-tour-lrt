"use client";

import { useTourLanguage } from "@/components/tour/TourLanguageProvider";
import { useState } from "react";
import Image from "next/image";
import { Minus, Plus } from "lucide-react";
import TrainInquiryCarPicker from "@/components/train/TrainInquiryCarPicker";
import TrainTourPanel from "@/components/train/TrainTourPanel";
import TourEditorLink from "@/components/tour/TourEditorLink";
import SpaceInquiryForm, { type SpaceInquiryStage } from "@/components/tour/SpaceInquiryForm";
import { useCommercialProfile } from "@/components/commercial/CommercialProfileProvider";
import { TRAIN_RENTAL_STATUS_LABELS, trainRentalStatusBadgeClass } from "@/lib/train-rental-sales";
import { Badge } from "@/components/ui/badge";
import { trainInquiryInputSchema, type TrainInquiryInput } from "@/lib/train-advertising-shared";
import { getWhatsAppUrl, formatRupiah } from "@/lib/utils";
import { resolvePublicAssetUrl, shouldUnoptimizeImage } from "@/lib/s3-utils";
import { TRAIN_MEDIA_SPEC_FIELDS, type TrainRentalSpacePublic } from "@/lib/train-rental-spaces-shared";

type Props = {
  space: TrainRentalSpacePublic;
  onClose: () => void;
  backLabel?: string;
  initialCarSlug?: string;
  editHotspotHref?: string;
};
const primaryClass = "inline-flex min-h-12 items-center justify-center rounded-xl bg-[#E31E2D] px-4 py-3 text-sm font-semibold text-white hover:bg-[#C41926] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D] disabled:opacity-50";

export default function TrainRentalSpaceDetail({ space, onClose, backLabel = "Kembali ke tur", editHotspotHref, initialCarSlug }: Props) {
  const { t, content, locale } = useTourLanguage();
  const [showForm, setShowForm] = useState(false);
  const [formStage, setFormStage] = useState<SpaceInquiryStage>("form");
  const cars = space.train?.cars ?? [];
  const [selectedCarSlugs, setSelectedCarSlugs] = useState<string[]>(() => cars.map(car => car.slug));
  const [quantity, setQuantity] = useState("1");
  const profile = useCommercialProfile();
  const fullBranding = space.inquiryMode === "FULL_BRANDING";
  const canApply = space.status !== "PENUH";
  const trainName = content(space.train?.name ?? "Kereta LRT Jabodebek");
  const selectedCar = cars.find(car => car.slug === initialCarSlug);
  const carLabel = selectedCar ? content(selectedCar.label) : undefined;
  const specifications = TRAIN_MEDIA_SPEC_FIELDS.flatMap(({ key, label }) => {
    const value = space.specifications?.[key];
    return value ? [{ key, label, value }] : [];
  });
  const trainInquiry: TrainInquiryInput = {
    ...(!fullBranding ? { carSlugs: selectedCarSlugs } : {}),
    requestedTrainsetCount: Number(quantity),
  };
  const validation = trainInquiryInputSchema.safeParse(trainInquiry);
  const contactUrl = profile.whatsappNumber ? getWhatsAppUrl(profile.whatsappNumber,
    t("Halo {team}, saya ingin bertanya tentang media {title} ({number}) di {train}.", { team: content(profile.teamName), title: content(space.title), number: space.displayNumber, train: trainName })) : null;

  const summary = <>
    <p className="text-xs text-slate-600">{t("Media")} {space.displayNumber} · {trainName}{!showForm && carLabel ? ` · ${carLabel}` : ""}</p>
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <h2 className="text-xl font-semibold text-slate-900">{content(space.title)}</h2>
      {!showForm && <Badge className={trainRentalStatusBadgeClass(space.status)}>{t(TRAIN_RENTAL_STATUS_LABELS[space.status])}</Badge>}
    </div>
    <p className="mt-2 text-sm text-slate-600">{fullBranding ? "Full branding" : t("Media iklan")}</p>
  </>;

  const campaignFields = <fieldset disabled={formStage === "review" || formStage === "success"} className="min-w-0 space-y-5">
    {!fullBranding && cars.length > 0 && <TrainInquiryCarPicker cars={cars}
      selectedSlugs={selectedCarSlugs} onSelectionChange={setSelectedCarSlugs} />}
    <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-200 py-4">
      <div>
        <label htmlFor="train-inquiry-quantity" className="block text-sm font-semibold">{t("Jumlah trainset")}</label>
        <p className="mt-1 text-xs text-slate-600">{t("Alokasi armada oleh tim LRT.")}</p>
      </div>
      <div className="inline-flex items-center overflow-hidden rounded-lg border border-slate-300 bg-white">
        <button type="button" aria-label={t("Kurangi trainset")} disabled={Number(quantity) <= 1} onClick={() => setQuantity(value => String(Math.max(1, Number(value) - 1)))} className="flex size-11 items-center justify-center text-slate-600 transition-colors enabled:hover:bg-slate-50 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#E31E2D]"><Minus className="size-4" /></button>
        <input id="train-inquiry-quantity" type="number" inputMode="numeric" min={1} max={999} step={1} value={quantity} onChange={event => setQuantity(event.target.value)} className="h-11 w-16 border-x border-slate-200 bg-white text-center text-sm font-semibold text-slate-900 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:outline-2 focus-visible:outline-[#E31E2D]" />
        <button type="button" aria-label={t("Tambah trainset")} disabled={Number(quantity) >= 999} onClick={() => setQuantity(value => String(Math.min(999, Number(value) + 1)))} className="flex size-11 items-center justify-center text-slate-600 transition-colors enabled:hover:bg-slate-50 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#E31E2D]"><Plus className="size-4" /></button>
      </div>
    </div>
    {!validation.success && <p role="alert" className="text-sm text-red-700">{t(validation.error.issues[0].message)}</p>}
  </fieldset>;

  return <TrainTourPanel centered wide={showForm} width={showForm ? 640 : undefined} title={showForm ? t("Pengajuan media iklan") : t("Detail media iklan")}
    onClose={onClose} footer={!showForm ? <div className="grid grid-cols-2 gap-2">
      {editHotspotHref && <div className="col-span-2"><TourEditorLink href={editHotspotHref} label={t("Edit pinpoint di CMS")} /></div>}
      <button type="button" disabled={!canApply} onClick={() => { setFormStage("form"); setShowForm(true); }} className={primaryClass}>{canApply ? t("Ajukan sewa") : t("Belum tersedia")}</button>
      {contactUrl ? <a href={contactUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">{t("Hubungi tim")}</a>
        : <button type="button" onClick={onClose} className="min-h-12 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700">{t(backLabel)}</button>}
    </div> : undefined}>
    {showForm ? <SpaceInquiryForm key={space.id} trainRentalSpaceId={space.id} trainInquiry={trainInquiry} trainCarOptions={cars}
      spaceCode={space.displayNumber} stationName={trainName} canApply={canApply} initialStage="form"
      onStageChange={setFormStage} onExplore={onClose} onBackToDetails={() => setShowForm(false)}
      additionalFields={<div className="my-5">{campaignFields}</div>} details={summary} />
      : <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
        {space.image && <div className="relative mb-5 aspect-video overflow-hidden rounded-xl bg-slate-100">
          <Image src={resolvePublicAssetUrl(space.image)} alt={content(space.title)} fill sizes="(max-width: 767px) 100vw, 600px" className="object-cover" style={{ objectPosition: space.objectPosition }} unoptimized={shouldUnoptimizeImage(resolvePublicAssetUrl(space.image))} />
        </div>}
        {summary}
        {(specifications.length > 0 || space.specifications?.technicalNote) && (
          <section className="mt-5 space-y-2.5">
            <h3 className="text-base font-semibold text-slate-900">{t("Spesifikasi Media")}</h3>
            {specifications.length > 0 && (
              <dl className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
                {specifications.map(({ key, label, value }) => (
                  <div key={key} className="grid grid-cols-[minmax(6.5rem,36%)_minmax(0,1fr)] text-sm leading-relaxed">
                    <dt className="bg-slate-50 px-3 py-2 font-semibold text-slate-800">{t(label)}</dt>
                    <dd className="break-words px-3 py-2 text-slate-700">{content(value)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {space.specifications?.technicalNote && <p className="text-sm leading-relaxed text-slate-600">{content(space.specifications.technicalNote)}</p>}
          </section>
        )}
        {space.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{content(space.description)}</p>}
        {space.monthlyRent !== null && space.monthlyRent > 0 && <p className="mt-5 text-sm font-semibold">{formatRupiah(space.monthlyRent, locale)} {t("/ bulan")}</p>}
        {space.train?.advertisingCapacity !== null && space.train?.advertisingCapacity !== undefined && <dl className="mt-5 text-sm"><dt className="text-slate-600">{t("Kapasitas iklan armada")}</dt><dd className="mt-1 font-semibold">{space.train.advertisingCapacity} {t("trainset")}</dd></dl>}
        {space.howToOrder && <section className="mt-5 border-t border-slate-200 pt-4"><h3 className="text-sm font-semibold">{t("Ketentuan pengajuan")}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{content(space.howToOrder)}</p></section>}
      </div>}
  </TrainTourPanel>;
}
