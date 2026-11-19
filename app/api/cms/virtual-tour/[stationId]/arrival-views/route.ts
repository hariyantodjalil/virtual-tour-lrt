import type { NextRequest } from "next/server";
import { saveArrivalView } from "@/lib/save-arrival-view";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ stationId: string }> }) {
  return saveArrivalView(request, await params);
}
