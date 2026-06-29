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
  };
}
