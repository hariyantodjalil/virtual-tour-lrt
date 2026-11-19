"use client";

import { useTourLanguage } from "@/components/tour/TourLanguageProvider";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Circle, LoaderCircle } from "lucide-react";
import {
  PUBLIC_LEAD_PROCESS_STEPS,
  publicLeadStageIndex,
  completedLeadStageIndex,
  SITE_VISIT_STATUS_LABELS,
  type CommercialSiteVisitStatus,
} from "@/lib/commercial-pipeline";
import { notifyCmsLeadsUpdated, notifyPartnerLeadsUpdated } from "@/lib/inquiry-sync-events";

/** Always render the six public milestones, never historical CMS workflow steps. */
export default function InquiryTimeline({ status, compact = false }: { status: string; compact?: boolean }) {
  const { t } = useTourLanguage();
  const active = publicLeadStageIndex(status);
  const completed = completedLeadStageIndex(status);

  if (compact) {
    const currentStep = PUBLIC_LEAD_PROCESS_STEPS[Math.max(0, active)] ?? PUBLIC_LEAD_PROCESS_STEPS[0];
    return (
      <div className="space-y-2.5">
        <ol aria-label={t("Tahapan proses sewa")} className="flex items-center">
          {PUBLIC_LEAD_PROCESS_STEPS.map((step, index) => {
            const done = index <= completed;
            const current = index === active && !done;
            return (
              <li
                key={step.status}
                aria-current={current ? "step" : undefined}
                title={t(step.title)}
                className="relative flex min-w-0 flex-1 items-center justify-center"
              >
                {index < PUBLIC_LEAD_PROCESS_STEPS.length - 1 ? (
                  <span
                    aria-hidden
                    className={`absolute top-1/2 left-[calc(50%+10px)] right-[calc(-50%+10px)] h-px -translate-y-1/2 ${
                      index < completed ? "bg-emerald-300" : "bg-slate-200"
                    }`}
                  />
                ) : null}
                <span
                  aria-hidden
                  className={`relative z-[1] flex size-5 items-center justify-center rounded-full ${
                    done
                      ? "bg-emerald-600 text-white"
                      : current
                        ? "bg-[#c41230] text-white ring-2 ring-[#c41230]/20"
                        : "bg-white text-slate-400 ring-1 ring-slate-200"
                  }`}
                >
                  {done ? (
                    <Check className="size-3" strokeWidth={2.5} />
                  ) : (
                    <span className="text-xs font-semibold leading-none">{index + 1}</span>
                  )}
                </span>
                <span className="sr-only">
                  {t(step.title)}. {done ? t("Selesai") : current ? t("Dalam proses") : t("Menunggu")}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="text-sm font-medium text-[#101828]">{t(currentStep.title)}</p>
      </div>
    );
  }

  return (
    <ol aria-label={t("Tahapan proses sewa")} className="space-y-5">
      {PUBLIC_LEAD_PROCESS_STEPS.map((step, index) => {
        const done = index <= completed;
        const current = index === active && !done;
        return (
          <li key={step.status} aria-current={current ? "step" : undefined} className="relative flex gap-3">
            {index < PUBLIC_LEAD_PROCESS_STEPS.length - 1 && (
              <span
                aria-hidden
                className={`absolute top-7 -bottom-5 left-3.5 w-px ${done ? "bg-emerald-200" : "bg-slate-200"}`}
              />
            )}
            <span
              aria-hidden
              className={`relative flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                done
                  ? "bg-emerald-50 text-emerald-800"
                  : current
                    ? "bg-[#c41230] text-white"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              {done ? <Check className="size-4" /> : current ? index + 1 : <Circle className="size-3" />}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={`text-sm ${done || current ? "font-semibold text-slate-900" : "text-slate-600"}`}>
                {t(step.title)}
              </p>
              <p
                className={`mt-1 text-xs font-medium ${
                  done ? "text-emerald-800" : current ? "text-[#a81724]" : "text-slate-500"
                }`}
              >
                {done ? t("Selesai") : current ? t("Dalam proses") : status === "CLOSED_LOST" ? t("Tidak dilanjutkan") : t("Menunggu")}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{t(step.detail)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function InquirySiteVisit({ id, status, siteVisitStatus, scheduledAt, preference }: { id: string; status: string; siteVisitStatus: string; scheduledAt: string | null; preference: string | null }) {
  const { t, locale } = useTourLanguage();
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
      setSubmitted(true);
      notifyPartnerLeadsUpdated();
      notifyCmsLeadsUpdated();
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Permintaan belum terkirim. Silakan coba lagi."); }
    finally { setPending(false); }
  }
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 text-[#101828] md:p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[#101828]">
        <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-[#c41230]" />
        {t("Site visit · Negosiasi")}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {t("Kunjungan lokasi merupakan bagian dari negosiasi, bukan tahapan terpisah.")}
      </p>

      {(siteVisitStatus !== "NONE" || submitted) && (
        <p role="status" className="mt-3 text-sm font-medium text-[#101828]">
          {submitted
            ? t("Permintaan site visit terkirim")
            : t(
                SITE_VISIT_STATUS_LABELS[
                  siteVisitStatus as CommercialSiteVisitStatus
                ] ?? siteVisitStatus
              )}
        </p>
      )}
      {scheduledAt && (
        <p className="mt-2 text-sm tabular-nums text-slate-700">
          {new Intl.DateTimeFormat(locale, {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "Asia/Jakarta",
          }).format(new Date(scheduledAt))}{" "}
          {t("WIB")}
        </p>
      )}
      {preference && (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">
          <span className="font-medium text-[#101828]">{t("Preferensi:")}</span>{" "}
          {preference}
        </p>
      )}

      {canRequest && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="survey-preference"
              className="mb-1.5 block text-sm font-medium text-[#101828]"
            >
              {t("Preferensi waktu kunjungan")}
            </label>
            <textarea
              id="survey-preference"
              required
              minLength={3}
              maxLength={500}
              rows={3}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={t(
                "Tuliskan hari, waktu, dan kebutuhan kunjungan Anda"
              )}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#101828] shadow-sm placeholder:text-slate-400 focus-visible:border-[#c41230] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c41230]/25"
            />
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              {t("Tim komersial akan mengonfirmasi jadwal kunjungan.")}
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {t(error)}
            </p>
          )}
          <button
            type="submit"
            disabled={pending || value.trim().length < 3}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#c41230] px-4 text-sm font-medium text-white hover:bg-[#a80f29] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c41230]/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending && (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin motion-reduce:animate-none"
              />
            )}
            {pending ? t("Mengirim…") : t("Ajukan site visit")}
          </button>
        </form>
      )}
    </section>
  );
}
