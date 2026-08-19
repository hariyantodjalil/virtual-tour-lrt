"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  LayoutDashboard,
  LogOut,
  Map,
  Store,
  Users,
  UserCircle,
  Train,
  PanelLeftClose,
  PanelLeft,
  Building2,
  PhoneCall,
  Sliders,
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
  { href: "/cms/virtual-tour", label: "Virtual Tour", icon: Map },
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
  return pathname.startsWith("/cms/virtual-tour/") && pathname !== "/cms/virtual-tour";
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
    return { title: "Editor Virtual Tour", subtitle: "Atur panorama, hotspot, dan alur tur 360" };
  }
  if (pathname.startsWith("/cms/virtual-tour")) {
    return { title: "Virtual Tour", subtitle: "Daftar konfigurasi tur 360 setiap stasiun" };
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
      subtitle: "Pipeline calon mitra dari inquiry hingga operasional komersial",
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

  return (
    <div className="cms-shell flex h-screen bg-[#07111f] text-slate-100 overflow-hidden">
      <aside
        className={`relative z-20 flex h-full min-h-0 flex-none flex-col border-r border-white/10 bg-[#081426]/95 shadow-2xl shadow-black/30 transition-all duration-200 ${
          collapsed ? "w-14" : "w-56"
        }`}
      >
        <div
          className={`border-b border-white/10 flex items-center ${
            collapsed ? "justify-center p-3" : "gap-2.5 p-4"
          }`}
        >
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-[#E31E2D] text-xs font-black text-white">
            LRT
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-black text-white leading-tight">Virtual Tour CMS</p>
              <p className="text-xs text-slate-400">LRT Jabodebek</p>
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
                    ? "bg-emerald-400/12 text-emerald-200 ring-1 ring-emerald-300/20"
                    : "text-slate-300 hover:bg-white/8 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 flex-none" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={`border-t border-white/10 p-2 ${collapsed ? "flex flex-col items-center gap-2" : "space-y-2"}`}>
          <div
            title={collapsed ? initialUser?.name ?? initialUser?.email ?? "User" : undefined}
            className={`flex items-center rounded-xl border border-white/10 bg-white/[0.035] text-slate-300 ${
              collapsed ? "h-10 w-10 justify-center" : "gap-3 p-2"
            }`}
          >
            <UserCircle className="h-5 w-5 flex-none text-emerald-300" />
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {initialUser?.name ?? initialUser?.email ?? "User"}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            title={collapsed ? "Logout" : undefined}
            className={`flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-900/30 hover:text-red-300 transition-colors ${
              collapsed ? "w-10 h-10" : "w-full h-9 gap-2 px-3"
            }`}
          >
            <LogOut className="h-4 w-4 flex-none" />
            {!collapsed && <span className="text-sm flex-1 text-left">Logout</span>}
          </button>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-20 border-b border-white/10 bg-[#081426]/95 shadow-lg shadow-black/10">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={toggleSidebar}
              title={collapsed ? "Perluas sidebar" : "Sembunyikan sidebar"}
              aria-label={collapsed ? "Perluas sidebar" : "Sembunyikan sidebar"}
              className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-emerald-300/30 hover:bg-emerald-400/10 hover:text-emerald-100"
            >
              {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>

            <div className="min-w-0">
              <h1 className="truncate text-base font-black text-white sm:text-lg">{pageMeta.title}</h1>
            </div>

            <CmsNotifications />
          </div>
        </header>

        <div className={`relative min-h-0 flex-1 ${fullWidth ? "overflow-hidden" : "overflow-auto"}`}>
          <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,.13),transparent_32%),radial-gradient(circle_at_85%_8%,rgba(227,30,45,.11),transparent_30%)]" />

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
