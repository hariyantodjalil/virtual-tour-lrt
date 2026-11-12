import { NextRequest, NextResponse } from "next/server";
import { inquiryCreationData, publicWorkflowSelect } from "@/lib/partner-inquiries";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireRole } from "@/lib/auth";
import { parseJsonRequest } from "@/lib/api-validation";
import { consumeRateLimit, getClientIdentifier, rateLimitHeaders } from "@/lib/rate-limit";
import { ACTIVE_LEAD_STATUSES } from "@/lib/commercial-pipeline";
import { findTrainRentalSpaceForLead, trainLeadRequirement } from "@/lib/train-rental-spaces";

const leadSchema = z.object({
  spaceId: z.string().trim().min(1).max(128).optional(),
  trainRentalSpaceId: z.string().trim().min(1).max(128).optional(),
  companyName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(10).max(32).regex(/^[+0-9()\s.-]+$/),
  email: z.string().trim().email().max(254),
  password: z.string().min(8, "Password minimal 8 karakter").max(128),
  businessType: z.string().trim().min(3).max(120),
  spaceRequirement: z.string().trim().max(500).optional(),
  surveyPreference: z.string().trim().max(500).optional(),
  message: z.string().trim().max(2_000).optional(),
}).strict();

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const leads = await prisma.tenantLead.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        space: {
          include: { station: { select: { name: true } } },
        },
      },
    });
    return NextResponse.json(leads);
  } catch {
    return NextResponse.json({ error: "Gagal mengambil data leads" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rateLimit = consumeRateLimit(req, "lead-submit", {
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Terlalu banyak pengajuan. Coba lagi nanti." },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    );
  }

  try {
    const parsed = await parseJsonRequest(req, leadSchema);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;
    const email = data.email.toLowerCase();

    let commercialSpaceId: string | undefined;
    let trainRequirement: string | undefined;

    if (data.trainRentalSpaceId) {
      const trainSpace = await findTrainRentalSpaceForLead(data.trainRentalSpaceId);
      if (!trainSpace) {
        return NextResponse.json(
          { error: "Space kereta tidak tersedia." },
          { status: 409 }
        );
      }
      trainRequirement = trainLeadRequirement(trainSpace);
    } else if (data.spaceId) {
      const space = await prisma.commercialSpace.findFirst({
        where: {
          id: data.spaceId,
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

    let user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      if (!user.isActive) {
        return NextResponse.json({ error: "Akun mitra tidak aktif" }, { status: 403 });
      }

      const passwordValid = await bcrypt.compare(data.password, user.password);
      if (!passwordValid) {
        return NextResponse.json(
          { error: "Email sudah terdaftar. Masukkan password akun yang benar untuk menautkan pengajuan." },
          { status: 409 }
        );
      }
    } else {
      user = await prisma.user.create({
        data: {
          email,
          name: data.contactName,
          password: await bcrypt.hash(data.password, 12),
          role: "MITRA",
        },
      });
    }

    if (commercialSpaceId) {
      const existingOpen = await prisma.tenantLead.findFirst({
        where: {
          userId: user.id,
          spaceId: commercialSpaceId,
          status: { in: ACTIVE_LEAD_STATUSES },
        },
        select: { id: true },
      });
      if (existingOpen) {
        return NextResponse.json(
          { error: "Anda sudah memiliki pengajuan aktif untuk unit ini." },
          { status: 409 }
        );
      }
    } else if (trainRequirement) {
      const existingOpen = await prisma.tenantLead.findFirst({
        where: {
          userId: user.id,
          spaceRequirement: trainRequirement,
          status: { in: ACTIVE_LEAD_STATUSES },
        },
        select: { id: true },
      });
      if (existingOpen) {
        return NextResponse.json(
          { error: "Anda sudah memiliki pengajuan aktif untuk space ini." },
          { status: 409 }
        );
      }
    }

    const lead = await prisma.tenantLead.create({
      data: {
        ...await inquiryCreationData(user.id),
        ...(commercialSpaceId ? { spaceId: commercialSpaceId } : {}),
        companyName: data.companyName,
        contactName: data.contactName,
        phone: data.phone,
        email,
        businessType: data.businessType,
        spaceRequirement: trainRequirement ?? data.spaceRequirement,
        surveyPreference: data.surveyPreference,
        message: data.message,
        userId: user.id,
        siteVisitStatus: data.surveyPreference ? "REQUESTED" : "NONE",
      },
      include: { workflowVersion: { select: publicWorkflowSelect } },
    });

    // Track analytics
    if (commercialSpaceId) {
      await prisma.visitEvent.create({
        data: {
          spaceId: commercialSpaceId,
          eventType: "FORM_SUBMIT",
          sessionId: getClientIdentifier(req),
        },
      });
    }

    return NextResponse.json(lead, { status: 201, headers: rateLimitHeaders(rateLimit) });
  } catch (error) {
    console.error("[api/leads POST]", error);
    return NextResponse.json({ error: "Gagal menyimpan lead" }, { status: 500 });
  }
}
