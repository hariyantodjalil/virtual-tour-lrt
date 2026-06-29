import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Decode payload JWT tanpa verifikasi signature — hanya untuk cek `exp`.
 * Verifikasi kriptografi tetap dilakukan di API routes via requireAuth().
 * Menggunakan atob() yang tersedia di Edge Runtime.
 */
function decodeJWTPayload(token: string): { exp?: number; userId?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // base64url → base64 → JSON
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    // Padding agar atob tidak error
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

/** Cek apakah token ada dan belum expired */
function isTokenValid(token: string | undefined): boolean {
  if (!token) return false;
  const payload = decodeJWTPayload(token);
  if (!payload) return false;
  // exp dalam detik (UNIX timestamp)
  if (payload.exp && payload.exp * 1000 < Date.now()) return false;
  return true;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Halaman login selalu diizinkan
  if (pathname.startsWith("/cms/login")) {
    return NextResponse.next();
  }

  // Proteksi halaman CMS — redirect ke login jika tidak ada token atau expired
  if (pathname.startsWith("/cms")) {
    const token = request.cookies.get("cms-token")?.value;

    if (!isTokenValid(token)) {
      const loginUrl = new URL("/cms/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      // Clear cookie expired sebelum redirect
      const response = NextResponse.redirect(loginUrl);
      if (token) response.cookies.delete("cms-token");
      return response;
    }
  }

  // Proteksi API CMS — kembalikan 401 jika tidak ada token atau expired
  if (pathname.startsWith("/api/cms")) {
    const token =
      request.cookies.get("cms-token")?.value ||
      request.headers.get("authorization")?.replace("Bearer ", "");

    if (!isTokenValid(token)) {
      return NextResponse.json(
        { error: "Sesi telah berakhir. Silakan login kembali.", expired: true },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/cms/:path*", "/api/cms/:path*"],
};
