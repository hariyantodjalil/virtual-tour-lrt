"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function HomeReveal({
  children,
  className = "",
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(true);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`home-reveal ${active ? "home-reveal--active" : ""} ${className}`}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}

export function HomeShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      document.documentElement.style.setProperty("--home-scroll-up", `${y * -0.04}px`);
      document.documentElement.style.setProperty("--home-scroll-down", `${y * 0.04}px`);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="home-void relative min-h-screen overflow-x-hidden selection:bg-[#E31E2D] selection:text-white">
      <div className="home-noise" aria-hidden />
      {children}
    </div>
  );
}

export function HomeHeroParallax({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const el = ref.current;
      if (!el) return;
      if (y < 1000) {
        el.style.transform = `translateY(${y * 0.35}px)`;
        el.style.opacity = String(Math.max(0, 1 - y / 560));
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={ref} className="will-change-transform">
      {children}
    </div>
  );
}

export function HomeJakartaClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Jakarta",
        })
      );
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="mt-10 flex items-center gap-4 font-display text-[10px] uppercase tracking-[0.22em] text-white/35 md:text-xs">
      <span>{time || "—"}</span>
      <span className="h-3 w-px bg-white/20" aria-hidden />
      <span>Jakarta, ID</span>
    </div>
  );
}
