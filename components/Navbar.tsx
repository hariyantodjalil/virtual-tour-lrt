"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogIn, Phone, UserCircle } from "lucide-react";

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
  const [scrolled, setScrolled] = useState(false);
  const isDark = variant === "dark";
  const panelHref = user?.role === "MITRA" ? "/partner" : "/cms/dashboard";

  useEffect(() => {
    fetch("/api/auth/verify")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.authenticated ? data.user : null))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-500 ${
        scrolled
          ? isDark
            ? "border-b border-white/5 bg-[#1C0A0E]/85 py-4 backdrop-blur-md"
            : "border-b border-[var(--hairline)] bg-[color:rgb(255_248_242_/_0.92)] py-3 backdrop-blur-md"
          : isDark
            ? "bg-transparent py-7"
            : "border-b border-transparent bg-transparent py-4"
      }`}
    >
      <div className="container mx-auto flex max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E31E2D]">
            <span className="font-display text-sm font-bold text-white">LRT</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span
              className={`font-display text-lg font-semibold tracking-tight ${
                isDark ? "text-white" : "text-[#1B3A6B]"
              }`}
            >
              LRT Jabodebek
            </span>
            <span
              className={`font-display text-[10px] font-semibold uppercase tracking-[0.14em] ${
                isDark ? "text-white/45" : "text-[var(--fog)]"
              }`}
            >
              Virtual Tour
            </span>
          </div>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <a
            href="#alur"
            className={`text-sm transition-colors ${
              isDark ? "text-white/45 hover:text-white" : "text-[var(--fog)] hover:text-[var(--ink)]"
            }`}
          >
            Alur
          </a>
          <a
            href="#deck"
            className={`text-sm transition-colors ${
              isDark ? "text-white/45 hover:text-white" : "text-[var(--fog)] hover:text-[var(--ink)]"
            }`}
          >
            Stasiun
          </a>
          <a
            href="#kontak"
            className={`text-sm transition-colors ${
              isDark ? "text-white/45 hover:text-white" : "text-[var(--fog)] hover:text-[var(--ink)]"
            }`}
          >
            Kontak
          </a>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="tel:+622180800000"
            className={`hidden h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition sm:inline-flex ${
              isDark
                ? "text-white/70 hover:bg-white/5 hover:text-white"
                : "text-[#1B3A6B] hover:bg-black/5"
            }`}
          >
            <Phone className="h-4 w-4" />
            Hubungi
          </Link>
          <Link
            href={user ? panelHref : "#deck"}
            className={`inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold transition hover:scale-[1.03] ${
              isDark
                ? "bg-white text-black hover:bg-neutral-100"
                : "bg-[#1B3A6B] text-white hover:bg-[#163058]"
            }`}
          >
            {user ? (
              <>
                <UserCircle className="h-4 w-4" />
                Panel
              </>
            ) : (
              "Mulai jelajah"
            )}
          </Link>
          {!user && (
            <Link
              href="/login"
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition ${
                isDark ? "text-white/60 hover:bg-white/5 hover:text-white" : "text-[#1B3A6B] hover:bg-black/5"
              }`}
              aria-label="Login"
            >
              <LogIn className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
