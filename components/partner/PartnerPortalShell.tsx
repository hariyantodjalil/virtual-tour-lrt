"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CircleHelp,
  FileText,
  Glasses,
  Headset,
  Heart,
  House,
  LayoutDashboard,
  LogOut,
  Settings,
  type LucideIcon,
} from "lucide-react";
import StationPickerModal, {
  type StationPickerItem,
} from "@/components/tour/StationPickerModal";
import type { PartnerLead } from "@/components/partner/ApplicationsSection";
import type { ActiveTenancy } from "@/components/partner/ActiveTenanciesSection";
import {
  FAVORITES_UPDATED_EVENT,
  fetchPartnerFavorites,
  removePartnerFavorite,
  type FavoriteSpace,
} from "@/lib/favorite-spaces";
import {
  ACTIVE_LEAD_STATUSES,
  isInquiryFullyCompleted,
} from "@/lib/commercial-pipeline";
import { PARTNER_LEADS_UPDATED_EVENT } from "@/lib/inquiry-sync-events";
import { announceAuthLogout } from "@/lib/auth-client";
import { useInquiryRealtimeSync } from "@/components/realtime/useInquiryRealtimeSync";

export type PartnerUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export type PartnerSummary = {
  total: number;
  active: number;
  won: number;
  lost: number;
};

type NavCountKey = "activeInquiries" | "tenancies" | "favorites";

type PartnerNavItem = {
  id: string;
  href: string | null;
  label: string;
  mobileLabel?: string;
  icon: LucideIcon;
  countKey?: NavCountKey;
};

type PartnerNavGroup = {
  id: string;
  label: string;
  items: readonly PartnerNavItem[];
};

const PARTNER_NAV_GROUPS: readonly PartnerNavGroup[] = [
  {
    id: "main",
    label: "Menu utama",
    items: [
      { id: "dashboard", href: "/partner/dashboard", label: "Dashboard", mobileLabel: "Dashboard", icon: LayoutDashboard },
      { id: "inquiries", href: "/partner/inquiries", label: "Pengajuan Sewa", mobileLabel: "Pengajuan", icon: FileText, countKey: "activeInquiries" },
      { id: "tenancies", href: "/partner/tenancies", label: "Unit Aktif Saya", mobileLabel: "Unit Saya", icon: Building2, countKey: "tenancies" },
    ],
  },
  {
    id: "explore",
    label: "Eksplorasi",
    items: [
      { id: "tour", href: null, label: "Virtual Tour", mobileLabel: "Tur 360°", icon: Glasses },
      { id: "favorites", href: "/partner/favorites", label: "Favorit", icon: Heart, countKey: "favorites" },
    ],
  },
  {
    id: "support",
    label: "Akun & dukungan",
    items: [
      { id: "account", href: "/partner/account", label: "Pengaturan Akun", icon: Settings },
      { id: "help", href: "/partner/help", label: "Bantuan", icon: CircleHelp },
    ],
  },
];

const MOBILE_NAV_ITEMS: readonly PartnerNavItem[] = PARTNER_NAV_GROUPS.flatMap(
  (group) => group.items
).slice(0, 4);

type PartnerPortalContextValue = {
  user: PartnerUser | null;
  setUser: (user: PartnerUser | null) => void;
  displayName: string;
  leads: PartnerLead[];
  tenancies: ActiveTenancy[];
  favorites: FavoriteSpace[];
  pickerStations: StationPickerItem[];
  loading: boolean;
  summary: PartnerSummary;
  openStationPicker: () => void;
  removeFavorite: (spaceId: string) => Promise<void>;
  logout: () => Promise<void>;
};

const PartnerPortalContext = createContext<PartnerPortalContextValue | null>(null);

/** Mengakses state dan aksi bersama Portal Mitra di seluruh sub-halaman `/partner/*`. */
export function usePartnerPortal() {
  const ctx = useContext(PartnerPortalContext);
  if (!ctx) {
    throw new Error("usePartnerPortal harus digunakan di dalam PartnerPortalShell.");
  }
  return ctx;
}

