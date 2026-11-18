import type { CmsTrainInquiry } from "./train-advertising-shared";
import type { CommercialLeadStatus } from "./commercial-pipeline";

/** Staff-only inquiry DTO shared by the list, dedicated detail page and refresh endpoint. */
export type LeadItem = {
  trainInquiry?: CmsTrainInquiry | null;
  id: string;
  inquiryCode: string;
  rejectionReason: string | null;
  userId: string | null;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  businessType: string;
  status: string;
  message: string | null;
  surveyPreference: string | null;
  siteVisitStatus: string;
  siteVisitScheduledAt: string | null;
  notes: string | null;
  rdsOfferNo: string | null;
  baNegotiationNo: string | null;
  followUpAt: string | null;
  leaseStartAt: string | null;
  leaseEndAt: string | null;
  paymentVerifiedAt: string | null;
  updatedAt: string;
  createdAt: string;
  space: { id: string; code: string; name: string; status: string; station: { name: string } } | null;
};

export function cmsLeadDetailHref(id: string) {
  return `/cms/leads/${encodeURIComponent(id)}`;
}

export function isCmsLeadId(id: string) {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(id);
}

/** Warna badge kolom Tahap — tiap milestone beda hue untuk scan cepat. */
const STAGE_BADGE_CLASS: Record<CommercialLeadStatus, string> = {
  NEW: "border-sky-200 bg-sky-50 text-sky-800",
  CONTACTED: "border-blue-200 bg-blue-50 text-blue-800",
  RDS_OFFER: "border-violet-200 bg-violet-50 text-violet-800",
  NEGOTIATING: "border-violet-200 bg-violet-50 text-violet-800",
  SITE_CHECK: "border-violet-200 bg-violet-50 text-violet-800",
  BA_SIGNED: "border-indigo-200 bg-indigo-50 text-indigo-800",
  DESIGN_REVIEW: "border-amber-200 bg-amber-50 text-amber-900",
  PKS: "border-orange-200 bg-orange-50 text-orange-900",
  BILLING: "border-orange-200 bg-orange-50 text-orange-900",
  FIT_OUT_HANDOVER: "border-teal-200 bg-teal-50 text-teal-800",
  COMMERCIAL_OPERATION: "border-emerald-200 bg-emerald-50 text-emerald-800",
  CLOSED_WON: "border-emerald-200 bg-emerald-50 text-emerald-800",
  CLOSED_LOST: "border-slate-200 bg-slate-100 text-slate-600",
};

export function leadStageBadgeClass(status: string) {
  return (
    STAGE_BADGE_CLASS[status as CommercialLeadStatus] ??
    "border-slate-200 bg-slate-50 text-slate-700"
  );
}
