import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateS3Key, uploadToS3 } from "@/lib/s3";
import { processSpacePhoto } from "@/lib/image-processor";
import { MAX_STANDARD_IMAGE_UPLOAD_BYTES, readValidatedImageUpload } from "@/lib/upload-validation";
import { parseJsonRequest } from "@/lib/api-validation";
import { spaceMutationSchema } from "@/lib/api-schemas";
import { resolveSpaceArea } from "@/lib/space-zoning";
import { diffChangedFields, logTenantChange } from "@/lib/tenant-change-log";
import {
  countLinks,
  describeLinks,
  findStationSpaceLinks,
  removeStationSpaceLinks,
  renameStationSpaceCode,
} from "@/lib/space-hotspot-links";

type Params = { params: Promise<{ id: string }> };

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
  console.error("[cms/spaces] write failed", error);
  return NextResponse.json({ error: "Gagal menyimpan unit." }, { status: 500 });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const parsed = await parseJsonRequest(request, spaceMutationSchema);
  if (!parsed.success) return parsed.response;
  const { tenantId, ...spaceData } = parsed.data;

  const existing = await prisma.commercialSpace.findUnique({
    where: { id },
    include: { occupancy: { select: { tenantId: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Unit tidak ditemukan." }, { status: 404 });
  }

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
      where: { id: tenantId, stationId: existing.stationId, isActive: true },
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
      const resolved = await resolveSpaceArea(tx, {
        stationId: existing.stationId,
        spaceId: id,
        input: spaceData,
      });
      if (!resolved.ok) return resolved;

      const nextData = { ...spaceData, ...resolved.data };
      const updated = await tx.commercialSpace.update({
        where: { id },
        data: nextData,
      });

      if (tenantId) {
        await tx.spaceOccupancy.upsert({
          where: { spaceId: id },
          create: { spaceId: id, tenantId },
          update: { tenantId },
        });
      } else {
        await tx.spaceOccupancy.deleteMany({ where: { spaceId: id } });
      }

      const hotspotsAffected =
        existing.code !== updated.code
          ? await renameStationSpaceCode(tx, existing.stationId, {
              id,
              oldCode: existing.code,
              newCode: updated.code,
            })
          : 0;

      const changedFields = diffChangedFields(
        { ...existing, tenantId: existing.occupancy?.tenantId ?? null },
        { ...nextData, tenantId: tenantId ?? null }
      );
      if (changedFields.length > 0) {
        await logTenantChange(tx, {
          entityType: "COMMERCIAL_SPACE",
          entityId: id,
          entityLabel: `${updated.code} - ${updated.name}`,
          stationId: existing.stationId,
          action: "UPDATE",
          changedFields,
          hotspotsAffected,
          performedBy: auth.user.email,
        });
      }

      return { ok: true as const, space: updated, hotspotsAffected };
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ...result.space, hotspotsAffected: result.hotspotsAffected });
  } catch (error) {
    return spaceWriteError(error);
  }
}

/**
 * Hapus unit. Jika unit masih ditandai di panorama, kembalikan 409 berisi daftar scene
 * agar admin mengonfirmasi; kirim ?cascadeHotspots=1 untuk menghapus unit beserta penandanya.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const cascade = request.nextUrl.searchParams.get("cascadeHotspots") === "1";
  const space = await prisma.commercialSpace.findUnique({
    where: { id },
    select: { id: true, code: true, name: true, stationId: true, _count: { select: { allocations: true } } },
  });
  if (!space) return NextResponse.json({ error: "Unit tidak ditemukan." }, { status: 404 });

  if (space._count.allocations > 0) {
    return NextResponse.json(
      {
        error: `Zona ${space.code} masih dibagi ke ${space._count.allocations} unit. Hapus atau pindahkan unit bagian zona terlebih dahulu.`,
        code: "ZONE_HAS_ALLOCATIONS",
      },
      { status: 409 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const links = await findStationSpaceLinks(tx, space.stationId, space);
    if (links.length > 0 && !cascade) return { ok: false as const, links };

    const hotspotsAffected = links.length > 0 ? await removeStationSpaceLinks(tx, space.stationId, space) : 0;
    await tx.commercialSpace.delete({ where: { id } });
    await logTenantChange(tx, {
      entityType: "COMMERCIAL_SPACE",
      entityId: id,
      entityLabel: `${space.code} - ${space.name}`,
      stationId: space.stationId,
      action: "DELETE",
      hotspotsAffected,
      performedBy: auth.user.email,
    });
    return { ok: true as const, hotspotsAffected };
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: `Unit ${space.code} masih ditandai di ${countLinks(result.links)} penanda lokasi (${describeLinks(result.links)}).`,
        code: "HOTSPOT_LINKED",
        links: result.links,
      },
      { status: 409 }
    );
  }
  return NextResponse.json({ message: "Unit dihapus", hotspotsAffected: result.hotspotsAffected });
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "File wajib diisi" }, { status: 400 });

  const upload = await readValidatedImageUpload(file, MAX_STANDARD_IMAGE_UPLOAD_BYTES);
  if ("error" in upload) return NextResponse.json({ error: upload.error }, { status: 400 });
  const originalBuffer = upload.buffer;
  const result = await processSpacePhoto(originalBuffer);

  const s3Key = generateS3Key("spaces", `${id}.webp`);
  await uploadToS3(result.buffer, s3Key, "image/webp");
  const panoramaUrl = `/${s3Key}`;

  const space = await prisma.$transaction(async (tx) => {
    const updated = await tx.commercialSpace.update({
      where: { id },
      data: { panoramaUrl },
    });
    await logTenantChange(tx, {
      entityType: "COMMERCIAL_SPACE",
      entityId: id,
      entityLabel: `${updated.code} - ${updated.name}`,
      stationId: updated.stationId,
      action: "UPDATE",
      changedFields: ["panoramaUrl"],
      performedBy: auth.user.email,
    });
    return updated;
  });

  return NextResponse.json({ message: "Upload berhasil", space });
}
