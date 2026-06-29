"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      setError(data.message ?? "Login gagal");
      return;
    }

    const redirect =
      searchParams.get("redirect") ||
      data.redirectTo ||
      (data.user?.role === "MITRA" ? "/partner" : "/cms/dashboard");
    router.push(redirect);
  }

  return (
    <div className="min-h-screen bg-[#07111f] px-4 py-8 text-slate-100">
      <Link href="/" className="mx-auto mb-8 flex max-w-md items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Kembali ke virtual tour
      </Link>
      <Card className="mx-auto w-full max-w-md border-white/10 bg-white/[0.055] text-slate-100 shadow-2xl shadow-black/20">
        <CardHeader>
          <CardTitle>Login Akun</CardTitle>
          <p className="text-sm text-slate-400">Mitra masuk ke panel pengajuan. Admin dan editor diarahkan ke CMS.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-slate-900 border-slate-700" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-slate-900 border-slate-700" required />
            </div>
            {error && <p className="text-sm text-red-300">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              <LogIn className="h-4 w-4" />
              {loading ? "Memproses..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
