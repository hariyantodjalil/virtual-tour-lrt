"use client";

import { useEffect, useRef, useState } from "react";
import type { InquirySyncEvent } from "@/lib/inquiry-sync-events";

export type SyncReason = "sse" | "reconnect" | "focus" | "poll" | "local";

type UseInquiryRealtimeSyncOptions = {
  enabled?: boolean;
  leadId?: string;
  fallbackIntervalMs?: number;
  minFocusSyncGapMs?: number;
  localEvents?: readonly string[];
  onSync: (reason: SyncReason, event?: InquirySyncEvent) => void | Promise<void>;
};

const SSE_STALE_HEARTBEAT_MS = 65_000;

/**
 * Sinkronisasi hybrid CMS ↔ Portal Mitra:
 * 1. SSE `/api/events/inquiries` (push < 1 detik)
 * 2. Revalidate saat tab fokus / online
 * 3. Polling fallback hanya jika SSE terputus & tab aktif
 */
export function useInquiryRealtimeSync({
  enabled = true,
  leadId,
  fallbackIntervalMs = 15_000,
  minFocusSyncGapMs = 2_000,
  localEvents,
  onSync,
}: UseInquiryRealtimeSyncOptions) {
  const [liveConnected, setLiveConnected] = useState(false);
  const onSyncRef = useRef(onSync);
  const localEventsKey = localEvents?.join("|") ?? "";

  useEffect(() => {
    onSyncRef.current = onSync;
  }, [onSync]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    let disposed = false;
    let sse: EventSource | null = null;
    let sseConnected = false;
    let hasOpenedOnce = false;
    let lastHeartbeatAt = Date.now();
    let lastSyncAt = Date.now();
    let inFlight = false;
    let queuedSync: { reason: SyncReason; event?: InquirySyncEvent } | null =
      null;

    const executeSync = async (
      reason: SyncReason,
      event?: InquirySyncEvent,
      forceImmediate = false
    ) => {
      if (disposed) return;
      const now = Date.now();
      if (!forceImmediate && now - lastSyncAt < minFocusSyncGapMs) {
        return;
      }

      if (inFlight) {
        queuedSync = { reason, event };
        return;
      }

      inFlight = true;
      lastSyncAt = now;
      try {
        await onSyncRef.current(reason, event);
      } catch {
        // Pertahankan data terakhir saat sync latar gagal sementara.
      } finally {
        inFlight = false;
        const pending = queuedSync;
        queuedSync = null;
        if (pending && !disposed) {
          void executeSync(pending.reason, pending.event, true);
        }
      }
    };

    const connectSse = () => {
      if (disposed || typeof EventSource === "undefined") return;
      if (sse) {
        sse.close();
        sse = null;
      }

      const source = new EventSource("/api/events/inquiries");
      sse = source;

      source.addEventListener("open", () => {
        if (disposed) return;
        const isReconnect = hasOpenedOnce;
        hasOpenedOnce = true;
        sseConnected = true;
        lastHeartbeatAt = Date.now();
        setLiveConnected(true);
        if (isReconnect) {
          void executeSync("reconnect", undefined, true);
        }
      });

      source.addEventListener("connected", () => {
        if (disposed) return;
        lastHeartbeatAt = Date.now();
        sseConnected = true;
        setLiveConnected(true);
      });

      source.addEventListener("ping", () => {
        if (disposed) return;
        lastHeartbeatAt = Date.now();
        sseConnected = true;
        setLiveConnected(true);
      });

      source.addEventListener("inquiry", (message) => {
        if (disposed) return;
        lastHeartbeatAt = Date.now();
        try {
          const payload = JSON.parse(
            (message as MessageEvent<string>).data
          ) as InquirySyncEvent;
          if (leadId && payload.leadId && payload.leadId !== leadId) {
            return;
          }
          void executeSync("sse", payload, true);
        } catch {
          // Abaikan event yang gagal di-parse.
        }
      });

      source.addEventListener("error", () => {
        if (disposed) return;
        sseConnected = false;
        setLiveConnected(false);
      });
    };

    connectSse();

    const handleVisibilityOrFocus = () => {
      if (disposed || document.visibilityState !== "visible") return;
      if (sse && sse.readyState === EventSource.CLOSED) {
        connectSse();
      }
      void executeSync("focus", undefined, false);
    };

    const handleOnline = () => {
      if (disposed) return;
      if (!sse || sse.readyState === EventSource.CLOSED) {
        connectSse();
      }
      void executeSync("focus", undefined, true);
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("online", handleOnline);

    const localEventNames = localEventsKey
      ? localEventsKey.split("|").filter(Boolean)
      : [];
    const handleLocalEvent = () => {
      void executeSync("local", undefined, true);
    };
    for (const eventName of localEventNames) {
      window.addEventListener(eventName, handleLocalEvent);
    }

    const fallbackTimer = window.setInterval(() => {
      if (disposed || document.visibilityState !== "visible") return;

      if (sseConnected && Date.now() - lastHeartbeatAt > SSE_STALE_HEARTBEAT_MS) {
        sseConnected = false;
        setLiveConnected(false);
        connectSse();
        void executeSync("poll", undefined, false);
        return;
      }

      if (!sseConnected) {
        void executeSync("poll", undefined, false);
      }
    }, fallbackIntervalMs);

    return () => {
      disposed = true;
      window.clearInterval(fallbackTimer);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("online", handleOnline);
      for (const eventName of localEventNames) {
        window.removeEventListener(eventName, handleLocalEvent);
      }
      if (sse) {
        sse.close();
        sse = null;
      }
    };
  }, [enabled, leadId, fallbackIntervalMs, minFocusSyncGapMs, localEventsKey]);

  return { liveConnected: enabled ? liveConnected : false };
}
