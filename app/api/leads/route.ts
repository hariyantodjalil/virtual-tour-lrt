import { trainInquiryInputSchema } from "@/lib/train-advertising-shared";
import { resolveTrainInquiry, TrainInquiryError } from "@/lib/train-advertising";
import { createInquiryOnce } from "@/lib/active-inquiry";
import { NextRequest, NextResponse } from "next/server";
import { inquiryCreationData } from "@/lib/partner-inquiries";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireRole } from "@/lib/auth";
import { parseJsonRequest } from "@/lib/api-validation";
import { consumeRateLimit, getClientIdentifier, rateLimitHeaders } from "@/lib/rate-limit";
import { trainLeadRequirement } from "@/lib/train-rental-spaces";

const leadSchema = z.object({
  spaceId: z.string().trim().min(1).max(128).optional(),
  trainRentalSpaceId: z.string().trim().min(1).max(128).optional(),
    trainInquiry: trainInquiryInputSchema.optional(),
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
    let trainRequest: Awaited<ReturnType<typeof resolveTrainInquiry>> | undefined;
    if (data.trainInquiry && !data.trainRentalSpaceId) {
      return NextResponse.json({ error: "Media iklan kereta wajib dipilih." }, { status: 400 });
    }

    if (data.trainRentalSpaceId) {
      try {
        trainRequest = await resolveTrainInquiry(data.trainRentalSpaceId, data.trainInquiry);
        trainRequirement = trainLeadRequirement(trainRequest.media);
      } catch (error) {
        if (error instanceof TrainInquiryError) return NextResponse.json({ error: error.message }, { status: 400 });
        throw error;
      }
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

    const result = await createInquiryOnce({
      userId: user.id,
      target: commercialSpaceId ? { kind: "space", id: commercialSpaceId }
        : data.trainRentalSpaceId ? { kind: "train", id: data.trainRentalSpaceId } : null,
      data: {
        ...await inquiryCreationData(user.id),
        ...(trainRequest ? { trainInquiry: { create: trainRequest.create } } : {}),
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
    });
    if (!result.created) {
      return NextResponse.json({
        error: "Anda sudah punya pengajuan aktif untuk unit ini.",
        existingInquiryId: result.existingInquiryId,
      }, { status: 409 });
    }
    const lead = result.lead;

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
