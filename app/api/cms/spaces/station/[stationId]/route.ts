import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { spaceMutationSchema } from "@/lib/api-schemas";
import { allocatedAreaByZone, resolveSpaceArea } from "@/lib/space-zoning";
import { logTenantChange } from "@/lib/tenant-change-log";
import { roundArea } from "@/lib/unit-dimensions";

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
  const [spaces, allocated] = await Promise.all([
    prisma.commercialSpace.findMany({
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
        parentZone: { select: { code: true, name: true } },
      },
    }),
    allocatedAreaByZone(prisma, stationId),
  ]);
  return NextResponse.json(
    spaces.map(({ occupancy, parentZone, ...space }) => {
      const allocatedArea = space.areaKind === "ZONE" ? roundArea(allocated.get(space.id) ?? 0) : null;
      return {
        ...space,
        tenantId:
          occupancy?.tenant.isActive === true ? occupancy.tenantId : null,
        tenantBrand:
          occupancy?.tenant.isActive === true ? occupancy.tenant.brandName : null,
        parentZoneLabel: parentZone ? `${parentZone.code} - ${parentZone.name}` : null,
        allocatedArea,
        remainingArea: allocatedArea === null ? null : roundArea(space.area - allocatedArea),
      };
    })
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
    const result = await prisma.$transaction(async (tx) => {
      const resolved = await resolveSpaceArea(tx, { stationId, input: spaceData });
      if (!resolved.ok) return resolved;

      const created = await tx.commercialSpace.create({
        data: { ...spaceData, ...resolved.data, stationId },
      });
      if (tenantId) {
        await tx.spaceOccupancy.create({
          data: {
            spaceId: created.id,
            tenantId,
          },
        });
      }
      await logTenantChange(tx, {
        entityType: "COMMERCIAL_SPACE",
        entityId: created.id,
        entityLabel: `${created.code} - ${created.name}`,
        stationId,
        action: "CREATE",
        performedBy: auth.user.email,
      });
      return { ok: true as const, space: created };
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result.space, { status: 201 });
  } catch (error) {
    return spaceWriteError(error);
  }
}
