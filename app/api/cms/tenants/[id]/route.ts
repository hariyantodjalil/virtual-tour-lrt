import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { tenantUpdateSchema } from "@/lib/api-schemas";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await requireAuth(_request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      station: { select: { id: true, name: true, slug: true } },
      occupancies: {
        include: {
          space: { select: { id: true, code: true, name: true, type: true, status: true } },
        },
      },
    },
  });
  if (!tenant) return NextResponse.json({ error: "Tenant tidak ditemukan" }, { status: 404 });
  return NextResponse.json(tenant);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const parsed = await parseJsonRequest(request, tenantUpdateSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  const existing = await prisma.tenant.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Tenant tidak ditemukan" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.brandName !== undefined) data.brandName = String(body.brandName).trim();
  if (body.contactName !== undefined) data.contactName = body.contactName || null;
  if (body.phone !== undefined) data.phone = body.phone || null;
  if (body.email !== undefined) data.email = body.email || null;
  if (body.notes !== undefined) data.notes = body.notes || null;
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl || null;

  const tenant = await prisma.tenant.update({
    where: { id },
    data,
    include: {
      station: { select: { id: true, name: true, slug: true } },
      occupancies: {
        include: {
          space: { select: { id: true, code: true, name: true, type: true, status: true } },
        },
      },
    },
  });

  return NextResponse.json(tenant);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: { occupancies: true },
  });
  if (!tenant) return NextResponse.json({ error: "Tenant tidak ditemukan" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    const spaceIds = tenant.occupancies.map((o) => o.spaceId);
    await tx.spaceOccupancy.deleteMany({ where: { tenantId: id } });
    if (spaceIds.length) {
      await tx.commercialSpace.updateMany({
        where: { id: { in: spaceIds }, status: "TERISI" },
        data: { status: "TERSEDIA" },
      });
    }
    await tx.tenant.delete({ where: { id } });
  });

  return NextResponse.json({ message: "Tenant dihapus" });
}
