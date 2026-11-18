"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

export default function CmsLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isExpired = searchParams.get("reason") === "expired";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.message || "Login gagal");
      return;
    }

    if (data.user?.role === "MITRA") {
      router.push("/partner");
      return;
    }

    const redirect = searchParams.get("redirect") || data.redirectTo || "/cms/dashboard";
    router.push(redirect);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--work-subtle)] p-4">
      <Card className="w-full max-w-md border-[var(--work-line)] bg-[var(--work-surface)] text-[var(--work-text)]">
        <CardHeader>
          <CardTitle>CMS Virtual Tour</CardTitle>
          <CardDescription className="text-[var(--work-muted)]">
            Masuk untuk mengelola konten LRT Jabodebek
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isExpired && (
            <div className="mb-4 rounded-lg border border-amber-500/40 bg-[var(--work-warning-soft)] px-4 py-3 text-sm text-amber-300">
              Sesi Anda telah berakhir. Silakan login kembali untuk melanjutkan.
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-[var(--work-line)] bg-[var(--work-subtle)] text-[var(--work-text)]"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-[var(--work-line)] bg-[var(--work-subtle)] text-[var(--work-text)]"
                required
              />
            </div>
            {error && <p className="text-sm text-[var(--work-danger)]">{error}</p>}
            <Button type="submit" className="w-full bg-[#E31E2D] hover:bg-[#c41926]" disabled={loading}>
              {loading ? "Memproses..." : "Login"}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-2">
            <div className="h-px flex-1 bg-[rgba(255,214,218,0.14)]" />
            <span className="text-xs font-medium whitespace-nowrap text-[var(--work-muted)]">
              atau masuk dengan
            </span>
            <div className="h-px flex-1 bg-[rgba(255,214,218,0.14)]" />
          </div>

          <GoogleSignInButton
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--work-line)] bg-[var(--work-subtle)] text-xs font-medium text-[var(--work-text)] transition hover:bg-[var(--work-surface)]"
            label="Masuk dengan Google"
            onSuccess={(u, redirect) => {
              if (u.role === "MITRA") {
                router.push("/partner");
                return;
              }
              const target = searchParams.get("redirect") || redirect || "/cms/dashboard";
              router.push(target);
            }}
            onError={(err) => setError(err)}
            disabled={loading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
