"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import LoginModal from "@/components/LoginModal";
import RegisterModal from "@/components/RegisterModal";
import PublicAccountMenu, {
  type PublicAuthUser,
} from "@/components/auth/PublicAccountMenu";
import { subscribeAuthSessionChanged } from "@/lib/auth-client";

const navItems = [
  { href: "/komersial", label: "Beranda", active: true },
  { href: "#kontak", label: "Hubungi Tim" },
  { href: "#area-komersial", label: "Area Komersial" },
] as const;

export default function Navbar({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [user, setUser] = useState<PublicAuthUser | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [authView, setAuthView] = useState<"login" | "register" | null>(null);
  void variant;

  useEffect(() => {
    let active = true;
    fetch("/api/auth/verify", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active) setUser(data?.authenticated ? data.user : null);
      })
      .catch(() => {
        if (active) setUser(null);
      });
    const unsubscribe = subscribeAuthSessionChanged((nextUser) => {
      setUser(nextUser);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-black/70 py-3 shadow-lg backdrop-blur-md" : "bg-transparent py-5"
        }`}
      >
        <div className="relative mx-auto flex w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 xl:px-10">
          <Link href="/" className="relative z-10 flex shrink-0 items-center gap-2.5 sm:gap-4" aria-label="LRT Jabodebek">
            <span className="relative h-10 w-[96px]">
              <Image
                src="/brand/landing/logo-kai-nav.png"
                alt="KAI"
                fill
                sizes="96px"
                className="object-contain object-left"
                priority
              />
            </span>
            <span className="relative h-11 w-[108px]">
              <Image
                src="/brand/landing/logo-lrt-nav.png"
                alt="LRT Jabodebek"
                fill
                sizes="108px"
                className="object-contain object-left"
                priority
              />
            </span>
          </Link>

          <nav
            className="absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center rounded-xl bg-[#fffcfc] py-1.5 pr-6 pl-1.5 md:flex"
            aria-label="Navigasi utama"
          >
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={`rounded-[6px] px-6 py-2.5 text-xs font-medium transition ${
                  "active" in item && item.active
                    ? "bg-[#d32f2f] text-white"
                    : "text-[#d32f2f] hover:bg-[#d32f2f]/10"
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <nav className="relative z-10 flex items-center gap-1 md:hidden" aria-label="Navigasi cepat">
            {navItems.slice(1).map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="rounded-lg px-2 py-1.5 text-[10px] font-medium text-white/90"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="relative z-10 ml-auto shrink-0">
            {user ? (
              <PublicAccountMenu
                user={user}
                variant="rounded"
                onLoggedOut={() => setUser(null)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAuthView("login")}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-xs font-semibold tracking-wide text-white shadow-[0_8px_32px_rgba(211,47,47,0.4)] transition hover:brightness-110"
                style={{ backgroundImage: "linear-gradient(155deg, #d32f2f 0%, #b71c1c 100%)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/landing/icons/user.svg" alt="" width={16} height={16} className="size-4" />
                Login
              </button>
            )}
          </div>
        </div>
      </header>

      <LoginModal
        open={authView === "login"}
        onClose={() => setAuthView(null)}
        onSwitchToRegister={() => setAuthView("register")}
        onSuccess={(u) => setUser(u)}
      />
      <RegisterModal
        open={authView === "register"}
        onClose={() => setAuthView(null)}
        onSwitchToLogin={() => setAuthView("login")}
        onSuccess={(u) => setUser(u)}
      />
    </>
  );
}
