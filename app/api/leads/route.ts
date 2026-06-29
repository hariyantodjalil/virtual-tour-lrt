import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const leadSchema = z.object({
  spaceId: z.string().optional(),
  companyName: z.string().min(2),
  contactName: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email(),
  businessType: z.string().min(3),
  spaceRequirement: z.string().optional(),
  message: z.string().optional(),
});

export async function GET() {
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
  try {
    const body = await req.json();
    const data = leadSchema.parse(body);

    const lead = await prisma.tenantLead.create({ data });

    // Track analytics
    if (data.spaceId) {
      await prisma.visitEvent.create({
        data: {
          spaceId: data.spaceId,
          eventType: "FORM_SUBMIT",
          sessionId: req.headers.get("x-forwarded-for") ?? "unknown",
        },
      });
    }

    return NextResponse.json(lead, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid", details: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal menyimpan lead" }, { status: 500 });
  }
}
