import { getTourLanguageData, getTourTranslator } from "@/lib/tour-translated-content";
import { translateTourContent } from "@/lib/tour-language";
import { TourLanguageToggle } from "@/components/tour/TourLanguageProvider";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { ArrowLeft, ArrowUpRight, MapPin } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { partnerInquiryInclude, toPartnerInquiry } from "@/lib/partner-inquiries";
import {
  PUBLIC_LEAD_PROCESS_STEPS,
  publicLeadStageIndex,
  completedLeadStageIndex,
  inquiryStatusLabel,
} from "@/lib/commercial-pipeline";
import InquiryTimeline, { InquirySiteVisit } from "@/components/partner/InquiryTimeline";
import { leadStageBadgeClass } from "@/lib/cms-leads-shared";
import { cn } from "@/lib/utils";

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium text-[#101828]">{value}</dd>
    </div>
  );
}

export default async function PartnerInquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTourTranslator();
  const { initialLanguage, translations } = await getTourLanguageData();
  const locale = initialLanguage === "en" ? "en-GB" : "id-ID";
  const content = (text: string) => translateTourContent(initialLanguage, translations, text);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Asia/Jakarta" });
  const number = new Intl.NumberFormat(locale);
  const { id } = await params;
  const auth = await requireRole(new NextRequest("http://localhost/partner", { headers: await headers() }), [
    "MITRA",
  ]);
  if ("error" in auth) {
    if (auth.status === 401) redirect(`/login?redirect=${encodeURIComponent(`/partner/inquiries/${id}`)}`);
    notFound();
  }
  const row = await prisma.tenantLead.findFirst({
    where: { id, userId: auth.user.userId },
    include: partnerInquiryInclude,
  });
  if (!row) notFound();
  const inquiry = toPartnerInquiry(row);
  const documents = inquiry.mediaAttachments;
  const stageIndex = publicLeadStageIndex(inquiry.status);
  const stageTitle =
    completedLeadStageIndex(inquiry.status) < stageIndex
      ? "Negosiasi berlangsung"
      : (PUBLIC_LEAD_PROCESS_STEPS[stageIndex]?.title ?? "Pengajuan tidak dilanjutkan");
  const statusLabel = inquiryStatusLabel(inquiry.status);
  const title = inquiry.space?.name ?? inquiry.trainInquiry?.mediaTitle ?? "Pengajuan media iklan";
  const code = inquiry.space?.code ?? inquiry.trainInquiry?.mediaCode ?? inquiry.inquiryCode;

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-6 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-center justify-between gap-3">
        <Link
          href="/partner"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-[#c41230] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c41230]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("Kembali ke Pengajuan Sewa")}
        </Link>
        <TourLanguageToggle light refresh />
        </div>

        <header className="mb-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                leadStageBadgeClass(inquiry.status)
              )}
            >
              {t(statusLabel)}
            </span>
            <span className="text-xs text-slate-400">{t("Diajukan {date}", { date: date.format(inquiry.createdAt) })}</span>
          </div>
          <p className="mt-3 text-xs font-medium tracking-wide text-slate-400 uppercase">{code}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#101828] sm:text-3xl">{content(title)}</h1>
          {inquiry.space ? (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                {inquiry.space.station.name}
              </span>
              {(inquiry.space.floor || inquiry.space.location) && (
                <>
                  <span className="text-slate-300" aria-hidden>
                    ·
                  </span>
                  <span>{content(inquiry.space.floor || inquiry.space.location || "")}</span>
                </>
              )}
              <span className="text-slate-300" aria-hidden>
                ·
              </span>
              <span>{number.format(inquiry.space.area)} m²</span>
            </p>
          ) : null}
          <p className="mt-3 text-sm font-medium text-[#c41230]">{t(stageTitle)}</p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="min-w-0 space-y-5">
            {inquiry.space ? (
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-base font-bold text-[#101828]">{t("Informasi unit")}</h2>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <DetailField label={t("Stasiun")} value={inquiry.space.station.name} />
                  <DetailField label={t("Kode unit")} value={inquiry.space.code} />
                  <DetailField
                    label={t("Lokasi")}
                    value={content(inquiry.space.floor || inquiry.space.location || "—")}
                  />
                  <DetailField label={t("Luas")} value={`${number.format(inquiry.space.area)} m²`} />
                </dl>
                <Link
                  href={`/station/${encodeURIComponent(inquiry.space.station.slug)}?unit=${encodeURIComponent(inquiry.space.id)}`}
                  className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#c41230] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c41230]"
                >
                  {t("Lihat unit di tur")}
                  <ArrowUpRight className="size-4" aria-hidden />
                </Link>
              </section>
            ) : null}

            {inquiry.trainInquiry ? (
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-base font-bold text-[#101828]">
                  Media {inquiry.trainInquiry.mediaCode} — {content(inquiry.trainInquiry.mediaTitle)}
                </h2>
                <p className="mt-2 text-sm text-slate-500">{inquiry.trainInquiry.train.name}</p>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  {inquiry.trainInquiry.requestedTrainsetCount !== null ? (
                    <DetailField
                      label={t("Trainset")}
                      value={`${number.format(inquiry.trainInquiry.requestedTrainsetCount)} ${t("trainset")}`}
                    />
                  ) : null}
                  {inquiry.trainInquiry.campaignStart && inquiry.trainInquiry.campaignEnd ? (
                    <DetailField
                      label={t("Periode kampanye")}
                      value={`${date.format(new Date(inquiry.trainInquiry.campaignStart))} — ${date.format(new Date(inquiry.trainInquiry.campaignEnd))}`}
                    />
                  ) : null}
                  {inquiry.trainInquiry.carPreferences.length > 0 ? (
                    <DetailField
                      label={t("Preferensi kereta")}
                      value={inquiry.trainInquiry.carPreferences.map((car) => content(car.carLabel)).join(", ")}
                    />
                  ) : null}
                  {inquiry.trainInquiry.applicantStatusLabel ? (
                    <DetailField label={t("Status pengaju")} value={content(inquiry.trainInquiry.applicantStatusLabel)} />
                  ) : null}
                  {inquiry.trainInquiry.representedBrand ? (
                    <DetailField label={t("Brand yang diwakili")} value={inquiry.trainInquiry.representedBrand} />
                  ) : null}
                  {inquiry.trainInquiry.businessCategoryLabel ? (
                    <DetailField
                      label={t("Kategori bisnis")}
                      value={
                        inquiry.trainInquiry.businessCategoryOther ??
                        content(inquiry.trainInquiry.businessCategoryLabel)
                      }
                    />
                  ) : null}
                </dl>
                {inquiry.trainInquiry.campaignNeeds ? (
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm text-slate-600">
                    {inquiry.trainInquiry.campaignNeeds}
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-bold text-[#101828]">{t("Data pengajuan")}</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["Perusahaan / brand", inquiry.companyName],
                    ["Penanggung jawab", inquiry.contactName],
                    ["Email", inquiry.email],
                    ["Telepon", inquiry.phone],
                    ["Peruntukan usaha", inquiry.businessType],
                    ["Catatan kebutuhan", inquiry.message],
                  ] as const
                )
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <DetailField key={label} label={t(label)} value={label === "Peruntukan usaha" ? content(value!) : value!} />
                  ))}
              </dl>
            </section>
          </div>

          <div className="min-w-0 space-y-5">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-bold text-[#101828]">{t("Progres pengajuan")}</h2>
              <p className="mt-1 text-sm font-medium text-[#c41230]">{t(stageTitle)}</p>
              {inquiry.rejectionReason ? (
                <p className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {inquiry.rejectionReason}
                </p>
              ) : null}
              <div className="mt-5">
                <InquiryTimeline status={inquiry.status} />
              </div>
            </section>

            <InquirySiteVisit
              id={inquiry.id}
              status={inquiry.status}
              siteVisitStatus={inquiry.siteVisitStatus}
              scheduledAt={inquiry.siteVisitScheduledAt?.toISOString() ?? null}
              preference={inquiry.surveyPreference}
            />

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-bold text-[#101828]">{t("Periode sewa & pembayaran")}</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <DetailField
                  label={t("Mulai sewa")}
                  value={inquiry.leaseStartAt ? date.format(inquiry.leaseStartAt) : t("Belum ditetapkan")}
                />
                <DetailField
                  label={t("Akhir sewa")}
                  value={inquiry.leaseEndAt ? date.format(inquiry.leaseEndAt) : t("Belum ditetapkan")}
                />
                <DetailField
                  label={t("Pembayaran")}
                  value={
                    inquiry.paymentVerifiedAt
                      ? t("Terverifikasi {date}", { date: date.format(inquiry.paymentVerifiedAt) })
                      : t("Menunggu verifikasi")
                  }
                />
              </dl>
            </section>

            {documents.length > 0 ? (
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-base font-bold text-[#101828]">{t("Dokumen pengajuan")}</h2>
                <ul className="mt-3 divide-y divide-slate-100">
                  {documents.map((document) => (
                    <li key={document.id}>
                      <a
                        href={document.mediaLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-12 items-center justify-between gap-3 py-3 text-sm font-medium text-[#c41230] hover:underline"
                      >
                        <span className="min-w-0 break-words">
                          {content(document.mediaTitle)}
                          {document.verifiedAt ? (
                            <span className="mt-1 block text-xs font-medium text-emerald-700">
                              {t("Terverifikasi")}
                            </span>
                          ) : null}
                          {document.documentNumber ? (
                            <span className="mt-1 block text-xs font-normal text-slate-500">
                              {document.documentNumber}
                            </span>
                          ) : null}
                        </span>
                        <ArrowUpRight className="size-4 shrink-0" aria-hidden />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {inquiry.stepLogs.length > 0 ? (
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-base font-bold text-[#101828]">{t("Riwayat pengajuan")}</h2>
                <ol className="mt-4 space-y-4">
                  {inquiry.stepLogs.map((log) => (
                    <li key={log.id}>
                      <p className="text-sm font-semibold text-[#101828]">
                        {content(log.pipelineStep?.title ?? "Pengajuan diterima")}
                      </p>
                      {log.notes ? (
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">
                          {content(log.notes)}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-400">
                        {date.format(log.createdAt)} · {content(log.performedBy)}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
