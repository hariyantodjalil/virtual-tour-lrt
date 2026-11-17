import Link from "next/link";
import { ArrowRight, Check, CheckCircle2 } from "lucide-react";
import { PUBLIC_LEAD_PROCESS_STEPS, type CommercialLeadStatus } from "@/lib/commercial-pipeline";

type Props = {
  id: string;
  inquiryCode?: string;
  workflowSteps?: { stepOrder: number; leadStatus: CommercialLeadStatus; title: string; publicMessage: string }[];
  status: CommercialLeadStatus;
  spaceCode: string;
  stationName: string;
  onClose: () => void;
};

export default function InquiryConfirmation({ id, inquiryCode, workflowSteps, status, spaceCode, stationName, onClose }: Props) {
  const steps = workflowSteps?.length ? workflowSteps : PUBLIC_LEAD_PROCESS_STEPS.map((step, index) => ({ stepOrder: index + 1, leadStatus: step.status, title: step.title, publicMessage: step.detail }));
  const activeIndex = steps.findIndex(step => step.leadStatus === (status === "CLOSED_WON" ? "COMMERCIAL_OPERATION" : status));
  return <>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 lg:px-7">
      <div className="flex items-center gap-3">
        <CheckCircle2 aria-hidden="true" className="size-7 shrink-0 text-emerald-700" />
        <h3 className="text-lg font-semibold text-slate-900">Minat sewa tercatat</h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">Pengajuan untuk <strong className="font-semibold text-slate-900">{spaceCode}</strong> di Stasiun {stationName} sudah diterima.</p>
      <dl className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <dt className="text-xs font-medium text-slate-500">Referensi pengajuan</dt>
        <dd className="mt-1 break-all font-display text-sm font-semibold text-slate-900">{inquiryCode || id}</dd>
      </dl>
      <h4 className="mt-4 text-sm font-semibold text-slate-900">Tahapan pengajuan</h4>
      <ol className="mt-3" aria-label="Tahapan proses sewa">
        {steps.map((step, index) => {
          const current = index === activeIndex;
          const completed = index < activeIndex;
          return <li key={step.leadStatus} aria-current={current ? "step" : undefined} className="relative flex gap-3 pb-4 last:pb-0">
            {index < steps.length - 1 && <span aria-hidden="true" className="absolute top-8 bottom-1 left-3.5 w-px bg-slate-200" />}
            <span aria-hidden="true" className={`relative flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${current ? "bg-[#E31E2D] text-white" : completed ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{completed ? <Check className="size-4" /> : step.stepOrder}</span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-semibold text-slate-900">{step.title}</p>
              {current && <p className="mt-0.5 text-xs font-medium text-[#C41926]">Tahap saat ini</p>}
              <p className="mt-0.5 text-xs leading-snug text-slate-600">{step.publicMessage}</p>
            </div>
          </li>;
        })}
      </ol>
    </div>
    <div className="flex shrink-0 items-center gap-3 border-t border-slate-200 bg-white px-5 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] lg:px-7 lg:py-3.5">
      <button type="button" onClick={onClose} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D]">Selesai</button>
      <Link href={`/partner/inquiries/${encodeURIComponent(id)}`} className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-[#E31E2D] px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-[#C41926] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D]">Pantau di Portal Mitra<ArrowRight className="size-4 shrink-0" /></Link>
    </div>
  </>;
}
