"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { cmsUi } from "@/lib/cms-ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props<T> = {
  items: T[];
  getSearchText: (item: T) => string;
  placeholder?: string;
  emptyLabel?: string;
  noMatchLabel?: string;
  toolbar?: ReactNode;
  children: (filtered: T[]) => ReactNode;
};

export default function CmsMediaSearch<T>({
  items,
  getSearchText,
  placeholder = "Cari…",
  emptyLabel = "Belum ada data.",
  noMatchLabel = "Tidak ada hasil untuk pencarian ini.",
  toolbar,
  children,
}: Props<T>) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => getSearchText(item).toLowerCase().includes(needle));
  }, [getSearchText, items, query]);

  const hasQuery = query.trim().length > 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search
            className={`pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 ${cmsUi.muted}`}
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className={`pl-9 pr-9 ${cmsUi.input}`}
            aria-label={placeholder}
          />
          {hasQuery ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
              onClick={() => setQuery("")}
              aria-label="Hapus pencarian"
            >
              <X className="size-3.5" />
            </Button>
          ) : null}
        </div>
        {hasQuery ? (
          <p className={`text-xs ${cmsUi.muted}`}>
            {filtered.length} dari {items.length}
          </p>
        ) : null}
        {toolbar ? <div className="ml-auto flex flex-wrap items-center gap-2">{toolbar}</div> : null}
      </div>

      {items.length === 0 ? (
        <p className={`rounded-xl border border-dashed ${cmsUi.hairline} px-4 py-10 text-center text-sm ${cmsUi.muted}`}>
          {emptyLabel}
        </p>
      ) : filtered.length === 0 ? (
        <p className={`rounded-xl border border-dashed ${cmsUi.hairline} px-4 py-10 text-center text-sm ${cmsUi.muted}`}>
          {noMatchLabel}
        </p>
      ) : (
        children(filtered)
      )}
    </div>
  );
}
