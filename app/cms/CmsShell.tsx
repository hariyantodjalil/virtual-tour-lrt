"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  House,
  LayoutDashboard,
  LogOut,
  Map,
  Store,
  Users,
  UserCircle,
  Train,
  TrainFront,
  PanelLeftClose,
  PanelLeft,
  Building2,
  PhoneCall,
  Sliders,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import CmsNotifications from "@/components/cms/CmsNotifications";

export type CmsUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: "/cms/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cms/stations", label: "Stasiun", icon: Train },
  { href: "/cms/virtual-tour", label: "Station Virtual Tour", icon: Map },
  { href: "/cms/virtual-train", label: "Train Virtual Tour", icon: TrainFront },
  { href: "/cms/train-spaces", label: "Train Rental Space", icon: LayoutGrid },
  { href: "/cms/spaces", label: "Ruang Komersial", icon: Store },
  { href: "/cms/tenants", label: "Penyewa Aktif", icon: Building2 },
  { href: "/cms/leads", label: "Pengajuan & Site Visit", icon: UserCircle },
  {
    href: "/cms/commercial-profile",
    label: "Profil Tim Komersial",
    icon: PhoneCall,
    adminOnly: true,
  },
  { href: "/cms/users", label: "Users", icon: Users, adminOnly: true },
  { href: "/cms/settings", label: "Pengaturan Sistem", icon: Sliders, adminOnly: true },
];

const SIDEBAR_STORAGE_KEY = "cms-sidebar-collapsed";
const SIDEBAR_EVENT = "cms-sidebar";

