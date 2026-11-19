"use client";

import { TourLanguageToggle, useTourLanguage } from "@/components/tour/TourLanguageProvider";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Heart, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { announceAuthLogin } from "@/lib/auth-client";

function sanitizeRedirect(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return null;
  }
  if (/[\u0000-\u001f]/.test(raw)) return null;
  return raw;
}

const inputClass =
  "h-10 rounded-lg border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 hover:border-slate-400 focus-visible:border-[#E31E2D] focus-visible:ring-[#E31E2D]/15";

export default function LoginForm() {
  const { t } = useTourLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const safeRedirect = sanitizeRedirect(searchParams.get("redirect"));
  const hasPendingFavorite = Boolean(safeRedirect?.includes("pendingFavorite="));

  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function switchMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setError("");
  }

  function goAfterAuth(role: string | undefined, serverTarget?: string | null) {
    const target =
      safeRedirect ||
      sanitizeRedirect(serverTarget ?? null) ||
      (role === "MITRA" ? "/partner" : "/cms/dashboard");
    router.push(target);
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const payload =
        mode === "register" ? { name: name.trim(), email, password } : { email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          data.message ??
            data.error ??
            (mode === "register" ? t("Pendaftaran akun Mitra gagal.") : t("Login gagal"))
        );
        return;
      }

      if (data.user) {
        announceAuthLogin(data.user, mode);
      }

      goAfterAuth(data.user?.role, data.redirectTo);
    } catch {
      setError(t("Ada kesalahan saat masuk. Silakan coba lagi."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f3f4f6] px-4 py-10 text-[#101828]">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-[#c41230]"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("Kembali ke virtual tour")}
          </Link>
          <TourLanguageToggle light />
        </div>

        <Card className="w-full rounded-2xl border-slate-200 bg-white text-[#101828] shadow-sm">
          <CardHeader className="pb-4">
            <p className="text-xs font-semibold tracking-wide text-[#c41230] uppercase">
              {t("Ruang Komersial · LRT Jabodebek")}
            </p>
            <CardTitle className="text-xl font-bold text-[#101828]">
              {mode === "register" ? t("Daftar Akun Mitra") : t("Masuk ke Akun Anda")}
            </CardTitle>
            <p className="text-sm leading-relaxed text-slate-600">
              {mode === "register"
                ? t("Buat akun Mitra untuk menyimpan unit favorit dan memantau pengajuan sewa.")
                : t("Mitra masuk ke Portal Mitra. Admin dan editor diarahkan ke CMS.")}
            </p>
          </CardHeader>

          <CardContent>
            {hasPendingFavorite && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/70 px-3.5 py-2.5 text-xs leading-relaxed text-rose-900">
                <Heart className="mt-0.5 size-4 shrink-0 fill-[#c41230] text-[#c41230]" />
                <span>
                  {mode === "register"
                    ? t(
                        "Setelah berhasil mendaftar sebagai Mitra, unit pilihan Anda akan otomatis disimpan ke Favorit."
                      )
                    : t(
                        "Setelah berhasil masuk sebagai Mitra, unit pilihan Anda akan otomatis disimpan ke Favorit."
                      )}
                </span>
              </div>
            )}

            <div
              role="tablist"
              aria-label={t("Mode autentikasi")}
              className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                onClick={() => switchMode("login")}
                className={`rounded-lg py-2 text-xs font-semibold transition ${
                  mode === "login"
                    ? "bg-white text-[#101828] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t("Masuk")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                onClick={() => switchMode("register")}
                className={`rounded-lg py-2 text-xs font-semibold transition ${
                  mode === "register"
                    ? "bg-white text-[#101828] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t("Daftar Mitra")}
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-medium text-slate-700">
                    {t("Nama Lengkap")}
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    minLength={2}
                    maxLength={120}
                    placeholder={t("Nama lengkap / PIC")}
                    className={inputClass}
                    required
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-slate-700">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@perusahaan.com"
                  className={inputClass}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium text-slate-700">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={mode === "register" ? 8 : undefined}
                  placeholder={
                    mode === "register" ? t("Minimal 8 karakter") : t("Masukkan password")
                  }
                  className={inputClass}
                  required
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                >
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="h-11 w-full rounded-lg bg-[#E31E2D] text-sm font-semibold text-white hover:bg-[#C41926]"
                disabled={loading}
              >
                {mode === "register" ? (
                  <UserPlus className="h-4 w-4" />
                ) : (
                  <LogIn className="h-4 w-4" />
                )}
                {loading
                  ? t("Memproses...")
                  : mode === "register"
                    ? t("Daftar & Simpan")
                    : t("Login")}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-medium whitespace-nowrap text-slate-500">
                {t("atau masuk dengan")}
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <GoogleSignInButton
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60"
              label={t("Masuk dengan Google")}
              onSuccess={(u, redirect) => {
                announceAuthLogin(u, "login");
                goAfterAuth(u.role, redirect);
              }}
              onError={(err) => setError(err)}
              disabled={loading}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
