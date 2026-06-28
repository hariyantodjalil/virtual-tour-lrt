import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ message: "Logout berhasil" });
  response.cookies.set("cms-token", "", { httpOnly: true, maxAge: 0 });
  return response;
}
