"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Layers,
  Minus,
  Phone,
  Plus,
  Tag,
  TrainFront,
  X,
} from "lucide-react";
import { getWhatsAppUrl } from "@/lib/utils";
import { resolvePublicAssetUrl, shouldUnoptimizeImage } from "@/lib/s3-utils";
import { useCommercialProfile } from "@/components/commercial/CommercialProfileProvider";
import TenantInterestForm from "@/components/tour/TenantInterestForm";
import {
  TRAIN_RENTAL_STATUS_LABELS,
  TRAINSET_OPTIONS,
  isAllTrainsets,
  parseCarTrainsetMap,
  type TrainRentalStatus,
} from "@/lib/train-rental-sales";
import { DEFAULT_TRAIN_CARS } from "@/lib/train-tour-defaults";
import type { TrainRentalSpacePublic } from "@/lib/train-rental-spaces-shared";

const ACCENT = "#E31E2D";

const STATUS_CLASS: Record<TrainRentalStatus, string> = {
  TERSEDIA: "border-[#E31E2D]/40 bg-[#E31E2D]/12 text-[#FF4D57]",
  TERBATAS: "border-amber-400/30 bg-amber-500/15 text-amber-300",
  PENUH: "border-white/15 bg-white/10 text-white/70",
};

const STATUS_DOT: Record<TrainRentalStatus, string> = {
  TERSEDIA: "bg-[#E31E2D]",
  TERBATAS: "bg-amber-400",
  PENUH: "bg-white/50",
};

type Props = {
  space: TrainRentalSpacePublic;
  onClose: () => void;
  backLabel?: string;
  initialCarSlug?: string;
};

function resolveCarIndex(slug?: string) {
  if (!slug) return 0;
  const needle = slug.trim().toLowerCase();
  const index = DEFAULT_TRAIN_CARS.findIndex(
    (car) => car.slug === needle || car.label.toLowerCase() === needle
  );
  return index >= 0 ? index : 0;
}

