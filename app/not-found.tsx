import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#07111f] px-4 text-center">
      <p className="text-sm font-semibold tracking-wide text-[#E31E2D]">404</p>
      <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Halaman tidak ditemukan</h1>
      <p className="mt-3 max-w-md text-sm text-slate-400">
        URL yang Anda buka tidak tersedia atau sudah dipindahkan.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex rounded-xl bg-[#E31E2D] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#c41926]"
      >
        Kembali ke beranda
      </Link>
    </div>
  );
}
