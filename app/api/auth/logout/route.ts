import { NextResponse } from "next/server";
import { cmsTokenCookieOptions } from "@/lib/auth-cookie";

export async function POST() {
  const response = NextResponse.json({ message: "Logout berhasil" });
  response.cookies.set("cms-token", "", cmsTokenCookieOptions(0));
  return response;
}
