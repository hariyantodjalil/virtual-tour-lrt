import { showAppToast } from "@/components/ui/toast";

export type ClientAuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export const AUTH_SESSION_CHANGED_EVENT = "lrt-auth-session-changed";

function formatAuthGreetingName(user: ClientAuthUser): string {
  const trimmed = user.name?.trim();
  if (trimmed) return trimmed;
  return user.email?.split("@")[0] || "Pengguna";
}

/**
 * Menyiarkan pembaruan sesi auth di client dan memunculkan notifikasi login berhasil di atas layar.
 */
export function announceAuthLogin(
  user: ClientAuthUser,
  mode: "login" | "register" = "login"
) {
  const displayName = formatAuthGreetingName(user);
  showAppToast({
    type: "success",
    title: mode === "register" ? "Pendaftaran & login berhasil" : "Login berhasil",
    description: `Selamat datang, ${displayName}.`,
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<ClientAuthUser | null>(AUTH_SESSION_CHANGED_EVENT, {
        detail: user,
      })
    );
  }
}

/** Menyiarkan penghapusan sesi auth saat logout agar navbar & panel ikut sinkron. */
export function announceAuthLogout() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<ClientAuthUser | null>(AUTH_SESSION_CHANGED_EVENT, {
        detail: null,
      })
    );
  }
}

/** Berlangganan pembaruan status login/logout antar komponen di tab aktif. */
export function subscribeAuthSessionChanged(
  handler: (user: ClientAuthUser | null) => void
) {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    handler((event as CustomEvent<ClientAuthUser | null>).detail ?? null);
  };
  window.addEventListener(AUTH_SESSION_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, listener);
  };
}
