import type { Prisma } from "@prisma/client";
import { ACTIVE_LEAD_STATUSES } from "@/lib/commercial-pipeline";
import { publicWorkflowSelect } from "@/lib/partner-inquiries";
import { prisma } from "@/lib/prisma";

export type InquiryTarget = { kind: "space" | "train"; id: string };

export function activeInquiryWhere(userId: string, target: InquiryTarget): Prisma.TenantLeadWhereInput {
  return {
    userId,
    status: { in: ACTIVE_LEAD_STATUSES },
    ...(target.kind === "space"
      ? { spaceId: target.id }
      : { OR: [{ trainInquiry: { mediaId: target.id } }, { spaceRequirement: { startsWith: `TRAIN:${target.id} |` } }] }),
  };
}

export async function createInquiryOnce(input: {
  userId: string;
  target: InquiryTarget | null;
  data: Prisma.TenantLeadUncheckedCreateInput;
}) {
  return prisma.$transaction(async tx => {
    if (input.target) {
      // Serialize both submission endpoints for the same applicant and unit.
      const lockKey = JSON.stringify([input.userId, input.target.kind, input.target.id]);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const existing = await tx.tenantLead.findFirst({
        where: activeInquiryWhere(input.userId, input.target),
        select: { id: true },
      });
      if (existing) return { created: false as const, existingInquiryId: existing.id };
    }

    const lead = await tx.tenantLead.create({
      data: input.data,
      include: { workflowVersion: { select: publicWorkflowSelect } },
    });
    return { created: true as const, lead };
  }, { isolationLevel: "ReadCommitted" });
}
