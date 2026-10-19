import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadToS3 } from "@/lib/s3";
import { processAvatarPhoto } from "@/lib/image-processor";
import {
  MAX_STANDARD_IMAGE_UPLOAD_BYTES,
  readValidatedImageUpload,
} from "@/lib/upload-validation";

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["MITRA"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "File wajib diisi" }, { status: 400 });

  const upload = await readValidatedImageUpload(file, MAX_STANDARD_IMAGE_UPLOAD_BYTES);
  if ("error" in upload) return NextResponse.json({ error: upload.error }, { status: 400 });

  const result = await processAvatarPhoto(upload.buffer);
  const s3Key = `misc/avatars/${auth.user.userId}.webp`;
  await uploadToS3(result.buffer, s3Key, "image/webp", {
    "user-id": auth.user.userId,
  });

  const avatarUrl = `/${s3Key}`;

  try {
    const user = await prisma.user.update({
      where: { id: auth.user.userId },
      data: { avatarUrl },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true },
    });
    return NextResponse.json({ message: "Foto profil berhasil diupload", user, avatarUrl });
  } catch {
    return NextResponse.json(
      {
        error:
          "Kolom avatarUrl belum ada di database. Jalankan `npx prisma db push` di development dulu.",
      },
      { status: 503 }
    );
  }
}
