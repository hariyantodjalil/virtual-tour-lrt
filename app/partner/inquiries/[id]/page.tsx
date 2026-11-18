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

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium text-[#101828]">{value}</dd>
    </div>
  );
}

export default async function PartnerInquiryPage({ params }: { params: Promise<{ id: string }> }) {
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
        <Link
          href="/partner"
          className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-[#c41230] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c41230]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Kembali ke Pengajuan Sewa
        </Link>

        <header className="mb-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                leadStageBadgeClass(inquiry.status)
              )}
            >
              {statusLabel}
            </span>
            <span className="text-xs text-slate-400">Diajukan {formatDate(inquiry.createdAt)}</span>
          </div>
          <p className="mt-3 text-xs font-medium tracking-wide text-slate-400 uppercase">{code}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#101828] sm:text-3xl">{title}</h1>
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
                  <span>{inquiry.space.floor || inquiry.space.location}</span>
                </>
              )}
              <span className="text-slate-300" aria-hidden>
                ·
              </span>
              <span>{inquiry.space.area} m²</span>
            </p>
          ) : null}
          <p className="mt-3 text-sm font-medium text-[#c41230]">{stageTitle}</p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="min-w-0 space-y-5">
            {inquiry.space ? (
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-base font-bold text-[#101828]">Informasi unit</h2>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <DetailField label="Stasiun" value={inquiry.space.station.name} />
                  <DetailField label="Kode unit" value={inquiry.space.code} />
                  <DetailField
                    label="Lokasi"
                    value={inquiry.space.floor || inquiry.space.location || "—"}
                  />
                  <DetailField label="Luas" value={`${inquiry.space.area} m²`} />
                </dl>
                <Link
                  href={`/station/${encodeURIComponent(inquiry.space.station.slug)}?unit=${encodeURIComponent(inquiry.space.id)}`}
                  className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#c41230] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c41230]"
                >
                  Lihat unit di tur
                  <ArrowUpRight className="size-4" aria-hidden />
                </Link>
              </section>
            ) : null}

            {inquiry.trainInquiry ? (
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-base font-bold text-[#101828]">
                  Media {inquiry.trainInquiry.mediaCode} — {inquiry.trainInquiry.mediaTitle}
                </h2>
                <p className="mt-2 text-sm text-slate-500">{inquiry.trainInquiry.train.name}</p>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  {inquiry.trainInquiry.requestedTrainsetCount !== null ? (
                    <DetailField
                      label="Trainset"
                      value={`${inquiry.trainInquiry.requestedTrainsetCount} trainset`}
                    />
                  ) : null}
                  {inquiry.trainInquiry.campaignStart && inquiry.trainInquiry.campaignEnd ? (
                    <DetailField
                      label="Periode kampanye"
                      value={`${formatDate(new Date(inquiry.trainInquiry.campaignStart))} — ${formatDate(new Date(inquiry.trainInquiry.campaignEnd))}`}
                    />
                  ) : null}
                  {inquiry.trainInquiry.carPreferences.length > 0 ? (
                    <DetailField
                      label="Preferensi kereta"
                      value={inquiry.trainInquiry.carPreferences.map((car) => car.carLabel).join(", ")}
                    />
                  ) : null}
                  {inquiry.trainInquiry.applicantStatusLabel ? (
                    <DetailField label="Status pengaju" value={inquiry.trainInquiry.applicantStatusLabel} />
                  ) : null}
                  {inquiry.trainInquiry.representedBrand ? (
                    <DetailField label="Brand yang diwakili" value={inquiry.trainInquiry.representedBrand} />
                  ) : null}
                  {inquiry.trainInquiry.businessCategoryLabel ? (
                    <DetailField
                      label="Kategori bisnis"
                      value={
                        inquiry.trainInquiry.businessCategoryOther ??
                        inquiry.trainInquiry.businessCategoryLabel
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
              <h2 className="text-base font-bold text-[#101828]">Data pengajuan</h2>
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
                    <DetailField key={label} label={label} value={value!} />
                  ))}
              </dl>
            </section>
          </div>

          <div className="min-w-0 space-y-5">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-bold text-[#101828]">Progres pengajuan</h2>
              <p className="mt-1 text-sm font-medium text-[#c41230]">{stageTitle}</p>
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
              <h2 className="text-base font-bold text-[#101828]">Periode sewa & pembayaran</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <DetailField
                  label="Mulai sewa"
                  value={inquiry.leaseStartAt ? formatDate(inquiry.leaseStartAt) : "Belum ditetapkan"}
                />
                <DetailField
                  label="Akhir sewa"
                  value={inquiry.leaseEndAt ? formatDate(inquiry.leaseEndAt) : "Belum ditetapkan"}
                />
                <DetailField
                  label="Pembayaran"
                  value={
                    inquiry.paymentVerifiedAt
                      ? `Terverifikasi ${formatDate(inquiry.paymentVerifiedAt)}`
                      : "Menunggu verifikasi"
                  }
                />
              </dl>
            </section>

            {documents.length > 0 ? (
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-base font-bold text-[#101828]">Dokumen pengajuan</h2>
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
                          {document.mediaTitle}
                          {document.verifiedAt ? (
                            <span className="mt-1 block text-xs font-medium text-emerald-700">
                              Terverifikasi
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
                <h2 className="text-base font-bold text-[#101828]">Riwayat pengajuan</h2>
                <ol className="mt-4 space-y-4">
                  {inquiry.stepLogs.map((log) => (
                    <li key={log.id}>
                      <p className="text-sm font-semibold text-[#101828]">
                        {log.pipelineStep?.title ?? "Pengajuan diterima"}
                      </p>
                      {log.notes ? (
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">
                          {log.notes}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-400">
                        {formatDate(log.createdAt)} · {log.performedBy}
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
