"use client";

import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, AccordionTrigger } from "@ui-sdk/react/accordion";
import { ChevronDown, MessageCircle } from "lucide-react";
import { useTourLanguage } from "@/components/tour/TourLanguageProvider";

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
  contactWhatsAppUrl,
  teamName = "Tim Komersial LRT Jabodebek",
}: { contactWhatsAppUrl: string; teamName?: string }) {
  const { t, content } = useTourLanguage();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight text-[#101828] md:text-3xl">{t("Bantuan")}</h1>

      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <h2 className="text-base font-semibold text-[#101828]">{t("Hubungi")} {content(teamName)}</h2>
        <a
          href={contactWhatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#c41230] px-4 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c41230]"
        >
          <MessageCircle className="size-4" aria-hidden />
          {t("Chat WhatsApp")}
        </a>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-[#101828]">{t("Pertanyaan umum")}</h2>
        <Accordion aria-label={t("Pertanyaan umum")} className="mt-2 divide-y divide-slate-200">
          {FAQ_ITEMS.map(({ question, answer }) => (
            <AccordionItem key={question} value={question}>
              <AccordionHeader>
                <AccordionTrigger className="group flex min-h-11 w-full items-center justify-between gap-3 rounded-md py-3 text-left text-sm font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-[#c41230]">
                  <span>{t(question)}</span>
                  <ChevronDown aria-hidden className="size-4 shrink-0 text-slate-500 motion-safe:transition-transform group-aria-expanded:rotate-180" />
                </AccordionTrigger>
              </AccordionHeader>
              <AccordionPanel className="pb-4 text-sm leading-relaxed text-slate-600">{t(answer)}</AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}
