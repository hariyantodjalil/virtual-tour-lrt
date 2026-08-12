import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID, createHash } from "node:crypto";
import { signToken } from "@/lib/auth";
import { cmsTokenCookieOptions } from "@/lib/auth-cookie";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { googleAuthSchema } from "@/lib/api-schemas";
import { consumeRateLimit, getClientIdentifier, rateLimitHeaders } from "@/lib/rate-limit";

type GoogleTokenInfo = {
  iss?: string;
  sub?: string;
  aud?: string;
  azp?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
  exp?: string;
  error_description?: string;
};

function emailFingerprint(email: string) {
  return createHash("sha256").update(email).digest("hex").slice(0, 16);
}

function defaultRedirectForRole(role: string) {
  return role === "MITRA" ? "/partner" : "/cms/dashboard";
}

export async function POST(request: NextRequest) {
  const ipLimit = consumeRateLimit(request, "auth-google-ip", {
    limit: 15,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { message: "Terlalu banyak percobaan login. Coba lagi nanti." },
      { status: 429, headers: rateLimitHeaders(ipLimit) }
    );
  }

  try {
    const parsed = await parseJsonRequest(request, googleAuthSchema);
    if (!parsed.success) return parsed.response;
    const { credential, remember } = parsed.data;

    // Verifikasi ID Token langsung ke Google OAuth tokeninfo endpoint
    const googleRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
      }
    );

    if (!googleRes.ok) {
      console.warn(
        JSON.stringify({
          event: "auth.google_failed",
          reason: "invalid_google_token",
          client: getClientIdentifier(request),
          occurredAt: new Date().toISOString(),
        })
      );
      return NextResponse.json(
        { message: "Token Google tidak valid atau sesi telah berakhir. Silakan coba lagi." },
        { status: 401 }
      );
    }

    const googlePayload: GoogleTokenInfo = await googleRes.json();

    // Validasi email terverifikasi
    const isEmailVerified =
      googlePayload.email_verified === true || googlePayload.email_verified === "true";
    if (!googlePayload.email || !isEmailVerified) {
      return NextResponse.json(
        { message: "Email Google belum terverifikasi oleh Google." },
        { status: 400 }
      );
    }

    // Validasi Audience / Client ID jika dikonfigurasi di Environment
    const expectedClientId =
      process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (expectedClientId) {
      const isAudMatch =
        googlePayload.aud === expectedClientId || googlePayload.azp === expectedClientId;
      if (!isAudMatch) {
        console.warn(
          JSON.stringify({
            event: "auth.google_failed",
            reason: "client_id_mismatch",
            receivedAud: googlePayload.aud,
            expectedClientId,
            client: getClientIdentifier(request),
          })
        );
        return NextResponse.json(
          { message: "Client ID Google tidak cocok dengan konfigurasi aplikasi." },
          { status: 403 }
        );
      }
    }

    const email = googlePayload.email.toLowerCase().trim();
    const name = googlePayload.name?.trim() || email.split("@")[0];
    const avatarUrl = googlePayload.picture || null;

    // Cari akun yang sudah ada
    let user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    if (user) {
      if (!user.isActive) {
        console.warn(
          JSON.stringify({
            event: "auth.google_failed",
            reason: "inactive_account",
            client: getClientIdentifier(request),
            emailFingerprint: emailFingerprint(email),
          })
        );
        return NextResponse.json(
          { message: "Akun Anda dinonaktifkan. Silakan hubungi admin." },
          { status: 403 }
        );
      }
    } else {
      // Buat akun baru khusus publik/mitra
      const randomPassword = await bcrypt.hash(randomUUID() + "-" + Date.now(), 12);
      user = await prisma.user.create({
        data: {
          email,
          name,
          password: randomPassword,
          role: "MITRA",
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
        },
      });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const userWithoutSecrets = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl,
      isActive: user.isActive,
    };

    const response = NextResponse.json({
      message: "Login Google berhasil",
      user: userWithoutSecrets,
      redirectTo: defaultRedirectForRole(user.role),
    });

    response.cookies.set(
      "cms-token",
      token,
      cmsTokenCookieOptions(remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8)
    );

    for (const [headerName, headerValue] of Object.entries(rateLimitHeaders(ipLimit))) {
      response.headers.set(headerName, headerValue);
    }

    return response;
  } catch (error) {
    console.error("Google Auth error:", error);
    return NextResponse.json({ message: "Terjadi kesalahan server saat login Google" }, { status: 500 });
  }
}
