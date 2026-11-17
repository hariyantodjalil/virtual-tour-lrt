import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { subscribeInquiryEvents } from "@/lib/realtime-events";
import type { InquirySyncEvent } from "@/lib/inquiry-sync-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_INTERVAL_MS = 25_000;

/**
 * Stream Server-Sent Events (SSE) untuk sinkronisasi otomatis status pengajuan,
 * dokumen, antrean admin, dan notifikasi real-time lintas sesi.
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["MITRA", "ADMIN", "EDITOR"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const isStaff = auth.user.role === "ADMIN" || auth.user.role === "EDITOR";
  const currentUserId = auth.user.userId;
  const encoder = new TextEncoder();

  let cleanupFn: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
      let unsubscribe: (() => void) | null = null;

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
        request.signal.removeEventListener("abort", cleanup);
        try {
          controller.close();
        } catch {
          // Stream sudah ditutup oleh runtime/klien.
        }
      };

      cleanupFn = cleanup;

      const sendFrame = (eventName: string, payload: unknown) => {
        if (closed) return;
        try {
          const chunk = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      const onEvent = (event: InquirySyncEvent) => {
        if (!isStaff) {
          if (!event.userId || event.userId !== currentUserId) return;
        }
        sendFrame("inquiry", event);
      };

      unsubscribe = subscribeInquiryEvents(onEvent);
      heartbeatTimer = setInterval(() => {
        sendFrame("ping", { ts: Date.now() });
      }, HEARTBEAT_INTERVAL_MS);

      request.signal.addEventListener("abort", cleanup);
      sendFrame("connected", { ok: true, ts: Date.now() });
    },
    cancel() {
      cleanupFn?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "private, no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
