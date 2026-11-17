import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { parseJsonRequest } from "@/lib/api-validation";
import { partnerFavoriteSelect, toFavoriteSpace } from "@/lib/partner-favorites";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

const addFavoriteSchema = z
  .object({
    spaceId: z.string().trim().min(1, "ID unit wajib diisi.").max(128),
  })
  .strict();

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["MITRA"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rows = await prisma.partnerFavorite.findMany({
    where: {
      userId: auth.user.userId,
      space: { station: { isActive: true } },
    },
    orderBy: { createdAt: "desc" },
    select: partnerFavoriteSelect,
  });

  return NextResponse.json(rows.map(toFavoriteSpace), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["MITRA"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const limit = consumeRateLimit(request, "partner-favorites-write", {
    limit: 60,
    windowMs: 60_000,
    subject: auth.user.userId,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan favorit. Coba sebentar lagi." },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  const parsed = await parseJsonRequest(request, addFavoriteSchema);
  if (!parsed.success) return parsed.response;

  const space = await prisma.commercialSpace.findFirst({
    where: {
      id: parsed.data.spaceId,
      station: { isActive: true },
    },
    select: { id: true },
  });
  if (!space) {
    return NextResponse.json({ error: "Unit komersial tidak ditemukan." }, { status: 404 });
  }

  const saved = await prisma.partnerFavorite.upsert({
    where: {
      userId_spaceId: {
        userId: auth.user.userId,
        spaceId: space.id,
      },
    },
    create: {
      userId: auth.user.userId,
      spaceId: space.id,
    },
    update: {},
    select: partnerFavoriteSelect,
  });

  return NextResponse.json(toFavoriteSpace(saved), { status: 201 });
}
