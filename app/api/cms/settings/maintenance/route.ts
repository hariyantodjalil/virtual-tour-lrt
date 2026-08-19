import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getMaintenanceConfig, updateMaintenanceConfig } from "@/lib/maintenance";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: Ambil status mode maintenance saat ini
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const config = await getMaintenanceConfig(true);
  return NextResponse.json(config, {
    headers: { "Cache-Control": "no-store" },
  });
}

// POST: Update status mode maintenance (Hanya ADMIN)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (auth.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Hanya akun dengan role Administrator yang dapat mengubah mode maintenance." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    if (typeof body.isMaintenanceMode !== "boolean") {
      return NextResponse.json(
        { error: "Field isMaintenanceMode (boolean) wajib diisi." },
        { status: 400 }
      );
    }

    const updated = await updateMaintenanceConfig({
      isMaintenanceMode: body.isMaintenanceMode,
      maintenanceMessage: body.maintenanceMessage,
      updatedBy: auth.user.email,
    });

    return NextResponse.json({
      message: updated.isMaintenanceMode
        ? "Mode maintenance BERHASIL DIAKTIFKAN. Akses publik sekarang ditutup sementara."
        : "Mode maintenance BERHASIL DINONAKTIFKAN. Situs publik sekarang dapat diakses kembali normal.",
      config: updated,
    });
  } catch (err) {
    console.error("[Maintenance API] Error updating maintenance config:", err);
    return NextResponse.json(
      { error: "Gagal memperbarui pengaturan maintenance." },
      { status: 500 }
    );
  }
}
