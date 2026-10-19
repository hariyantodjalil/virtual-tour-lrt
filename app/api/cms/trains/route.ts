import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugifyLabel } from "@/lib/train-tour-defaults";
import { ensureTrainTourStructure } from "@/lib/train-tour-structure";
import { parseJsonRequest } from "@/lib/api-validation";

const trainCreateSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(80).optional(),
  description: z.string().max(2000).optional(),
  formation: z.string().max(120).optional(),
  imageUrl: z.string().max(500).optional(),
  order: z.number().int().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const trains = await prisma.train.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      formation: true,
      isActive: true,
      order: true,
      _count: { select: { trainTourScenes: true } },
    },
  });

  return NextResponse.json(trains);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const existingCount = await prisma.train.count();
  if (existingCount > 0) {
    return NextResponse.json(
      { error: "Hanya satu konfigurasi kereta. Gunakan editor Train Virtual Tour yang ada." },
      { status: 409 }
    );
  }

  const parsed = await parseJsonRequest(request, trainCreateSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  const slug = body.slug ? slugifyLabel(body.slug) : slugifyLabel(body.name);
  const existing = await prisma.train.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "Slug kereta sudah dipakai" }, { status: 409 });
  }

  const maxOrder = await prisma.train.aggregate({ _max: { order: true } });

  const train = await prisma.train.create({
    data: {
      name: body.name,
      slug,
      description: body.description ?? null,
      formation: body.formation ?? null,
      imageUrl: body.imageUrl ?? null,
      order: body.order ?? (maxOrder._max.order ?? -1) + 1,
      virtualTour: { create: {} },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      formation: true,
      isActive: true,
      order: true,
    },
  });

  await ensureTrainTourStructure(train.id);

  return NextResponse.json(train, { status: 201 });
}
