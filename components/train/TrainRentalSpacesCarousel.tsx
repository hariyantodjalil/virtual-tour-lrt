"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import {
  DEFAULT_TRAIN_RENTAL_SPACES,
  type TrainRentalSpacePublic,
} from "@/lib/train-rental-spaces-shared";
import { DEFAULT_TRAIN_SLUG } from "@/lib/train-constants";
import { resolvePublicAssetUrl, shouldUnoptimizeImage } from "@/lib/s3-utils";

type SlideItem = TrainRentalSpacePublic & { slideKey: string; loopIndex: number };

const FALLBACK_SPACES: TrainRentalSpacePublic[] = DEFAULT_TRAIN_RENTAL_SPACES.map((space) => ({
  id: space.displayNumber,
  displayNumber: space.displayNumber,
  title: space.title,
  description: space.description,
  image: space.image,
  objectPosition: space.objectPosition,
  availableTrainsets: [...space.availableTrainsets],
  availableByCar: { ...space.availableByCar },
  howToOrder: space.howToOrder,
  status: space.status,
  monthlyRent: space.monthlyRent,
}));

function getVisibleCount(width: number) {
  if (width >= 1280) return 4;
  if (width >= 768) return 3;
  if (width >= 640) return 2;
  return 1;
}

function spaceTourHref(tourHref: string, space: TrainRentalSpacePublic) {
  const base = tourHref.startsWith("/") ? tourHref : `/train/${DEFAULT_TRAIN_SLUG}`;
  return `${base}?space=${encodeURIComponent(space.displayNumber)}`;
}

function getNearestSlideIndex(track: HTMLDivElement, cards: HTMLElement[]) {
  const scrollLeft = track.scrollLeft;
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  cards.forEach((card, index) => {
    const distance = Math.abs(card.offsetLeft - scrollLeft);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = index;
    }
  });

  return nearest;
}

function RentalCard({
  space,
  href,
}: {
  space: SlideItem;
  href: string;
}) {
  return (
    <article
      data-rental-card
      data-loop-index={space.loopIndex}
      className="relative aspect-[3/4] w-[72%] shrink-0 snap-start overflow-hidden rounded-2xl sm:w-[calc((100%-1rem)/2)] md:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/3.5)] xl:w-[calc((100%-4rem)/4)]"
    >
      <Link
        href={href}
        className="absolute inset-0 text-left"
        aria-label={`Buka virtual tour ${space.title}`}
      >
        <Image
          src={resolvePublicAssetUrl(space.image)}
          alt={space.title}
          fill
          sizes="(max-width: 640px) 72vw, (max-width: 1024px) 40vw, 24vw"
          className="pointer-events-none object-cover select-none"
          style={{ objectPosition: space.objectPosition }}
          draggable={false}
          unoptimized={shouldUnoptimizeImage(resolvePublicAssetUrl(space.image))}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />

        <span className="pointer-events-none absolute top-3 left-3 inline-flex size-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
          <LayoutGrid className="size-4 text-white" strokeWidth={2} />
        </span>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-4 pb-4">
          <p className="text-sm font-semibold text-white">{space.title}</p>
          <p className="text-sm font-medium text-white/90">{space.displayNumber}</p>
        </div>
      </Link>
    </article>
  );
}