function CarriageIcon({
  index,
  total,
  selected,
}: {
  index: number;
  total: number;
  selected: boolean;
}) {
  const fill = selected ? ACCENT : "none";
  const stroke = selected ? ACCENT : "rgba(255,255,255,0.48)";

  if (index === 0) {
    return (
      <svg viewBox="0 0 52 28" className="h-[18px] w-[34px]" aria-hidden>
        <path
          d="M46 2.5H20.2C14.6 2.5 9.4 5.7 6.2 10.8L2.4 16.4C0.5 19.2 2.5 23.5 6.6 23.5H46C48.2 23.5 50 21.7 50 19.5V6.5C50 4.3 48.2 2.5 46 2.5Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (index === total - 1) {
    return (
      <svg viewBox="0 0 52 28" className="h-[18px] w-[34px]" aria-hidden>
        <path
          d="M6 2.5H31.8C37.4 2.5 42.6 5.7 45.8 10.8L49.6 16.4C51.5 19.2 49.5 23.5 45.4 23.5H6C3.8 23.5 2 21.7 2 19.5V6.5C2 4.3 3.8 2.5 6 2.5Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 52 28" className="h-[18px] w-[34px]" aria-hidden>
      <rect
        x="2"
        y="2.5"
        width="48"
        height="21"
        rx="5.5"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.6"
      />
    </svg>
  );
}

export default function TrainRentalSpaceDetail({
  space,
  onClose,
  backLabel = "Kembali ke Daftar Fasilitas",
  initialCarSlug,
}: Props) {
  const profile = useCommercialProfile();
  const [mounted, setMounted] = useState(false);
  const [carIndex, setCarIndex] = useState(() => resolveCarIndex(initialCarSlug));
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [rentMode, setRentMode] = useState<"gerbong" | "trainset">("gerbong");
  const [trainsetQty, setTrainsetQty] = useState(1);
  const [selectedCarSlugs, setSelectedCarSlugs] = useState<string[]>(() => {
    const car = DEFAULT_TRAIN_CARS[resolveCarIndex(initialCarSlug)];
    return car ? [car.slug] : [DEFAULT_TRAIN_CARS[0].slug];
  });

  const selectedCar = DEFAULT_TRAIN_CARS[carIndex] ?? DEFAULT_TRAIN_CARS[0];
  const carLabel = selectedCar.label;
  const maxTrainsetQty = TRAINSET_OPTIONS.length;
  const carTrainsets = parseCarTrainsetMap(space.availableByCar, space.availableTrainsets)[
    selectedCar.slug
  ] ?? [];
  const allTrainsetsAvailable = isAllTrainsets(carTrainsets);
  const trainsetCount = allTrainsetsAvailable
    ? maxTrainsetQty
    : carTrainsets.length > 0
      ? carTrainsets.length
      : 5;

  const trainsetText = allTrainsetsAvailable
    ? `Tersedia di semua train set pada ${carLabel}.`
    : carTrainsets.length > 0
      ? carTrainsets.join(", ")
      : `Belum diatur train set untuk ${carLabel}.`;

  const detailText =
    space.description?.trim() ||
    space.howToOrder?.trim() ||
    `Media ${space.title.toLowerCase()} di dalam kereta yang dapat dimanfaatkan untuk promosi brand Anda.`;

  const hubungiMessage = useMemo(
    () =>
      `Halo ${profile.teamName}, saya ingin bertanya terkait media ${space.title} (kode ${space.displayNumber}) di ${carLabel}. Mohon informasinya.`,
    [profile.teamName, space.title, space.displayNumber, carLabel]
  );

  const selectedCars = DEFAULT_TRAIN_CARS.filter((car) => selectedCarSlugs.includes(car.slug));
  const unitSummary =
    rentMode === "trainset"
      ? `${trainsetQty} train set utuh (masing-masing 6 gerbong)`
      : `Beberapa gerbong: ${selectedCars.map((car) => car.label).join(", ")} (total ${selectedCars.length} gerbong)`;

  const extraMessage = `Pengajuan ${space.title} (${space.displayNumber}) di Kereta LRT Jabodebek. ${unitSummary}. Ada di ${trainsetCount} train set.`;
  const hubungiUrl = getWhatsAppUrl(profile.whatsappNumber, hubungiMessage);
  const canApply = space.status !== "PENUH";

  function openApplyForm() {
    const current = DEFAULT_TRAIN_CARS[carIndex] ?? DEFAULT_TRAIN_CARS[0];
    setRentMode("gerbong");
    setSelectedCarSlugs([current.slug]);
    setTrainsetQty(1);
    setShowInterestModal(true);
  }

  function toggleCar(slug: string) {
    if (rentMode === "trainset") return;
    setSelectedCarSlugs((current) => {
      if (current.includes(slug)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== slug);
      }
      return [...current, slug];
    });
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setCarIndex(resolveCarIndex(initialCarSlug));
  }, [space.id, initialCarSlug]);

  useEffect(() => {
    if (!mounted) return;

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (showInterestModal) {
        setShowInterestModal(false);
        return;
      }
      onClose();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, onClose, showInterestModal]);

  if (!mounted) return null;

  return createPortal(
    <>
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="train-rental-space-title"
      className="tour-panel-in pointer-events-auto fixed inset-x-3 top-20 bottom-4 z-[80] flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0F0F0F]/65 text-white shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-md sm:inset-x-auto sm:right-6 sm:top-24 sm:bottom-6 sm:w-[410px] lg:w-[420px]"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={onClose}
          className="flex min-w-0 items-center gap-2 text-left"
        >
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#E31E2D]/55 bg-[#161616]">
            <ChevronLeft className="size-4 text-[#E31E2D]" strokeWidth={2.4} />
          </span>
          <span className="truncate text-xs font-medium text-white">{backLabel}</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
          aria-label="Tutup detail ruang sewa"
        >
          <X className="size-4" strokeWidth={2.2} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 sm:px-4">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-[#1A1A1A]">
          <Image
            src={resolvePublicAssetUrl(space.image)}
            alt={space.title}
            fill
            sizes="420px"
            className="object-cover"
            style={{ objectPosition: space.objectPosition }}
            unoptimized={shouldUnoptimizeImage(resolvePublicAssetUrl(space.image))}
          />
        </div>

        <div
          className="mt-3 flex justify-between gap-1"
          role="tablist"
          aria-label="Pilih gerbong"
        >
          {DEFAULT_TRAIN_CARS.map((car, index) => {
            const selected = index === carIndex;
            return (
              <button
                key={car.slug}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setCarIndex(index)}
                className="flex min-w-0 flex-1 flex-col items-center gap-1"
              >
                <CarriageIcon
                  index={index}
                  total={DEFAULT_TRAIN_CARS.length}
                  selected={selected}
                />
                <span
                  className={`text-[9px] leading-tight font-medium ${
                    selected ? "text-[#E31E2D]" : "text-white/65"
                  }`}
                >
                  {car.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 rounded-2xl bg-[#171717] p-3 shadow-[0_0_0_1px_rgba(227,30,45,0.38),0_0_20px_rgba(227,30,45,0.14)]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-white/45 uppercase">
                Ruang sewa kereta - {space.displayNumber}
              </p>
              <h3
                id="train-rental-space-title"
                className="mt-1 font-display text-xl leading-tight font-bold text-white"
              >
                {space.title}
              </h3>
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[space.status]}`}
            >
              <span className={`size-1.5 rounded-full ${STATUS_DOT[space.status]}`} />
              {TRAIN_RENTAL_STATUS_LABELS[space.status]}
            </span>
          </div>

          <div className="mt-2.5 flex items-start gap-2 text-white/70">
            <TrainFront className="mt-0.5 size-3.5 shrink-0 text-white" />
            <div>
              <p className="text-[10px] font-semibold tracking-wide text-white/80 uppercase">
                Ada di {trainsetCount} train set
              </p>
              {carTrainsets.length > 0 && !allTrainsetsAvailable ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {carTrainsets.map((trainset) => (
                    <span
                      key={trainset}
                      className="rounded-full border border-[#E31E2D]/35 bg-[#E31E2D]/10 px-2 py-0.5 text-[10px] font-medium text-[#FF4D57]"
                    >
                      {trainset}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-0.5 text-[11px] leading-relaxed text-white/50">{trainsetText}</p>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <div className="rounded-xl bg-[#121212] p-2">
              <TrainFront className="mb-1.5 size-4 text-[#E31E2D]" />
              <p className="text-[11px] font-bold text-white">{carLabel}</p>
              <p className="mt-1 line-clamp-3 text-[10px] leading-relaxed text-white/50">
                {space.title} ini berada di {carLabel} pada rangkaian kereta.
              </p>
            </div>

            <div className="rounded-xl bg-[#121212] p-2">
              <Layers className="mb-1.5 size-4 text-[#E31E2D]" />
              <p className="text-[11px] font-bold leading-snug">
                <span className="text-[#E31E2D]">Ada di {trainsetCount}</span>
                <span className="text-white"> train set</span>
              </p>
              <p className="mt-1 line-clamp-3 text-[10px] leading-relaxed text-white/50">
                {space.title} ada di {trainsetCount} train set yang dapat disewa.
              </p>
            </div>

            <div className="rounded-xl bg-[#121212] p-2">
              <Info className="mb-1.5 size-4 text-[#E31E2D]" />
              <p className="text-[11px] font-bold text-white">Detail</p>
              <p className="mt-1 line-clamp-3 text-[10px] leading-relaxed text-white/50">
                {detailText}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-white/10 bg-[#0F0F0F] p-3">
        <button
          type="button"
          onClick={openApplyForm}
          disabled={!canApply}
          className="inline-flex h-11 items-center justify-between gap-1 rounded-xl bg-[#E31E2D] px-2.5 text-[11px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Tag className="size-3.5 shrink-0" />
          <span className="flex-1 text-center">Sewa Space</span>
          <ChevronRight className="size-3.5 shrink-0" />
        </button>
        <a
          href={hubungiUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-between gap-1 rounded-xl border border-[#E31E2D]/45 bg-[#161616] px-2 text-[11px] font-semibold text-white transition hover:bg-[#1d1d1d]"
        >
          <Phone className="size-3.5 shrink-0 text-[#E31E2D]" />
          <span className="flex-1 text-center leading-tight">Hubungi Tim Komersial</span>
          <ChevronRight className="size-3.5 shrink-0 text-white/80" />
        </a>
      </div>
    </div>
    {showInterestModal ? (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6">
        <div className="relative grid max-h-[min(920px,calc(100vh-24px))] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl md:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.2fr)]">
          <div className="relative overflow-y-auto bg-[#111111] text-white">
            <div className="flex min-h-full flex-col p-4 sm:p-5 lg:p-6 lg:pb-8">
              <span
                className={`mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_CLASS[space.status]}`}
              >
                <span className={`size-1.5 rounded-full ${STATUS_DOT[space.status]}`} />
                {TRAIN_RENTAL_STATUS_LABELS[space.status]}
              </span>

              <div className="relative mb-4 aspect-[16/9] overflow-hidden rounded-xl sm:mb-5 sm:aspect-[16/10]">
                <Image
                  src={resolvePublicAssetUrl(space.image)}
                  alt={space.title}
                  fill
                  sizes="420px"
                  className="object-cover"
                  style={{ objectPosition: space.objectPosition }}
                  unoptimized={shouldUnoptimizeImage(resolvePublicAssetUrl(space.image))}
                />
              </div>

              <p className="text-[10px] font-semibold tracking-[0.16em] text-white/45 uppercase">
                Formulir sewa space - {space.displayNumber}
              </p>
              <h2 className="mt-1 text-2xl leading-tight font-bold lg:text-[28px]">
                {space.title}
              </h2>
              <p className="mt-1 text-sm text-white/70">
                {carLabel} · Kereta LRT Jabodebek
              </p>

              <div className="mt-4 grid max-w-md grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/5 p-3 ring-1 ring-[#E31E2D]/40">
                  <TrainFront className="mb-2 size-3.5 text-[#E31E2D]" />
                  <p className="text-[10px] font-medium text-white/60">Lokasi</p>
                  <p className="mt-1 text-[15px] leading-none font-bold text-white">{carLabel}</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3 ring-1 ring-[#E31E2D]/40">
                  <Layers className="mb-2 size-3.5 text-[#E31E2D]" />
                  <p className="text-[10px] font-medium text-white/60">Ketersediaan</p>
                  <p className="mt-1 text-[15px] leading-snug font-bold text-white">
                    Ada di {trainsetCount} train set
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-white/70 uppercase">
                  Jumlah unit yang ingin disewa
                  <span className="text-[#E31E2D]">*</span>
                  <Info className="size-3 text-white/40" />
                </p>

                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRentMode("gerbong");
                      if (selectedCarSlugs.length === DEFAULT_TRAIN_CARS.length) {
                        const current = DEFAULT_TRAIN_CARS[carIndex] ?? DEFAULT_TRAIN_CARS[0];
                        setSelectedCarSlugs([current.slug]);
                      }
                    }}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-[12px] font-semibold transition ${
                      rentMode === "gerbong"
                        ? "border-[#E31E2D] bg-[#E31E2D]/10 text-[#E31E2D] shadow-[0_0_12px_rgba(227,30,45,0.25)]"
                        : "border-white/20 text-white/80 hover:border-white/40"
                    }`}
                  >
                    <TrainFront className="size-3.5" />
                    Beberapa Gerbong
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRentMode("trainset");
                      setSelectedCarSlugs(DEFAULT_TRAIN_CARS.map((car) => car.slug));
                      setTrainsetQty((qty) => Math.min(Math.max(qty, 1), maxTrainsetQty));
                    }}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-[12px] font-semibold transition ${
                      rentMode === "trainset"
                        ? "border-[#E31E2D] bg-[#E31E2D]/10 text-[#E31E2D] shadow-[0_0_12px_rgba(227,30,45,0.25)]"
                        : "border-white/20 text-white/80 hover:border-white/40"
                    }`}
                  >
                    <TrainFront className="size-3.5" />
                    Satu Trainset
                  </button>
                </div>

                {rentMode === "gerbong" ? (
                  <>
                    <div
                      className="mt-4 flex items-end justify-center gap-0.5"
                      role="group"
                      aria-label="Pilih gerbong"
                    >
                      {DEFAULT_TRAIN_CARS.map((car, index) => {
                        const selected = selectedCarSlugs.includes(car.slug);
                        return (
                          <button
                            key={car.slug}
                            type="button"
                            onClick={() => toggleCar(car.slug)}
                            className="flex w-11 flex-col items-center gap-0.5"
                          >
                            <CarriageIcon
                              index={index}
                              total={DEFAULT_TRAIN_CARS.length}
                              selected={selected}
                            />
                            <span
                              className={`text-[8px] leading-tight font-medium whitespace-nowrap ${
                                selected ? "text-[#E31E2D] underline underline-offset-2" : "text-white/65"
                              }`}
                            >
                              {car.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold text-white/70">Gerbong yang Dipilih</p>
                        <p className="text-[11px] font-semibold text-white/80">
                          Total: {selectedCars.length} gerbong
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {selectedCars.map((car) => (
                          <span
                            key={car.slug}
                            className="inline-flex items-center gap-1 rounded-full bg-[#2a2a2a] px-2.5 py-1 text-[11px] font-medium text-white"
                          >
                            {car.label}
                            <button
                              type="button"
                              onClick={() => toggleCar(car.slug)}
                              className="rounded-full text-white/50 hover:text-white"
                              aria-label={`Hapus ${car.label}`}
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mt-3 rounded-xl border border-[#E31E2D]/35 bg-[#E31E2D]/10 p-3">
                    <p className="text-[11px] font-semibold text-[#FF4D57]">Jumlah train set</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-white/60">
                      Pilih 1 sampai {maxTrainsetQty} train set. Setiap train set mencakup seluruh 6
                      gerbong untuk {space.title}.
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setTrainsetQty((qty) => Math.max(1, qty - 1))}
                        disabled={trainsetQty <= 1}
                        className="inline-flex size-9 items-center justify-center rounded-lg border border-white/15 text-white transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label="Kurangi train set"
                      >
                        <Minus className="size-4" />
                      </button>
                      <p className="text-center">
                        <span className="block text-2xl leading-none font-bold text-white">{trainsetQty}</span>
                        <span className="mt-1 block text-[11px] text-white/55">
                          train set
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setTrainsetQty((qty) => Math.min(maxTrainsetQty, qty + 1))}
                        disabled={trainsetQty >= maxTrainsetQty}
                        className="inline-flex size-9 items-center justify-center rounded-lg border border-white/15 text-white transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label="Tambah train set"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="relative max-h-[min(920px,calc(100vh-24px))] overflow-y-auto bg-white p-5 sm:p-7 lg:p-8">
            <button
              type="button"
              onClick={() => setShowInterestModal(false)}
              className="absolute top-4 right-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Tutup formulir sewa space"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-5 pr-8">
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#D81435] uppercase">
                Ajukan Sewa Space
              </p>
              <h3 className="mt-1.5 text-2xl font-bold text-[#101828] sm:text-[28px]">
                Data Calon Penyewa
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Form ini khusus untuk media {space.title} ({space.displayNumber}) di {carLabel}.
              </p>
            </div>

            <TenantInterestForm
              trainRentalSpaceId={space.id}
              spaceCode={space.displayNumber}
              stationName={`Kereta LRT Jabodebek · ${space.title}`}
              extraMessage={extraMessage}
              variant="modal"
            />
          </div>
        </div>
      </div>
    ) : null}
    </>,
    document.body
  );
}