function isNavItemActive(pathname: string, item: PartnerNavItem, pickerOpen: boolean) {
  if (item.href === null) return pickerOpen;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * Shell navigasi & penyedia state Portal Mitra.
 * Mengambil data 1x di layout sehingga perpindahan antar sub-route instan,
 * namun tetap membiarkan halaman detail `/partner/inquiries/[id]` tampil full-width.
 */
export default function PartnerPortalShell({
  children,
  initialUser = null,
}: {
  children: ReactNode;
  initialUser?: PartnerUser | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isInquiryDetailRoute = /^\/partner\/inquiries\/[^/]+/.test(pathname);

  const [user, setUser] = useState<PartnerUser | null>(initialUser);
  const [leads, setLeads] = useState<PartnerLead[]>([]);
  const [tenancies, setTenancies] = useState<ActiveTenancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerStations, setPickerStations] = useState<StationPickerItem[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteSpace[]>([]);
  const hasLoadedRef = useRef(false);
  const wasDetailRouteRef = useRef(isInquiryDetailRoute);

  useEffect(() => {
    let active = true;
    async function refreshFavorites() {
      try {
        const result = await fetchPartnerFavorites();
        if (!active) return;
        if (result.kind === "ready") {
          setFavorites(result.items);
        }
      } catch {
        // Biarkan state sebelumnya jika sinkronisasi latar gagal sementara.
      }
    }

    window.addEventListener(FAVORITES_UPDATED_EVENT, refreshFavorites);
    return () => {
      active = false;
      window.removeEventListener(FAVORITES_UPDATED_EVENT, refreshFavorites);
    };
  }, []);

  const refreshLeadsAndTenancies = useCallback(
    async (scope: "all" | "leads" | "tenancies" = "all") => {
      try {
        const [leadsRes, tenanciesRes] = await Promise.all([
          scope === "tenancies"
            ? Promise.resolve(null)
            : fetch("/api/partner/leads", { cache: "no-store" }),
          scope === "leads"
            ? Promise.resolve(null)
            : fetch("/api/partner/tenancies", { cache: "no-store" }),
        ]);

        if (leadsRes?.ok) {
          const nextLeads = await leadsRes.json();
          setLeads(Array.isArray(nextLeads) ? nextLeads : []);
        }
        if (tenanciesRes?.ok) {
          const nextTenancies = await tenanciesRes.json();
          setTenancies(Array.isArray(nextTenancies) ? nextTenancies : []);
        }
      } catch {
        // Biarkan state sebelumnya jika sinkronisasi latar gagal sementara.
      }
    },
    []
  );

  useEffect(() => {
    const wasDetail = wasDetailRouteRef.current;
    wasDetailRouteRef.current = isInquiryDetailRoute;
    if (wasDetail && !isInquiryDetailRoute && hasLoadedRef.current) {
      void refreshLeadsAndTenancies("all");
    }
  }, [isInquiryDetailRoute, refreshLeadsAndTenancies]);

  useInquiryRealtimeSync({
    enabled: true,
    localEvents: [PARTNER_LEADS_UPDATED_EVENT],
    onSync: async (_reason, event) => {
      if (event?.kind === "tenancy-updated" || event?.kind === "lead-updated") {
        await refreshLeadsAndTenancies("all");
        return;
      }
      await refreshLeadsAndTenancies("leads");
    },
  });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      try {
        const [verifyRes, leadsRes, stationsRes, tenanciesRes, favoritesResult] = await Promise.all([
          fetch("/api/auth/verify", { cache: "no-store", signal: controller.signal }),
          fetch("/api/partner/leads", { cache: "no-store", signal: controller.signal }),
          fetch("/api/stations", { cache: "no-store", signal: controller.signal }),
          fetch("/api/partner/tenancies", { cache: "no-store", signal: controller.signal }),
          fetchPartnerFavorites({ signal: controller.signal }).catch(() => ({
            kind: "unauthenticated" as const,
          })),
        ]);

        if (!active || controller.signal.aborted) return;

        if (verifyRes.ok) {
          const verify = await verifyRes.json();
          if (active && verify.authenticated && verify.user) {
            setUser(verify.user);
          }
        }

        if (leadsRes.ok) setLeads(await leadsRes.json());
        if (tenanciesRes.ok) setTenancies(await tenanciesRes.json());
        if (favoritesResult.kind === "ready") setFavorites(favoritesResult.items);

        if (stationsRes.ok) {
          const stations = (await stationsRes.json()) as StationPickerItem[];
          setPickerStations(
            stations.map((s) => ({
              slug: s.slug,
              name: s.name,
              order: s.order,
              line: s.line,
              address: s.address,
              location: s.location,
              dailyPassengers: s.dailyPassengers,
            }))
          );
        }

        if (active) {
          hasLoadedRef.current = true;
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
      } finally {
        if (active && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const summary = useMemo<PartnerSummary>(
    () => ({
      total: leads.length,
      active: leads.filter((lead) =>
        ACTIVE_LEAD_STATUSES.includes(
          lead.status as (typeof ACTIVE_LEAD_STATUSES)[number]
        )
      ).length,
      won: leads.filter((lead) => isInquiryFullyCompleted(lead.status)).length,
      lost: leads.filter(
        (lead) => lead.status === "REJECTED" || lead.status === "CLOSED_LOST"
      ).length,
    }),
    [leads]
  );

  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || "Mitra";
  const initial = displayName.charAt(0).toUpperCase();

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      announceAuthLogout();
      router.push("/");
      router.refresh();
    }
  }, [router]);

  const openStationPicker = useCallback(() => {
    setPickerOpen(true);
  }, []);

  const selectStation = useCallback(
    (slug: string) => {
      setPickerOpen(false);
      router.push(`/station/${slug}`);
    },
    [router]
  );

  const removeFavorite = useCallback(async (spaceId: string) => {
    await removePartnerFavorite(spaceId);
    setFavorites((prev) => prev.filter((item) => item.spaceId !== spaceId));
  }, []);

  const contextValue = useMemo<PartnerPortalContextValue>(
    () => ({
      user,
      setUser,
      displayName,
      leads,
      tenancies,
      favorites,
      pickerStations,
      loading,
      summary,
      openStationPicker,
      removeFavorite,
      logout,
    }),
    [
      user,
      displayName,
      leads,
      tenancies,
      favorites,
      pickerStations,
      loading,
      summary,
      openStationPicker,
      removeFavorite,
      logout,
    ]
  );

  const counts: Record<NavCountKey, number> = {
    activeInquiries: summary.active,
    tenancies: tenancies.length,
    favorites: favorites.length,
  };

  return (
    <PartnerPortalContext.Provider value={contextValue}>
      <div className="font-display min-h-screen bg-[#f3f4f6] text-[#101828]">
        {pickerOpen && (
          <StationPickerModal
            stations={pickerStations}
            currentSlug=""
            onSelect={selectStation}
            onClose={() => setPickerOpen(false)}
          />
        )}

        {/* Top bar — penuh seperti sebelumnya dengan utilitas kanan bergaya Admin + Halaman Utama */}
        <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-black/10 bg-[#c41230] px-4 text-white shadow-xs md:pr-6 md:pl-0">
          <div className="flex h-full items-center">
            <Link
              href="/partner/dashboard"
              className="flex h-full items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60"
              aria-label="Portal Mitra LRT Jabodebek"
            >
              <span className="flex items-center gap-2 sm:gap-3 md:w-[223px] md:shrink-0 md:pl-5">
                <span className="relative h-8 w-16 shrink-0 sm:w-[72px]">
                  <Image
                    src="/brand/landing/logo-kai-nav.png"
                    alt="KAI"
                    fill
                    sizes="72px"
                    className="object-contain object-left"
                    priority
                  />
                </span>
                <span className="relative h-9 w-[74px] shrink-0 sm:w-[84px]">
                  <Image
                    src="/brand/landing/logo-lrt-nav.png"
                    alt="LRT Jabodebek"
                    fill
                    sizes="84px"
                    className="object-contain object-left"
                    priority
                  />
                </span>
              </span>
            </Link>

            <span
              className={
                isInquiryDetailRoute
                  ? "ml-2.5 h-5 w-px shrink-0 bg-white/25 sm:ml-3 md:ml-0"
                  : "hidden h-5 w-px shrink-0 bg-white/25 md:block"
              }
              aria-hidden
            />

            {isInquiryDetailRoute && (
              <Link
                href="/partner/inquiries"
                title="Kembali ke Pengajuan Sewa"
                aria-label="Kembali ke Pengajuan Sewa"
                className="ml-2.5 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3 text-xs font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:ml-3 md:ml-4"
              >
                <ArrowLeft className="size-4 flex-none" strokeWidth={1.5} />
                <span>
                  Kembali<span className="hidden sm:inline"> ke Pengajuan Sewa</span>
                </span>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              title="Halaman Utama"
              aria-label="Halaman Utama"
              className="inline-flex h-9 w-9 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 text-xs font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:w-auto sm:px-3"
            >
              <House className="size-4 flex-none" strokeWidth={1.5} />
              <span className="hidden sm:inline">Halaman Utama</span>
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                aria-label={`Menu akun ${displayName}`}
                className="flex h-9 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-1.5 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:pr-3 sm:pl-1.5"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-white text-xs font-semibold text-[#c41230]">
                  {initial}
                </span>
                <span className="hidden max-w-[140px] truncate text-sm font-medium sm:inline">
                  {displayName}
                </span>
              </button>

              {profileOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40 cursor-default"
                    aria-label="Tutup menu profil"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute top-full right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-[#101828] shadow-lg"
                  >
                    <div className="mb-1 border-b border-slate-100 px-2.5 py-2">
                      <p className="truncate text-sm font-semibold text-[#101828]">{displayName}</p>
                      <p className="truncate text-xs text-slate-500">{user?.email}</p>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileOpen(false);
                        void logout();
                      }}
                      className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-red-50 hover:text-red-700"
                    >
                      <LogOut className="size-4" strokeWidth={1.5} />
                      Keluar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="flex min-h-screen pt-14">
          {!isInquiryDetailRoute && (
            /* Sidebar Desktop — desain sistem Admin CMS tanpa header logo berulang & tanpa akun/keluar */
            <aside className="fixed top-14 bottom-0 left-0 z-30 hidden w-56 flex-col border-r border-slate-200 bg-white md:flex">
            <nav
              className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2 pt-3"
              aria-label="Menu mitra"
            >
              {PARTNER_NAV_GROUPS.map((group, groupIdx) => (
                <div key={group.id}>
                  {groupIdx > 0 && <div className="my-2 border-t border-slate-100" />}
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isNavItemActive(pathname, item, pickerOpen);
                      const itemCount =
                        !loading && item.countKey ? counts[item.countKey] : 0;

                      const classes = `group flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c41230]/35 ${
                        active
                          ? "bg-[#c41230] font-semibold text-white shadow-xs"
                          : "font-medium text-slate-600 hover:bg-slate-100 hover:text-[#101828]"
                      }`;

                      const content = (
                        <>
                          <span className="flex min-w-0 items-center gap-2.5">
                            <Icon className="size-4 flex-none" strokeWidth={1.5} />
                            <span className="truncate">{item.label}</span>
                          </span>
                          {itemCount > 0 && (
                            <span
                              className={`shrink-0 text-xs tabular-nums ${
                                active ? "text-white/90" : "text-slate-400"
                              }`}
                            >
                              {itemCount}
                            </span>
                          )}
                        </>
                      );

                      if (item.href === null) {
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={openStationPicker}
                            className={classes}
                          >
                            {content}
                          </button>
                        );
                      }

                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={classes}
                        >
                          {content}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {/* Footer Sidebar — hanya kartu Tim Komersial berwarna */}
            <div className="border-t border-slate-200 p-2">
              <div className="rounded-xl border border-[#c41230]/20 bg-[#c41230]/[0.06] p-2.5">
                <div className="flex items-start gap-2">
                  <span className="flex size-7 flex-none items-center justify-center rounded-lg bg-[#c41230]/12 text-[#c41230]">
                    <Headset className="size-4" strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#101828]">Tim Komersial</p>
                    <p className="text-[11px] leading-snug text-slate-600">
                      Konsultasi lokasi & berkas sewa
                    </p>
                  </div>
                </div>
                <Link
                  href="/#kontak"
                  className="mt-2 inline-flex h-8 w-full items-center justify-center rounded-lg bg-[#c41230] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#a60f28] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c41230]/35"
                >
                  Hubungi Tim
                </Link>
              </div>
            </div>
          </aside>
          )}

          {/* Main Content */}
          {isInquiryDetailRoute ? (
            <div className="min-w-0 flex-1">{children}</div>
          ) : (
            <main className="min-w-0 flex-1 pb-24 md:pb-12 md:pl-56">
              <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
                {children}
              </div>
            </main>
          )}
        </div>

        {/* Mobile Bottom Nav */}
        {!isInquiryDetailRoute && (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white px-2 py-1.5 md:hidden"
          aria-label="Menu mitra mobile"
        >
          {MOBILE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(pathname, item, pickerOpen);
            const classes = `flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-[11px] transition-colors ${
              active
                ? "font-semibold text-[#c41230]"
                : "font-medium text-slate-500 hover:text-[#101828]"
            }`;
            const shortLabel = item.mobileLabel ?? item.label;

            if (item.href === null) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={openStationPicker}
                  className={classes}
                >
                  <Icon className="size-4" strokeWidth={1.5} />
                  <span>{shortLabel}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={classes}
              >
                <Icon className="size-4" strokeWidth={1.5} />
                <span>{shortLabel}</span>
              </Link>
            );
          })}
        </nav>
        )}
      </div>
    </PartnerPortalContext.Provider>
  );
}