export default function TrainRentalSpacesCarousel({
  spaces = FALLBACK_SPACES,
  tourHref = `/train/${DEFAULT_TRAIN_SLUG}`,
}: {
  spaces?: TrainRentalSpacePublic[];
  tourHref?: string;
}) {
  const rentalSpaces = spaces.length > 0 ? spaces : FALLBACK_SPACES;

  const loopSlides = useMemo<SlideItem[]>(
    () =>
      Array.from({ length: 3 }, (_, setIndex) =>
        rentalSpaces.map((space, index) => ({
          ...space,
          slideKey: `${space.displayNumber}-set-${setIndex}`,
          loopIndex: setIndex * rentalSpaces.length + index,
        }))
      ).flat(),
    [rentalSpaces]
  );

  const trackRef = useRef<HTMLDivElement>(null);
  const slideIndexRef = useRef(rentalSpaces.length);
  const isJumpingRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(4);

  const realCount = rentalSpaces.length;
  const startIndex = realCount;
  const pageCount = Math.max(1, Math.ceil(realCount / visibleCount));
  const activePage = Math.min(pageCount - 1, Math.floor(activeIndex / visibleCount));

  const getCards = useCallback(() => {
    const track = trackRef.current;
    if (!track) return [];
    return Array.from(track.querySelectorAll<HTMLElement>("[data-rental-card]"));
  }, []);

  const getSetWidth = useCallback(
    (cards: HTMLElement[]) => cards[realCount].offsetLeft - cards[0].offsetLeft,
    [realCount]
  );

  const scrollToSlideIndex = useCallback(
    (slideIndex: number, behavior: ScrollBehavior = "smooth") => {
      const track = trackRef.current;
      const cards = getCards();
      const card = cards[slideIndex];
      if (!track || !card) return;

      const previousSnap = track.style.scrollSnapType;
      if (behavior === "auto") {
        track.style.scrollSnapType = "none";
      }

      track.scrollTo({ left: card.offsetLeft, behavior });

      slideIndexRef.current = slideIndex;
      setActiveIndex(slideIndex % realCount);

      if (behavior === "auto") {
        requestAnimationFrame(() => {
          if (trackRef.current) {
            trackRef.current.style.scrollSnapType = previousSnap || "";
          }
        });
      }
    },
    [getCards, realCount]
  );

  const repositionIfNeeded = useCallback(
    (direction?: -1 | 1) => {
      const track = trackRef.current;
      const cards = getCards();
      if (!track || cards.length === 0) return 0;

      const setWidth = getSetWidth(cards);
      let nearest = getNearestSlideIndex(track, cards);
      const maxScroll = track.scrollWidth - track.clientWidth;
      const atPhysicalEnd = track.scrollLeft >= maxScroll - 4;
      const atPhysicalStart = track.scrollLeft <= cards[0].offsetLeft + 4;
      const needsForwardRoom = direction === 1 && nearest >= cards.length - 1;
      const needsBackwardRoom = direction === -1 && nearest <= 0;

      const shouldJumpForward =
        needsForwardRoom || (direction === 1 && atPhysicalEnd) || (!direction && atPhysicalEnd);
      const shouldJumpBackward =
        needsBackwardRoom ||
        (direction === -1 && atPhysicalStart) ||
        (!direction && track.scrollLeft < cards[realCount].offsetLeft - 8);

      if (!shouldJumpForward && !shouldJumpBackward) {
        return nearest;
      }

      isJumpingRef.current = true;
      track.style.scrollSnapType = "none";

      if (shouldJumpBackward) {
        track.scrollLeft += setWidth;
      } else {
        track.scrollLeft -= setWidth;
      }

      nearest = getNearestSlideIndex(track, cards);

      requestAnimationFrame(() => {
        if (trackRef.current) {
          trackRef.current.style.scrollSnapType = "";
        }
        isJumpingRef.current = false;
      });

      return nearest;
    },
    [getCards, getSetWidth, realCount]
  );

  const syncActiveSlide = useCallback(() => {
    const track = trackRef.current;
    const cards = getCards();
    if (!track || cards.length === 0) return;

    const nearest = repositionIfNeeded();
    slideIndexRef.current = nearest;
    setActiveIndex(nearest % realCount);
  }, [getCards, repositionIfNeeded, realCount]);

  useEffect(() => {
    const track = trackRef.current;
    const cards = getCards();
    if (!track || cards.length === 0) return;

    track.style.scrollSnapType = "none";
    track.scrollLeft = cards[startIndex].offsetLeft;
    track.style.scrollSnapType = "";
    slideIndexRef.current = startIndex;
    setActiveIndex(0);
  }, [getCards, startIndex]);

  useEffect(() => {
    function updateVisibleCount() {
      setVisibleCount(getVisibleCount(window.innerWidth));
    }
    updateVisibleCount();
    window.addEventListener("resize", updateVisibleCount, { passive: true });
    return () => window.removeEventListener("resize", updateVisibleCount);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    function onScroll() {
      if (isJumpingRef.current) return;

      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => {
        syncActiveSlide();
      }, 100);
    }

    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, [syncActiveSlide]);

  const slideBy = useCallback(
    (direction: -1 | 1) => {
      const nearest = repositionIfNeeded(direction);
      scrollToSlideIndex(nearest + direction, "smooth");
    },
    [repositionIfNeeded, scrollToSlideIndex]
  );

  const scrollToPage = useCallback(
    (page: number) => {
      const wrappedPage = ((page % pageCount) + pageCount) % pageCount;
      const targetRealIndex = Math.min(wrappedPage * visibleCount, realCount - 1);
      scrollToSlideIndex(startIndex + targetRealIndex, "smooth");
    },
    [pageCount, realCount, scrollToSlideIndex, startIndex, visibleCount]
  );

  return (
    <section id="ruang-sewa" className="bg-white py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-10">
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold text-black md:text-[32px] md:leading-tight">
            Apa yang Ingin Anda Sewa?
          </h2>
          <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-black/75 md:text-[15px]">
            Pilih berbagai ruang dan fitur interior kereta untuk menempatkan brand Anda di tempat
            yang tepat.
          </p>
        </div>

        <div className="relative mt-10">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => slideBy(-1)}
              aria-label="Ruangan sebelumnya"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-md transition hover:border-[#d32f2f] hover:text-[#d32f2f] sm:size-10"
            >
              <ChevronLeft className="size-5" strokeWidth={2.25} />
            </button>

            <div
              ref={trackRef}
              className="min-w-0 flex-1 cursor-grab overflow-x-auto scroll-smooth active:cursor-grabbing [scroll-snap-type:x_mandatory] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="flex gap-4">
                {loopSlides.map((space) => (
                  <RentalCard
                    key={space.slideKey}
                    space={space}
                    href={spaceTourHref(tourHref, space)}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => slideBy(1)}
              aria-label="Ruangan berikutnya"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-md transition hover:border-[#d32f2f] hover:text-[#d32f2f] sm:size-10"
            >
              <ChevronRight className="size-5" strokeWidth={2.25} />
            </button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2">
            {Array.from({ length: pageCount }).map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => scrollToPage(index)}
                aria-label={`Halaman ${index + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  activePage === index ? "w-8 bg-black" : "w-4 bg-black/20 hover:bg-black/35"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