function subscribeSidebar(onStoreChange: () => void) {
  window.addEventListener(SIDEBAR_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(SIDEBAR_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getSidebarSnapshot() {
  return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
}

function getSidebarServerSnapshot() {
  return false;
}

function isFullWidthPage(pathname: string) {
  return (
    pathname === "/cms/virtual-train" ||
    (pathname.startsWith("/cms/virtual-tour/") && pathname !== "/cms/virtual-tour") ||
    (pathname.startsWith("/cms/virtual-train/") && pathname !== "/cms/virtual-train")
  );
}

function getPageMeta(pathname: string) {
  if (pathname.startsWith("/cms/settings")) {
    return {
      title: "Pengaturan Sistem",
      subtitle: "Kelola status mode maintenance dan konfigurasi sistem",
    };
  }
  if (pathname.startsWith("/cms/dashboard")) {
    return { title: "Dashboard", subtitle: "Ringkasan performa komersial dan aktivitas tenant" };
  }
  if (pathname.startsWith("/cms/stations/")) {
    return { title: "Detail Stasiun", subtitle: "Kelola profil, gambar, dan data operasional stasiun" };
  }
  if (pathname.startsWith("/cms/stations")) {
    return { title: "Stasiun", subtitle: "Master data stasiun LRT Jabodebek" };
  }
  if (pathname.startsWith("/cms/virtual-tour/")) {
    return { title: "Editor Station Virtual Tour", subtitle: "Atur panorama, hotspot, dan alur tur 360 stasiun" };
  }
  if (pathname.startsWith("/cms/virtual-tour")) {
    return { title: "Station Virtual Tour", subtitle: "Daftar konfigurasi tur 360 setiap stasiun" };
  }
  if (pathname.startsWith("/cms/virtual-train")) {
    return { title: "Train Virtual Tour", subtitle: "Kelola panorama 360° interior kereta LRT Jabodebek" };
  }
  if (pathname.startsWith("/cms/train-spaces")) {
    return {
      title: "Train Rental Space",
      subtitle: "Kelola kartu carousel ruang iklan di landing train virtual tour",
    };
  }
  if (pathname.startsWith("/cms/spaces/")) {
    return { title: "Ruang Komersial", subtitle: "Kelola unit sewa per stasiun" };
  }
  if (pathname.startsWith("/cms/spaces")) {
    return { title: "Ruang Komersial", subtitle: "Inventori tenant, kios, media, dan area promosi" };
  }
  if (pathname.startsWith("/cms/tenants")) {
    return {
      title: "Penyewa Aktif",
      subtitle: "Brand atau mitra yang sedang mengisi unit komersial",
    };
  }
  if (pathname.startsWith("/cms/leads")) {
    return {
      title: "Pengajuan & Site Visit",
      subtitle: "Alur calon mitra: penawaran, verifikasi lokasi, BA Negosiasi, lalu PKS",
    };
  }
  if (pathname.startsWith("/cms/commercial-profile")) {
    return {
      title: "Profil Tim Komersial",
      subtitle: "Sumber kontak utama untuk seluruh kanal komersial",
    };
  }
  if (pathname.startsWith("/cms/users")) {
    return { title: "Users", subtitle: "Akses pengguna dan peran admin CMS" };
  }
  return { title: "CMS", subtitle: "Virtual Tour Komersial LRT Jabodebek" };
}

export default function CmsShell({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: CmsUser | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const collapsed = useSyncExternalStore(
    subscribeSidebar,
    getSidebarSnapshot,
    getSidebarServerSnapshot
  );

  const toggleSidebar = () => {
    const next = !getSidebarSnapshot();
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  };

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  const fullWidth = isFullWidthPage(pathname);
  const pageMeta = getPageMeta(pathname);
  const visibleNav = navItems.filter(
    (item) => !item.adminOnly || initialUser?.role === "ADMIN"
  );

  // Editor panoramik: auto-collapse app rail agar canvas lebih lebar (toggle tetap tersedia).
  const prevFullWidth = useRef(false);
  useEffect(() => {
    if (fullWidth && !prevFullWidth.current) {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, "true");
      window.dispatchEvent(new Event(SIDEBAR_EVENT));
    }
    prevFullWidth.current = fullWidth;
  }, [fullWidth]);

  return (
    <div className="cms-shell flex h-screen overflow-hidden bg-[#f3f4f6] text-[#101828]">
      <aside
        className={`relative z-20 flex h-full min-h-0 flex-none flex-col border-r border-slate-200 bg-white transition-all duration-200 ${
          collapsed ? "w-14" : "w-56"
        }`}
      >
        <div
          className={`flex h-16 flex-none items-center border-b border-slate-200 ${
            collapsed ? "justify-center px-2" : "gap-2.5 px-4"
          }`}
        >
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-[#c41230] text-xs font-black text-white">
            LRT
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-black text-[#101828] leading-tight">Virtual Tour CMS</p>
              <p className="text-xs text-slate-500">LRT Jabodebek</p>
            </div>
          )}
        </div>

        <nav className="min-h-0 flex-1 p-2 space-y-0.5 overflow-y-auto">
          {visibleNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center rounded-lg text-sm transition-colors group ${
                  collapsed ? "justify-center w-10 h-10 mx-auto" : "gap-3 px-3 py-2"
                } ${
                  active
                    ? "bg-[#c41230] text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-[#101828]"
                }`}
              >
                <Icon className="h-4 w-4 flex-none" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={`border-t border-slate-200 p-2 ${collapsed ? "flex flex-col items-center gap-2" : "space-y-2"}`}>
          <div
            title={collapsed ? initialUser?.name ?? initialUser?.email ?? "User" : undefined}
            className={`flex items-center rounded-xl border border-slate-200 bg-slate-50 text-[#101828] ${
              collapsed ? "h-10 w-10 justify-center" : "gap-3 p-2"
            }`}
          >
            <UserCircle className="h-5 w-5 flex-none text-[#c41230]" />
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#101828]">
                  {initialUser?.name ?? initialUser?.email ?? "User"}
                </p>
              </div>
            )}
          </div>

          {/* Ke halaman utama publik tanpa logout; sesi admin tetap aktif sehingga bisa kembali ke CMS. */}
          <Link
            href="/"
            title={collapsed ? "Halaman Utama" : undefined}
            className={`flex items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#101828] ${
              collapsed ? "w-10 h-10" : "w-full h-9 gap-2 px-3"
            }`}
          >
            <House className="h-4 w-4 flex-none" />
            {!collapsed && <span className="text-sm flex-1 text-left">Halaman Utama</span>}
          </Link>

          <button
            onClick={handleLogout}
            title={collapsed ? "Logout" : undefined}
            className={`flex items-center justify-center rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-700 transition-colors ${
              collapsed ? "w-10 h-10" : "w-full h-9 gap-2 px-3"
            }`}
          >
            <LogOut className="h-4 w-4 flex-none" />
            {!collapsed && <span className="text-sm flex-1 text-left">Logout</span>}
          </button>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-20 bg-[#c41230] text-white shadow-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={toggleSidebar}
              title={collapsed ? "Perluas sidebar" : "Sembunyikan sidebar"}
              aria-label={collapsed ? "Perluas sidebar" : "Sembunyikan sidebar"}
              className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white transition hover:bg-white/20"
            >
              {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>

            <div className="min-w-0">
              <h1 className="truncate text-base font-black text-white sm:text-lg">{pageMeta.title}</h1>
            </div>

            <div className="ml-auto flex-none">
              <CmsNotifications />
            </div>
          </div>
        </header>

        <div className={`relative min-h-0 flex-1 ${fullWidth ? "overflow-hidden" : "overflow-auto"}`}>

          {fullWidth ? (
            <div className="relative z-10 flex h-full min-h-0 w-full flex-col overflow-hidden">{children}</div>
          ) : (
            <div className="relative z-10 mx-auto max-w-7xl p-6">{children}</div>
          )}
        </div>
      </main>
    </div>
  );
}
