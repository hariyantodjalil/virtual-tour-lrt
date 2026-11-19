/** Nama cookie sesi; bedakan antar app localhost (cookie tidak scoped per port). */
export function authCookieName(): string {
  const fromEnv = process.env.AUTH_COOKIE_NAME?.trim();
  if (fromEnv) return fromEnv;
  return "cms-token";
}

export function isSecureAuthCookie(): boolean {
  if (process.env.COOKIE_SECURE === "false") return false;
  if (process.env.COOKIE_SECURE === "true") return true;
  return process.env.NODE_ENV === "production";
}

export function cmsTokenCookieOptions(maxAge = 60 * 60 * 24) {
  return {
    httpOnly: true,
    secure: isSecureAuthCookie(),
    sameSite: "lax" as const,
    maxAge,
    path: "/",
  };
}
