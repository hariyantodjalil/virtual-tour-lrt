"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Bell,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Clock3,
  FileText,
  Glasses,
  Headset,
  Heart,
  LayoutDashboard,
  LogOut,
  MapPin,
  Plus,
  Settings,
} from "lucide-react";
import StationPickerModal, {
  type StationPickerItem,
} from "@/components/tour/StationPickerModal";
import ApplicationsSection, {
  type PartnerLead,
} from "@/components/partner/ApplicationsSection";
import AccountSettingsSection from "@/components/partner/AccountSettingsSection";
import ActiveTenanciesSection, {
  type ActiveTenancy,
} from "@/components/partner/ActiveTenanciesSection";
import {
  FAVORITES_UPDATED_EVENT,
  readFavoriteSpaces,
  removeFavoriteSpace,
  type FavoriteSpace,
} from "@/lib/favorite-spaces";
import {
  ACTIVE_LEAD_STATUSES,
  isCommercialOperation,
  LEAD_STATUS_LABELS,
  type CommercialLeadStatus,
} from "@/lib/commercial-pipeline";
import { formatRupiah } from "@/lib/utils";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type Lead = PartnerLead;

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "pengajuan", label: "Pengajuan Sewa", icon: FileText },
  { id: "unit-aktif", label: "Unit Aktif Saya", icon: Building2 },
  { id: "tour", label: "Virtual Tour", icon: Glasses },
  { id: "favorit", label: "Favorit", icon: Heart },
  { id: "akun", label: "Pengaturan Akun", icon: Settings },
  { id: "bantuan", label: "Bantuan", icon: CircleHelp },
] as const;

