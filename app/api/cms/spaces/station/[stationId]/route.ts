import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { spaceMutationSchema } from "@/lib/api-schemas";

type Params = { params: Promise<{ stationId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId } = await params;
  const spaces = await prisma.commercialSpace.findMany({
    where: { stationId },
    orderBy: [{ floor: "asc" }, { code: "asc" }],
  });
  return NextResponse.json(spaces);
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId } = await params;
  const parsed = await parseJsonRequest(request, spaceMutationSchema);
  if (!parsed.success) return parsed.response;
  const space = await prisma.commercialSpace.create({
    data: { ...parsed.data, stationId },
  });
  return NextResponse.json(space, { status: 201 });
}
