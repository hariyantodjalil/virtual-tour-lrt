"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Map } from "lucide-react";
import { useTourLanguage } from "./TourLanguageProvider";

export default function FloorplanImage({ src, name, onLoad, onError }: {
  src: string;
  name: string;
  onLoad?: () => void;
  onError?: () => void;
}) {
  const { t, content } = useTourLanguage();
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");

  useEffect(() => {
    if (status !== "loading") return;
    const timer = setTimeout(() => setStatus("failed"), 10000);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (status === "failed") onError?.();
  }, [status, onError]);

  return <>
    <Image src={src} alt={t("Denah {name}", { name: content(name) })} fill unoptimized
      draggable={false} className={`select-none object-contain ${status === "loaded" ? "" : "opacity-0"}`}
      onLoad={() => { setStatus("loaded"); onLoad?.(); }}
      onError={() => setStatus("failed")} />
    {status !== "loaded" && <span role="status" className="pointer-events-none absolute inset-0 grid place-content-center justify-items-center gap-1.5 p-3 text-center text-xs font-medium text-slate-600">
      <Map aria-hidden="true" className="size-5" />
      {t(status === "loading" ? "Memuat denah…" : "Gambar denah belum dapat dimuat.")}
    </span>}
  </>;
}
