import type { Prisma } from "@prisma/client";
import { cmsTrainInquirySelect } from "./train-advertising";
import type { LeadItem } from "./cms-leads-shared";

export const cmsLeadInclude = {
  trainInquiry: { select: cmsTrainInquirySelect },
  space: { include: { station: { select: { name: true } } } },
} satisfies Prisma.TenantLeadInclude;

type CmsLeadRow = Prisma.TenantLeadGetPayload<{ include: typeof cmsLeadInclude }>;

/** Call only after staff authorization. Never reuse this projection on partner/public endpoints. */
export function toCmsLeadItem(lead: CmsLeadRow): LeadItem {
  return {
    id: lead.id,
    inquiryCode: lead.inquiryCode,
    trainInquiry: lead.trainInquiry ? { ...lead.trainInquiry, campaignStart: lead.trainInquiry.campaignStart?.toISOString() ?? null, campaignEnd: lead.trainInquiry.campaignEnd?.toISOString() ?? null } : null,
    rejectionReason: lead.rejectionReason,
    userId: lead.userId,
    companyName: lead.companyName,
    contactName: lead.contactName,
    phone: lead.phone,
    email: lead.email,
    businessType: lead.businessType,
    status: lead.status,
    message: lead.message,
    surveyPreference: lead.surveyPreference,
    siteVisitStatus: lead.siteVisitStatus,
    siteVisitScheduledAt: lead.siteVisitScheduledAt?.toISOString() ?? null,
    notes: lead.notes,
    followUpAt: lead.followUpAt?.toISOString() ?? null,
    leaseStartAt: lead.leaseStartAt?.toISOString() ?? null,
    leaseEndAt: lead.leaseEndAt?.toISOString() ?? null,
    paymentVerifiedAt: lead.paymentVerifiedAt?.toISOString() ?? null,
    rdsOfferNo: lead.rdsOfferNo,
    baNegotiationNo: lead.baNegotiationNo,
    updatedAt: lead.updatedAt.toISOString(),
    createdAt: lead.createdAt.toISOString(),
    space: lead.space ? { id: lead.space.id, code: lead.space.code, name: lead.space.name, status: lead.space.status, station: { name: lead.space.station.name } } : null,
  };
}
