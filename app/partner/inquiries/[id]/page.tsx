"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { useCommercialProfile } from "@/components/commercial/CommercialProfileProvider";
import PartnerInquiryWorkspace, {
  type PartnerInquiryDetail,
} from "@/components/partner/PartnerInquiryWorkspace";
import { PARTNER_LEADS_UPDATED_EVENT } from "@/lib/inquiry-sync-events";
import { useInquiryRealtimeSync } from "@/components/realtime/useInquiryRealtimeSync";

type InquiryFetchResult =
  | { kind: "unauthorized" }
  | { kind: "not-found" }
  | { kind: "error"; message: string }
  | { kind: "ok"; data: PartnerInquiryDetail };

function hasInquiryDetailChanged(
  prev: PartnerInquiryDetail | null,
  next: PartnerInquiryDetail
): boolean {
  if (!prev) return false;
  return (
    prev.status !== next.status ||
    prev.currentStepOrder !== next.currentStepOrder ||
    prev.updatedAt !== next.updatedAt ||
    prev.siteVisitStatus !== next.siteVisitStatus ||
    prev.siteVisitScheduledAt !== next.siteVisitScheduledAt ||
    prev.rejectionReason !== next.rejectionReason ||
    prev.workflowVersion?.id !== next.workflowVersion?.id ||
    (prev.workflowVersion?.steps?.length ?? 0) !==
      (next.workflowVersion?.steps?.length ?? 0) ||
    prev.stepLogs.length !== next.stepLogs.length ||
    prev.mediaAttachments.length !== next.mediaAttachments.length
  );
}

async function requestInquiryDetail(id: string): Promise<InquiryFetchResult> {
  try {
    const res = await fetch(`/api/partner/inquiries/${id}`, {
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) {
      return { kind: "unauthorized" };
    }
    if (res.status === 404) {
      return { kind: "not-found" };
    }
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        kind: "error",
        message: errData.error || "Gagal memuat detail pengajuan",
      };
    }
    const data = (await res.json()) as PartnerInquiryDetail;
    return { kind: "ok", data };
  } catch (err: unknown) {
    return {
      kind: "error",
      message:
        err instanceof Error ? err.message : "Terjadi kesalahan saat memuat data",
    };
  }
}

export default function InquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const commercialProfile = useCommercialProfile();

  const [inquiry, setInquiry] = useState<PartnerInquiryDetail | null>(null);
  const inquiryRef = useRef<PartnerInquiryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveNotice, setLiveNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!liveNotice) return;
    const timer = window.setTimeout(() => setLiveNotice(null), 6_000);
    return () => window.clearTimeout(timer);
  }, [liveNotice]);

  const applyInquiryResult = useCallback(
    (result: InquiryFetchResult, options: { silent: boolean }) => {
      if (result.kind === "unauthorized") {
        router.push(
          "/login?redirect=" +
            encodeURIComponent(`/partner/inquiries/${resolvedParams.id}`)
        );
        return;
      }
      if (result.kind === "not-found") {
        if (options.silent) {
          inquiryRef.current = null;
          setInquiry(null);
          setError("Pengajuan ini telah dihapus atau tidak lagi tersedia.");
        } else {
          setError("Pengajuan tidak ditemukan.");
        }
        return;
      }
      if (result.kind === "error") {
        if (!options.silent) {
          setError(result.message);
        }
        return;
      }

      const data = result.data;
      const changed =
        options.silent && hasInquiryDetailChanged(inquiryRef.current, data);
      inquiryRef.current = data;
      setInquiry(data);
      setError(null);
      if (changed) {
        setLiveNotice(
          "Status atau detail pengajuan baru saja diperbarui oleh Tim Komersial."
        );
      }
    },
    [resolvedParams.id, router]
  );

  useEffect(() => {
    let cancelled = false;
    async function loadInitial() {
      const result = await requestInquiryDetail(resolvedParams.id);
      if (cancelled) return;
      applyInquiryResult(result, { silent: false });
      setLoading(false);
    }
    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, [applyInquiryResult, resolvedParams.id]);

  useInquiryRealtimeSync({
    enabled: Boolean(inquiry),
    leadId: resolvedParams.id,
    localEvents: [PARTNER_LEADS_UPDATED_EVENT],
    fallbackIntervalMs: 30_000,
    onSync: async () => {
      const result = await requestInquiryDetail(resolvedParams.id);
      applyInquiryResult(result, { silent: true });
    },
  });

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 animate-spin rounded-full border-2 border-[#c41230] border-t-transparent" />
          <p className="text-sm font-medium text-slate-600">
            Memuat detail pengajuan sewa
          </p>
        </div>
      </div>
    );
  }

  if (error || !inquiry) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <ShieldAlert className="size-6" strokeWidth={1.5} />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-[#101828]">
            Pengajuan Tidak Ditemukan
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {error || "Data pengajuan tidak ditemukan"}
          </p>
          <Link
            href="/partner/inquiries"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#c41230] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#a60f28]"
          >
            <ArrowLeft className="size-4" strokeWidth={1.5} />
            Kembali ke Pengajuan Sewa
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 pt-6 pb-16 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <Link
          href="/partner"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-[#c41230]"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
          Kembali ke Pengajuan Sewa
        </Link>

        <PartnerInquiryWorkspace
          inquiry={inquiry}
          whatsappNumber={commercialProfile.whatsappNumber}
          liveNotice={liveNotice}
          onDismissNotice={() => setLiveNotice(null)}
        />
      </div>
    </main>
  );
}
