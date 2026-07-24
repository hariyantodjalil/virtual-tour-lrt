"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="id">
      <body className="m-0 min-h-screen bg-[#07111f] font-sans text-white antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
          <p className="text-sm font-semibold tracking-wide text-[#E31E2D]">Error</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Aplikasi bermasalah</h1>
          <p className="mt-3 max-w-md text-sm text-slate-400">
            Terjadi error pada root layout. Muat ulang halaman untuk melanjutkan.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-8 inline-flex rounded-xl bg-[#E31E2D] px-5 py-2.5 text-sm font-bold text-white"
          >
            Muat ulang
          </button>
        </div>
      </body>
    </html>
  );
}
