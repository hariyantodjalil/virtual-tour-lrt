import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, type JWTPayload } from "@/lib/auth";

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

  if (pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/cms")) {
    if (!cookiePayload) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const response = NextResponse.redirect(loginUrl);
      if (cookieToken) response.cookies.delete("cms-token");
      return response;
    }

    if (cookiePayload.role !== "ADMIN" && cookiePayload.role !== "EDITOR") {
      return NextResponse.redirect(new URL("/partner", request.url));
    }
  }

  if (pathname.startsWith("/partner")) {
    if (!cookiePayload) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const response = NextResponse.redirect(loginUrl);
      if (cookieToken) response.cookies.delete("cms-token");
      return response;
    }

    if (cookiePayload.role !== "MITRA") {
      return NextResponse.redirect(new URL("/cms/dashboard", request.url));
    }
  }

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
  matcher: ["/cms/:path*", "/partner/:path*", "/api/cms/:path*"],
};
