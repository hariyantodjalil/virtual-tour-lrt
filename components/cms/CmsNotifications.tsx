"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CalendarDays, UserCircle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CMS_LEADS_UPDATED_EVENT } from "@/lib/inquiry-sync-events";
import { useInquiryRealtimeSync } from "@/components/realtime/useInquiryRealtimeSync";
import { cn } from "@/lib/utils";

type LeadNotif = {
  id: string;
  companyName: string;
  contactName: string;
  businessType: string;
  status: string;
  siteVisitStatus?: string | null;
  siteVisitScheduledAt?: string | null;
  surveyPreference?: string | null;
  createdAt: string;
  updatedAt?: string;
  space?: { code: string; name: string; station?: { name: string } } | null;
};

type NotifKind = "NEW_LEAD" | "SITE_VISIT";

type NotifItem = LeadNotif & {
  kind: NotifKind;
  sortAt: string;
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

function notifKey(item: Pick<NotifItem, "kind" | "id">) {
  return `${item.kind}:${item.id}`;
}

/** Baca: key baru `kind:id`, plus legacy github `id` untuk pengajuan baru. */
function isUnread(readIds: Set<string>, item: NotifItem) {
  if (readIds.has(notifKey(item))) return false;
  if (item.kind === "NEW_LEAD" && readIds.has(item.id)) return false;
  return true;
}

function markItemRead(readIds: Set<string>, item: NotifItem) {
  const next = new Set(readIds);
  next.add(notifKey(item));
  if (item.kind === "NEW_LEAD") next.add(item.id);
  return next;
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

function visitScheduleLabel(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return (
    date.toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }) + " WIB"
  );
}

/**
 * Antrean lonceng CMS:
 * - NEW → pengajuan baru
 * - siteVisitStatus REQUESTED → site visit menunggu jadwal admin
 * Item hilang otomatis saat status berubah (NEW diproses / visit dijadwalkan).
 */
