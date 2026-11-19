"use client";

import { TourLanguageToggle, useTourLanguage } from "@/components/tour/TourLanguageProvider";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Home, User } from "lucide-react";
import LoginModal from "@/components/LoginModal";
import RegisterModal from "@/components/RegisterModal";
import PublicAccountMenu, {
  type PublicAuthUser,
} from "@/components/auth/PublicAccountMenu";
import { VIRTUAL_TOUR_LANDING } from "@/lib/tour-nav";
import { subscribeAuthSessionChanged } from "@/lib/auth-client";

export default function VirtualTourNavbar() {
  const { t } = useTourLanguage();
  const pathname = usePathname();
  const isTourLanding = pathname === "/" || pathname === "/virtual-tour";
  const [user, setUser] = useState<PublicAuthUser | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [authView, setAuthView] = useState<"login" | "register" | null>(null);

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
          className={`relative mx-auto w-full max-w-7xl items-center gap-2 px-2 sm:gap-4 sm:px-6 md:px-10 ${
            isTourLanding ? "flex justify-between" : "flex justify-between sm:grid sm:grid-cols-[1fr_auto_1fr]"
          }`}
        >
          {!isTourLanding && (
            <Link
              href={VIRTUAL_TOUR_LANDING}
              aria-label={t("Beranda")}
              className="relative z-10 inline-flex h-10 w-max items-center justify-center gap-2 rounded-full border border-white/70 bg-transparent px-3 text-xs font-semibold tracking-wide text-white transition hover:bg-white/10 sm:h-11 sm:px-5"
            >
              <Home className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden md:inline">{t("Beranda")}</span>
            </Link>
          )}

          <Link
            href={VIRTUAL_TOUR_LANDING}
            className={`relative z-10 flex shrink-0 items-center gap-2 sm:gap-3 ${
              isTourLanding ? "" : "justify-center"
            }`}
            aria-label={t("Beranda LRT Jabodebek")}
          >
            <span className="relative h-6 w-11 sm:h-7 sm:w-[70px]">
              <Image
                src="/brand/landing/logo-kai-nav.png"
                alt="KAI"
                fill
                sizes="(max-width: 640px) 52px, 70px"
                className="object-contain"
                priority
              />
            </span>
            <span className="relative h-7 w-12 sm:h-8 sm:w-[78px]">
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

          <div className="relative z-10 flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
            <TourLanguageToggle refresh />
            {user ? (
              <PublicAccountMenu
                user={user}
                variant="pill"
                onLoggedOut={() => setUser(null)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAuthView("login")}
                aria-label={t("Login")}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full px-3 text-xs font-semibold text-white shadow-[0_8px_32px_rgba(211,47,47,0.4)] transition hover:brightness-110 sm:h-11 sm:px-5"
                style={{ backgroundImage: "linear-gradient(155deg, #d32f2f 0%, #b71c1c 100%)" }}
              >
                <User className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">{t("Login")}</span>
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
