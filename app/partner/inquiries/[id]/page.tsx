import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { ArrowLeft, ArrowUpRight, Check } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { partnerInquiryInclude, toPartnerInquiry } from "@/lib/partner-inquiries";
import { isCommercialOperation, LEAD_STATUS_LABELS } from "@/lib/commercial-pipeline";
import { inquiryMediaSchema } from "@/lib/inquiry-media";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium", timeZone: "Asia/Jakarta",
  }).format(value);
}

export default async function PartnerInquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole(new NextRequest("http://localhost/partner", { headers: await headers() }), ["MITRA"]);
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
  const status = isCommercialOperation(inquiry.status) ? "COMMERCIAL_OPERATION" : inquiry.status;
  const steps = inquiry.workflowVersion?.steps ?? [];
  const currentIndex = steps.findIndex(step => step.leadStatus === status);
  const documents = inquiry.mediaAttachments.filter(media => inquiryMediaSchema.shape.mediaLink.safeParse(media.mediaLink).success);

  return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6">
    <div className="mx-auto max-w-5xl">
      <Link href="/partner" className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold hover:text-[#C41926]">
        <ArrowLeft className="size-4" />Portal Mitra
      </Link>
      <header className="mb-6">
        <p className="text-sm text-slate-600">{inquiry.inquiryCode}</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">{inquiry.space?.name ?? inquiry.trainInquiry?.mediaTitle ?? "Pengajuan media iklan"}</h1>
        <p className="mt-2 text-sm text-slate-600">Diajukan {formatDate(inquiry.createdAt)}</p>
      </header>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="min-w-0 space-y-5">
          {inquiry.space && <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Informasi unit</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {[["Stasiun", inquiry.space.station.name], ["Kode unit", inquiry.space.code], ["Lokasi", inquiry.space.floor || inquiry.space.location], ["Luas", `${inquiry.space.area} m²`]].map(([label, value]) => <div key={label}>
                <dt className="text-slate-600">{label}</dt><dd className="mt-1 break-words font-medium">{value || "—"}</dd>
              </div>)}
            </dl>
            <Link href={`/station/${encodeURIComponent(inquiry.space.station.slug)}?unit=${encodeURIComponent(inquiry.space.id)}`} className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#C41926]">Lihat unit di tur<ArrowUpRight className="size-4" /></Link>
          </section>}
          {inquiry.trainInquiry && <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Media {inquiry.trainInquiry.mediaCode} ? {inquiry.trainInquiry.mediaTitle}</h2>
            <p className="mt-2 text-sm text-slate-600">{inquiry.trainInquiry.train.name}</p>
            {inquiry.trainInquiry.requestedTrainsetCount !== null && <p className="mt-3 text-sm">Permintaan {inquiry.trainInquiry.requestedTrainsetCount} trainset</p>}
            {inquiry.trainInquiry.campaignStart && inquiry.trainInquiry.campaignEnd && <p className="mt-3 text-sm">{formatDate(new Date(inquiry.trainInquiry.campaignStart))} ? {formatDate(new Date(inquiry.trainInquiry.campaignEnd))}</p>}
            {inquiry.trainInquiry.campaignNeeds && <p className="mt-3 whitespace-pre-wrap break-words text-sm">{inquiry.trainInquiry.campaignNeeds}</p>}
          </section>}
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Data pengajuan</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {[["Perusahaan / brand", inquiry.companyName], ["Penanggung jawab", inquiry.contactName], ["Email", inquiry.email], ["Telepon", inquiry.phone], ["Peruntukan usaha", inquiry.businessType], ["Catatan kebutuhan", inquiry.message]].filter(([, value]) => value).map(([label, value]) => <div key={label}>
                <dt className="text-slate-600">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words font-medium">{value}</dd>
              </div>)}
            </dl>
          </section>
        </div>
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Progres pengajuan</h2>
            <p className="mt-2 text-sm font-medium text-[#C41926]">{LEAD_STATUS_LABELS[inquiry.status]}</p>
            {inquiry.rejectionReason && <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-red-50 p-3 text-sm text-red-800">{inquiry.rejectionReason}</p>}
            <ol className="mt-5 space-y-4">
              {steps.map((step, index) => {
                const current = index === currentIndex;
                const completed = index < currentIndex || (isCommercialOperation(inquiry.status) && current);
                return <li key={step.id} aria-current={current ? "step" : undefined} className="flex gap-3">
                  <span aria-hidden="true" className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${completed ? "bg-emerald-50 text-emerald-800" : current ? "bg-[#E31E2D] text-white" : "bg-slate-100 text-slate-600"}`}>{completed ? <Check className="size-4" /> : step.stepOrder}</span>
                  <div className="min-w-0 pt-0.5"><p className="text-sm font-semibold">{step.title}</p>{current && <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.publicMessage}</p>}</div>
                </li>;
              })}
            </ol>
            {inquiry.siteVisitScheduledAt && <p className="mt-5 text-sm">Jadwal survei {formatDate(inquiry.siteVisitScheduledAt)}</p>}
          </section>
          {documents.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Dokumen pengajuan</h2>
            <ul className="mt-3 divide-y divide-slate-200">{documents.map(document => <li key={document.id}>
              <a href={document.mediaLink} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-between gap-3 py-3 text-sm font-medium text-[#C41926]"><span className="min-w-0 break-words">{document.mediaTitle}{document.documentNumber && <span className="mt-1 block text-xs text-slate-600">{document.documentNumber}</span>}</span><ArrowUpRight className="size-4 shrink-0" /></a>
            </li>)}</ul>
          </section>}
          {inquiry.stepLogs.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Riwayat pengajuan</h2>
            <ol className="mt-4 space-y-4">{inquiry.stepLogs.map(log => <li key={log.id}>
              <p className="text-sm font-medium">{log.pipelineStep?.title ?? "Pengajuan diterima"}</p>
              {log.notes && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{log.notes}</p>}
              <p className="mt-1 text-xs text-slate-500">{formatDate(log.createdAt)} · {log.performedBy}</p>
            </li>)}</ol>
          </section>}
        </div>
      </div>
    </div>
  </main>;
}
