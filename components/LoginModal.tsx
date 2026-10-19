"use client";

import { createPortal } from "react-dom";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSwitchToRegister?: () => void;
  onSuccess?: (user: { id: string; email: string; name: string; role: string }) => void;
};

import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

export default function LoginModal({ open, onClose, onSwitchToRegister, onSuccess }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open || typeof document === "undefined") return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });

      let data: {
        message?: string;
        error?: string;
        user?: { id: string; email: string; name: string; role: string };
        redirectTo?: string;
      } = {};
      try {
        data = await res.json();
      } catch {
        setLoading(false);
        setError(
          res.status === 404
            ? "Endpoint login tidak ditemukan. Restart server `npm run dev`."
            : "Respons server tidak valid. Coba refresh halaman."
        );
        return;
      }

      setLoading(false);

      if (!res.ok) {
        setError(data.message ?? data.error ?? "Login gagal");
        return;
      }

      onSuccess?.(data.user!);
      onClose();

      // Admin / editor → CMS; mitra tetap di halaman saat ini
      const role = data.user?.role as string | undefined;
      if (role === "ADMIN" || role === "EDITOR") {
        router.push(data.redirectTo || "/cms/dashboard");
      }
    } catch {
      setLoading(false);
      setError("Tidak dapat terhubung ke server");
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Tutup login"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        className="relative z-10 w-full max-w-[300px] overflow-hidden rounded-xl border border-white/10 bg-black/50 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.6),0_0_45px_rgba(211,47,47,0.06)] backdrop-blur-md"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 rounded-full p-1 text-white/70 transition hover:bg-white/10 hover:text-white"
          aria-label="Tutup"
        >
          <X className="size-4" />
        </button>

        <div className="pt-3 text-center">
          <h2
            id="login-modal-title"
            className="font-display text-[20px] font-bold tracking-tight text-white"
          >
            Login
          </h2>
          <p className="mx-auto mt-1.5 max-w-[220px] text-[10px] leading-relaxed font-light text-white">
            Masuk untuk melanjutkan dan mengakses fitur ruang komersial LRT Jabodebek.
          </p>
        </div>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
          <div>
            <label
              htmlFor="login-email"
              className="text-[8px] font-semibold tracking-[0.1em] text-white uppercase"
            >
              Email Address
            </label>
            <div className="relative mt-1.5">
              <Mail className="pointer-events-none absolute top-1/2 left-3 size-3 -translate-y-1/2 text-white/50" />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="h-9 w-full rounded-[9px] border border-white/80 bg-white/[0.07] pr-3 pl-9 text-[11px] text-white placeholder:text-white/25 outline-none focus:border-white"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="text-[8px] font-semibold tracking-[0.1em] text-white uppercase"
            >
              Password
            </label>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute top-1/2 left-3 size-3 -translate-y-1/2 text-white/50" />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password Anda"
                className="h-9 w-full rounded-[9px] border border-white/80 bg-white/[0.07] px-9 text-[11px] text-white placeholder:text-white/25 outline-none focus:border-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-white/50 transition hover:text-white"
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showPassword ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="size-3.5 rounded-[4px] border border-white bg-white/[0.06] accent-[#d32f2f]"
              />
              <span className="text-[9px] font-medium text-white">Ingat saya</span>
            </label>
            <button
              type="button"
              className="text-[9px] font-semibold text-[#ff6b6b] transition hover:underline"
              onClick={() => setError("Hubungi admin untuk reset password.")}
            >
              Lupa Password?
            </button>
          </div>

          {error && <p className="text-center text-[10px] text-red-300">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="h-9 w-full rounded-[9px] text-[11px] font-semibold tracking-wide text-white shadow-[0_6px_24px_rgba(211,47,47,0.4)] transition hover:brightness-110 disabled:opacity-60"
            style={{
              backgroundImage: "linear-gradient(171deg, #d32f2f 0%, #b71c1c 100%)",
            }}
          >
            {loading ? "Memproses..." : "Masuk Sekarang"}
          </button>
        </form>

        <div className="mt-4 flex items-center gap-2">
          <div className="h-px flex-1 bg-white/80" />
          <span className="text-[8px] font-medium whitespace-nowrap text-white">
            atau masuk dengan
          </span>
          <div className="h-px flex-1 bg-white/80" />
        </div>

        <GoogleSignInButton
          remember={remember}
          onSuccess={(u, redirect) => {
            onSuccess?.(u);
            onClose();
            if (u.role === "ADMIN" || u.role === "EDITOR") {
              router.push(redirect || "/cms/dashboard");
            }
          }}
          onError={(err) => setError(err)}
          disabled={loading}
          label="Masuk dengan Google"
        />

        <p className="mt-4 text-center text-[10px] text-white">
          Belum punya akun?{" "}
          <button
            type="button"
            className="font-semibold text-[#ff6b6b] transition hover:underline"
            onClick={() => {
              setError("");
              onSwitchToRegister?.();
            }}
          >
            Daftar Sekarang
          </button>
        </p>
      </div>
    </div>,
    document.body
  );
}
