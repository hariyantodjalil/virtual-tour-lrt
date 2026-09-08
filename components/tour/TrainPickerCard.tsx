import Image from "next/image";
import { Train } from "lucide-react";

export type TrainPickerItem = {
  slug: string;
  name: string;
  formation: string | null;
  imageUrl: string | null;
};

type Props = {
  train: TrainPickerItem;
  variant?: "light" | "dark";
  className?: string;
};

const FALLBACK_IMAGE = "/brand/landing/hero-train-station.jpg";

export default function TrainPickerCard({ train, variant = "dark", className = "" }: Props) {
  const isDark = variant === "dark";
  const imageSrc = train.imageUrl?.trim() || FALLBACK_IMAGE;

  return (
    <article
      className={`group flex w-full flex-col overflow-hidden rounded-2xl text-left transition ${
        isDark
          ? "border border-white/15 bg-black/40 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm hover:border-[#d32f2f]/60 hover:bg-black/50"
          : "bg-white shadow-[0_2px_12px_rgba(16,24,40,0.08)] hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(16,24,40,0.14)]"
      } ${className}`}
    >
      <span className="relative block h-[140px] w-full shrink-0 overflow-hidden sm:h-[150px]">
        <Image
          src={imageSrc}
          alt={train.name}
          fill
          sizes="(max-width: 640px) 100vw, 320px"
          className="object-cover transition duration-500 group-hover:scale-105"
          unoptimized={imageSrc.startsWith("http") || imageSrc.startsWith("/api/")}
        />
        {isDark ? (
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        ) : null}
      </span>

      <span className={`flex flex-1 flex-col gap-2.5 px-3.5 pt-3 pb-3.5 ${isDark ? "text-white" : ""}`}>
        <span
          className={`block text-[15px] font-bold leading-snug ${isDark ? "text-white" : "text-[#101828]"}`}
        >
          {train.name}
        </span>

        {train.formation ? (
          <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
              isDark ? "bg-white/10 text-white/80" : "bg-[#fce8eb] text-[#d32f2f]"
            }`}
          >
            <Train className="size-3.5 shrink-0" strokeWidth={2.25} />
            {train.formation}
          </span>
        ) : null}

        <span
          className={`mt-auto inline-flex items-center gap-1.5 text-xs font-semibold ${
            isDark ? "text-[#ff8a8a] group-hover:text-white" : "text-[#d32f2f]"
          }`}
        >
          Mulai tour
          <span aria-hidden className="transition group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </span>
    </article>
  );
}
