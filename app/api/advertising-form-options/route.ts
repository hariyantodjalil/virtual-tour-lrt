import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const options = await prisma.advertisingFormOption.findMany({
    where: { isActive: true }, orderBy: [{ kind: "asc" }, { order: "asc" }, { id: "asc" }],
  });
  return NextResponse.json(options, { headers: { "Cache-Control": "no-store" } });
}
