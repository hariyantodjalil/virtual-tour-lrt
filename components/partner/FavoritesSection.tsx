"use client";

import { useState } from "react";
import Link from "next/link";
import { Glasses, Heart, MapPin } from "lucide-react";
import PartnerSectionHeader from "@/components/partner/PartnerSectionHeader";
import { SPACE_STATUS_LABELS } from "@/lib/commercial-pipeline";
import type { FavoriteSpace } from "@/lib/favorite-spaces";

type Props = {
  displayName: string;
  favorites: FavoriteSpace[];
  onExplore: () => void;
  pickerReady: boolean;
  onRemove: (spaceId: string) => Promise<void> | void;
};

/** Halaman daftar unit komersial favorit yang disimpan mitra dari Virtual Tour & beranda. */
export default function FavoritesSection({
  displayName,
  favorites,
  onExplore,
  pickerReady,
  onRemove,
}: Props) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState("");

  async function handleRemove(spaceId: string) {
    if (removingId) return;
    setRemovingId(spaceId);
    setRemoveError("");
    try {
      await onRemove(spaceId);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Gagal menghapus unit dari favorit.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <>
      <PartnerSectionHeader
        displayName={displayName}
        title="Unit Favorit"
        subtitle="Unit yang Anda simpan di akun Mitra akan tersinkron di sini"
        onExplore={onExplore}
        pickerReady={pickerReady}
      />

      {removeError && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700"
        >
          {removeError}
        </p>
      )}

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {favorites.length === 0 ? (
          <div className="grid items-center gap-6 p-6 md:grid-cols-[minmax(0,280px)_1fr] md:gap-10 md:p-8">
            <div className="relative mx-auto flex aspect-[4/3] w-full max-w-[280px] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#c41230]/10 to-slate-100">
              <Heart className="size-16 text-[#c41230]/35" />
            </div>
            <div className="text-center md:text-left">
              <h2 className="text-xl font-bold text-[#101828]">Belum ada favorit.</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500 md:mx-0">
                Saat menjelajah virtual tour atau katalog beranda, ketuk tombol{" "}
                <strong>Favorit</strong> pada unit untuk menyimpannya di akun Anda.
              </p>
              <button
                type="button"
                onClick={onExplore}
                disabled={!pickerReady}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#c41230] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                <Glasses className="size-4" />
                Cari Unit di Virtual Tour
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {favorites.map((item) => {
              const statusLabel =
                (SPACE_STATUS_LABELS as Record<string, string>)[item.status] ?? item.status;
              const isAvailable = item.status === "TERSEDIA";
              return (
                <div
                  key={item.spaceId}
                  className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
                        <Heart className="size-3 fill-current" />
                        Favorit
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          isAvailable
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-50 text-slate-600"
                        }`}
                      >
                        {statusLabel}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(item.savedAt).toLocaleDateString("id-ID")}
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-[#101828]">
                      {item.code} — {item.name}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" />
                        Stasiun {item.stationName}
                      </span>
                      <span>{item.area} m²</span>
                      {item.location && <span>{item.location}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRemove(item.spaceId)}
                      disabled={removingId === item.spaceId}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      {removingId === item.spaceId ? "Menghapus..." : "Hapus"}
                    </button>
                    <Link
                      href={`/station/${encodeURIComponent(item.stationSlug)}?unit=${encodeURIComponent(item.spaceId)}`}
                      className="inline-flex items-center justify-center rounded-lg bg-[#c41230] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                    >
                      Lihat Unit
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
