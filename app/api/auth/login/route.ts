import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { cmsTokenCookieOptions } from "@/lib/auth-cookie";

function defaultRedirectForRole(role: string) {
  return role === "MITRA" ? "/partner" : "/cms/dashboard";
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ message: "Email dan password harus diisi" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, name: true, password: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ message: "Email atau password salah" }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ message: "Email atau password salah" }, { status: 401 });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.NEXTAUTH_SECRET || "default-secret",
      { expiresIn: "24h" }
    );

    const userWithoutPassword = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    };
    const response = NextResponse.json({
      message: "Login berhasil",
      token,
      user: userWithoutPassword,
      redirectTo: defaultRedirectForRole(user.role),
    });

    response.cookies.set("cms-token", token, cmsTokenCookieOptions());

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ message: "Terjadi kesalahan server" }, { status: 500 });
  }
}
