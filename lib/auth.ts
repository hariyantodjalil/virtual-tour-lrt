import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, process.env.NEXTAUTH_SECRET || "default-secret") as JWTPayload;
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

export function requireAuth(
  request: NextRequest
): { user: JWTPayload } | { error: string; status: number } {
  const user = getUserFromRequest(request);
  if (!user) return { error: "Authentication required", status: 401 };
  return { user };
}

export function requireRole(
  request: NextRequest,
  allowedRoles: string[]
): { user: JWTPayload } | { error: string; status: number } {
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult;
  if (!allowedRoles.includes(authResult.user.role)) {
    return { error: "Insufficient permissions", status: 403 };
  }
  return authResult;
}
