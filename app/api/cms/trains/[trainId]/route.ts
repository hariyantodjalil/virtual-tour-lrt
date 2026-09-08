import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugifyLabel } from "@/lib/train-tour-defaults";
import { parseJsonRequest } from "@/lib/api-validation";

type Params = { params: Promise<{ trainId: string }> };

const trainUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: z.string().min(1).max(80).optional(),
  description: z.string().max(2000).nullable().optional(),
  formation: z.string().max(120).nullable().optional(),
  imageUrl: z.string().max(500).nullable().optional(),
  order: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { trainId } = await params;
  const train = await prisma.train.findUnique({
    where: { id: trainId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      formation: true,
      imageUrl: true,
      order: true,
      isActive: true,
    },
  });

  if (!train) return NextResponse.json({ error: "Kereta tidak ditemukan" }, { status: 404 });
  return NextResponse.json(train);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { trainId } = await params;
  const parsed = await parseJsonRequest(request, trainUpdateSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  const data: Record<string, unknown> = {};
  if (body.name != null) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.formation !== undefined) data.formation = body.formation;
  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl;
  if (body.order != null) data.order = body.order;
  if (body.isActive != null) data.isActive = body.isActive;
  if (body.slug != null) {
    const slug = slugifyLabel(body.slug);
    const clash = await prisma.train.findFirst({
      where: { slug, NOT: { id: trainId } },
    });
    if (clash) return NextResponse.json({ error: "Slug sudah dipakai" }, { status: 409 });
    data.slug = slug;
  }

  const train = await prisma.train.update({
    where: { id: trainId },
    data,
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      formation: true,
      imageUrl: true,
      order: true,
      isActive: true,
    },
  });

  return NextResponse.json(train);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { trainId } = await params;
  await prisma.train.delete({ where: { id: trainId } });
  return NextResponse.json({ message: "Kereta dihapus" });
}
