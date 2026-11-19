"use client";

import { useTourLanguage } from "@/components/tour/TourLanguageProvider";
import { useMemo, useState } from "react";
import {
  ChevronRight,
  LogOut,
  MessageSquareHeart,
  Search,
  UserRound,
} from "lucide-react";

type UserInfo = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type SettingItem = {
  id: "akun" | "feedback" | "logout";
  title: string;
  description: string;
  icon: React.ElementType;
  kind: "link" | "danger";
};

const SETTING_GROUPS: SettingItem[][] = [
  [
    {
      id: "akun",
      title: "Akun Saya",
      description: "Kelola nama tampilan dan informasi akun Anda.",
      icon: UserRound,
      kind: "link",
    },
  ],
  [
    {
      id: "feedback",
      title: "Feedback",
      description: "Kirim masukan atau saran untuk perbaikan portal mitra.",
      icon: MessageSquareHeart,
      kind: "link",
    },
  ],
  [
    {
      id: "logout",
      title: "Keluar Akun",
      description: "Keluar dari akun Anda pada perangkat ini.",
      icon: LogOut,
      kind: "danger",
    },
  ],
];

const FEEDBACK_TOPICS = [
  "Portal Mitra",
  "Pengajuan Sewa",
  "Virtual Tour",
  "Lainnya",
] as const;

type Props = {
  user: UserInfo | null;
  displayName: string;
  onLogout: () => void;
  onUserUpdated: (user: UserInfo) => void;
};

export default function AccountSettingsSection({
  user,
  displayName,
  onLogout,
  onUserUpdated,
}: Props) {
  const { t } = useTourLanguage();
  const [query, setQuery] = useState("");
  const [activePanel, setActivePanel] = useState<"akun" | "feedback" | null>(null);
  const [nameDraft, setNameDraft] = useState(user?.name ?? "");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SETTING_GROUPS;
    return SETTING_GROUPS.map((group) =>
      group.filter(
        (item) =>
          t(item.title).toLocaleLowerCase().includes(q) ||
          t(item.description).toLocaleLowerCase().includes(q)
      )
    ).filter((group) => group.length > 0);
  }, [query, t]);

  function handleItemClick(item: SettingItem) {
    if (item.kind === "danger" || item.id === "logout") {
      onLogout();
      return;
    }
    if (item.id === "akun") {
      setNameDraft(user?.name ?? "");
    }
    setActivePanel(item.id);
  }

  return (
    <>
      <p className="text-base font-semibold text-[#101828] md:text-lg">
        {t("Halo,")} {displayName}
      </p>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#101828] md:text-[28px]">
            {t("Pengaturan Akun")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t("Kelola profil akun dan kirim feedback ke tim.")}
          </p>
        </div>
        <label className="relative w-full sm:max-w-[240px]">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Cari pengaturan...")}
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
                      {t(item.title)}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 sm:text-[13px]">
                      {t(item.description)}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-slate-300" />
                </button>
              );
            })}
          </div>
        ))}

        {groups.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
            {t("Tidak ada pengaturan yang cocok dengan pencarian.")}
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

      {activePanel === "feedback" && (
        <FeedbackPanel onClose={() => setActivePanel(null)} />
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
  const { t } = useTourLanguage();
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
              <p className="text-xs font-bold tracking-wide text-[#c41230] uppercase">{t("Akun Saya")}</p>
              <h2 className="mt-0.5 text-xl font-bold text-[#101828]">{t("Detail Profil")}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100"
          >
            {t("Tutup")}
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500">{t("Nama")}</label>
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
            <label className="text-xs font-semibold text-slate-500">{t("Peran")}</label>
            <input
              value={user?.role === "MITRA" || !user?.role ? t("Mitra") : user.role}
              readOnly
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600"
            />
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{t(error)}</p> : null}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {t("Batal")}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex-1 rounded-xl bg-[#c41230] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
          >
            {saving ? t("Menyimpan...") : t("Simpan")}
          </button>
        </div>
      </div>
    </div>
  );
}

function FeedbackPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTourLanguage();
  const [topic, setTopic] = useState<(typeof FEEDBACK_TOPICS)[number]>("Portal Mitra");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    const trimmed = message.trim();
    if (trimmed.length < 10) {
      setError("Pesan feedback minimal 10 karakter.");
      return;
    }
    if (trimmed.length > 2000) {
      setError("Pesan feedback maksimal 2000 karakter.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/partner/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, message: trimmed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Gagal mengirim feedback.");
        return;
      }
      setSuccess(true);
      setMessage("");
    } catch {
      setError("Gagal mengirim feedback. Coba lagi.");
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
              <MessageSquareHeart className="size-7" strokeWidth={1.85} />
            </span>
            <div>
              <p className="text-xs font-bold tracking-wide text-[#c41230] uppercase">Feedback</p>
              <h2 className="mt-0.5 text-xl font-bold text-[#101828]">{t("Kirim Masukan")}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100"
          >
            {t("Tutup")}
          </button>
        </div>

        {success ? (
          <div className="mt-5 space-y-4">
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {t("Terima kasih. Feedback Anda sudah tersimpan dan dapat dibaca tim admin.")}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-[#c41230] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              {t("Selesai")}
            </button>
          </div>
        ) : (
          <>
            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="feedback-topic" className="text-xs font-semibold text-slate-500">
                  {t("Topik")}
                </label>
                <select
                  id="feedback-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value as (typeof FEEDBACK_TOPICS)[number])}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#c41230] focus:ring-2 focus:ring-[#c41230]/20"
                >
                  {FEEDBACK_TOPICS.map((item) => (
                    <option key={item} value={item}>
                      {t(item)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="feedback-message" className="text-xs font-semibold text-slate-500">
                  {t("Pesan")}
                </label>
                <textarea
                  id="feedback-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  maxLength={2000}
                  placeholder={t("Ceritakan kendala, saran, atau pengalaman Anda memakai portal mitra.")}
                  className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-[#c41230] focus:ring-2 focus:ring-[#c41230]/20"
                />
                <p className="mt-1 text-right text-[11px] text-slate-400">{message.trim().length}/2000</p>
              </div>
            </div>

            {error ? <p className="mt-3 text-sm text-red-600">{t(error)}</p> : null}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {t("Batal")}
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={saving}
                className="flex-1 rounded-xl bg-[#c41230] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
              >
                {saving ? t("Mengirim...") : t("Kirim Feedback")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
