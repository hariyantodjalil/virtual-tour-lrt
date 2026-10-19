import { NextResponse } from "next/server";
import { getMaintenanceConfig } from "@/lib/maintenance";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const config = await getMaintenanceConfig();
  return NextResponse.json(
    {
      isMaintenanceMode: config.isMaintenanceMode,
      maintenanceMessage: config.maintenanceMessage,
      updatedAt: config.updatedAt,
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
