import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "lrt-virtualtour",
    timestamp: new Date().toISOString(),
  });
}

