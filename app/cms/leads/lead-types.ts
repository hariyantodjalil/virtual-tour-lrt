import type {
  CommercialSiteVisitStatus,
  PipelineStepTypeValue,
  StepMediaRequirementValue,
  StepSlaHealth,
  StepSpaceEffectValue,
} from "@/lib/commercial-pipeline";
import {
  LEAD_STATUS_LABELS,
  SITE_VISIT_STATUS_LABELS,
  SPACE_STATUS_LABELS,
  type CommercialLeadStatus,
  type CommercialSpaceStatus,
} from "@/lib/commercial-pipeline";

export type CmsWorkflowStep = {
  id: string;
  stepOrder: number;
  leadStatus: string;
  stepType: PipelineStepTypeValue;
  documentNumberLabel: string | null;
  slaHours: number | null;
  mediaRequirement: StepMediaRequirementValue;
  requiresMedia: boolean;
  spaceEffect: StepSpaceEffectValue;
  title: string;
  description: string | null;
  publicMessage: string;
};

export type CmsStepLogSummary = {
  id: string;
  stepOrder: number;
  status: string;
  action: string;
  createdAt: string;
};

export type CmsStepLogDetail = CmsStepLogSummary & {
  fromStatus: string | null;
  notes: string | null;
  documentNumber: string | null;
  visitStatus: string | null;
  scheduledAt: string | null;
  performedBy: string;
  pipelineStep: {
    id: string;
    stepOrder: number;
    title: string;
    stepType: PipelineStepTypeValue;
    documentNumberLabel: string | null;
  } | null;
};

export type CmsInquiryMedia = {
  id: string;
  stepOrder: number;
  mediaTitle: string;
  documentNumber: string | null;
  mediaLink: string;
  isVisibleToMitra: boolean;
  uploadedByAdmin: string;
  createdAt: string;
};

export type CmsLeadSummary = {
  id: string;
  inquiryCode: string;
  userId: string | null;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  businessType: string;
  spaceRequirement: string | null;
  status: string;
  currentStepOrder: number;
  siteVisitStatus: string;
  siteVisitScheduledAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  space: {
    id: string;
    code: string;
    name: string;
    type: string;
    status: string;
    station: {
      id: string;
      name: string;
      code: string | null;
    };
  } | null;
  workflowVersion: {
    id: string;
    version: number | null;
    title: string;
    status?: string;
    steps: CmsWorkflowStep[];
  } | null;
  stepLogs: CmsStepLogSummary[];
  _count: {
    mediaAttachments: number;
  };
};

export type CmsLeadDetail = {
  id: string;
  inquiryCode: string;
  userId: string | null;
  spaceId: string | null;
  workflowVersionId: string | null;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  businessType: string;
  spaceRequirement: string | null;
  message: string | null;
  status: string;
  currentStepOrder: number;
  surveyPreference: string | null;
  siteVisitStatus: string;
  siteVisitScheduledAt: string | null;
  notes: string | null;
  rdsOfferNo: string | null;
  baNegotiationNo: string | null;
  rejectionReason: string | null;
  followUpAt: string | null;
  createdAt: string;
  updatedAt: string;
  space: {
    id: string;
    code: string;
    name: string;
    type: string;
    status: string;
    area: number;
    lengthM: number | null;
    widthM: number | null;
    heightM: number | null;
    areaKind: string | null;
    exposure: number;
    floor: string;
    location: string;
    nearestExit: string | null;
    nearbyFacilities: string[];
    powerSupply: string | null;
    waterAccess: boolean;
    airConditioning: boolean;
    description: string | null;
    panoramaUrl: string | null;
    station: {
      id: string;
      code: string | null;
      name: string;
      slug: string;
      address: string;
      location: string | null;
      line: string;
      dailyPassengers: number;
      imageUrl: string | null;
    };
    parentZone: {
      id: string;
      code: string;
      name: string;
      area: number;
    } | null;
    occupancy: {
      id: string;
      tenant: {
        id: string;
        userId: string | null;
        brandName: string;
      };
    } | null;
  } | null;
  workflowVersion: {
    id: string;
    version: number | null;
    title: string;
    description: string | null;
    status: string;
    steps: CmsWorkflowStep[];
  } | null;
  stepLogs: CmsStepLogDetail[];
  mediaAttachments: CmsInquiryMedia[];
  _count: {
    mediaAttachments: number;
  };
};

export const SLA_BADGE_CLASSES: Record<StepSlaHealth, string> = {
  SAFE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  WARNING: "border-amber-200 bg-amber-50 text-amber-800",
  BREACHED: "border-rose-200 bg-rose-50 text-rose-700",
  MET: "border-emerald-200 bg-emerald-50 text-emerald-700",
  MISSED: "border-rose-200 bg-rose-50 text-rose-700",
};

export const SPACE_STATUS_BADGE_CLASSES: Record<string, string> = {
  TERSEDIA: "border-emerald-200 bg-emerald-50 text-emerald-700",
  RESERVED: "border-amber-200 bg-amber-50 text-amber-800",
  FIT_OUT: "border-sky-200 bg-sky-50 text-sky-700",
  TERISI: "border-slate-300 bg-slate-100 text-slate-700",
  MAINTENANCE: "border-rose-200 bg-rose-50 text-rose-700",
};

export function getLeadStatusLabel(status: string): string {
  return (
    LEAD_STATUS_LABELS[status as CommercialLeadStatus] ??
    status.replaceAll("_", " ")
  );
}

export function getSpaceStatusLabel(status: string): string {
  return (
    SPACE_STATUS_LABELS[status as CommercialSpaceStatus] ??
    status.replaceAll("_", " ")
  );
}

export function getSiteVisitStatusLabel(status: string): string {
  return (
    SITE_VISIT_STATUS_LABELS[status as CommercialSiteVisitStatus] ??
    status.replaceAll("_", " ")
  );
}

export function formatDateId(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function toDateTimeLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 16);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export { formatSpaceRequirementLabel } from "@/lib/commercial-pipeline";

export function buildWhatsAppPartnerUrl(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}
