import { randomUUID } from "node:crypto";
import type { Client as PgClient } from "pg";
import { prisma } from "@/lib/prisma";
import type {
  InquirySyncEvent,
  InquirySyncEventKind,
} from "@/lib/inquiry-sync-events";

const PG_NOTIFY_CHANNEL = "lrt_inquiry_events";
const MAX_SEEN_EVENT_IDS = 200;
const PG_RECONNECT_DELAY_MS = 3_000;
const PG_IDLE_CLOSE_DELAY_MS = 30_000;

type EventSubscriber = (event: InquirySyncEvent) => void;

type RealtimeBusState = {
  subscribers: Set<EventSubscriber>;
  seenEventIds: string[];
  seenEventSet: Set<string>;
  pgClient: PgClient | null;
  pgConnecting: Promise<void> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  idleCloseTimer: ReturnType<typeof setTimeout> | null;
};

const globalForRealtime = globalThis as unknown as {
  __lrtRealtimeBus?: RealtimeBusState;
};

function getBusState(): RealtimeBusState {
  if (!globalForRealtime.__lrtRealtimeBus) {
    globalForRealtime.__lrtRealtimeBus = {
      subscribers: new Set<EventSubscriber>(),
      seenEventIds: [],
      seenEventSet: new Set<string>(),
      pgClient: null,
      pgConnecting: null,
      reconnectTimer: null,
      idleCloseTimer: null,
    };
  }
  return globalForRealtime.__lrtRealtimeBus;
}

function markEventSeen(bus: RealtimeBusState, eventId: string): boolean {
  if (bus.seenEventSet.has(eventId)) return false;

  bus.seenEventSet.add(eventId);
  bus.seenEventIds.push(eventId);
  if (bus.seenEventIds.length > MAX_SEEN_EVENT_IDS) {
    const oldest = bus.seenEventIds.shift();
    if (oldest) bus.seenEventSet.delete(oldest);
  }
  return true;
}

function dispatchToLocalSubscribers(event: InquirySyncEvent) {
  const bus = getBusState();
  if (!markEventSeen(bus, event.eventId)) return;

  for (const subscriber of bus.subscribers) {
    try {
      subscriber(event);
    } catch {
      // Abaikan error listener tunggal agar tidak memblokir subscriber lain.
    }
  }
}

function schedulePgReconnect(bus: RealtimeBusState) {
  if (bus.reconnectTimer || bus.subscribers.size === 0) return;
  bus.reconnectTimer = setTimeout(() => {
    bus.reconnectTimer = null;
    if (bus.subscribers.size > 0) {
      void ensurePgListener();
    }
  }, PG_RECONNECT_DELAY_MS);
}

async function closePgClient(bus: RealtimeBusState) {
  const client = bus.pgClient;
  bus.pgClient = null;
  if (!client) return;
  try {
    await client.end();
  } catch {
    // Abaikan error saat menutup koneksi idle.
  }
}

async function ensurePgListener() {
  const bus = getBusState();
  if (bus.pgClient || bus.subscribers.size === 0) return;
  if (bus.pgConnecting) {
    await bus.pgConnecting;
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;

  bus.pgConnecting = (async () => {
    let client: PgClient | null = null;
    try {
      const { Client } = await import("pg");
      client = new Client({ connectionString });

      client.on("notification", (msg) => {
        if (msg.channel !== PG_NOTIFY_CHANNEL || !msg.payload) return;
        try {
          const parsed = JSON.parse(msg.payload) as InquirySyncEvent;
          if (!parsed?.eventId || !parsed?.kind) return;
          dispatchToLocalSubscribers(parsed);
        } catch {
          // Abaikan payload NOTIFY yang tidak valid.
        }
      });

      const handleDisconnect = () => {
        if (bus.pgClient === client) {
          bus.pgClient = null;
          schedulePgReconnect(bus);
        }
      };

      client.on("error", handleDisconnect);
      client.on("end", handleDisconnect);

      await client.connect();
      await client.query(`LISTEN ${PG_NOTIFY_CHANNEL}`);

      if (bus.subscribers.size === 0) {
        await client.end().catch(() => {});
        return;
      }

      bus.pgClient = client;
    } catch {
      if (client) {
        await client.end().catch(() => {});
      }
      schedulePgReconnect(bus);
    } finally {
      bus.pgConnecting = null;
    }
  })();

  await bus.pgConnecting;
}

/**
 * Mendaftarkan subscriber real-time server untuk event pengajuan & tenancy.
 * Membuka koneksi PG LISTEN secara lazy hanya selama ada klien SSE aktif.
 */
export function subscribeInquiryEvents(subscriber: EventSubscriber): () => void {
  const bus = getBusState();
  if (bus.idleCloseTimer) {
    clearTimeout(bus.idleCloseTimer);
    bus.idleCloseTimer = null;
  }

  bus.subscribers.add(subscriber);
  void ensurePgListener();

  return () => {
    bus.subscribers.delete(subscriber);
    if (bus.subscribers.size === 0) {
      if (bus.reconnectTimer) {
        clearTimeout(bus.reconnectTimer);
        bus.reconnectTimer = null;
      }
      if (!bus.idleCloseTimer) {
        bus.idleCloseTimer = setTimeout(() => {
          bus.idleCloseTimer = null;
          if (bus.subscribers.size === 0) {
            void closePgClient(bus);
          }
        }, PG_IDLE_CLOSE_DELAY_MS);
      }
    }
  };
}

/**
 * Memancarkan event perubahan data secara lokal sekaligus lintas worker via PG NOTIFY.
 * Tidak melempar error jika transport notifikasi sedang gagal agar mutasi API tetap sukses.
 */
export async function publishInquiryEvent(input: {
  kind: InquirySyncEventKind;
  leadId?: string;
  userId?: string | null;
}) {
  const event: InquirySyncEvent = {
    eventId: randomUUID(),
    kind: input.kind,
    leadId: input.leadId,
    userId: input.userId ?? null,
    occurredAt: new Date().toISOString(),
  };

  dispatchToLocalSubscribers(event);

  try {
    const payload = JSON.stringify(event);
    if (Buffer.byteLength(payload, "utf8") <= 7_500) {
      await prisma.$executeRaw`SELECT pg_notify(${PG_NOTIFY_CHANNEL}, ${payload})`;
    }
  } catch (error) {
    console.warn("[realtime-events] pg_notify skipped", error);
  }
}
