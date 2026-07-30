"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronRight,
  CircleHelp,
  CreditCard,
  FileText,
  Lock,
  LogOut,
  MessageSquareHeart,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";

type UserInfo = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type SettingItem = {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  kind: "link" | "toggle" | "danger";
};

/** Grup sesuai Figma (tanpa banner Upgrade & tanpa Profil Perusahaan). */
const SETTING_GROUPS: SettingItem[][] = [
  [
    {
      id: "akun",
      title: "Akun Saya",
      description: "Kelola informasi profil dan akun Anda.",
      icon: UserRound,
      kind: "link",
    },
    {
      id: "pengajuan",
      title: "Pengajuan",
      description: "Kelola preferensi dan pengaturan pengajuan sewa.",
      icon: FileText,
      kind: "link",
    },
    {
      id: "pembayaran",
      title: "Metode Pembayaran",
      description: "Kelola rekening dan metode pembayaran Anda.",
      icon: CreditCard,
      kind: "link",
    },
    {
      id: "2fa",
      title: "Autentikasi Dua Faktor (2FA)",
      description: "Tingkatkan keamanan akun Anda.",
      icon: ShieldCheck,
      kind: "toggle",
    },
  ],
  [
    {
      id: "preferensi",
      title: "Preferensi",
      description: "Atur preferensi tampilan dan notifikasi.",
      icon: Bell,
      kind: "link",
    },
    {
      id: "privasi",
      title: "Privasi & Keamanan",
      description: "Kelola privasi data dan keamanan akun.",
      icon: Lock,
      kind: "link",
    },
    {
      id: "bantuan",
      title: "Bantuan & Dukungan",
      description: "Pusat bantuan, panduan, dan hubungi kami.",
      icon: CircleHelp,
      kind: "link",
    },
  ],
  [
    {
      id: "feedback",
      title: "Feedback",
      description: "Berikan masukan untuk kami.",
      icon: MessageSquareHeart,
      kind: "link",
    },
    {
      id: "logout",
      title: "Keluar Akun",
      description: "Keluar dari akun Anda pada perangkat ini.",
      icon: LogOut,
      kind: "danger",
    },
  ],
];

type Props = {
  user: UserInfo | null;
  displayName: string;
  onLogout: () => void;
  onOpenPengajuan: () => void;
  onOpenBantuan: () => void;
  onUserUpdated: (user: UserInfo) => void;
};

