"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

type Notice = { type: "ok" | "err"; message: string };

export function useEditorNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const showToast = useCallback((type: Notice["type"], message: string) => {
    clearTimeout(timer.current);
    setNotice({ type, message });
    timer.current = setTimeout(() => setNotice(null), type === "err" ? 6500 : 3500);
  }, []);

  return { notice, showToast };
}

export function EditorNotice({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  const failed = notice.type === "err";
  const Icon = failed ? AlertCircle : CheckCircle2;
  const tone = failed ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900";
  return (
    <div role={failed ? "alert" : "status"} className={`pointer-events-none fixed bottom-5 left-1/2 z-[105] flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${tone}`}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 break-words">{notice.message}</span>
    </div>
  );
}
