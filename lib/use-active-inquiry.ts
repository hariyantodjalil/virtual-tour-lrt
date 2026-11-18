"use client";

import { useEffect, useState } from "react";
import { z } from "zod";

const responseSchema = z.object({ id: z.string().min(1) }).nullable();

export function useActiveInquiry(userId: string | undefined, spaceId?: string, trainRentalSpaceId?: string) {
  const key = JSON.stringify([userId, spaceId, trainRentalSpaceId]);
  const enabled = Boolean(userId && (spaceId || trainRentalSpaceId));
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; id: string | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const query = new URLSearchParams(trainRentalSpaceId ? { trainRentalSpaceId } : { spaceId: spaceId ?? "" });
    async function load() {
      try {
        const response = await fetch(`/api/partner/leads/active?${query}`, {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("Pengajuan aktif belum dapat diperiksa.");
        const inquiry = responseSchema.parse(await response.json());
        if (!controller.signal.aborted) setResult({ key, id: inquiry?.id ?? null, error: null });
      } catch {
        if (!controller.signal.aborted) setResult({ key, id: null, error: "Pengajuan aktif belum dapat diperiksa." });
      }
    }
    void load();
    return () => controller.abort();
  }, [enabled, key, spaceId, trainRentalSpaceId, attempt]);

  return {
    checking: enabled && result?.key !== key,
    id: enabled && result?.key === key ? result.id : null,
    error: enabled && result?.key === key ? result.error : null,
    retry: () => { setResult(null); setAttempt(value => value + 1); },
  };
}
