"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#07111f] px-4 text-center">
      <p className="text-sm font-semibold tracking-wide text-[#E31E2D]">Error</p>
      <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Terjadi kesalahan</h1>
      <p className="mt-3 max-w-md text-sm text-slate-400">
        Halaman gagal dimuat. Silakan coba lagi atau kembali ke beranda.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex rounded-xl bg-[#E31E2D] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#c41926]"
        >
          Coba lagi
        </button>
        <Link
          href="/"
          className="inline-flex rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5"
        >
          Beranda
        </Link>
      </div>
    </div>
  );
}
