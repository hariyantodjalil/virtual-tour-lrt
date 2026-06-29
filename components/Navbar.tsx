"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, BarChart3, Sun, Moon } from "lucide-react";

type NavbarProps = {
  variant?: "light" | "dark";
  onToggleTheme?: () => void;
};

export default function Navbar({ variant = "light", onToggleTheme }: NavbarProps) {
  const isDark = variant === "dark";
  const panelHref = user?.role === "MITRA" ? "/partner" : "/cms/dashboard";

  useEffect(() => {
    fetch("/api/auth/verify")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.authenticated ? data.user : null))
      .catch(() => setUser(null));
  }, []);

  return (
    <header className={`sticky top-4 mx-auto w-[calc(100%-2rem)] max-w-7xl h-14 rounded-2xl border backdrop-blur-md z-50 flex items-center justify-between px-6 shadow-xl transition-all duration-300 ${
      isDark
        ? "border-white/10 bg-slate-950/75 text-white"
        : "border-slate-200/85 bg-white/75 text-slate-900"
    }`}>
      <Link href="/" className="flex items-center gap-3">
        <img
          src={isDark ? "/logo-lrt-white.png" : "/logo-lrt-red.png"}
          alt="LRT Logo"
          className="h-6 w-auto object-contain"
        />
        <span className="text-xs sm:text-sm font-black tracking-tight">Virtual Tour LRT</span>
      </Link>

      <div className="flex items-center gap-4">
        <nav className="hidden md:flex items-center gap-1">
          <Link href="/" className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            isDark ? "text-slate-300 hover:text-white hover:bg-white/5" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}>
            <MapPin className="h-4 w-4 text-red-500" />
            18 Stasiun
          </Link>
          <Link href="/dashboard" className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            isDark ? "text-slate-300 hover:text-white hover:bg-white/5" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}>
            <BarChart3 className="h-4 w-4 text-blue-400" />
            Dashboard
          </Link>
        </nav>

        {/* Theme Toggle Button */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors cursor-pointer ${
              isDark
                ? "border-white/10 bg-white/5 text-yellow-400 hover:bg-white/10"
                : "border-slate-200 bg-slate-100 text-indigo-900 hover:bg-slate-200"
            }`}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        )}
      </div>
    </header>
  );
}
