import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { spaceMutationSchema } from "@/lib/api-schemas";

type Params = { params: Promise<{ stationId: string }> };

function spaceWriteError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json(
      { error: "Kode unit sudah dipakai di stasiun ini. Gunakan kode lain." },
      { status: 409 }
    );
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return NextResponse.json(
      {
        error:
          "Data unit tidak cocok dengan skema database. Restart server `npm run dev` lalu coba lagi.",
      },
      { status: 400 }
    );
  }
  console.error("[cms/spaces/station] write failed", error);
  return NextResponse.json({ error: "Gagal menyimpan unit." }, { status: 500 });
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId } = await params;
  const spaces = await prisma.commercialSpace.findMany({
    where: { stationId },
    orderBy: [{ floor: "asc" }, { code: "asc" }],
    include: {
      occupancy: {
        select: {
          tenantId: true,
          tenant: {
            select: {
              brandName: true,
              isActive: true,
            },
          },
        },
      },
    },
  });
  return NextResponse.json(
    spaces.map(({ occupancy, ...space }) => ({
      ...space,
      tenantId:
        occupancy?.tenant.isActive === true ? occupancy.tenantId : null,
      tenantBrand:
        occupancy?.tenant.isActive === true ? occupancy.tenant.brandName : null,
    }))
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId } = await params;
  const parsed = await parseJsonRequest(request, spaceMutationSchema);
  if (!parsed.success) return parsed.response;
  const { tenantId, ...spaceData } = parsed.data;

  if (spaceData.status === "TERISI" && !tenantId) {
    return NextResponse.json(
      { error: "Penyewa wajib dipilih ketika status unit TERISI." },
      { status: 400 }
    );
  }
  if (spaceData.status !== "TERISI" && tenantId) {
    return NextResponse.json(
      { error: "Penyewa hanya dapat dipilih untuk unit berstatus TERISI." },
      { status: 400 }
    );
  }

  if (tenantId) {
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, stationId, isActive: true },
      select: { id: true },
    });
    if (!tenant) {
      return NextResponse.json(
        { error: "Penyewa aktif tidak ditemukan di stasiun ini." },
        { status: 400 }
      );
    }
  }

  try {
    const space = await prisma.$transaction(async (tx) => {
      const created = await tx.commercialSpace.create({
        data: { ...spaceData, stationId },
      });
      if (tenantId) {
        await tx.spaceOccupancy.create({
          data: {
            spaceId: created.id,
            tenantId,
          },
        });
      }
      return created;
    });
    return NextResponse.json(space, { status: 201 });
  } catch (error) {
    return spaceWriteError(error);
  }
}
