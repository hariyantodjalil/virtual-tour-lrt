import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireRole } from "@/lib/auth";

const leadSchema = z.object({
  spaceId: z.string().optional(),
  companyName: z.string().min(2),
  contactName: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email(),
  password: z.string().min(8, "Password minimal 8 karakter"),
  businessType: z.string().min(3),
  spaceRequirement: z.string().optional(),
  message: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ["ADMIN", "EDITOR"]);
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
  try {
    const body = await req.json();
    const data = leadSchema.parse(body);
    const email = data.email.toLowerCase();

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
          password: await bcrypt.hash(data.password, 10),
          role: "MITRA",
        },
      });
    }

    const leadData = {
      spaceId: data.spaceId,
      companyName: data.companyName,
      contactName: data.contactName,
      phone: data.phone,
      email: data.email,
      businessType: data.businessType,
      spaceRequirement: data.spaceRequirement,
      message: data.message,
    };
    const lead = await prisma.tenantLead.create({
      data: {
        ...leadData,
        email,
        userId: user.id,
      },
    });

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
