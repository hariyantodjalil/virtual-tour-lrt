import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, type JWTPayload } from "@/lib/auth";
import { isMaintenanceActiveFast } from "@/lib/maintenance";

function getCookieToken(request: NextRequest): string | undefined {
  return request.cookies.get("cms-token")?.value;
}

function getApiToken(request: NextRequest): string | undefined {
  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    return bearer.slice("Bearer ".length).trim() || undefined;
  }
  return getCookieToken(request);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieToken = getCookieToken(request);
  const cookiePayload: JWTPayload | null = cookieToken ? verifyToken(cookieToken) : null;
  const isAdminOrEditor =
    cookiePayload?.role === "ADMIN" || cookiePayload?.role === "EDITOR";

  // ─── 1. Bypass Khusus Login & Auth ──────────────────────────────────────────
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/maintenance/status") ||
    pathname.startsWith("/api/s3-proxy")
  ) {
    return NextResponse.next();
  }

  // ─── 2. Mode Pemeliharaan (Maintenance Mode) Protection ─────────────────────
  // Pengecekan instan (0ms) tanpa memblokir request ke DB
  const isMaintenanceMode = isMaintenanceActiveFast();

  if (isMaintenanceMode) {
    if (pathname === "/maintenance") {
      return NextResponse.next();
    }

    // Jika bukan Admin/Editor dan bukan rute CMS
    if (!isAdminOrEditor && !pathname.startsWith("/cms") && !pathname.startsWith("/api/cms")) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          {
            error: "Situs Virtual Tour LRT Jabodebek sedang dalam mode pemeliharaan sistem.",
            maintenance: true,
          },
          { status: 503 }
        );
      }

      const maintenanceUrl = new URL("/maintenance", request.url);
      return NextResponse.redirect(maintenanceUrl);
    }
  } else {
    // Jika maintenance NONAKTIF dan user sengaja buka /maintenance, kembalikan ke home
    if (pathname === "/maintenance") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // ─── 3. Proteksi Akses CMS ──────────────────────────────────────────────────
  if (pathname.startsWith("/cms")) {
    if (!cookiePayload) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const response = NextResponse.redirect(loginUrl);
      if (cookieToken) response.cookies.delete("cms-token");
      return response;
    }

    if (!isAdminOrEditor) {
      return NextResponse.redirect(new URL("/partner", request.url));
    }
  }

  // ─── 4. Proteksi Akses Portal Partner / Mitra ───────────────────────────────
  if (pathname.startsWith("/partner")) {
    if (!cookiePayload) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const response = NextResponse.redirect(loginUrl);
      if (cookieToken) response.cookies.delete("cms-token");
      return response;
    }

    if (cookiePayload.role !== "MITRA" && !isAdminOrEditor) {
      return NextResponse.redirect(new URL("/cms/dashboard", request.url));
    }
  }

  // ─── 5. Proteksi API CMS ───────────────────────────────────────────────────
  if (pathname.startsWith("/api/cms")) {
    const apiToken = getApiToken(request);
    const apiPayload = apiToken ? verifyToken(apiToken) : null;

    if (!apiPayload) {
      return NextResponse.json(
        { error: "Sesi telah berakhir. Silakan login kembali.", expired: true },
        { status: 401 }
      );
    }

    if (apiPayload.role !== "ADMIN" && apiPayload.role !== "EDITOR") {
      return NextResponse.json({ error: "Akses CMS ditolak." }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
