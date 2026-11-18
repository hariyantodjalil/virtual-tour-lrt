"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
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
  ChevronDown,
  ExternalLink,
  Home,
  MessageSquareHeart,
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

type NavGroup = {
  label: string;
  items: NavItem[];
};

/** Dashboard selalu terlihat; kelompok lain dibuka sebagai dropdown agar rail tetap rapi. */
const standaloneItems: NavItem[] = [
  { href: "/cms/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

/** Sidebar dikelompokkan per fungsi; setiap kelompok adalah dropdown yang bisa dibuka-tutup. */
const navGroups: NavGroup[] = [
  {
    label: "Tur Virtual",
    items: [
      { href: "/cms/virtual-tour", label: "Station Virtual Tour", icon: Map },
      { href: "/cms/virtual-train", label: "Train Virtual Tour", icon: TrainFront },
    ],
  },
  {
    label: "Komersial",
    items: [
      { href: "/cms/stations", label: "Stasiun", icon: Train },
      { href: "/cms/spaces", label: "Ruang Komersial", icon: Store },
      { href: "/cms/train-spaces", label: "Train Rental Space", icon: LayoutGrid },
      { href: "/cms/tenants", label: "Penyewa Aktif", icon: Building2 },
    ],
  },
  {
    label: "Pengajuan",
    items: [
      { href: "/cms/leads", label: "Pengajuan & Site Visit", icon: UserCircle },
      { href: "/cms/advertising-form", label: "Form Advertising", icon: Sliders },
      { href: "/cms/feedback", label: "Feedback", icon: MessageSquareHeart },
    ],
  },
  {
    label: "Pengaturan",
    items: [
      {
        href: "/cms/commercial-profile",
        label: "Profil Tim Komersial",
        icon: PhoneCall,
        adminOnly: true,
      },
      { href: "/cms/users", label: "Users", icon: Users, adminOnly: true },
      { href: "/cms/settings", label: "Pengaturan Sistem", icon: Sliders, adminOnly: true },
    ],
  },
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
  if (pathname.startsWith("/cms/advertising-form")) {
    return { title: "Form Advertising", subtitle: "Opsi status pengaju dan kategori bisnis" };
  }
  if (pathname.startsWith("/cms/feedback")) {
    return { title: "Feedback", subtitle: "Masukan mitra dari portal partner" };
  }
  if (pathname.startsWith("/cms/settings")) {
    return {
      title: "Pengaturan Sistem",
      subtitle: "Mode maintenance dan konfigurasi sistem",
    };
  }
  if (pathname.startsWith("/cms/inquiry-workflow")) {
    return { title: "Alur Pengajuan", subtitle: "Versi tahapan untuk mitra" };
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
  if (pathname.startsWith("/cms/leads/")) {
    return { title: "Detail Pengajuan", subtitle: "Tahapan, dokumen, dan tindak lanjut" };
  }
  if (pathname.startsWith("/cms/leads")) {
    return {
      title: "Pengajuan & Site Visit",
      subtitle: "Daftar pengajuan stasiun dan kereta",
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
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.adminOnly || initialUser?.role === "ADMIN"),
    }))
    .filter((group) => group.items.length > 0);

  const activeGroupLabel = visibleGroups.find((group) =>
    group.items.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
  )?.label;

  // Kelompok aktif terbuka otomatis saat pindah halaman; buka-tutup manual mengikuti halaman saat itu.
  const [navState, setNavState] = useState<{ path: string; open: ReadonlySet<string> }>(() => ({
    path: pathname,
    open: activeGroupLabel ? new Set([activeGroupLabel]) : new Set<string>(),
  }));
  const openGroups =
    navState.path === pathname
      ? navState.open
      : activeGroupLabel
        ? new Set([activeGroupLabel])
        : new Set<string>();
  function toggleGroup(label: string) {
    setNavState({ path: pathname, open: openGroups.has(label) ? new Set<string>() : new Set([label]) });
  }

  function renderNavLink(item: NavItem) {
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        className={`flex items-center rounded-lg text-sm transition-colors group ${
          collapsed ? "justify-center w-10 h-10 mx-auto" : "gap-3 px-3 py-2"
        } ${
          active
            ? "bg-[#E31E2D] text-white"
            : "text-[#C4A8AD] hover:bg-white/8 hover:text-[#F8ECEE]"
        }`}
      >
        <Icon className="h-4 w-4 flex-none" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );
  }

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
    <div className="cms-shell flex h-screen overflow-hidden bg-[#F6F7F9] text-slate-900">
      <aside
        className={`relative z-20 flex h-full min-h-0 flex-none flex-col border-r border-[rgba(255,214,218,0.14)] bg-[#261015] text-[#F8ECEE] transition-all duration-200 ${
          collapsed ? "w-14" : "w-56"
        }`}
      >
        <div
          className={`border-b border-[rgba(255,214,218,0.14)] flex items-center ${
            collapsed ? "justify-center p-3" : "gap-2.5 p-4"
          }`}
        >
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-[#E31E2D] text-xs font-black text-white">
            LRT
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-black text-white leading-tight">Virtual Tour CMS</p>
              <p className="text-xs text-[#C4A8AD]">LRT Jabodebek</p>
            </div>
          )}
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Menu CMS">
          <div className="space-y-0.5">{standaloneItems.map(renderNavLink)}</div>
          {collapsed ? (
            visibleGroups.map((group) => (
              <div key={group.label}>
                <div aria-hidden="true" className="mx-auto my-2 h-px w-6 bg-white/10" />
                <div className="space-y-0.5">{group.items.map(renderNavLink)}</div>
              </div>
            ))
          ) : (
            visibleGroups.map((group) => {
              const isOpen = openGroups.has(group.label);
              const listId = `navgroup-${group.label.replace(/\s+/g, "-").toLowerCase()}`;
              return (
                <div key={group.label} className="mt-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    aria-expanded={isOpen}
                    aria-controls={listId}
                    className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-[10px] font-semibold uppercase tracking-wider text-[#A88990] transition-colors hover:bg-white/5 hover:text-[#F8ECEE] focus-visible:outline-2 focus-visible:outline-[#FF858D]"
                  >
                    {group.label}
                    <ChevronDown
                      aria-hidden="true"
                      className={`ml-auto h-3.5 w-3.5 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                    />
                  </button>
                  {isOpen && (
                    <div id={listId} className="mt-0.5 space-y-0.5">
                      {group.items.map(renderNavLink)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </nav>

        <div className={`border-t border-[rgba(255,214,218,0.14)] p-2 ${collapsed ? "flex flex-col items-center gap-2" : "space-y-2"}`}>
          <div
            title={collapsed ? initialUser?.name ?? initialUser?.email ?? "User" : undefined}
            className={`flex items-center rounded-xl border border-[rgba(255,214,218,0.14)] bg-[#3A161C] text-[#F8ECEE] ${
              collapsed ? "h-10 w-10 justify-center" : "gap-3 p-2"
            }`}
          >
            <UserCircle className="h-5 w-5 flex-none text-[#FF6B4A]" />
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
            className={`flex items-center justify-center rounded-lg text-[#C4A8AD] hover:bg-red-900/30 hover:text-red-300 transition-colors ${
              collapsed ? "w-10 h-10" : "w-full h-9 gap-2 px-3"
            }`}
          >
            <LogOut className="h-4 w-4 flex-none" />
            {!collapsed && <span className="text-sm flex-1 text-left">Logout</span>}
          </button>
        </div>
      </aside>

      <main className="cms-light relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-20 border-b border-slate-200 bg-white">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={toggleSidebar}
              title={collapsed ? "Perluas sidebar" : "Sembunyikan sidebar"}
              aria-label={collapsed ? "Perluas sidebar" : "Sembunyikan sidebar"}
              className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D81435]"
            >
              {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-black text-slate-900 sm:text-lg">{pageMeta.title}</h1>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D81435]"
              >
                <Home className="size-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Beranda</span>
                <ExternalLink className="size-3.5 shrink-0 text-slate-400" aria-hidden />
              </Link>
              <Link
                href="/komersial"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D81435]"
              >
                <Map className="size-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Virtual Tour</span>
                <ExternalLink className="size-3.5 shrink-0 text-slate-400" aria-hidden />
              </Link>
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
