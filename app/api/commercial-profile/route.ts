import { NextResponse } from "next/server";
import { getCommercialProfile } from "@/lib/commercial-profile";

export async function GET() {
  const profile = await getCommercialProfile();
  return NextResponse.json(profile, {
    headers: { "Cache-Control": "no-store" },
  });
}
