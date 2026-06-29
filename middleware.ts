import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function decodeJWTPayload(token: string): { exp?: number; userId?: string; role?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function isTokenValid(token: string | undefined): boolean {
  if (!token) return false;
  const payload = decodeJWTPayload(token);
  if (!payload) return false;
  if (payload.exp && payload.exp * 1000 < Date.now()) return false;
  return true;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("cms-token")?.value;
  const payload = token ? decodeJWTPayload(token) : null;

  if (pathname.startsWith("/cms/login") || pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/cms")) {
    if (!isTokenValid(token)) {
      const loginUrl = new URL("/cms/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const response = NextResponse.redirect(loginUrl);
      if (token) response.cookies.delete("cms-token");
      return response;
    }

    if (payload?.role === "MITRA") {
      return NextResponse.redirect(new URL("/partner", request.url));
    }
  }

  if (pathname.startsWith("/partner")) {
    if (!isTokenValid(token)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const response = NextResponse.redirect(loginUrl);
      if (token) response.cookies.delete("cms-token");
      return response;
    }

    if (payload?.role !== "MITRA") {
      return NextResponse.redirect(new URL("/cms/dashboard", request.url));
    }
  }

  if (pathname.startsWith("/api/cms")) {
    const apiToken =
      request.cookies.get("cms-token")?.value ||
      request.headers.get("authorization")?.replace("Bearer ", "");

    if (!isTokenValid(apiToken)) {
      return NextResponse.json(
        { error: "Sesi telah berakhir. Silakan login kembali.", expired: true },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/cms/:path*", "/partner/:path*", "/api/cms/:path*"],
};
