"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LayoutDashboard, LogOut } from "lucide-react";
import { announceAuthLogout } from "@/lib/auth-client";

export type PublicAuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type RoleTargetMeta = {
  href: string;
  shortLabel: string;
  actionLabel: string;
  roleLabel: string;
};

function getRoleTargetMeta(role: string): RoleTargetMeta {
  if (role === "MITRA") {
    return {
      href: "/partner/dashboard",
      shortLabel: "Portal Mitra",
      actionLabel: "Dashboard Mitra",
      roleLabel: "Mitra",
    };
  }
  return {
    href: "/cms/dashboard",
    shortLabel: "Dashboard CMS",
    actionLabel: "Dashboard CMS",
    roleLabel: role === "ADMIN" ? "Admin" : "Editor",
  };
}

type Props = {
  user: PublicAuthUser;
  onLoggedOut: () => void;
  variant?: "pill" | "rounded";
};

/**
 * Menu akun kanan atas pada halaman publik (beranda & virtual tour).
 * Menampilkan nama pengguna serta tujuan dashboard sesuai role agar pengguna
 * langsung mengenali akses ke Portal Mitra atau Dashboard CMS.
 */
export default function PublicAccountMenu({
  user,
  onLoggedOut,
  variant = "pill",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayName = user.name?.trim() || user.email?.split("@")[0] || "Akun";
  const initial = displayName.charAt(0).toUpperCase();
  const target = getRoleTargetMeta(user.role);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setLoggingOut(false);
      setOpen(false);
      announceAuthLogout();
      onLoggedOut();
      router.refresh();
    }
  }

  const triggerShape =
    variant === "rounded"
      ? "h-12 rounded-xl pl-2 pr-3 sm:pl-2.5 sm:pr-3.5"
      : "h-10 rounded-full pl-1.5 pr-2.5 sm:h-11 sm:pl-2 sm:pr-3.5";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`${displayName} (${target.shortLabel})`}
        title={`${displayName} — ${target.actionLabel}`}
        className={`inline-flex items-center gap-2 text-white shadow-[0_8px_32px_rgba(211,47,47,0.4)] transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${triggerShape}`}
        style={{
          backgroundImage: "linear-gradient(155deg, #d32f2f 0%, #b71c1c 100%)",
        }}
      >
        <span className="flex size-7 flex-none items-center justify-center rounded-full border border-white/25 bg-white/15 text-xs font-semibold text-white">
          {initial}
        </span>

        <span className="flex min-w-0 flex-col items-start text-left leading-tight">
          <span className="max-w-[78px] truncate text-xs font-semibold text-white sm:max-w-[140px]">
            {displayName}
          </span>
          <span className="max-w-[78px] truncate text-[10px] font-medium text-white/85 sm:max-w-[140px]">
            {target.shortLabel}
          </span>
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-white/15 bg-[#111111]/90 p-1.5 text-white shadow-[0_20px_50px_rgba(0,0,0,0.65)] backdrop-blur-md"
        >
          <div className="mb-1 border-b border-white/10 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-semibold text-white">
                {displayName}
              </p>
              <span className="shrink-0 rounded-md border border-[#ff8a8a]/25 bg-[#d32f2f]/25 px-1.5 py-0.5 text-[10px] font-semibold text-[#ff9b9b]">
                {target.roleLabel}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-white/60">
              {user.email}
            </p>
          </div>

          <Link
            href={target.href}
            prefetch={false}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex h-9 items-center justify-between gap-2 rounded-lg px-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#d32f2f]/25 focus-visible:bg-[#d32f2f]/25 focus-visible:outline-none"
          >
            <span className="flex min-w-0 items-center gap-2">
              <LayoutDashboard
                className="size-4 flex-none text-[#ff8a8a]"
                strokeWidth={1.5}
              />
              <span className="truncate">{target.actionLabel}</span>
            </span>
            <ArrowRight
              className="size-3.5 flex-none text-white/60"
              strokeWidth={1.75}
              aria-hidden
            />
          </Link>

          <button
            type="button"
            role="menuitem"
            disabled={loggingOut}
            onClick={() => void handleLogout()}
            className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:outline-none disabled:opacity-50"
          >
            <LogOut className="size-4 flex-none text-white/60" strokeWidth={1.5} />
            {loggingOut ? "Keluar..." : "Keluar"}
          </button>
        </div>
      )}
    </div>
  );
}