export default function PartnerPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tenancies, setTenancies] = useState<ActiveTenancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerStations, setPickerStations] = useState<StationPickerItem[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<(typeof NAV_ITEMS)[number]["id"]>("dashboard");
  const [favorites, setFavorites] = useState<FavoriteSpace[]>([]);

  useEffect(() => {
    function refreshFavorites() {
      setFavorites(readFavoriteSpaces());
    }

    refreshFavorites();
    window.addEventListener(FAVORITES_UPDATED_EVENT, refreshFavorites);
    return () => window.removeEventListener(FAVORITES_UPDATED_EVENT, refreshFavorites);
  }, []);

  useEffect(() => {
    async function load() {
      const [verifyRes, leadsRes, stationsRes, tenanciesRes] = await Promise.all([
        fetch("/api/auth/verify"),
        fetch("/api/partner/leads"),
        fetch("/api/stations"),
        fetch("/api/partner/tenancies"),
      ]);

      if (verifyRes.ok) {
        const verify = await verifyRes.json();
        if (verify.authenticated && verify.user) setUser(verify.user);
      }

      if (leadsRes.ok) setLeads(await leadsRes.json());
      if (tenanciesRes.ok) setTenancies(await tenanciesRes.json());

      if (stationsRes.ok) {
        const stations = (await stationsRes.json()) as Array<{
          slug: string;
          name: string;
          order: number;
          line: string;
          address?: string;
          location?: string | null;
          dailyPassengers?: number;
        }>;
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

      setLoading(false);
    }

    void load();
  }, []);

  const summary = useMemo(
    () => ({
      total: leads.length,
      active: leads.filter((lead) =>
        ACTIVE_LEAD_STATUSES.includes(
          lead.status as (typeof ACTIVE_LEAD_STATUSES)[number]
        )
      ).length,
      won: leads.filter((lead) => isCommercialOperation(lead.status)).length,
      lost: leads.filter((lead) => lead.status === "CLOSED_LOST").length,
    }),
    [leads]
  );

  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || "Mitra";
  const initial = displayName.charAt(0).toUpperCase();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  function openStationPicker() {
    setPickerOpen(true);
  }

  function selectStation(slug: string) {
    setPickerOpen(false);
    router.push(`/station/${slug}`);
  }

  function onNavClick(id: (typeof NAV_ITEMS)[number]["id"]) {
    setActiveNav(id);
    if (id === "tour") openStationPicker();
  }

  const showComingSoon = activeNav === "bantuan";

  return (
    <div className="font-display min-h-screen bg-[#f3f4f6] text-[#101828]">
      {pickerOpen && (
        <StationPickerModal
          stations={pickerStations}
          currentSlug=""
          onSelect={selectStation}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between bg-[#c41230] px-4 text-white shadow-md md:px-6">
        <Link href="/" className="flex items-center gap-2.5 md:gap-3" aria-label="LRT Jabodebek">
          <span className="relative h-8 w-[72px] shrink-0">
            <Image
              src="/brand/landing/logo-kai-nav.png"
              alt="KAI"
              fill
              sizes="72px"
              className="object-contain object-left"
              priority
            />
          </span>
          <span className="relative h-9 w-[84px] shrink-0">
            <Image
              src="/brand/landing/logo-lrt-nav.png"
              alt="LRT Jabodebek"
              fill
              sizes="84px"
              className="object-contain object-left"
              priority
            />
          </span>
          <span className="hidden h-5 w-px bg-white/35 sm:block" aria-hidden />
          <span className="hidden text-sm font-semibold tracking-wide sm:inline">
            Panel Mitra <span className="font-normal opacity-80">|</span>{" "}
            <span className="font-normal opacity-90">Virtual Tour Komersial</span>
          </span>
        </Link>

        <div className="flex items-center gap-3 md:gap-4">
          <button
            type="button"
            className="relative rounded-full p-2 transition hover:bg-white/15"
            aria-label="Notifikasi"
          >
            <Bell className="size-5" />
            {summary.active > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-[#c41230]">
                {summary.active}
              </span>
            )}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full py-1 pr-1 pl-1 transition hover:bg-white/15"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-white text-sm font-bold text-[#c41230]">
                {initial}
              </span>
              <span className="hidden max-w-[120px] truncate text-sm font-medium sm:inline">
                {displayName}
              </span>
              <ChevronDown className="hidden size-4 opacity-80 sm:block" />
            </button>

            {profileOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default"
                  aria-label="Tutup menu profil"
                  onClick={() => setProfileOpen(false)}
                />
                <div className="absolute top-full right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-[#101828] shadow-xl">
                  <div className="border-b border-slate-100 px-3 py-2">
                    <p className="truncate text-sm font-semibold">{displayName}</p>
                    <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
                  <button
                    type="button"
                    onClick={logout}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <LogOut className="size-4" />
              Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-screen pt-14">
        {/* Sidebar */}
        <aside className="fixed top-14 bottom-0 left-0 z-30 hidden w-[240px] flex-col border-r border-slate-200 bg-white md:flex">
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="Menu mitra">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavClick(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition ${
                    active
                      ? "border-[#c41230]/35 bg-[#c41230]/10 text-[#c41230]"
                      : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2.25 : 2} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="space-y-4 border-t border-slate-100 p-4">
            <div className="rounded-xl bg-[#c41230]/[0.06] p-3.5">
              <p className="text-sm font-semibold text-[#101828]">Butuh Bantuan?</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Tim komersial siap membantu proses sewa Anda.
              </p>
              <Link
                href="/#kontak"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#c41230] px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110"
              >
                <Headset className="size-3.5" />
                Hubungi Kami
              </Link>
            </div>

            <div className="flex items-center justify-center gap-3 px-1 pb-1">
              <Image
                src="/brand/landing/logo-kai-nav.png"
                alt="KAI"
                width={72}
                height={28}
                className="h-7 w-auto object-contain"
              />
              <Image
                src="/brand/landing/logo-lrt-nav.png"
                alt="LRT Jabodebek"
                width={80}
                height={28}
                className="h-7 w-auto object-contain"
              />
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 md:ml-[240px]">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
            {activeNav === "dashboard" ? (
              <DashboardOverview
                displayName={displayName}
                loading={loading}
                leads={leads}
                favorites={favorites}
                summary={summary}
                onExplore={openStationPicker}
                onOpenPengajuan={() => setActiveNav("pengajuan")}
                onOpenFavorit={() => setActiveNav("favorit")}
                pickerReady={pickerStations.length > 0}
              />
            ) : activeNav === "pengajuan" ? (
              <ApplicationsSection
                displayName={displayName}
                loading={loading}
                leads={leads}
                onExplore={openStationPicker}
                pickerReady={pickerStations.length > 0}
              />
            ) : activeNav === "unit-aktif" ? (
              <ActiveTenanciesSection
                displayName={displayName}
                tenancies={tenancies}
                loading={loading}
              />
            ) : activeNav === "favorit" ? (
              <FavoritesSection
                displayName={displayName}
                favorites={favorites}
                onExplore={openStationPicker}
                pickerReady={pickerStations.length > 0}
                onRemove={removeFavoriteSpace}
              />
            ) : activeNav === "akun" ? (
              <AccountSettingsSection
                user={user}
                displayName={displayName}
                onLogout={logout}
                onOpenPengajuan={() => setActiveNav("pengajuan")}
                onOpenBantuan={() => setActiveNav("bantuan")}
                onUserUpdated={setUser}
              />
            ) : showComingSoon ? (
              <ComingSoonSection
                displayName={displayName}
                title={NAV_ITEMS.find((item) => item.id === activeNav)?.label ?? "Menu"}
              />
            ) : null}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white px-2 py-2 md:hidden"
        aria-label="Menu mitra mobile"
      >
        {NAV_ITEMS.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const active = activeNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavClick(item.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium ${
                active ? "text-[#c41230]" : "text-slate-500"
              }`}
            >
              <Icon className="size-5" />
              {item.label.split(" ")[0]}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function DashboardOverview({
  displayName,
  loading,
  leads,
  favorites,
  summary,
  onExplore,
  onOpenPengajuan,
  onOpenFavorit,
  pickerReady,
}: {
  displayName: string;
  loading: boolean;
  leads: Lead[];
  favorites: FavoriteSpace[];
  summary: { total: number; active: number; won: number; lost: number };
  onExplore: () => void;
  onOpenPengajuan: () => void;
  onOpenFavorit: () => void;
  pickerReady: boolean;
}) {
  const recentLeads = leads.slice(0, 5);
  const recentFavorites = favorites.slice(0, 3);

  return (
    <>
      <p className="text-base text-slate-600 md:text-lg">
        Halo, <span className="font-semibold text-[#101828]">{displayName}</span>      </p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#101828] md:text-[28px]">
            Dashboard Mitra
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Ringkasan pengajuan, favorit, dan akses cepat ke virtual tour.
          </p>
        </div>
        <button
          type="button"
          onClick={onExplore}
          disabled={!pickerReady}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#c41230] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
        >
          <Glasses className="size-4" />
          Jelajahi Virtual Tour
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Pengajuan"
          value={summary.total}
          caption="Semua pengajuan"
          icon={<ClipboardList className="size-5" />}
          tone="red"
        />
        <MetricCard
          title="Sedang Diproses"
          value={summary.active}
          caption="Menunggu review"
          icon={<Clock3 className="size-5" />}
          tone="orange"
        />
        <MetricCard
          title="Unit Favorit"
          value={favorites.length}
          caption="Disimpan dari tour"
          icon={<Heart className="size-5" />}
          tone="rose"
        />
        <MetricCard
          title="Disetujui"
          value={summary.won}
          caption="Siap lanjut"
          icon={<CheckCircle2 className="size-5" />}
          tone="green"
        />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <QuickAction
          icon={<FileText className="size-5" />}
          title="Pengajuan Sewa"
          description="Lihat semua status minat sewa"
          onClick={onOpenPengajuan}
        />
        <QuickAction
          icon={<Heart className="size-5" />}
          title="Favorit"
          description="Kelola unit yang Anda simpan"
          onClick={onOpenFavorit}
        />
        <QuickAction
          icon={<Plus className="size-5" />}
          title="Ajukan Baru"
          description="Pilih stasiun lalu ajukan unit"
          onClick={onExplore}
          disabled={!pickerReady}
        />
        </div>

      {/* Pengajuan progress — gaya list kartu + timeline */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[#101828]">Pengajuan Saya</h2>
          <button
            type="button"
            onClick={onOpenPengajuan}
            className="text-sm font-semibold text-[#c41230] hover:underline"
          >
            Lihat semua
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">Memuat pengajuan...</div>
        ) : recentLeads.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 px-5 py-10 text-center">
            <p className="text-sm text-slate-500">
              Belum ada pengajuan tenant. Ajukan unit dari virtual tour.
            </p>
            <button
              type="button"
              onClick={onExplore}
              disabled={!pickerReady}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#c41230] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Glasses className="size-4" />
              Jelajahi Virtual Tour
            </button>
          </div>
        ) : (
          <ApplicationProgressList leads={recentLeads} />
        )}
      </section>

      {recentFavorites.length > 0 && (
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-bold text-[#101828]">Favorit Terbaru</h2>
            <button
              type="button"
              onClick={onOpenFavorit}
              className="text-sm font-semibold text-[#c41230] hover:underline"
            >
              Lihat semua
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentFavorites.map((item) => (
              <div key={item.spaceId} className="flex items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#101828]">
                    {item.code} — {item.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.stationName} · {item.area} m²
                  </p>
                </div>
                <Link
                  href={`/station/${item.stationSlug}?unit=${item.spaceId}`}
                  className="shrink-0 text-sm font-semibold text-[#c41230] hover:underline"
                >
                  Buka
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

const PROGRESS_CARD_TONES = [
  { card: "bg-[#e8f1ff]", btn: "bg-[#c4b5fd] hover:bg-[#a78bfa]" },
  { card: "bg-[#f3e8ff]", btn: "bg-[#f9a8d4] hover:bg-[#f472b6]" },
  { card: "bg-[#ffe8e4]", btn: "bg-[#fda4af] hover:bg-[#fb7185]" },
] as const;

function applicationBadge(status: string, createdAt: string) {
  const dateLabel = new Date(createdAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  switch (status) {
    case "COMMERCIAL_OPERATION":
    case "CLOSED_WON":
      return { label: "Operasional", className: "bg-emerald-500 text-white" };
    case "CLOSED_LOST":
      return { label: "Ditolak", className: "bg-red-500 text-white" };
    case "NEGOTIATING":
      return { label: `Negosiasi · ${dateLabel}`, className: "bg-[#1e293b] text-white" };
    case "PKS":
      return { label: `PKS · ${dateLabel}`, className: "bg-indigo-600 text-white" };
    case "FIT_OUT_HANDOVER":
      return { label: `Fit-Out · ${dateLabel}`, className: "bg-violet-600 text-white" };
    case "CONTACTED":
      return { label: `Direview · ${dateLabel}`, className: "bg-[#1e293b] text-white" };
    default:
      return {
        label: `${LEAD_STATUS_LABELS[status as CommercialLeadStatus] ?? "Diajukan"} · ${dateLabel}`,
        className: "bg-[#1C0A0E] text-white",
      };
  }
}

function isApplicationDone(status: string) {
  return isCommercialOperation(status) || status === "CLOSED_LOST";
}

function ApplicationProgressList({ leads }: { leads: Lead[] }) {
  return (
    <div className="relative">
      {/* vertical timeline line */}
      {leads.length > 1 && (
        <div
          className="absolute top-6 bottom-6 left-[11px] w-0.5 bg-[#1e293b]/25 md:left-[13px]"
          aria-hidden
        />
      )}

      <ul className="space-y-3">
        {leads.map((lead, index) => {
          const tone = PROGRESS_CARD_TONES[index % PROGRESS_CARD_TONES.length];
          const badge = applicationBadge(lead.status, lead.createdAt);
          const done = isApplicationDone(lead.status);
          const href = lead.space?.station?.slug
            ? `/station/${lead.space.station.slug}?unit=${lead.space.id}`
            : undefined;

          return (
            <li key={lead.id} className="relative flex gap-3 md:gap-4">
              <div className="relative z-[1] mt-5 flex w-6 shrink-0 justify-center md:w-7">
                <span
                  className={`size-3.5 rounded-full border-2 border-[#1e293b] md:size-4 ${
                    done ? "bg-[#1e293b]" : "bg-white"
                  }`}
                />
              </div>

              <div
                className={`min-w-0 flex-1 rounded-2xl ${tone.card} px-4 py-3.5 sm:px-5 sm:py-4`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-[#101828] sm:text-base">
                      {lead.space?.code ?? "-"} — {lead.space?.name ?? "Unit Komersial"}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600 sm:text-[13px]">
                      {lead.space?.station?.name ?? "Stasiun"}
                      {lead.space?.floor ? ` · ${lead.space.floor}` : ""}
                      {lead.businessType ? ` · ${lead.businessType}` : ""}
                      {lead.space ? ` · ${lead.space.area} m²` : ""}
                    </p>
                    {lead.message && (
                      <p className="mt-1.5 line-clamp-1 text-xs text-slate-500">{lead.message}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold tracking-wide uppercase ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>

                <div className="mt-3 flex items-end justify-between gap-3">
                  <p className="text-xs font-semibold text-slate-500">
                    {lead.space?.monthlyRent && lead.space.monthlyRent > 0
                      ? formatRupiah(lead.space.monthlyRent) + " / bulan"
                      : "Harga: hubungi tim"}
                  </p>
                  {href ? (
                    <Link
                      href={href}
                      className={`inline-flex size-9 items-center justify-center rounded-full text-white shadow-sm transition ${tone.btn}`}
                      aria-label="Lihat unit"
                    >
                      <ArrowUpRight className="size-4" strokeWidth={2.5} />
                    </Link>
                  ) : (
                    <span
                      className={`inline-flex size-9 items-center justify-center rounded-full text-white/70 ${tone.btn}`}
                    >
                      <ArrowUpRight className="size-4" strokeWidth={2.5} />
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function QuickAction({
  icon,
  title,
  description,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#c41230]/30 hover:bg-[#c41230]/[0.02] disabled:opacity-50"
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-[#c41230]/10 text-[#c41230]">
        {icon}
      </span>
      <p className="mt-3 text-sm font-bold text-[#101828]">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </button>
  );
}

function FavoritesSection({
  displayName,
  favorites,
  onExplore,
  pickerReady,
  onRemove,
}: {
  displayName: string;
  favorites: FavoriteSpace[];
  onExplore: () => void;
  pickerReady: boolean;
  onRemove: (spaceId: string) => void;
}) {
  return (
    <>
      <p className="text-base text-slate-600 md:text-lg">
        Halo, <span className="font-semibold text-[#101828]">{displayName}</span>      </p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#101828] md:text-[28px]">
            Unit Favorit
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Unit yang Anda simpan dari virtual tour akan muncul di sini.
          </p>
        </div>
        <button
          type="button"
          onClick={onExplore}
          disabled={!pickerReady}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#c41230] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
        >
          <Glasses className="size-4" />
          Jelajahi Virtual Tour
        </button>
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {favorites.length === 0 ? (
          <div className="grid items-center gap-6 p-6 md:grid-cols-[minmax(0,280px)_1fr] md:gap-10 md:p-8">
            <div className="relative mx-auto flex aspect-[4/3] w-full max-w-[280px] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#c41230]/10 to-slate-100">
              <Heart className="size-16 text-[#c41230]/35" />
            </div>
            <div className="text-center md:text-left">
              <h2 className="text-xl font-bold text-[#101828]">Belum ada favorit.</h2>
              <p className="mt-2 mx-auto max-w-md text-sm leading-relaxed text-slate-500 md:mx-0">
                Saat menjelajah virtual tour, ketuk tombol <strong>Favorit</strong> pada detail unit
                untuk menyimpannya di sini.
              </p>
              <button
                type="button"
                onClick={onExplore}
                disabled={!pickerReady}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#c41230] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                <Glasses className="size-4" />
                Cari Unit di Virtual Tour
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {favorites.map((item) => {
              const priceLabel =
                item.monthlyRent && item.monthlyRent > 0
                  ? `${formatRupiah(item.monthlyRent)} / bulan`
                  : "Hubungi tim";
              return (
                <div
                  key={item.spaceId}
                  className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
                        <Heart className="size-3 fill-current" />
                        Favorit
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(item.savedAt).toLocaleDateString("id-ID")}
                      </span>
                      </div>
                    <h2 className="text-base font-bold text-[#101828]">
                      {item.code} — {item.name}
                      </h2>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" />
                        {item.stationName}
                      </span>
                      <span>{item.area} m²</span>
                      <span>{priceLabel}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onRemove(item.spaceId)}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      Hapus
                    </button>
                    <Link
                      href={`/station/${item.stationSlug}`}
                      className="inline-flex items-center justify-center rounded-lg bg-[#c41230] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                    >
                      Lihat Unit
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

function ComingSoonSection({
  displayName,
  title,
}: {
  displayName: string;
  title: string;
}) {
  return (
    <>
      <p className="text-base text-slate-600 md:text-lg">
        Halo, <span className="font-semibold text-[#101828]">{displayName}</span>      </p>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-[#101828]">{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Fitur ini segera hadir. Sementara itu, pantau pengajuan sewa atau jelajahi virtual tour.
        </p>
    </div>
    </>
  );
}

function MetricCard({
  title,
  value,
  caption,
  icon,
  tone,
}: {
  title: string;
  value: number;
  caption: string;
  icon: React.ReactNode;
  tone: "red" | "orange" | "green" | "rose";
}) {
  const tones = {
    red: "bg-[#c41230]/10 text-[#c41230]",
    orange: "bg-orange-100 text-orange-600",
    green: "bg-emerald-100 text-emerald-600",
    rose: "bg-rose-100 text-rose-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[#101828]">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{caption}</p>
        </div>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          {icon}
        </span>
      </div>
    </div>
  );
}
