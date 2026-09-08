import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateS3Key, uploadToS3 } from "@/lib/s3";
import { processSpacePhoto } from "@/lib/image-processor";
import { MAX_STANDARD_IMAGE_UPLOAD_BYTES, readValidatedImageUpload } from "@/lib/upload-validation";
import { parseJsonRequest } from "@/lib/api-validation";
import { trainRentalSpaceMutationSchema } from "@/lib/api-schemas";
import { fetchTrainRentalSalesMap, writeTrainRentalSalesFields } from "@/lib/train-rental-spaces";

type Params = { params: Promise<{ id: string }> };

function writeError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json(
      { error: "Nomor tampilan sudah dipakai. Gunakan nomor lain." },
      { status: 409 }
    );
  }
  console.error("[cms/train-rental-spaces/id] write failed", error);
  return NextResponse.json({ error: "Gagal menyimpan ruang sewa kereta." }, { status: 500 });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const parsed = await parseJsonRequest(request, trainRentalSpaceMutationSchema);
  if (!parsed.success) return parsed.response;

  const existing = await prisma.trainRentalSpace.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Ruang sewa tidak ditemukan." }, { status: 404 });
  }

  try {
    const space = await prisma.trainRentalSpace.update({
      where: { id },
      data: {
        displayNumber: parsed.data.displayNumber,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        imageUrl: parsed.data.imageUrl ?? null,
        objectPosition: parsed.data.objectPosition ?? "50% 50%",
        order: parsed.data.order ?? existing.order,
        isActive: parsed.data.isActive ?? existing.isActive,
      },
    });
    await writeTrainRentalSalesFields(id, {
      availableTrainsets: parsed.data.availableTrainsets,
      availableByCar: parsed.data.availableByCar,
      howToOrder: parsed.data.howToOrder ?? null,
      status: parsed.data.status,
      monthlyRent: parsed.data.monthlyRent ?? null,
    });
    const sales = await fetchTrainRentalSalesMap([id]);
    const extra = sales.get(id);
    return NextResponse.json({
      ...space,
      availableTrainsets: extra?.availableTrainsets ?? [],
      howToOrder: extra?.howToOrder ?? null,
      status: extra?.status ?? parsed.data.status,
      monthlyRent: extra?.monthlyRent ?? null,
    });
  } catch (error) {
    return writeError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  await prisma.trainRentalSpace.delete({ where: { id } });
  return NextResponse.json({ message: "Ruang sewa dihapus" });
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

  const result = await processSpacePhoto(upload.buffer);
  const s3Key = generateS3Key("train-rental-spaces", `${id}.webp`);
  await uploadToS3(result.buffer, s3Key, "image/webp");
  const imageUrl = `/${s3Key}`;

  const space = await prisma.trainRentalSpace.update({
    where: { id },
    data: { imageUrl },
  });

  return NextResponse.json({ message: "Upload berhasil", space });
}
