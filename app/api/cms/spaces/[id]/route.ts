import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateS3Key, uploadToS3 } from "@/lib/s3";
import { processSpacePhoto } from "@/lib/image-processor";
import { MAX_STANDARD_IMAGE_UPLOAD_BYTES, readValidatedImageUpload } from "@/lib/upload-validation";
import { parseJsonRequest } from "@/lib/api-validation";
import { spaceMutationSchema } from "@/lib/api-schemas";

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
  try {
    const space = await prisma.commercialSpace.update({ where: { id }, data: parsed.data });
    return NextResponse.json(space);
  } catch (error) {
    return spaceWriteError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  await prisma.commercialSpace.delete({ where: { id } });
  return NextResponse.json({ message: "Unit dihapus" });
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

  const space = await prisma.commercialSpace.update({
    where: { id },
    data: { panoramaUrl },
  });

  return NextResponse.json({ message: "Upload berhasil", space });
}