function buildNotifications(list: LeadNotif[]): NotifItem[] {
  const items: NotifItem[] = [];
  for (const lead of list) {
    if (lead.status === "NEW") {
      items.push({
        ...lead,
        kind: "NEW_LEAD",
        sortAt: lead.createdAt,
      });
      continue;
    }
    if (lead.siteVisitStatus === "REQUESTED") {
      items.push({
        ...lead,
        kind: "SITE_VISIT",
        sortAt: lead.updatedAt || lead.createdAt,
      });
    }
  }
  return items
    .sort(
      (a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime()
    )
    .slice(0, 16);
}

async function fetchLeadNotifications(): Promise<NotifItem[] | null> {
  try {
    const res = await fetch("/api/cms/leads", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const list = Array.isArray(data) ? (data as LeadNotif[]) : [];
    return buildNotifications(list);
  } catch {
    return null;
  }
}

function itemHref(item: NotifItem) {
  const base = `/cms/leads/${encodeURIComponent(item.id)}`;
  return item.kind === "SITE_VISIT" ? `${base}#site-visit` : base;
}

export default function CmsNotifications() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(loadReadIds);
  const [loaded, setLoaded] = useState(false);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  const loadItems = useCallback(async () => {
    const fresh = await fetchLeadNotifications();
    if (fresh) setItems(fresh);
    setLoaded(true);
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      const fresh = await fetchLeadNotifications();
      if (!active) return;
      if (fresh) setItems(fresh);
      setLoaded(true);
    }
    void init();
    return () => {
      active = false;
    };
  }, []);

  useInquiryRealtimeSync({
    enabled: true,
    localEvents: [CMS_LEADS_UPDATED_EVENT],
    fallbackIntervalMs: 60_000,
    onSync: loadItems,
  });

  const unread = items.filter((item) => isUnread(readIds, item));
  const unreadCount = unread.length;

  const markAllRead = () => {
    let next = readIds;
    for (const item of items) next = markItemRead(next, item);
    setReadIds(next);
    saveReadIds(next);
  };

  const markRead = (item: NotifItem) => {
    const next = markItemRead(readIds, item);
    setReadIds(next);
    saveReadIds(next);
  };

  return (
    <div
      className="relative"
      onKeyDown={(event) => {
        if (open && event.key === "Escape") close();
      }}
    >
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        className="relative border-slate-200 bg-white text-slate-700 hover:border-[#E31E2D]/40 hover:bg-[#E31E2D] hover:text-white"
        aria-label="Notifikasi"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            variant="default"
            className="absolute -top-1.5 -right-1.5 h-4 min-w-4 justify-center rounded-full px-1 text-xs leading-none"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </Button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            tabIndex={-1}
            aria-hidden="true"
            onClick={close}
          />
          <section
            id={panelId}
            aria-label="Notifikasi"
            className="absolute top-full right-0 z-50 mt-2 flex max-h-[calc(100dvh-5.5rem)] w-[min(calc(100cqw-2rem),22rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-slate-900">Notifikasi</p>
                <p className="text-xs text-slate-600">
                  {loaded
                    ? unreadCount > 0
                      ? `${unreadCount} belum dibaca`
                      : "Tidak ada notifikasi baru"
                    : "Memuat..."}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={markAllRead}
                    className="h-8 px-2 text-xs text-[#C41926] hover:bg-slate-50 hover:text-[#C41926]"
                  >
                    Tandai dibaca
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={close}
                  className="h-8 w-8 text-slate-500 hover:text-slate-900"
                  aria-label="Tutup"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ul className="min-h-0 max-h-[min(60vh,22rem)] overflow-y-auto overscroll-contain">
              {items.length === 0 && loaded && (
                <li className="px-4 py-10 text-center text-sm text-slate-500">
                  Belum ada notifikasi.
                </li>
              )}
              {items.map((item) => {
                const key = notifKey(item);
                const unreadItem = isUnread(readIds, item);
                const station = item.space?.station?.name;
                const unit = item.space
                  ? `${item.space.code} · ${item.space.name}`
                  : null;
                const Icon =
                  item.kind === "SITE_VISIT" ? CalendarDays : UserCircle;
                const schedule = visitScheduleLabel(item.siteVisitScheduledAt);
                const preference = item.surveyPreference?.trim() || null;

                return (
                  <li
                    key={key}
                    className="border-b border-slate-200 last:border-0"
                  >
                    <Link
                      href={itemHref(item)}
                      onClick={() => {
                        markRead(item);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex gap-3 px-4 py-3 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#D81435]",
                        unreadItem && "bg-[#c41230]/[0.08]"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
                          unreadItem
                            ? "bg-[#c41230]/20 text-[#c41230]"
                            : "bg-slate-100 text-slate-500"
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-slate-900">
                            {item.companyName || item.contactName}
                          </span>
                          {unreadItem && (
                            <span
                              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#c41230]"
                              aria-hidden
                            />
                          )}
                        </span>

                        {item.kind === "SITE_VISIT" ? (
                          <>
                            <Badge
                              variant="outline"
                              className="mt-1 border-[#E31E2D]/30 bg-white px-1.5 py-0 text-xs font-semibold text-[#C41926]"
                            >
                              Site visit diajukan
                            </Badge>
                            <span className="mt-1 block truncate text-xs font-medium text-slate-800">
                              {schedule
                                ? `Jadwal: ${schedule}`
                                : preference
                                  ? preference
                                  : "Menunggu jadwal dari admin"}
                            </span>
                          </>
                        ) : (
                          <span className="mt-0.5 block truncate text-xs text-slate-600">
                            {item.contactName}
                            {item.businessType ? ` · ${item.businessType}` : ""}
                          </span>
                        )}

                        {(unit || station) && (
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {[unit, station].filter(Boolean).join(" · ")}
                          </span>
                        )}
                        <span className="mt-1 block text-xs text-slate-500">
                          {timeAgo(item.sortAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="shrink-0 border-t border-slate-200 p-2">
              <Button
                asChild
                variant="ghost"
                className="h-9 w-full text-xs font-semibold text-[#C41926] hover:bg-slate-50 hover:text-[#C41926]"
              >
                <Link href="/cms/leads" onClick={close}>
                  Buka semua leads
                </Link>
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
