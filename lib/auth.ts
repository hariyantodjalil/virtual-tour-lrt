import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

export type UserRole = "ADMIN" | "EDITOR" | "MITRA";

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

const JWT_ISSUER = "lrt-virtualtour";
const JWT_AUDIENCE = "lrt-virtualtour-web";

function getJwtSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("NEXTAUTH_SECRET must contain at least 32 characters");
  }
  return secret;
}

export function signToken(payload: Omit<JWTPayload, "iat" | "exp">): string {
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: "HS256",
    audience: JWT_AUDIENCE,
    issuer: JWT_ISSUER,
    expiresIn: "8h",
  });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      audience: JWT_AUDIENCE,
      issuer: JWT_ISSUER,
    }) as JWTPayload;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.replace("Bearer ", "");
  }
  const cookieToken = request.cookies.get("cms-token")?.value;
  if (cookieToken) return cookieToken;
  return request.headers.get("x-token");
}

export function getUserFromRequest(request: NextRequest): JWTPayload | null {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

async function getActiveUser(request: NextRequest): Promise<JWTPayload | null> {
  const claims = getUserFromRequest(request);
  if (!claims) return null;

  // Tetap lazy agar proxy yang hanya memverifikasi JWT tidak menarik Prisma ke jalur awal request.
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({
    where: { id: claims.userId },
    select: { id: true, email: true, role: true, isActive: true },
  });
  if (!user?.isActive) return null;

  return {
    ...claims,
    userId: user.id,
    email: user.email,
    role: user.role,
  };
}

export async function requireAuth(
  request: NextRequest
): Promise<{ user: JWTPayload } | { error: string; status: number }> {
  const user = await getActiveUser(request);
  if (!user) return { error: "Authentication required", status: 401 };
  if (user.role !== "ADMIN" && user.role !== "EDITOR") {
    return { error: "Insufficient permissions", status: 403 };
  }
  return { user };
}

export async function requireRole(
  request: NextRequest,
  allowedRoles: UserRole[]
): Promise<{ user: JWTPayload } | { error: string; status: number }> {
  const user = await getActiveUser(request);
  if (!user) return { error: "Authentication required", status: 401 };
  if (!allowedRoles.includes(user.role)) {
    return { error: "Insufficient permissions", status: 403 };
  }
  return { user };
}
