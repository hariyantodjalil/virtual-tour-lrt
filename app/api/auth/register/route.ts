import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { z } from "zod";
import { signToken } from "@/lib/auth";
import { cmsTokenCookieOptions } from "@/lib/auth-cookie";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { consumeRateLimit, getClientIdentifier, rateLimitHeaders } from "@/lib/rate-limit";

const registerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    name: z.string().trim().min(2).max(120),
    password: z.string().min(8).max(128),
    remember: z.boolean().optional(),
  })
  .strict();

function emailFingerprint(email: string) {
  return createHash("sha256").update(email).digest("hex").slice(0, 16);
}

/** Pendaftaran publik — selalu role MITRA (bukan admin) */
export async function POST(request: NextRequest) {
  const ipLimit = consumeRateLimit(request, "auth-register-ip", {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { message: "Terlalu banyak percobaan daftar. Coba lagi nanti." },
      { status: 429, headers: rateLimitHeaders(ipLimit) }
    );
  }

  try {
    const parsed = await parseJsonRequest(request, registerSchema);
    if (!parsed.success) return parsed.response;
    const { email, name, password, remember } = parsed.data;

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      console.warn(
        JSON.stringify({
          event: "auth.register_failed",
          reason: "email_taken",
          client: getClientIdentifier(request),
          emailFingerprint: emailFingerprint(email),
        })
      );
      return NextResponse.json(
        { message: "Email sudah terdaftar. Silakan login." },
        { status: 409 }
      );
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashed,
        role: "MITRA",
        isActive: true,
      },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    const response = NextResponse.json({
      message: "Pendaftaran berhasil",
      user,
      redirectTo: "/partner",
    }, { status: 201 });

    response.cookies.set(
      "cms-token",
      token,
      cmsTokenCookieOptions(remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8)
    );

    return response;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ message: "Terjadi kesalahan server" }, { status: 500 });
  }
}
