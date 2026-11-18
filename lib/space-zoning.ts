import type { Prisma } from "@prisma/client";
import {
  AREA_EPSILON,
  areaFromDimensions,
  formatArea,
  roundArea,
  type SpaceAreaKind,
} from "@/lib/unit-dimensions";

type AreaInput = {
  area: number;
  lengthM?: number | null;
  widthM?: number | null;
  heightM?: number | null;
  areaKind: SpaceAreaKind;
  parentZoneId?: string | null;
};

type ResolveResult =
  | {
      ok: true;
      data: {
        area: number;
        lengthM: number | null;
        widthM: number | null;
        heightM: number | null;
        areaKind: SpaceAreaKind;
        parentZoneId: string | null;
      };
    }
  | { ok: false; error: string; status: number };

async function sumAllocatedArea(tx: Prisma.TransactionClient, zoneId: string, excludeId?: string) {
  const result = await tx.commercialSpace.aggregate({
    where: { parentZoneId: zoneId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    _sum: { area: true },
  });
  return result._sum.area ?? 0;
}

/**
 * Normalisasi luas dari dimensi dan terapkan aturan zonasi:
 * - area tetap dan zona induk tidak boleh punya zona induk;
 * - bagian zona wajib menunjuk zona induk di stasiun yang sama;
 * - total luas bagian zona tidak boleh melebihi luas zona induk.
 */
export async function resolveSpaceArea(
  tx: Prisma.TransactionClient,
  { stationId, spaceId, input }: { stationId: string; spaceId?: string; input: AreaInput }
): Promise<ResolveResult> {
  const area = areaFromDimensions(input.lengthM, input.widthM) ?? roundArea(input.area);
  if (area <= 0) {
    return { ok: false, error: "Luas unit harus lebih dari 0 m². Isi panjang × lebar atau luas.", status: 400 };
  }

  const data = {
    area,
    lengthM: input.lengthM ?? null,
    widthM: input.widthM ?? null,
    heightM: input.heightM ?? null,
    areaKind: input.areaKind,
    parentZoneId: input.areaKind === "ZONE_ALLOCATION" ? input.parentZoneId ?? null : null,
  };

  if (data.areaKind === "ZONE_ALLOCATION") {
    if (!data.parentZoneId) {
      return { ok: false, error: "Pilih zona induk untuk unit bagian zona.", status: 400 };
    }
    if (data.parentZoneId === spaceId) {
      return { ok: false, error: "Unit tidak bisa menjadi zona induk bagi dirinya sendiri.", status: 400 };
    }
    const zone = await tx.commercialSpace.findFirst({
      where: { id: data.parentZoneId, stationId, areaKind: "ZONE" },
      select: { id: true, code: true, area: true },
    });
    if (!zone) {
      return { ok: false, error: "Zona induk tidak ditemukan di stasiun ini.", status: 400 };
    }
    const allocated = await sumAllocatedArea(tx, zone.id, spaceId);
    const remaining = roundArea(zone.area - allocated);
    if (area > remaining + AREA_EPSILON) {
      return {
        ok: false,
        error: `Luas ${formatArea(area)} melebihi sisa zona ${zone.code} (${formatArea(Math.max(remaining, 0))}).`,
        status: 409,
      };
    }
  }

  if (spaceId) {
    const allocationCount = await tx.commercialSpace.count({ where: { parentZoneId: spaceId } });
    if (allocationCount > 0) {
      if (data.areaKind !== "ZONE") {
        return {
          ok: false,
          error: `Unit ini masih menjadi zona induk bagi ${allocationCount} unit. Pindahkan atau hapus unit bagian zona terlebih dahulu.`,
          status: 409,
        };
      }
      const allocated = await sumAllocatedArea(tx, spaceId);
      if (area + AREA_EPSILON < allocated) {
        return {
          ok: false,
          error: `Luas zona tidak boleh lebih kecil dari luas yang sudah dibagi (${formatArea(allocated)}).`,
          status: 409,
        };
      }
    }
  }

  return { ok: true, data };
}

/** Luas yang sudah dibagi per zona induk di satu stasiun. */
export async function allocatedAreaByZone(tx: Prisma.TransactionClient, stationId: string) {
  const rows = await tx.commercialSpace.groupBy({
    by: ["parentZoneId"],
    where: { stationId, parentZoneId: { not: null } },
    _sum: { area: true },
  });
  return new Map(rows.map((row) => [row.parentZoneId as string, row._sum.area ?? 0]));
}
