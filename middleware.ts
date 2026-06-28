import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/cms/login")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/cms")) {
    const token = request.cookies.get("cms-token")?.value;
    if (!token) {
      const loginUrl = new URL("/cms/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith("/api/cms")) {
    const token =
      request.cookies.get("cms-token")?.value ||
      request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/cms/:path*", "/api/cms/:path*"],
};
