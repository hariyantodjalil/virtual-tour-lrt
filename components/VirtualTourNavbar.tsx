"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Home, User } from "lucide-react";
import LoginModal from "@/components/LoginModal";
import RegisterModal from "@/components/RegisterModal";
import { VIRTUAL_TOUR_LANDING } from "@/lib/tour-nav";

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export default function VirtualTourNavbar() {
  const pathname = usePathname();
  const isTourLanding = pathname === "/" || pathname === "/virtual-tour";
  const [user, setUser] = useState<AuthUser | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [authView, setAuthView] = useState<"login" | "register" | null>(null);
  const panelHref = user?.role === "MITRA" ? "/partner" : "/cms/dashboard";

  useEffect(() => {
    fetch("/api/auth/verify")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.authenticated ? data.user : null))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const showSolidHeader = scrolled;

  return (
    <>
      <header
        className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
          showSolidHeader
            ? "bg-black/70 py-3 shadow-lg backdrop-blur-md sm:py-3.5"
            : "bg-transparent py-4 sm:py-5"
        }`}
      >
        <div
          className={`relative mx-auto w-full max-w-7xl items-center gap-3 px-4 sm:gap-4 sm:px-6 md:px-10 ${
            isTourLanding ? "flex justify-between" : "grid grid-cols-[1fr_auto_1fr]"
          }`}
        >
          {!isTourLanding && (
            <Link
              href={VIRTUAL_TOUR_LANDING}
              className="relative z-10 inline-flex h-10 w-max items-center justify-center gap-2 rounded-full border border-white/70 bg-transparent px-4 text-xs font-semibold tracking-wide text-white transition hover:bg-white/10 sm:h-11 sm:px-5"
            >
              <Home className="h-4 w-4 shrink-0" aria-hidden />
              Beranda
            </Link>
          )}

          <Link
            href={VIRTUAL_TOUR_LANDING}
            className={`relative z-10 flex shrink-0 items-center gap-2 sm:gap-3 ${
              isTourLanding ? "" : "justify-center"
            }`}
            aria-label="Beranda LRT Jabodebek"
          >
            <span className="relative h-6 w-[52px] sm:h-7 sm:w-[70px]">
              <Image
                src="/brand/landing/logo-kai-nav.png"
                alt="KAI"
                fill
                sizes="(max-width: 640px) 52px, 70px"
                className="object-contain"
                priority
              />
            </span>
            <span className="relative h-7 w-[58px] sm:h-8 sm:w-[78px]">
              <Image
                src="/brand/landing/logo-lrt-nav.png"
                alt="LRT Jabodebek"
                fill
                sizes="(max-width: 640px) 58px, 78px"
                className="object-contain"
                priority
              />
            </span>
          </Link>

          <div className="relative z-10 flex shrink-0 items-center justify-end">
            {user ? (
              <Link
                href={panelHref}
                title={user.name}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold text-white shadow-[0_8px_32px_rgba(211,47,47,0.4)] transition hover:brightness-110 sm:h-11 sm:px-5"
                style={{ backgroundImage: "linear-gradient(155deg, #d32f2f 0%, #b71c1c 100%)" }}
              >
                <User className="h-4 w-4 shrink-0" aria-hidden />
                <span className="max-w-[120px] truncate">{user.name || "Akun"}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setAuthView("login")}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold text-white shadow-[0_8px_32px_rgba(211,47,47,0.4)] transition hover:brightness-110 sm:h-11 sm:px-5"
                style={{ backgroundImage: "linear-gradient(155deg, #d32f2f 0%, #b71c1c 100%)" }}
              >
                <User className="h-4 w-4 shrink-0" aria-hidden />
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
