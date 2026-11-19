import { NextResponse } from "next/server";
import { authCookieName, cmsTokenCookieOptions } from "@/lib/auth-cookie";

export async function POST() {
  const response = NextResponse.json({ message: "Logout berhasil" });
  response.cookies.set(authCookieName(), "", cmsTokenCookieOptions(0));
  return response;
}
