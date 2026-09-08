import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { trainRentalSpaceMutationSchema } from "@/lib/api-schemas";
import { ensureDefaultTrain } from "@/lib/default-train";
import { ensureDefaultTrainRentalSpaces } from "@/lib/train-rental-spaces";

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

  const train = await ensureDefaultTrain();
  await ensureDefaultTrainRentalSpaces(train.id);

  const spaces = await prisma.trainRentalSpace.findMany({
    where: { trainId: train.id },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(spaces);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonRequest(request, trainRentalSpaceMutationSchema);
  if (!parsed.success) return parsed.response;

  const train = await ensureDefaultTrain();

  try {
    const space = await prisma.trainRentalSpace.create({
      data: {
        trainId: train.id,
        displayNumber: parsed.data.displayNumber,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        imageUrl: parsed.data.imageUrl ?? null,
        objectPosition: parsed.data.objectPosition ?? "50% 50%",
        order: parsed.data.order ?? 0,
        isActive: parsed.data.isActive ?? true,
      },
    });
    return NextResponse.json(space, { status: 201 });
  } catch (error) {
    return writeError(error);
  }
}
