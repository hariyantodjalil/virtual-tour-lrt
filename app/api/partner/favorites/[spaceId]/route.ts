import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ spaceId: string }> }
) {
  const auth = await requireRole(request, ["MITRA"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { spaceId } = await context.params;
  const trimmedId = spaceId?.trim();
  if (!trimmedId) {
    return NextResponse.json({ error: "ID unit tidak valid." }, { status: 400 });
  }

  await prisma.partnerFavorite.deleteMany({
    where: {
      userId: auth.user.userId,
      spaceId: trimmedId,
    },
  });

  return NextResponse.json({ removed: true, spaceId: trimmedId });
}
