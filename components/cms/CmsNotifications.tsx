"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, UserCircle, X } from "lucide-react";

type LeadNotif = {
  id: string;
  companyName: string;
  contactName: string;
  businessType: string;
  status: string;
  createdAt: string;
  space?: { code: string; name: string; station?: { name: string } } | null;
};

const READ_KEY = "cms-notif-read-ids";

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} mnt lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

/**
 * Lonceng notifikasi CMS — lead baru (status NEW) di header.
 */
export default function CmsNotifications() {
  const [open, setOpen] = useState(false);
  const [leads, setLeads] = useState<LeadNotif[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(loadReadIds);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/cms/leads");
        if (!res.ok || !active) return;
        const data = await res.json();
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        const fresh = list
          .filter((l: LeadNotif) => l.status === "NEW")
          .sort(
            (a: LeadNotif, b: LeadNotif) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          .slice(0, 12);
        setLeads(fresh);
      } catch {
        /* ignore */
      } finally {
        if (active) setLoaded(true);
      }
    }

    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  const unread = leads.filter((l) => !readIds.has(l.id));
  const unreadCount = unread.length;

  const markAllRead = () => {
    const next = new Set(readIds);
    for (const l of leads) next.add(l.id);
    setReadIds(next);
    saveReadIds(next);
  };

  const markRead = (id: string) => {
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    saveReadIds(next);
  };

  return (
    <div className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
        aria-label="Notifikasi"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D81435] px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Tutup notifikasi"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#0b1628] shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-white">Notifikasi</p>
                <p className="text-[11px] text-slate-400">
                  {loaded
                    ? unreadCount > 0
                      ? `${unreadCount} lead baru belum dibaca`
                      : "Tidak ada lead baru"
                    : "Memuat..."}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="rounded-lg px-2 py-1 text-[11px] font-semibold text-emerald-300 transition hover:bg-white/5"
                  >
                    Tandai dibaca
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
                  aria-label="Tutup"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <ul className="max-h-[min(60vh,22rem)] overflow-y-auto">
              {leads.length === 0 && loaded && (
                <li className="px-4 py-10 text-center text-sm text-slate-500">
                  Belum ada notifikasi lead baru.
                </li>
              )}
              {leads.map((lead) => {
                const isUnread = !readIds.has(lead.id);
                const station = lead.space?.station?.name;
                const unit = lead.space ? `${lead.space.code} · ${lead.space.name}` : null;
                return (
                  <li key={lead.id} className="border-b border-white/5 last:border-0">
                    <Link
                      href="/cms/leads"
                      onClick={() => {
                        markRead(lead.id);
                        setOpen(false);
                      }}
                      className={`flex gap-3 px-4 py-3 transition hover:bg-white/[0.04] ${
                        isUnread ? "bg-[#D81435]/[0.06]" : ""
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${
                          isUnread
                            ? "bg-[#D81435]/20 text-[#ff6b7a]"
                            : "bg-white/5 text-slate-400"
                        }`}
                      >
                        <UserCircle className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-white">
                            {lead.companyName || lead.contactName}
                          </span>
                          {isUnread && (
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#D81435]" />
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-400">
                          {lead.contactName}
                          {lead.businessType ? ` · ${lead.businessType}` : ""}
                        </span>
                        {(unit || station) && (
                          <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                            {[unit, station].filter(Boolean).join(" · ")}
                          </span>
                        )}
                        <span className="mt-1 block text-[10px] text-slate-500">
                          {timeAgo(lead.createdAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-white/10 p-2">
              <Link
                href="/cms/leads"
                onClick={() => setOpen(false)}
                className="flex h-9 w-full items-center justify-center rounded-xl text-xs font-semibold text-emerald-300 transition hover:bg-white/[0.04]"
              >
                Buka semua leads
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