export default function AccountSettingsSection({
  user,
  displayName,
  onLogout,
  onOpenPengajuan,
  onOpenBantuan,
  onUserUpdated,
}: Props) {
  const [query, setQuery] = useState("");
  const [twoFactor, setTwoFactor] = useState(true);
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState(user?.name ?? "");

  useEffect(() => {
    setNameDraft(user?.name ?? "");
  }, [user?.name]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SETTING_GROUPS;
    return SETTING_GROUPS.map((group) =>
      group.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
      )
    ).filter((group) => group.length > 0);
  }, [query]);

  function handleItemClick(item: SettingItem) {
    if (item.kind === "toggle") return;
    if (item.kind === "danger") {
      onLogout();
      return;
    }
    if (item.id === "pengajuan") {
      onOpenPengajuan();
      return;
    }
    if (item.id === "bantuan") {
      onOpenBantuan();
      return;
    }
    setActivePanel(item.id);
  }

  return (
    <>
      <p className="text-base font-semibold text-[#101828] md:text-lg">
        Halo, {displayName}      </p>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#101828] md:text-[28px]">
            Pengaturan Akun
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola informasi akun dan preferensi Anda.
          </p>
        </div>
        <label className="relative w-full sm:max-w-[240px]">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari pengaturan..."
            className="h-10 w-full rounded-full border border-slate-200 bg-white pr-3 pl-9 text-sm text-[#101828] outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
          />
        </label>
      </div>

      <div className="mt-6 space-y-4">
        {groups.map((group, groupIndex) => (
          <div
            key={`group-${groupIndex}`}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            {group.map((item, index) => {
              const Icon = item.icon;
              const isLast = index === group.length - 1;
              const isDanger = item.kind === "danger";
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className={`flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition sm:gap-4 sm:px-5 sm:py-4 ${
                    !isLast ? "border-b border-slate-100" : ""
                  } ${isDanger ? "hover:bg-red-50/50" : "hover:bg-slate-50/80"}`}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#fce8eb]">
                    <Icon className="size-[18px] text-[#c41230]" strokeWidth={2} color="#c41230" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm font-semibold ${
                        isDanger ? "text-[#c41230]" : "text-[#101828]"
                      }`}
                    >
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 sm:text-[13px]">
                      {item.description}
                    </span>
                  </span>
                  {item.kind === "toggle" ? (
                    <span
                      role="switch"
                      aria-checked={twoFactor}
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTwoFactor((v) => !v);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          setTwoFactor((v) => !v);
                        }
                      }}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                        twoFactor ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${
                          twoFactor ? "left-[22px]" : "left-0.5"
                        }`}
                      />
                    </span>
                  ) : (
                    <ChevronRight className="size-5 shrink-0 text-slate-300" />
                  )}
                </button>
              );
            })}
          </div>
        ))}

        {groups.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
            Tidak ada pengaturan yang cocok dengan pencarian.
          </div>
        )}
      </div>

      {activePanel === "akun" && (
        <AccountDetailPanel
          user={user}
          nameDraft={nameDraft}
          onNameChange={setNameDraft}
          onClose={() => setActivePanel(null)}
          onSaved={(nextUser) => {
            onUserUpdated(nextUser);
            setNameDraft(nextUser.name);
            setActivePanel(null);
          }}
        />
      )}

      {activePanel && activePanel !== "akun" && (
        <SimplePanel
          title={
            SETTING_GROUPS.flat().find((s) => s.id === activePanel)?.title ?? "Pengaturan"
          }
          description={
            SETTING_GROUPS.flat().find((s) => s.id === activePanel)?.description ??
            "Fitur ini segera tersedia."
          }
          onClose={() => setActivePanel(null)}
        />
      )}
    </>
  );
}

function AccountDetailPanel({
  user,
  nameDraft,
  onNameChange,
  onClose,
  onSaved,
}: {
  user: UserInfo | null;
  nameDraft: string;
  onNameChange: (value: string) => void;
  onClose: () => void;
  onSaved: (user: UserInfo) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    const name = nameDraft.trim();
    if (name.length < 2) {
      setError("Nama minimal 2 karakter.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/partner/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Gagal menyimpan nama.");
        return;
      }
      onSaved(data.user as UserInfo);
    } catch {
      setError("Gagal menyimpan nama. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#fce8eb] text-[#c41230]">
              <UserRound className="size-7" strokeWidth={1.85} />
            </span>
            <div>
              <p className="text-xs font-bold tracking-wide text-[#c41230] uppercase">Akun Saya</p>
              <h2 className="mt-0.5 text-xl font-bold text-[#101828]">Detail Profil</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100"
          >
            Tutup
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500">Nama</label>
            <input
              value={nameDraft}
              onChange={(e) => onNameChange(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-[#c41230] focus:ring-2 focus:ring-[#c41230]/20"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Email</label>
            <input
              value={user?.email ?? ""}
              readOnly
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Peran</label>
            <input
              value={user?.role ?? "MITRA"}
              readOnly
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-xl bg-[#c41230] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SimplePanel({
  title,
  description,
  onClose,
}: {
  title: string;
  description: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-[#101828]">{title}</h2>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Fitur ini sedang disiapkan. Untuk kebutuhan mendesak, hubungi tim leasing lewat menu
          Bantuan.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-[#c41230] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
        >
          Mengerti
        </button>
      </div>
    </div>
  );
}
