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
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type AppToastVariant = "success" | "error" | "info";

export type AppToastInput = {
  type?: AppToastVariant;
  title: string;
  description?: string;
  durationMs?: number;
};

type AppToastItem = {
  id: string;
  type: AppToastVariant;
  title: string;
  description?: string;
};

const APP_TOAST_EVENT = "lrt-app-toast";
const DEFAULT_TOAST_DURATION_MS = 4500;
const MAX_VISIBLE_TOASTS = 3;

type AppToastContextValue = {
  showToast: (input: AppToastInput) => void;
  dismissToast: (id: string) => void;
};

const AppToastContext = createContext<AppToastContextValue | null>(null);

/** Memicu notifikasi toast global dari komponen klien mana pun. */
export function showAppToast(input: AppToastInput) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AppToastInput>(APP_TOAST_EVENT, { detail: input }));
}

/** Mengakses kontrol toast global di dalam AppToastProvider. */
export function useAppToast() {
  const ctx = useContext(AppToastContext);
  if (!ctx) {
    return {
      showToast: showAppToast,
      dismissToast: () => {},
    };
  }
  return ctx;
}

const VARIANT_STYLES: Record<
  AppToastVariant,
  {
    container: string;
    iconWrap: string;
    icon: typeof CheckCircle2;
  }
> = {
  success: {
    container: "border-emerald-200/95 bg-white/95 text-[#101828]",
    iconWrap: "bg-emerald-50 text-emerald-600",
    icon: CheckCircle2,
  },
  error: {
    container: "border-rose-200/95 bg-white/95 text-[#101828]",
    iconWrap: "bg-rose-50 text-[#c41230]",
    icon: AlertCircle,
  },
  info: {
    container: "border-slate-200/95 bg-white/95 text-[#101828]",
    iconWrap: "bg-slate-100 text-slate-700",
    icon: Info,
  },
};

/** Provider & viewport notifikasi atas global yang persisten lintas navigasi Next.js. */
export function AppToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<AppToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const existingTimer = timersRef.current.get(id);
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (input: AppToastInput) => {
      if (typeof window === "undefined") return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const nextItem: AppToastItem = {
        id,
        type: input.type ?? "info",
        title: input.title,
        description: input.description,
      };

      setToasts((prev) => {
        const overflow = prev.length + 1 - MAX_VISIBLE_TOASTS;
        if (overflow > 0) {
          for (const stale of prev.slice(0, overflow)) {
            const staleTimer = timersRef.current.get(stale.id);
            if (staleTimer !== undefined) {
              window.clearTimeout(staleTimer);
              timersRef.current.delete(stale.id);
            }
          }
        }
        return [...prev, nextItem].slice(-MAX_VISIBLE_TOASTS);
      });

      const duration = input.durationMs ?? DEFAULT_TOAST_DURATION_MS;
      if (duration > 0) {
        const timer = window.setTimeout(() => {
          timersRef.current.delete(id);
          setToasts((prev) => prev.filter((item) => item.id !== id));
        }, duration);
        timersRef.current.set(id, timer);
      }
    },
    []
  );

  useEffect(() => {
    const timers = timersRef.current;
    const onToastEvent = (event: Event) => {
      const detail = (event as CustomEvent<AppToastInput>).detail;
      if (detail?.title) {
        showToast(detail);
      }
    };

    window.addEventListener(APP_TOAST_EVENT, onToastEvent);
    return () => {
      window.removeEventListener(APP_TOAST_EVENT, onToastEvent);
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
      timers.clear();
    };
  }, [showToast]);

  const contextValue = useMemo(
    () => ({ showToast, dismissToast }),
    [showToast, dismissToast]
  );

  return (
    <AppToastContext.Provider value={contextValue}>
      {children}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          aria-atomic="true"
          className="pointer-events-none fixed inset-x-0 top-4 z-[150] flex flex-col items-center gap-2 px-4 sm:top-5"
        >
          {toasts.map((toast) => {
            const style = VARIANT_STYLES[toast.type];
            const Icon = style.icon;
            return (
              <div
                key={toast.id}
                role="status"
                className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border px-3.5 py-2.5 shadow-[0_14px_34px_rgba(16,24,40,0.18)] backdrop-blur-md transition-all ${style.container}`}
              >
                <span
                  className={`flex size-8 flex-none items-center justify-center rounded-lg ${style.iconWrap}`}
                >
                  <Icon className="size-4" strokeWidth={1.85} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold sm:text-[13px]">
                    {toast.title}
                  </p>
                  {toast.description && (
                    <p className="truncate text-[11px] text-slate-600 sm:text-xs">
                      {toast.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Tutup notifikasi"
                  className="flex size-7 flex-none items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="size-3.5" strokeWidth={1.75} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </AppToastContext.Provider>
  );
}
