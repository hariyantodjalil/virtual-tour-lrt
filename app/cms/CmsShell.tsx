"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
  GitBranch,
  Handshake,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import CmsNotifications from "@/components/cms/CmsNotifications";
import { announceAuthLogout } from "@/lib/auth-client";

export type CmsUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type NavLeaf = {
  kind: "link";
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

type NavGroup = {
  kind: "group";
  id: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  children: NavLeaf[];
};

type NavEntry = NavLeaf | NavGroup;

const navItems: NavEntry[] = [
  { kind: "link", href: "/cms/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { kind: "link", href: "/cms/stations", label: "Stasiun", icon: Train },
  { kind: "link", href: "/cms/virtual-tour", label: "Station Virtual Tour", icon: Map },
  { kind: "link", href: "/cms/virtual-train", label: "Train Virtual Tour", icon: TrainFront },
  { kind: "link", href: "/cms/train-spaces", label: "Train Rental Space", icon: LayoutGrid },
  { kind: "link", href: "/cms/spaces", label: "Ruang Komersial", icon: Store },
  {
    kind: "group",
    id: "tenant-leasing",
    label: "Penyewaan Tenant",
    icon: Handshake,
    children: [
      { kind: "link", href: "/cms/leads", label: "Pengajuan & Site Visit", icon: UserCircle },
      { kind: "link", href: "/cms/tenants", label: "Penyewa Aktif", icon: Building2 },
      {
        kind: "link",
        href: "/cms/workflow",
        label: "Alur Pengajuan",
        icon: GitBranch,
        adminOnly: true,
      },
    ],
  },
  {
    kind: "link",
    href: "/cms/commercial-profile",
    label: "Profil Tim Komersial",
    icon: PhoneCall,
    adminOnly: true,
  },
  { kind: "link", href: "/cms/users", label: "Users", icon: Users, adminOnly: true },
  {
    kind: "link",
    href: "/cms/settings",
    label: "Pengaturan Sistem",
    icon: Sliders,
    adminOnly: true,
  },
];

function isRouteActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function filterVisibleNav(entries: NavEntry[], isAdmin: boolean): NavEntry[] {
  const result: NavEntry[] = [];
  for (const item of entries) {
    if (item.adminOnly && !isAdmin) continue;
    if (item.kind === "link") {
      result.push(item);
      continue;
    }
    const visibleChildren = item.children.filter((child) => !child.adminOnly || isAdmin);
    if (visibleChildren.length > 0) {
      result.push({ ...item, children: visibleChildren });
    }
  }
  return result;
}

/** Shared leaf link used by both the inline accordion tree and the collapsed rail popover. */
function SubNavLink({
  child,
  active,
  role,
  onNavigate,
}: {
  child: NavLeaf;
  active: boolean;
  role?: "menuitem";
  onNavigate: () => void;
}) {
  const ChildIcon = child.icon;
  return (
    <Link
      href={child.href}
      role={role}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
        active
          ? "bg-[#c41230] font-medium text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100 hover:text-[#101828]"
      }`}
    >
      <ChildIcon className="h-3.5 w-3.5 flex-none" />
      <span className="truncate">{child.label}</span>
    </Link>
  );
}

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
  if (pathname.startsWith("/cms/leads/")) {
    return {
      title: "Detail Pengajuan & Kendali Tahapan",
      subtitle: "Meja kerja admin untuk verifikasi, dokumen resmi, dan kemajuan alur pengajuan",
    };
  }
  if (pathname.startsWith("/cms/leads")) {
    return {
      title: "Pengajuan & Site Visit",
      subtitle: "Alur calon mitra: penawaran, verifikasi lokasi, BA Negosiasi, lalu PKS",
    };
  }
  if (pathname.startsWith("/cms/workflow")) {
    return {
      title: "Alur Pengajuan (Workflow Builder)",
      subtitle:
        "Kelola versi tahapan proses, tipe form tahapan, target SLA, syarat dokumen, dan automasi status ruang",
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

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [groupOverrides, setGroupOverrides] = useState<
    Record<string, { pathname: string; open: boolean }>
  >({});
  const [collapsedPopover, setCollapsedPopover] = useState<{
    groupId: string;
    pathname: string;
    top: number;
    left: number;
  } | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = initialUser?.role === "ADMIN";
  const visibleNav = filterVisibleNav(navItems, isAdmin);

  const isIconRail = collapsed && !mobileNavOpen;
  const activePopover =
    isIconRail && collapsedPopover && collapsedPopover.pathname === pathname
      ? collapsedPopover
      : null;
  const activePopoverGroupId = activePopover?.groupId ?? null;
  const activePopoverEntry = activePopover
    ? visibleNav.find(
        (entry): entry is NavGroup =>
          entry.kind === "group" && entry.id === activePopover.groupId
      ) ?? null
    : null;

  useEffect(() => {
    if (!activePopoverGroupId) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (target.closest(`[data-collapsed-group-trigger="${activePopoverGroupId}"]`)) {
        return;
      }
      setCollapsedPopover(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCollapsedPopover(null);
        const trigger = document.querySelector<HTMLButtonElement>(
          `[data-collapsed-group-trigger="${activePopoverGroupId}"]`
        );
        trigger?.focus();
      }
    };

    const handleResize = () => setCollapsedPopover(null);

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [activePopoverGroupId]);

  const handleHeaderSidebarToggle = () => {
    setCollapsedPopover(null);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setMobileNavOpen((prev) => !prev);
      return;
    }
    const next = !getSidebarSnapshot();
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  };

  function handleCollapsedGroupToggle(group: NavGroup, triggerEl: HTMLButtonElement) {
    if (activePopover?.groupId === group.id) {
      setCollapsedPopover(null);
      return;
    }
    const rect = triggerEl.getBoundingClientRect();
    const estimatedHeight = 44 + group.children.length * 36;
    const top = Math.max(12, Math.min(rect.top, window.innerHeight - estimatedHeight - 12));
    setCollapsedPopover({
      groupId: group.id,
      pathname,
      top,
      left: rect.right + 8,
    });
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      announceAuthLogout();
      router.push("/");
      router.refresh();
    }
  }

  const fullWidth = isFullWidthPage(pathname);
  const pageMeta = getPageMeta(pathname);

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
    <div className="cms-shell relative flex h-screen overflow-hidden bg-[#f3f4f6] text-[#101828]">
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Tutup menu navigasi"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/45 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-full min-h-0 flex-none flex-col border-r border-slate-200 bg-white transition-all duration-200 md:relative md:z-20 md:translate-x-0 ${
          mobileNavOpen
            ? "w-60 translate-x-0 shadow-2xl"
            : "-translate-x-full pointer-events-none md:pointer-events-auto"
        } ${collapsed ? "md:w-14" : "md:w-60"}`}
      >
        <div
          className={`flex h-16 flex-none items-center border-b border-slate-200 ${
            isIconRail ? "justify-center px-2" : "gap-2.5 px-4"
          }`}
        >
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-[#c41230] text-xs font-black text-white">
            LRT
          </div>
          {!isIconRail && (
            <div className="min-w-0">
              <p className="text-sm font-black text-[#101828] leading-tight">Virtual Tour CMS</p>
              <p className="text-xs text-slate-500">LRT Jabodebek</p>
            </div>
          )}
        </div>

        <nav
          onScroll={() => {
            if (activePopover) setCollapsedPopover(null);
          }}
          className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2"
        >
          {visibleNav.map((entry) => {
            if (entry.kind === "link") {
              const active = isRouteActive(pathname, entry.href);
              const Icon = entry.icon;
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  onClick={() => setMobileNavOpen(false)}
                  title={isIconRail ? entry.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center rounded-lg text-sm transition-colors group ${
                    isIconRail ? "justify-center w-10 h-10 mx-auto" : "gap-3 px-3 py-2"
                  } ${
                    active
                      ? "bg-[#c41230] text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-[#101828]"
                  }`}
                >
                  <Icon className="h-4 w-4 flex-none" />
                  {!isIconRail && <span className="truncate">{entry.label}</span>}
                </Link>
              );
            }

            const GroupIcon = entry.icon;
            const isGroupActive = entry.children.some((child) =>
              isRouteActive(pathname, child.href)
            );

            if (isIconRail) {
              const isPopoverOpen = activePopover?.groupId === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  data-collapsed-group-trigger={entry.id}
                  onClick={(event) => handleCollapsedGroupToggle(entry, event.currentTarget)}
                  title={entry.label}
                  aria-label={entry.label}
                  aria-haspopup="menu"
                  aria-expanded={isPopoverOpen}
                  className={`relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                    isGroupActive
                      ? "bg-[#c41230] text-white shadow-sm"
                      : isPopoverOpen
                        ? "bg-slate-100 text-[#101828]"
                        : "text-slate-600 hover:bg-slate-100 hover:text-[#101828]"
                  }`}
                >
                  <GroupIcon className="h-4 w-4 flex-none" />
                  <ChevronRight
                    className="pointer-events-none absolute right-1 bottom-1 size-2.5 opacity-75"
                    aria-hidden="true"
                  />
                </button>
              );
            }

            const override = groupOverrides[entry.id];
            const isOpen =
              override && override.pathname === pathname ? override.open : isGroupActive;
            const submenuId = `nav-group-${entry.id}`;

            return (
              <div key={entry.id}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={submenuId}
                  onClick={() =>
                    setGroupOverrides((prev) => ({
                      ...prev,
                      [entry.id]: { pathname, open: !isOpen },
                    }))
                  }
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    isGroupActive
                      ? "bg-rose-50/80 font-medium text-[#c41230]"
                      : isOpen
                        ? "bg-slate-100/80 font-medium text-[#101828]"
                        : "text-slate-600 hover:bg-slate-100 hover:text-[#101828]"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <GroupIcon className="h-4 w-4 flex-none" />
                    <span className="truncate">{entry.label}</span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 flex-none transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {isOpen && (
                  <ul id={submenuId} className="mt-0.5">
                    {entry.children.map((child, idx) => {
                      const isLast = idx === entry.children.length - 1;
                      return (
                        <li key={child.href} className="relative py-0.5 pl-[30px]">
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none absolute top-0 left-5 w-px bg-slate-200 ${
                              isLast ? "h-1/2" : "bottom-0"
                            }`}
                          />
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute top-1/2 left-5 h-px w-2 bg-slate-200"
                          />
                          <SubNavLink
                            child={child}
                            active={isRouteActive(pathname, child.href)}
                            onNavigate={() => setMobileNavOpen(false)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {activePopover && activePopoverEntry && (
          <div
            ref={popoverRef}
            role="menu"
            aria-label={activePopoverEntry.label}
            style={{ top: activePopover.top, left: activePopover.left }}
            className="fixed z-50 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
          >
            <div className="mb-1 border-b border-slate-100 px-2.5 pt-1 pb-1.5">
              <p className="text-xs font-semibold text-[#101828]">{activePopoverEntry.label}</p>
            </div>
            <div className="space-y-0.5">
              {activePopoverEntry.children.map((child) => (
                <SubNavLink
                  key={child.href}
                  child={child}
                  role="menuitem"
                  active={isRouteActive(pathname, child.href)}
                  onNavigate={() => setCollapsedPopover(null)}
                />
              ))}
            </div>
          </div>
        )}

        <div className={`border-t border-slate-200 p-2 ${isIconRail ? "flex flex-col items-center gap-2" : "space-y-2"}`}>
          <div
            title={isIconRail ? initialUser?.name ?? initialUser?.email ?? "User" : undefined}
            className={`flex items-center rounded-xl border border-slate-200 bg-slate-50 text-[#101828] ${
              isIconRail ? "h-10 w-10 justify-center" : "gap-3 p-2"
            }`}
          >
            <UserCircle className="h-5 w-5 flex-none text-[#c41230]" />
            {!isIconRail && (
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
            title={isIconRail ? "Halaman Utama" : undefined}
            className={`flex items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#101828] ${
              isIconRail ? "w-10 h-10" : "w-full h-9 gap-2 px-3"
            }`}
          >
            <House className="h-4 w-4 flex-none" />
            {!isIconRail && <span className="text-sm flex-1 text-left">Halaman Utama</span>}
          </Link>

          <button
            onClick={handleLogout}
            title={isIconRail ? "Logout" : undefined}
            className={`flex items-center justify-center rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-700 transition-colors ${
              isIconRail ? "w-10 h-10" : "w-full h-9 gap-2 px-3"
            }`}
          >
            <LogOut className="h-4 w-4 flex-none" />
            {!isIconRail && <span className="text-sm flex-1 text-left">Logout</span>}
          </button>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-20 bg-[#c41230] text-white shadow-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={handleHeaderSidebarToggle}
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

        <div className={`relative min-h-0 min-w-0 flex-1 ${fullWidth ? "overflow-hidden" : "overflow-auto"}`}>

          {fullWidth ? (
            <div className="relative z-10 flex h-full min-h-0 w-full flex-col overflow-hidden">{children}</div>
          ) : (
            <div
              className={`relative z-10 mx-auto w-full min-w-0 p-4 sm:p-6 ${
                pathname.startsWith("/cms/workflow") ? "max-w-none" : "max-w-7xl"
              }`}
            >
              {children}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
