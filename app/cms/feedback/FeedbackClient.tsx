"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, MessageSquareHeart, RefreshCw, Search } from "lucide-react";
import { cmsFetch } from "@/lib/cms-fetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type FeedbackItem = {
  id: string;
  topic: string;
  message: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

export default function FeedbackClient({
  initialFeedbacks,
  initialError,
}: {
  initialFeedbacks: FeedbackItem[];
  initialError: string | null;
}) {
  const [feedbacks, setFeedbacks] = useState(initialFeedbacks);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return feedbacks;
    return feedbacks.filter((item) =>
      [item.topic, item.message, item.user.name, item.user.email]
        .join(" ")
        .toLowerCase()
        .includes(text)
    );
  }, [feedbacks, query]);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const res = await cmsFetch("/api/cms/feedback", { cache: "no-store" });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data)) {
        throw new Error("Data feedback gagal dimuat.");
      }
      setFeedbacks(data as FeedbackItem[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat feedback.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari topik, pesan, atau mitra..."
            className="pl-9"
          />
        </div>
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void reload()}>
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} />
          {loading ? "Memuat…" : "Muat ulang"}
        </Button>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Feedback tidak dapat dimuat</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareHeart className="size-4 text-[#E31E2D]" aria-hidden />
            Masukan Mitra
          </CardTitle>
          <CardDescription>
            {filtered.length} dari {feedbacks.length} feedback tersimpan
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
              Belum ada feedback dari mitra.
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
              {filtered.map((item) => (
                <li key={item.id} className="px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                          {item.topic}
                        </Badge>
                        <p className="text-sm font-semibold text-slate-900">
                          {item.user.name || "Mitra"}
                        </p>
                      </div>
                      <p className="mt-1 break-all text-xs text-slate-500">{item.user.email}</p>
                    </div>
                    <p className="shrink-0 text-xs text-slate-500">
                      {new Date(item.createdAt).toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {item.message}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
