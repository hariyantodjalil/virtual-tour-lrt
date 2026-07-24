"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Clock3,
  ExternalLink,
  FileText,
  Glasses,
  Headset,
  Heart,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  MapPin,
  MessageCircle,
  Plus,
  Settings,
  TrendingUp,
  XCircle,
} from "lucide-react";
import StationPickerModal, {
  type StationPickerItem,
} from "@/components/tour/StationPickerModal";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type Lead = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  businessType: string;
  status: string;
  message: string | null;
  createdAt: string;
  space: {
    code: string;
    name: string;
    type: string;
    area: number;
    station: { name: string; slug: string };
  } | null;
};

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; className: string }
> = {
  NEW: {
    label: "Baru diajukan",
    icon: Clock3,
    className: "border-sky-200 bg-sky-50 text-sky-700",
  },
  CONTACTED: {
    label: "Dihubungi",
    icon: MessageCircle,
    className: "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
  NEGOTIATING: {
    label: "Negosiasi",
    icon: TrendingUp,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  CLOSED_WON: {
    label: "Disetujui",
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  CLOSED_LOST: {
    label: "Ditolak",
    icon: XCircle,
    className: "border-red-200 bg-red-50 text-red-700",
  },
};

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "pengajuan", label: "Pengajuan Sewa", icon: FileText },
  { id: "tour", label: "Virtual Tour", icon: Glasses },
  { id: "favorit", label: "Favorit", icon: Heart },
  { id: "profil", label: "Profil Perusahaan", icon: Building2 },
  { id: "akun", label: "Pengaturan Akun", icon: Settings },
  { id: "bantuan", label: "Bantuan", icon: CircleHelp },
] as const;

export default function PartnerPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerStations, setPickerStations] = useState<StationPickerItem[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<(typeof NAV_ITEMS)[number]["id"]>("dashboard");

  useEffect(() => {
    async function load() {
      const [verifyRes, leadsRes, stationsRes] = await Promise.all([
        fetch("/api/auth/verify"),
        fetch("/api/partner/leads"),
        fetch("/api/stations"),
      ]);

      if (verifyRes.ok) {
        const verify = await verifyRes.json();
        setUser(verify.user);
      }

      if (leadsRes.ok) setLeads(await leadsRes.json());

      if (stationsRes.ok) {
        const stations = (await stationsRes.json()) as Array<{
          slug: string;
          name: string;
          order: number;
          line: string;
        }>;
        setPickerStations(
          stations.map((s) => ({
            slug: s.slug,
            name: s.name,
            order: s.order,
            line: s.line,
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
        ["NEW", "CONTACTED", "NEGOTIATING"].includes(lead.status)
      ).length,
      won: leads.filter((lead) => lead.status === "CLOSED_WON").length,
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
    if (id === "tour" || id === "pengajuan") openStationPicker();
  }

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
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                    active
                      ? "bg-[#c41230]/10 text-[#c41230]"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
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
              <a
                href="/#kontak"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#c41230] px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110"
              >
                <Headset className="size-3.5" />
                Hubungi Kami
              </a>
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
            <p className="text-base text-slate-600 md:text-lg">
              Halo, <span className="font-semibold text-[#101828]">{displayName}</span> 👋
            </p>

            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#101828] md:text-[28px]">
                  Status Pengajuan Sewa
                </h1>
                <p className="mt-1 max-w-xl text-sm text-slate-500">
                  Pantau perkembangan minat sewa yang Anda ajukan dari virtual tour.
                </p>
              </div>
              <button
                type="button"
                onClick={openStationPicker}
                disabled={pickerStations.length === 0}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#c41230] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
              >
                <Plus className="size-4" strokeWidth={2.5} />
                Ajukan Penyewaan Baru
              </button>
            </div>

            {/* Metrics */}
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
                title="Disetujui"
                value={summary.won}
                caption="Siap lanjut"
                icon={<CheckCircle2 className="size-5" />}
                tone="green"
              />
              <MetricCard
                title="Ditolak"
                value={summary.lost}
                caption="Tidak dilanjutkan"
                icon={<XCircle className="size-5" />}
                tone="rose"
              />
            </div>

            {/* Content */}
            <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {loading ? (
                <div className="px-6 py-16 text-center text-sm text-slate-500">
                  Memuat pengajuan...
                </div>
              ) : leads.length === 0 ? (
                <div className="grid items-center gap-6 p-6 md:grid-cols-[minmax(0,280px)_1fr] md:gap-10 md:p-8">
                  <div className="relative mx-auto aspect-[4/3] w-full max-w-[280px] overflow-hidden rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200">
                    <Image
                      src="/brand/landing/space-card.jpg"
                      alt="Area komersial tersedia"
                      fill
                      sizes="280px"
                      className="object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-10">
                      <span className="inline-block rounded bg-[#c41230] px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
                        Space Available
                      </span>
                    </div>
                  </div>

                  <div className="text-center md:text-left">
                    <h2 className="text-xl font-bold text-[#101828]">Belum ada pengajuan.</h2>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500 md:mx-0 mx-auto">
                      Jelajahi Virtual Tour untuk menemukan area komersial yang tersedia, lalu ajukan
                      minat sewa langsung dari unit yang dipilih.
                    </p>
                    <div className="mt-5 flex flex-col items-center gap-3 md:items-start">
                      <button
                        type="button"
                        onClick={openStationPicker}
                        disabled={pickerStations.length === 0}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c41230] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                      >
                        <Glasses className="size-4" />
                        Jelajahi Virtual Tour
                      </button>
                      <button
                        type="button"
                        onClick={openStationPicker}
                        disabled={pickerStations.length === 0}
                        className="text-sm font-semibold text-[#c41230] transition hover:underline disabled:opacity-50"
                      >
                        Lihat Stasiun →
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {leads.map((lead) => {
                    const status = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.NEW;
                    const Icon = status.icon;
                    return (
                      <div
                        key={lead.id}
                        className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                            >
                              <Icon className="size-3" />
                              {status.label}
                            </span>
                            <span className="text-xs text-slate-400">
                              {new Date(lead.createdAt).toLocaleDateString("id-ID")}
                            </span>
                          </div>
                          <h2 className="text-base font-bold text-[#101828]">
                            {lead.space?.code ?? "-"} — {lead.space?.name ?? "Unit Komersial"}
                          </h2>
                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3.5" />
                              {lead.space?.station?.name ?? "-"}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Building2 className="size-3.5" />
                              {lead.businessType}
                            </span>
                            {lead.space && <span>{lead.space.area} m²</span>}
                          </div>
                          {lead.message && (
                            <p className="mt-2 text-sm text-slate-600">{lead.message}</p>
                          )}
                        </div>
                        {lead.space?.station?.slug && (
                          <Link
                            href={`/station/${lead.space.station.slug}`}
                            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Lihat Unit
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* How to */}
            <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between md:p-6">
              <div className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#c41230]/10 text-[#c41230]">
                  <Lightbulb className="size-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-[#101828]">Cara Mengajukan Sewa</h3>
                  <ol className="mt-2 space-y-1 text-sm text-slate-500">
                    <li>
                      <span className="font-semibold text-slate-700">1.</span> Jelajahi stasiun &amp;
                      area komersial lewat Virtual Tour.
                    </li>
                    <li>
                      <span className="font-semibold text-slate-700">2.</span> Pilih unit lalu ajukan
                      minat sewa.
                    </li>
                    <li>
                      <span className="font-semibold text-slate-700">3.</span> Tim kami akan review
                      dan menghubungi Anda.
                    </li>
                  </ol>
                </div>
              </div>
              <Link
                href="/#langkah"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Pelajari Lebih Lanjut
                <ExternalLink className="size-3.5" />
              </Link>
            </section>
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
