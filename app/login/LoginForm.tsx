"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
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
      setError(data.message ?? data.error ?? "Login gagal");
      return;
    }

    const redirect =
      searchParams.get("redirect") ||
      data.redirectTo ||
      (data.user?.role === "MITRA" ? "/partner" : "/cms/dashboard");
    router.push(redirect);
  }

  return (
    <div className="min-h-screen bg-[#1C0A0E] px-4 py-8 text-[#F8ECEE]">
      <Link href="/" className="mx-auto mb-8 flex max-w-md items-center gap-2 text-sm text-[#C4A8AD] hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Kembali ke virtual tour
      </Link>
      <Card className="mx-auto w-full max-w-md border-[rgba(255,214,218,0.14)] bg-[#3A161C] text-[#F8ECEE]">
        <CardHeader>
          <CardTitle>Login Akun</CardTitle>
          <p className="text-sm text-[#C4A8AD]">Mitra masuk ke panel pengajuan. Admin dan editor diarahkan ke CMS.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="border-[rgba(255,214,218,0.14)] bg-[#261015] text-[#F8ECEE]" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="border-[rgba(255,214,218,0.14)] bg-[#261015] text-[#F8ECEE]" required />
            </div>
            {error && <p className="text-sm text-red-300">{error}</p>}
            <Button type="submit" className="w-full bg-[#E31E2D] hover:bg-[#c41926]" disabled={loading}>
              <LogIn className="h-4 w-4" />
              {loading ? "Memproses..." : "Login"}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-2">
            <div className="h-px flex-1 bg-white/20" />
            <span className="text-xs font-medium whitespace-nowrap text-[#C4A8AD]">
              atau masuk dengan
            </span>
            <div className="h-px flex-1 bg-white/20" />
          </div>

          <GoogleSignInButton
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[rgba(255,214,218,0.14)] bg-[#261015] text-xs font-medium text-[#F8ECEE] transition hover:bg-[#3A161C]"
            label="Masuk dengan Google"
            onSuccess={(u, redirect) => {
              const target =
                searchParams.get("redirect") ||
                redirect ||
                (u.role === "MITRA" ? "/partner" : "/cms/dashboard");
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
