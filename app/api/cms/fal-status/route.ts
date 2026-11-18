import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isFalConfigured } from "@/lib/fal-client";

/**
 * GET — status integrasi Fal (tanpa mengekspos key).
 * Dipakai CMS untuk menampilkan “under development” jika belum terhubung.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const configured = isFalConfigured();
  return NextResponse.json({
    configured,
    model: "fal-ai/flux-pro/kontext",
    status: configured ? "ready" : "under_development",
    message: configured
      ? "Fal terhubung — AI Patch siap dipakai"
      : "Under development — Fal API belum terhubung (FAL_KEY belum diatur)",
  });
}
