"use client";

import { useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { Minus, Plus } from "lucide-react";
import TrainTourPanel from "@/components/train/TrainTourPanel";
import SpaceInquiryForm, { type SpaceInquiryStage } from "@/components/tour/SpaceInquiryForm";
import { useCommercialProfile } from "@/components/commercial/CommercialProfileProvider";
import { TRAIN_RENTAL_STATUS_LABELS } from "@/lib/train-rental-sales";
import { trainInquiryInputSchema, type TrainInquiryInput } from "@/lib/train-advertising-shared";
import { getWhatsAppUrl, formatRupiah } from "@/lib/utils";
import { resolvePublicAssetUrl, shouldUnoptimizeImage } from "@/lib/s3-utils";
import type { TrainRentalSpacePublic } from "@/lib/train-rental-spaces-shared";

type Props = {
  space: TrainRentalSpacePublic;
  onClose: () => void;
  backLabel?: string;
  initialCarSlug?: string;
};
const desktopQuery = "(min-width: 1024px)";
function subscribeToDesktop(onChange: () => void) {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const controlClass = "min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-[#E31E2D]";
const primaryClass = "inline-flex min-h-12 items-center justify-center rounded-xl bg-[#E31E2D] px-4 py-3 text-sm font-semibold text-white hover:bg-[#C41926] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D] disabled:opacity-50";

export default function TrainRentalSpaceDetail({ space, onClose, backLabel = "Kembali ke tur" }: Props) {
  const desktop = useSyncExternalStore(subscribeToDesktop, () => window.matchMedia(desktopQuery).matches, () => false);
  const [showForm, setShowForm] = useState(false);
  const [formStage, setFormStage] = useState<SpaceInquiryStage>("form");
  const [quantity, setQuantity] = useState(1);
  const [campaignStart, setCampaignStart] = useState("");
  const [campaignEnd, setCampaignEnd] = useState("");
  const [campaignNeeds, setCampaignNeeds] = useState("");
  const profile = useCommercialProfile();
  const fullBranding = space.inquiryMode === "FULL_BRANDING";
  const canApply = space.status !== "PENUH";
  const trainName = space.train?.name ?? "Kereta LRT Jabodebek";
  const trainInquiry: TrainInquiryInput = {
    ...(fullBranding ? { requestedTrainsetCount: quantity } : {}),
    ...(campaignStart ? { campaignStart } : {}),
    ...(campaignEnd ? { campaignEnd } : {}),
    ...(campaignNeeds.trim() ? { campaignNeeds: campaignNeeds.trim() } : {}),
  };
  const validation = trainInquiryInputSchema.safeParse(trainInquiry);
  const contactUrl = profile.whatsappNumber ? getWhatsAppUrl(profile.whatsappNumber,
    `Halo ${profile.teamName}, saya ingin bertanya tentang media ${space.title} (${space.displayNumber}) di ${trainName}.`) : null;

  const summary = <>
    <p className="text-xs text-slate-600">Media {space.displayNumber} · {trainName}</p>
    <h2 className="mt-1 text-xl font-semibold text-slate-900">{space.title}</h2>
    <p className="mt-2 text-sm text-slate-600">{fullBranding ? "Full branding" : "Media iklan"}</p>
  </>;

  const campaignFields = <fieldset disabled={formStage === "review" || formStage === "success"} className="min-w-0 space-y-5">
    {fullBranding && <div>
      <label htmlFor="train-inquiry-quantity" className="block text-sm font-semibold">Jumlah trainset</label>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">Penempatan armada ditentukan tim LRT.</p>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" aria-label="Kurangi trainset" disabled={quantity <= 1} onClick={() => setQuantity(value => Math.max(1, value - 1))} className="flex size-11 items-center justify-center rounded-lg border border-slate-300 disabled:opacity-40"><Minus className="size-4" /></button>
        <input id="train-inquiry-quantity" type="number" min={1} max={999} value={quantity} onChange={event => setQuantity(Number(event.target.value))} className={controlClass + " max-w-24 text-center"} />
        <button type="button" aria-label="Tambah trainset" disabled={quantity >= 999} onClick={() => setQuantity(value => Math.min(999, value + 1))} className="flex size-11 items-center justify-center rounded-lg border border-slate-300 disabled:opacity-40"><Plus className="size-4" /></button>
      </div>
    </div>}
    <fieldset>
      <legend className="text-sm font-semibold">Periode kampanye <span className="font-normal text-slate-500">(opsional)</span></legend>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="min-w-0 text-xs text-slate-600">Mulai<input id="train-campaign-start" type="date" value={campaignStart} onChange={event => setCampaignStart(event.target.value)} className={controlClass + " mt-1"} /></label>
        <label className="min-w-0 text-xs text-slate-600">Selesai<input id="train-campaign-end" type="date" min={campaignStart || undefined} value={campaignEnd} onChange={event => setCampaignEnd(event.target.value)} className={controlClass + " mt-1"} /></label>
      </div>
    </fieldset>
    <label className="block text-sm font-semibold">Kebutuhan kampanye <span className="font-normal text-slate-500">(opsional)</span>
      <textarea id="train-campaign-needs" rows={3} maxLength={2000} value={campaignNeeds} onChange={event => setCampaignNeeds(event.target.value)} className={controlClass + " mt-2 resize-y font-normal"} />
    </label>
    {!validation.success && <p role="alert" className="text-sm text-red-700">{validation.error.issues[0].message}</p>}
  </fieldset>;

  return <TrainTourPanel centered wide={showForm} title={showForm ? "Pengajuan media iklan" : "Detail media iklan"}
    onClose={onClose} footer={!showForm ? <div className="grid grid-cols-2 gap-2">
      <button type="button" disabled={!canApply} onClick={() => { setFormStage("form"); setShowForm(true); }} className={primaryClass}>{canApply ? "Ajukan sewa" : "Belum tersedia"}</button>
      {contactUrl ? <a href={contactUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Hubungi tim</a>
        : <button type="button" onClick={onClose} className="min-h-12 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700">{backLabel}</button>}
    </div> : undefined}>
    {showForm ? <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-2">
      {desktop && <aside className="hidden min-h-0 min-w-0 overflow-y-auto border-r border-slate-200 px-7 py-6 lg:block">
        <div className="mb-6">{summary}</div>
        {campaignFields}
      </aside>}
      <SpaceInquiryForm key={space.id} trainRentalSpaceId={space.id} trainInquiry={trainInquiry}
        spaceCode={space.displayNumber} stationName={trainName} canApply={canApply} initialStage="form"
        onStageChange={setFormStage} onExplore={onClose} onBackToDetails={() => setShowForm(false)}
        additionalFields={!desktop ? <div className="mt-5">{campaignFields}</div> : undefined} details={summary} />
    </div>
      : <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
        {space.image && <div className="relative mb-5 aspect-video overflow-hidden rounded-xl bg-slate-100">
          <Image src={resolvePublicAssetUrl(space.image)} alt={space.title} fill sizes="(max-width: 767px) 100vw, 600px" className="object-cover" style={{ objectPosition: space.objectPosition }} unoptimized={shouldUnoptimizeImage(resolvePublicAssetUrl(space.image))} />
        </div>}
        {summary}
        <p className="mt-4 text-sm font-medium text-slate-700">{TRAIN_RENTAL_STATUS_LABELS[space.status]}</p>
        {space.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{space.description}</p>}
        {space.monthlyRent !== null && space.monthlyRent > 0 && <p className="mt-5 text-sm font-semibold">{formatRupiah(space.monthlyRent)} / bulan</p>}
        {space.train?.advertisingCapacity !== null && space.train?.advertisingCapacity !== undefined && <dl className="mt-5 text-sm"><dt className="text-slate-600">Kapasitas iklan armada</dt><dd className="mt-1 font-semibold">{space.train.advertisingCapacity} trainset</dd></dl>}
        {space.howToOrder && <section className="mt-5 border-t border-slate-200 pt-4"><h3 className="text-sm font-semibold">Ketentuan pengajuan</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{space.howToOrder}</p></section>}
      </div>}
  </TrainTourPanel>;
}
