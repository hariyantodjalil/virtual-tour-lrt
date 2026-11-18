import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { type CommercialLeadStatus } from "@/lib/commercial-pipeline";

import InquiryTimeline from "@/components/partner/InquiryTimeline";

type Props = {
  id: string;
  isTrain?: boolean;
  inquiryCode?: string;
  workflowSteps?: { stepOrder: number; leadStatus: CommercialLeadStatus; title: string; publicMessage: string }[];
  status: CommercialLeadStatus;
  spaceCode: string;
  stationName: string;
  onClose: () => void;
};

export default function InquiryConfirmation({ id, inquiryCode, status, spaceCode, stationName, isTrain = false, onClose }: Props) {
  return <>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-7">
      <div className="flex items-center gap-3">
        <CheckCircle2 aria-hidden="true" className="size-8 shrink-0 text-emerald-700" />
        <h3 className="text-lg font-semibold">Minat sewa tercatat</h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">Pengajuan untuk <strong className="font-semibold text-slate-900">{spaceCode}</strong> di {isTrain ? "" : "Stasiun "}{stationName} sudah diterima.</p>
      <dl className="mt-3 border-b border-slate-200 pb-3">
        <dt className="text-xs text-slate-600">Referensi pengajuan</dt>
        <dd className="mt-1 text-sm font-medium break-all text-slate-900">{inquiryCode || id}</dd>
      </dl>
      <h4 className="mt-4 text-sm font-semibold">Tahapan pengajuan</h4>
      <div className="mt-3"><InquiryTimeline status={status} /></div>
    </div>
    <div className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] gap-2 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7 lg:pb-4">
      <button type="button" onClick={onClose} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#E31E2D]">Selesai</button>
      <Link href={`/partner/inquiries/${encodeURIComponent(id)}`} className="inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl bg-[#E31E2D] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[#c41926] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D]">Pantau di Portal Mitra<ArrowRight className="size-4 shrink-0" /></Link>
    </div>
  </>;
}
