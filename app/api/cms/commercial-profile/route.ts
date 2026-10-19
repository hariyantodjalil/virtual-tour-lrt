import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { commercialProfileUpdateSchema } from "@/lib/api-schemas";
import { getCommercialProfile } from "@/lib/commercial-profile";
import { normalizeContactNumber } from "@/lib/commercial-profile-shared";

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["ADMIN"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  return NextResponse.json(await getCommercialProfile());
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRole(request, ["ADMIN"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const parsed = await parseJsonRequest(request, commercialProfileUpdateSchema);
  if (!parsed.success) return parsed.response;

  const input = parsed.data;
  const data = {
    ...(input.teamName !== undefined && { teamName: input.teamName }),
    ...(input.contactPersonName !== undefined && {
      contactPersonName: input.contactPersonName || null,
    }),
    ...(input.whatsappNumber !== undefined && {
      whatsappNumber: normalizeContactNumber(input.whatsappNumber),
    }),
    ...(input.phoneNumber !== undefined && {
      phoneNumber: input.phoneNumber
        ? normalizeContactNumber(input.phoneNumber)
        : null,
    }),
    ...(input.email !== undefined && { email: input.email || null }),
    ...(input.officeAddress !== undefined && {
      officeAddress: input.officeAddress || null,
    }),
    ...(input.defaultWhatsappMessage !== undefined && {
      defaultWhatsappMessage: input.defaultWhatsappMessage,
    }),
  };

  const profile = await prisma.commercialProfile.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
    select: {
      teamName: true,
      contactPersonName: true,
      whatsappNumber: true,
      phoneNumber: true,
      email: true,
      officeAddress: true,
      defaultWhatsappMessage: true,
    },
  });

  return NextResponse.json(profile);
}
