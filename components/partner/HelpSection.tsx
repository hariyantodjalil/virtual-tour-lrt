"use client";

import {
  Building2,
  CircleHelp,
  FileText,
  Glasses,
  Heart,
  Headset,
  MessageCircle,
  Settings,
} from "lucide-react";
import {
  PUBLIC_LEAD_PROCESS_STEPS,
  PUBLIC_LEASING_STEPS,
} from "@/lib/commercial-pipeline";

type Props = {
  displayName: string;
  contactWhatsAppUrl: string;
  teamName?: string;
  onOpenPengajuan: () => void;
  onOpenTour: () => void;
  tourReady: boolean;
};

const PORTAL_GUIDES = [
  {
    title: "Pengajuan Sewa",
    detail: "Pantau status, dokumen, dan progres setiap pengajuan yang sudah Anda kirim.",
    icon: FileText,
  },
  {
    title: "Unit Aktif Saya",
    detail: "Lihat unit yang sudah memasuki tahap sewa aktif setelah PKS dan pembayaran terverifikasi.",
    icon: Building2,
  },
  {
    title: "Favorit",
    detail: "Simpan unit dari virtual tour agar mudah dibuka kembali saat Anda siap mengajukan.",
    icon: Heart,
  },
  {
    title: "Pengaturan Akun",
    detail: "Perbarui nama tampilan dan kelola akses akun mitra Anda.",
    icon: Settings,
  },
] as const;

const FAQ_ITEMS = [
  {
    question: "Bagaimana cara mengajukan sewa?",
    answer:
      "Buka Virtual Tour, pilih stasiun dan unit, lalu isi formulir minat sewa. Pengajuan akan muncul otomatis di menu Pengajuan Sewa.",
  },
  {
    question: "Mengapa status pengajuan saya belum berubah?",
    answer:
      "Setiap tahap dikonfirmasi oleh tim komersial setelah dokumen atau tindakan yang diperlukan selesai. Anda dapat memantau progres dan dokumen di detail pengajuan.",
  },
  {
    question: "Apa yang terjadi setelah saya mengajukan site visit?",
    answer:
      "Permintaan site visit ditinjau tim komersial. Jadwal atau hasil kunjungan akan terlihat pada detail pengajuan setelah diperbarui admin.",
  },
  {
    question: "Dokumen apa yang biasanya diperlukan?",
    answer:
      "Di tahap negosiasi biasanya diperlukan LOI, Surat Negosiasi, dan BA Negosiasi. Selanjutnya ada dokumen desain dan PKS sesuai progres pengajuan.",
  },
  {
    question: "Kapan unit masuk ke Unit Aktif Saya?",
    answer:
      "Setelah tahap Sewa Aktif: pembayaran terverifikasi dan tanggal efektif sewa sudah berlaku.",
  },
] as const;

export default function HelpSection({
  displayName,
  contactWhatsAppUrl,
  teamName = "Tim Komersial LRT Jabodebek",
  onOpenPengajuan,
  onOpenTour,
  tourReady,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-base text-slate-600 md:text-lg">
          Halo, <span className="font-semibold text-[#101828]">{displayName}</span>
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#101828] md:text-3xl">Bantuan</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
          Panduan singkat portal mitra, alur sewa ruang komersial, dan kontak tim komersial bila Anda
          butuh bantuan langsung.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#c41230]">
              <Headset className="size-4" aria-hidden />
              Butuh bantuan langsung?
            </div>
            <h2 className="mt-2 text-lg font-bold text-[#101828]">Hubungi {teamName}</h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">
              Chat WhatsApp untuk pertanyaan proses sewa, dokumen, atau status pengajuan Anda.
            </p>
          </div>
          <a
            href={contactWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#c41230] px-4 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c41230]"
          >
            <MessageCircle className="size-4" aria-hidden />
            Chat WhatsApp
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-[#101828]">Cara memakai portal mitra</h2>
        <p className="mt-1 text-sm text-slate-500">Menu utama dan kegunaannya.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {PORTAL_GUIDES.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.title}
                className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#c41230] shadow-sm">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-[#101828]">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">{item.detail}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onOpenPengajuan}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c41230]"
          >
            <FileText className="size-4" aria-hidden />
            Buka Pengajuan Sewa
          </button>
          <button
            type="button"
            onClick={onOpenTour}
            disabled={!tourReady}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c41230] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Glasses className="size-4" aria-hidden />
            Buka Virtual Tour
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-[#101828]">Alur sewa ruang komersial</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ringkasan perjalanan dari jelajah unit sampai sewa aktif.
        </p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {PUBLIC_LEASING_STEPS.map((step) => (
            <li
              key={step.n}
              className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3"
            >
              <p className="text-xs font-semibold tracking-wide text-[#c41230]">{step.n}</p>
              <p className="mt-1 font-semibold text-[#101828]">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-[#101828]">Enam tahap progres pengajuan</h2>
        <p className="mt-1 text-sm text-slate-500">
          Status yang Anda lihat di detail pengajuan mengikuti tahap berikut.
        </p>
        <ol className="mt-4 space-y-3">
          {PUBLIC_LEAD_PROCESS_STEPS.map((step, index) => (
            <li
              key={step.status}
              className="flex gap-3 rounded-xl border border-slate-200 px-4 py-3 sm:gap-4"
            >
              <span
                aria-hidden
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[#c41230] text-xs font-bold text-white"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-[#101828]">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <CircleHelp className="size-4 text-[#c41230]" aria-hidden />
          <h2 className="text-lg font-bold text-[#101828]">Pertanyaan umum</h2>
        </div>
        <dl className="mt-4 divide-y divide-slate-200">
          {FAQ_ITEMS.map((item) => (
            <div key={item.question} className="py-4 first:pt-0 last:pb-0">
              <dt className="font-semibold text-[#101828]">{item.question}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-slate-500">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
