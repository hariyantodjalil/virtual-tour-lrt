import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { trainRentalSpaceMutationSchema } from "@/lib/api-schemas";
import { ensureDefaultTrain } from "@/lib/default-train";
import {
  fetchTrainRentalSalesMap,
  getTrainRentalSpacesForCms,
  writeTrainRentalSalesFields,
} from "@/lib/train-rental-spaces";
import { logTenantChange } from "@/lib/tenant-change-log";

function writeError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json(
      { error: "Nomor tampilan sudah dipakai. Gunakan nomor lain." },
      { status: 409 }
    );
  }
  console.error("[cms/train-rental-spaces] write failed", error);
  return NextResponse.json({ error: "Gagal menyimpan ruang sewa kereta." }, { status: 500 });
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const spaces = await getTrainRentalSpacesForCms();
  return NextResponse.json(spaces);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonRequest(request, trainRentalSpaceMutationSchema);
  if (!parsed.success) return parsed.response;

  const train = await ensureDefaultTrain();

  try {
    const space = await prisma.$transaction(async (tx) => {
      const created = await tx.trainRentalSpace.create({
        data: {
          trainId: train.id,
          displayNumber: parsed.data.displayNumber,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          imageUrl: parsed.data.imageUrl ?? null,
          objectPosition: parsed.data.objectPosition ?? "50% 50%",
          order: parsed.data.order ?? 0,
          isActive: parsed.data.isActive ?? true,
          lengthM: parsed.data.lengthM ?? null,
          widthM: parsed.data.widthM ?? null,
          heightM: parsed.data.heightM ?? null,
        },
      });
      await logTenantChange(tx, {
        entityType: "TRAIN_RENTAL_SPACE",
        entityId: created.id,
        entityLabel: `${created.displayNumber} - ${created.title}`,
        action: "CREATE",
        performedBy: auth.user.email,
      });
      return created;
    });
    await writeTrainRentalSalesFields(space.id, {
      availableTrainsets: parsed.data.availableTrainsets,
      availableByCar: parsed.data.availableByCar,
      howToOrder: parsed.data.howToOrder ?? null,
      status: parsed.data.status,
      monthlyRent: parsed.data.monthlyRent ?? null,
    });
    const sales = await fetchTrainRentalSalesMap([space.id]);
    const extra = sales.get(space.id);
    return NextResponse.json(
      {
        ...space,
        availableTrainsets: extra?.availableTrainsets ?? [],
        howToOrder: extra?.howToOrder ?? null,
        status: extra?.status ?? parsed.data.status,
        monthlyRent: extra?.monthlyRent ?? null,
      },
      { status: 201 }
    );
  } catch (error) {
    return writeError(error);
  }
}
