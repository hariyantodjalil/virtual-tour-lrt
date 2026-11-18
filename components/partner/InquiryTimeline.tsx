"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Circle, LoaderCircle } from "lucide-react";
import { PUBLIC_LEAD_PROCESS_STEPS, publicLeadStageIndex, completedLeadStageIndex, SITE_VISIT_STATUS_LABELS, type CommercialSiteVisitStatus } from "@/lib/commercial-pipeline";

export function inquiryStatusLabel(status: string) {
  if (["RDS_OFFER", "NEGOTIATING", "SITE_CHECK"].includes(status)) return "Negosiasi berlangsung";
  return PUBLIC_LEAD_PROCESS_STEPS[publicLeadStageIndex(status)]?.title ?? "Pengajuan tidak dilanjutkan";
}

/** Always render the six public milestones, never historical CMS workflow steps. */
export default function InquiryTimeline({ status, compact = false }: { status: string; compact?: boolean }) {
  const active = publicLeadStageIndex(status);
  const completed = completedLeadStageIndex(status);
  return <ol aria-label="Tahapan proses sewa" className={compact ? "space-y-3" : "space-y-5"}>
    {PUBLIC_LEAD_PROCESS_STEPS.map((step, index) => {
      const done = index <= completed;
      const current = index === active && !done;
      return <li key={step.status} aria-current={current ? "step" : undefined} className="relative flex gap-3">
        {index < PUBLIC_LEAD_PROCESS_STEPS.length - 1 && <span aria-hidden="true" className={`absolute top-7 -bottom-5 left-3.5 w-px ${done ? "bg-emerald-200" : "bg-slate-200"}`} />}
        <span aria-hidden="true" className={`relative flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? "bg-emerald-50 text-emerald-800" : current ? "bg-[#c41230] text-white" : "bg-slate-100 text-slate-500"}`}>
          {done ? <Check className="size-4" /> : current ? index + 1 : <Circle className="size-3" />}
        </span>
        <div className="min-w-0 pt-0.5">
          <p className={`text-sm ${done || current ? "font-semibold text-slate-900" : "text-slate-600"}`}>{step.title}</p>
          {!compact && <><p className={`mt-1 text-xs font-medium ${done ? "text-emerald-800" : current ? "text-[#a81724]" : "text-slate-500"}`}>{done ? "Selesai" : current ? "Dalam proses" : status === "CLOSED_LOST" ? "Tidak dilanjutkan" : "Menunggu"}</p><p className="mt-1 text-sm leading-relaxed text-slate-600">{step.detail}</p></>}
          {compact && <span className="sr-only">{done ? "Selesai" : current ? "Dalam proses" : "Menunggu"}</span>}
        </div>
      </li>;
    })}
  </ol>;
}

export function InquirySiteVisit({ id, status, siteVisitStatus, scheduledAt, preference }: { id: string; status: string; siteVisitStatus: string; scheduledAt: string | null; preference: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(preference ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const canRequest = ["NEW", "CONTACTED", "RDS_OFFER", "NEGOTIATING", "SITE_CHECK"].includes(status) && ["NONE", "CANCELLED"].includes(siteVisitStatus) && !submitted;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/partner/inquiries/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ surveyPreference: value.trim() }) });
      if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error || "Permintaan belum terkirim. Silakan coba lagi."); }
      setSubmitted(true); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Permintaan belum terkirim. Silakan coba lagi."); }
    finally { setPending(false); }
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <h2 className="flex items-center gap-2 font-semibold"><CalendarDays aria-hidden="true" className="size-5 text-[#c41230]" />Site visit · Negosiasi</h2>
    <p className="mt-2 text-sm leading-relaxed text-slate-600">Kunjungan lokasi merupakan bagian dari negosiasi, bukan tahapan terpisah.</p>
    {(siteVisitStatus !== "NONE" || submitted) && <p role="status" className="mt-3 text-sm font-medium">{submitted ? "Permintaan site visit terkirim" : SITE_VISIT_STATUS_LABELS[siteVisitStatus as CommercialSiteVisitStatus] ?? siteVisitStatus}</p>}
    {scheduledAt && <p className="mt-2 text-sm">{new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(scheduledAt))} WIB</p>}
    {preference && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">Preferensi: {preference}</p>}
    {canRequest && <form onSubmit={submit} className="mt-4">
      <label htmlFor="survey-preference" className="block text-sm font-medium">Preferensi waktu kunjungan</label>
      <textarea id="survey-preference" required minLength={3} maxLength={500} rows={3} value={value} onChange={event => setValue(event.target.value)} placeholder="Tuliskan hari, waktu, dan kebutuhan kunjungan Anda" className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm focus-visible:outline-2 focus-visible:outline-[#c41230]" />
      <p className="mt-1 text-xs text-slate-600">Tim komersial akan mengonfirmasi jadwal kunjungan.</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={pending || value.trim().length < 3} className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#c41230] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a80f29] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c41230] disabled:opacity-50">{pending && <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}{pending ? "Mengirim…" : "Ajukan site visit"}</button>
    </form>}
  </section>;
}
