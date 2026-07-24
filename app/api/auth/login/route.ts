import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { z } from "zod";
import { signToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { consumeRateLimit, getClientIdentifier, rateLimitHeaders } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
  remember: z.boolean().optional(),
}).strict();

function emailFingerprint(email: string) {
  return createHash("sha256").update(email).digest("hex").slice(0, 16);
}

function recordFailedLogin(request: NextRequest, email: string, reason: string) {
  console.warn(JSON.stringify({
    event: "auth.login_failed",
    reason,
    client: getClientIdentifier(request),
    emailFingerprint: emailFingerprint(email),
    occurredAt: new Date().toISOString(),
  }));
}

function defaultRedirectForRole(role: string) {
  return role === "MITRA" ? "/partner" : "/cms/dashboard";
}

export async function POST(request: NextRequest) {
  const ipLimit = consumeRateLimit(request, "auth-login-ip", {
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { message: "Terlalu banyak percobaan login. Coba lagi nanti." },
      { status: 429, headers: rateLimitHeaders(ipLimit) }
    );
  }

  try {
    const parsed = await parseJsonRequest(request, loginSchema);
    if (!parsed.success) return parsed.response;
    const { email, password, remember } = parsed.data;

    const accountLimit = consumeRateLimit(request, "auth-login-account", {
      limit: 5,
      windowMs: 10 * 60 * 1000,
      subject: emailFingerprint(email),
    });
    if (!accountLimit.allowed) {
      recordFailedLogin(request, email, "account_rate_limited");
      return NextResponse.json(
        { message: "Terlalu banyak percobaan login. Coba lagi nanti." },
        { status: 429, headers: rateLimitHeaders(accountLimit) }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, password: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      recordFailedLogin(request, email, user ? "inactive_account" : "unknown_account");
      return NextResponse.json({ message: "Email atau password salah" }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      recordFailedLogin(request, email, "invalid_password");
      return NextResponse.json({ message: "Email atau password salah" }, { status: 401 });
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    const userWithoutPassword = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    };
    const response = NextResponse.json({
      message: "Login berhasil",
      user: userWithoutPassword,
      redirectTo: defaultRedirectForRole(user.role),
    });

    response.cookies.set("cms-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8,
      path: "/",
    });
    for (const [name, value] of Object.entries(rateLimitHeaders(accountLimit))) {
      response.headers.set(name, value);
    }

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ message: "Terjadi kesalahan server" }, { status: 500 });
  }
}
