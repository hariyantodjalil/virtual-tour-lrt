import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicWorkflowSelect } from "@/lib/partner-inquiries";

export const dynamic = "force-dynamic";
export async function GET() {
  const workflow = await prisma.pipelineWorkflowVersion.findFirst({ where: { status: "ACTIVE" }, orderBy: { version: "desc" }, select: publicWorkflowSelect });
  if (!workflow) return NextResponse.json({ error: "Alur pengajuan belum tersedia." }, { status: 404 });
  return NextResponse.json(workflow, { headers: { "Cache-Control": "no-store" } });
}
