"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogIn, Phone, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type NavbarProps = {
  variant?: "light" | "dark";
};

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export default function Navbar({ variant = "light" }: NavbarProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const isDark = variant === "dark";
  const panelHref = user?.role === "MITRA" ? "/partner" : "/cms/dashboard";

  useEffect(() => {
    fetch("/api/auth/verify")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.authenticated ? data.user : null))
      .catch(() => setUser(null));
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b backdrop-blur supports-[backdrop-filter]:backdrop-blur ${
        isDark
          ? "border-white/10 bg-[#081426]/92"
          : "border-gray-200 bg-white/95 supports-[backdrop-filter]:bg-white/80"
      }`}
    >
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E31E2D]">
            <span className="text-sm font-black text-white">LRT</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className={`text-sm font-black tracking-tight ${isDark ? "text-white" : "text-[#1B3A6B]"}`}>
              LRT Jabodebek
            </span>
            <span className={`text-[10px] font-medium uppercase tracking-wide ${isDark ? "text-white/50" : "text-gray-500"}`}>
              Virtual Tour Komersial
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Button size="sm" variant={isDark ? "outline" : "default"} asChild>
            <Link href="tel:+622180800000" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">Hubungi Tim</span>
            </Link>
          </Button>

          <Button size="sm" variant={user ? "secondary" : "outline"} asChild>
            <Link href={user ? panelHref : "/login"} className="flex items-center gap-2">
              {user ? <UserCircle className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
              <span className="hidden sm:inline">{user ? "Panel" : "Login"}</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
