import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { z } from "zod";
import { consumeRateLimit, getClientIdentifier, rateLimitHeaders } from "@/lib/rate-limit";
import { ACTIVE_LEAD_STATUSES } from "@/lib/commercial-pipeline";
import { findTrainRentalSpaceForLead, trainLeadRequirement } from "@/lib/train-rental-spaces";

const partnerLeadSchema = z
  .object({
    spaceId: z.string().trim().min(1).max(128).optional(),
    trainRentalSpaceId: z.string().trim().min(1).max(128).optional(),
    businessType: z.string().trim().min(3).max(120),
    message: z.string().trim().max(2_000).optional(),
    companyName: z.string().trim().min(2).max(160).optional(),
    contactName: z.string().trim().min(2).max(160).optional(),
    surveyPreference: z.string().trim().max(500).optional(),
    phone: z
      .string()
      .trim()
      .min(10)
      .max(32)
      .regex(/^[+0-9()\s.-]+$/)
      .optional(),
  })
  .strict()
  .refine((value) => Boolean(value.spaceId) || Boolean(value.trainRentalSpaceId), {
    message: "Space pengajuan wajib dipilih.",
  });

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["MITRA"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const leads = await prisma.tenantLead.findMany({
    where: { userId: auth.user.userId },
    orderBy: { createdAt: "desc" },
    include: {
      space: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          area: true,
          floor: true,
          location: true,
          leasingModel: true,
          panoramaUrl: true,
          station: { select: { name: true, slug: true } },
        },
      },
      workflowVersion: {
        select: {
          id: true,
          version: true,
          title: true,
          steps: {
            orderBy: { stepOrder: "asc" },
            select: {
              id: true,
              stepOrder: true,
              title: true,
              description: true,
              publicMessage: true,
              requiresMedia: true,
            },
          },
        },
      },
      _count: {
        select: {
          mediaAttachments: {
            where: { isVisibleToMitra: true },
          },
        },
      },
    },
  });

  return NextResponse.json(leads);
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["MITRA"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rateLimit = consumeRateLimit(request, "partner-lead-submit", {
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Terlalu banyak pengajuan. Coba lagi nanti." },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    );
  }

  const parsed = await parseJsonRequest(request, partnerLeadSchema);
  if (!parsed.success) return parsed.response;

  const user = await prisma.user.findUnique({
    where: { id: auth.user.userId },
    select: { id: true, email: true, name: true, isActive: true },
  });
  if (!user?.isActive) {
    return NextResponse.json({ error: "Akun mitra tidak aktif" }, { status: 403 });
  }

  let commercialSpaceId: string | undefined;
  let trainRequirement: string | undefined;

  if (parsed.data.trainRentalSpaceId) {
    const trainSpace = await findTrainRentalSpaceForLead(parsed.data.trainRentalSpaceId);
    if (!trainSpace) {
      return NextResponse.json({ error: "Space kereta tidak tersedia." }, { status: 409 });
    }
    trainRequirement = trainLeadRequirement(trainSpace);
  } else if (parsed.data.spaceId) {
    const space = await prisma.commercialSpace.findFirst({
      where: {
        id: parsed.data.spaceId,
        status: "TERSEDIA",
        station: { isActive: true },
      },
      select: { id: true },
    });
    if (!space) {
      return NextResponse.json(
        { error: "Unit tidak tersedia atau stasiun sedang nonaktif." },
        { status: 409 }
      );
    }
    commercialSpaceId = space.id;
  }

  const latestLead = await prisma.tenantLead.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { companyName: true, contactName: true, phone: true },
  });

  const companyName =
    parsed.data.companyName?.trim() ||
    latestLead?.companyName ||
    `Mitra ${user.name}`;
  const contactName = parsed.data.contactName?.trim() || latestLead?.contactName || user.name;
  const phone = parsed.data.phone?.trim() || latestLead?.phone;
  if (!phone) {
    return NextResponse.json(
      { error: "Nomor telepon wajib diisi untuk pengajuan pertama." },
      { status: 400 }
    );
  }

  const existingOpen = commercialSpaceId
    ? await prisma.tenantLead.findFirst({
        where: {
          userId: user.id,
          spaceId: commercialSpaceId,
          status: { in: ACTIVE_LEAD_STATUSES },
        },
        select: { id: true },
      })
    : await prisma.tenantLead.findFirst({
        where: {
          userId: user.id,
          spaceRequirement: trainRequirement,
          status: { in: ACTIVE_LEAD_STATUSES },
        },
        select: { id: true },
      });
  if (existingOpen) {
    return NextResponse.json(
      { error: "Anda sudah punya pengajuan aktif untuk unit ini." },
      { status: 409 }
    );
  }

  const activeWf = await prisma.pipelineWorkflowVersion.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { version: "desc" },
    include: {
      steps: {
        where: { stepOrder: 1 },
        take: 1,
        select: { id: true },
      },
    },
  });

  const year = new Date().getFullYear();
  const countTotal = await prisma.tenantLead.count();
  let seq = countTotal + 1;
  let inquiryCode = `INQ-${year}-${String(seq).padStart(4, "0")}`;
  while (await prisma.tenantLead.findUnique({ where: { inquiryCode }, select: { id: true } })) {
    seq += 1;
    inquiryCode = `INQ-${year}-${String(seq).padStart(4, "0")}`;
  }

  const firstStepId = activeWf?.steps[0]?.id ?? null;

  const lead = await prisma.tenantLead.create({
    data: {
      userId: user.id,
      spaceId: commercialSpaceId,
      companyName,
      contactName,
      phone,
      email: user.email,
      businessType: parsed.data.businessType,
      spaceRequirement: trainRequirement ?? null,
      message: parsed.data.message || null,
      inquiryCode,
      status: "ACTIVE",
      workflowVersionId: activeWf?.id ?? null,
      currentStepOrder: 1,
      stepLogs: {
        create: {
          stepOrder: 1,
          pipelineStepId: firstStepId,
          action: "SUBMITTED",
          notes: "Pengajuan minat sewa dikirim oleh mitra.",
          performedBy: contactName,
        },
      },
    },
  });

  if (commercialSpaceId) {
    await prisma.visitEvent.create({
      data: {
        spaceId: commercialSpaceId,
        eventType: "FORM_SUBMIT",
        sessionId: getClientIdentifier(request),
      },
    });
  }

  return NextResponse.json(lead, { status: 201, headers: rateLimitHeaders(rateLimit) });
}
