"use client";

import { useEffect, useRef, useState, useCallback } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: number | string;
              locale?: string;
            }
          ) => void;
          prompt: (notification?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean; getNotDisplayedReason: () => string }) => void) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

type CredentialCallback = (credential: string) => void;
const activeListeners = new Set<CredentialCallback>();
let initializedClientId: string | null = null;
let cachedClientId: string = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
let clientConfigPromise: Promise<string> | null = null;

async function fetchGoogleClientId(): Promise<string> {
  if (cachedClientId) return cachedClientId;
  if (!clientConfigPromise) {
    clientConfigPromise = fetch("/api/auth/google/config")
      .then((res) => (res.ok ? res.json() : { clientId: "" }))
      .then((data) => {
        if (data.clientId) {
          cachedClientId = data.clientId;
        }
        return cachedClientId;
      })
      .catch(() => "")
      .finally(() => {
        clientConfigPromise = null;
      });
  }
  return clientConfigPromise;
}

function ensureGsiInitialized(clientId: string) {
  if (typeof window === "undefined" || !window.google?.accounts?.id || !clientId) return false;
  if (initializedClientId === clientId) return true;

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (res) => {
      if (res.credential) {
        activeListeners.forEach((fn) => fn(res.credential));
      }
    },
    cancel_on_tap_outside: true,
  });
  initializedClientId = clientId;
  return true;
}

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.3-.2-1.9H12z"
      />
      <path
        fill="#34A853"
        d="M5.3 14.3l-.8.6-2.8 2.2C3.5 20.3 7.5 23 12 23c3 0 5.5-1 7.3-2.7l-3.1-2.4c-.9.6-2 1-3.2 1-2.5 0-4.6-1.7-5.3-3.9z"
      />
      <path
        fill="#4A90E2"
        d="M3.1 6.9C2.4 8.3 2 9.9 2 11.5s.4 3.2 1.1 4.6l3.6-2.8c-.2-.6-.4-1.2-.4-1.8s.1-1.2.4-1.8L3.1 6.9z"
      />
      <path
        fill="#FBBC05"
        d="M12 4.7c1.6 0 3 .6 4.1 1.6L19 3.4C17.1 1.7 14.7 1 12 1 7.5 1 3.5 3.7 1.7 7.5l3.6 2.8C6.1 7.9 8.3 4.7 12 4.7z"
      />
    </svg>
  );
}

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
};

type Props = {
  onSuccess?: (user: AuthUser, redirectTo?: string) => void;
  onError?: (error: string) => void;
  remember?: boolean;
  className?: string;
  label?: string;
  disabled?: boolean;
};

export default function GoogleSignInButton({
  onSuccess,
  onError,
  remember = false,
  className = "",
  label = "Masuk dengan Google",
  disabled = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState<string>(() => cachedClientId);
  const [scriptLoaded, setScriptLoaded] = useState(() => {
    return typeof window !== "undefined" && Boolean(window.google?.accounts?.id);
  });
  const hiddenBtnRef = useRef<HTMLDivElement>(null);

  // Fetch client ID dynamically from server if not inlined at build time (e.g. Docker container)
  useEffect(() => {
    if (!clientId) {
      void fetchGoogleClientId().then((id) => {
        if (id) setClientId(id);
      });
    }
  }, [clientId]);

  const handleCredential = useCallback(
    async (credential: string) => {
      setLoading(true);
      onError?.("");

      try {
        const res = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential, remember }),
        });

        const data = await res.json();
        setLoading(false);

        if (!res.ok) {
          onError?.(data.message ?? data.error ?? "Login Google gagal");
          return;
        }

        onSuccess?.(data.user, data.redirectTo);
      } catch (err) {
        console.error("GSI fetch error:", err);
        setLoading(false);
        onError?.("Tidak dapat terhubung ke server saat login Google");
      }
    },
    [onError, onSuccess, remember]
  );

  // Subscribe to global credential listener
  useEffect(() => {
    activeListeners.add(handleCredential);
    return () => {
      activeListeners.delete(handleCredential);
    };
  }, [handleCredential]);

  // Load Google Identity Services script
  useEffect(() => {
    if (typeof window === "undefined" || window.google?.accounts?.id) return;

    const existingScript = document.getElementById("google-gsi-client");
    if (existingScript) {
      const handleLoad = () => setScriptLoaded(true);
      existingScript.addEventListener("load", handleLoad);
      return () => existingScript.removeEventListener("load", handleLoad);
    }

    const script = document.createElement("script");
    script.id = "google-gsi-client";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => console.warn("Google GSI script failed to load");
    document.head.appendChild(script);
  }, []);

  // Initialize and render hidden Google button for reliable trigger
  useEffect(() => {
    if (!scriptLoaded || !clientId || !window.google?.accounts?.id) return;

    try {
      ensureGsiInitialized(clientId);

      if (hiddenBtnRef.current) {
        hiddenBtnRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(hiddenBtnRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          width: 250,
          locale: "id",
        });
      }
    } catch (e) {
      console.warn("GSI init error:", e);
    }
  }, [scriptLoaded, clientId]);

  async function handleClick() {
    if (disabled || loading) return;

    let targetClientId = clientId;
    if (!targetClientId) {
      setLoading(true);
      targetClientId = await fetchGoogleClientId();
      setLoading(false);
      if (targetClientId) {
        setClientId(targetClientId);
      }
    }

    if (!targetClientId) {
      onError?.(
        "Google Client ID belum diatur. Tambahkan NEXT_PUBLIC_GOOGLE_CLIENT_ID di file .env."
      );
      return;
    }

    if (!scriptLoaded || !window.google?.accounts?.id) {
      onError?.("Sedang memuat modul Google... Silakan coba beberapa detik lagi.");
      return;
    }

    // Pastikan GSI sudah terinisialisasi dengan target client ID
    ensureGsiInitialized(targetClientId);

    // Coba trigger tombol tersembunyi GSI atau prompt One Tap
    const iframeBtn = hiddenBtnRef.current?.querySelector("div[role=button]") as HTMLElement | null;
    if (iframeBtn) {
      iframeBtn.click();
    } else {
      try {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Jika One Tap tertutup/dilewati, buka kembali via renderButton
            const btn = hiddenBtnRef.current?.querySelector("div[role=button]") as HTMLElement | null;
            btn?.click();
          }
        });
      } catch {
        const btn = hiddenBtnRef.current?.querySelector("div[role=button]") as HTMLElement | null;
        btn?.click();
      }
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        className={
          className ||
          "mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-[9px] border border-white/80 bg-white/[0.06] text-[11px] font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
        }
      >
        <GoogleIcon className="size-3.5 shrink-0" />
        <span>{loading ? "Menghubungkan..." : label}</span>
      </button>

      {/* Hidden container for official Google GSI button trigger */}
      <div
        ref={hiddenBtnRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          overflow: "hidden",
          opacity: 0.01,
          pointerEvents: "none",
          clip: "rect(0 0 0 0)",
        }}
      />
    </>
  );
}
