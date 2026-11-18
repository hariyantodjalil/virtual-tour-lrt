"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { cmsFetch } from "@/lib/cms-fetch";
import { cmsUi } from "@/lib/cms-ui";
import { resolvePublicAssetUrl, shouldUnoptimizeImage } from "@/lib/s3-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import CmsMediaSearch from "@/components/cms/CmsMediaSearch";
import { LayoutGrid, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import {
  TRAIN_RENTAL_STATUS_LABELS,
  TRAIN_RENTAL_STATUS_VALUES,
  emptyCarTrainsetMap,
  formatCarTrainsetSummary,
  isTrainRentalStatus,
  parseCarTrainsetMap,
  trainRentalStatusBadgeClass,
  unionCarTrainsets,
  type CarTrainsetMap,
  type TrainRentalStatus,
} from "@/lib/train-rental-sales";
import TrainCarTrainsetPicker from "@/components/train/TrainCarTrainsetPicker";

type TrainSpace = {
  id: string;
  displayNumber: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  objectPosition: string;
  availableTrainsets: string[];
  availableByCar: CarTrainsetMap;
  howToOrder: string | null;
  inquiryMode?: "MEDIA" | "FULL_BRANDING";
  status: TrainRentalStatus;
  monthlyRent: number | null;
  order: number;
  isActive: boolean;
};

function createDraft(order: number): TrainSpace {
  const nextNumber = String(order + 1).padStart(2, "0");
  return {
    id: "",
    displayNumber: nextNumber,
    title: "",
    description: "",
    imageUrl: "",
    objectPosition: "50% 50%",
    availableTrainsets: [],
    availableByCar: emptyCarTrainsetMap(),
    howToOrder: "",
    inquiryMode: "MEDIA",
    status: "TERSEDIA",
    monthlyRent: null,
    order,
    isActive: true,
  };
}

function toPayload(space: TrainSpace) {
  const availableByCar = parseCarTrainsetMap(space.availableByCar, space.availableTrainsets);
  return {
    displayNumber: space.displayNumber.trim(),
    title: space.title.trim(),
    inquiryMode: space.inquiryMode ?? "MEDIA",
    description: space.description?.trim() || null,
    imageUrl: space.imageUrl?.trim() || null,
    objectPosition: space.objectPosition.trim() || "50% 50%",
    availableTrainsets: unionCarTrainsets(availableByCar),
    availableByCar,
    howToOrder: space.howToOrder?.trim() || null,
    status: space.status,
    monthlyRent: space.monthlyRent == null || Number.isNaN(Number(space.monthlyRent))
      ? null
      : Number(space.monthlyRent),
    order: Number(space.order) || 0,
    isActive: Boolean(space.isActive),
  };
}

export default function TrainSpacesClient() {
  const [spaces, setSpaces] = useState<TrainSpace[]>([]);
  const [editing, setEditing] = useState<TrainSpace | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { confirmDialog, confirmElement } = useConfirmDialog();

  async function load() {
    const response = await cmsFetch("/api/cms/train-rental-spaces");
    if (!response.ok) return;
    const data = await response.json().catch(() => null);
    setSpaces(
      Array.isArray(data)
        ? data.map((item: TrainSpace) => ({
            ...item,
            availableTrainsets: Array.isArray(item.availableTrainsets) ? item.availableTrainsets : [],
            availableByCar: parseCarTrainsetMap(
              (item as TrainSpace).availableByCar,
              Array.isArray(item.availableTrainsets) ? item.availableTrainsets : []
            ),
            howToOrder: item.howToOrder ?? "",
            status: isTrainRentalStatus(item.status) ? item.status : "TERSEDIA",
            monthlyRent: item.monthlyRent ?? null,
          }))
        : []
    );
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function openCreate() {
    setEditing(createDraft(spaces.length));
    setMessage("");
    setError("");
  }

  function openEdit(space: TrainSpace) {
    setEditing({
      ...space,
      description: space.description ?? "",
      howToOrder: space.howToOrder ?? "",
      availableTrainsets: space.availableTrainsets ?? [],
      availableByCar: parseCarTrainsetMap(space.availableByCar, space.availableTrainsets ?? []),
    });
    setMessage("");
    setError("");
  }

  async function saveSpace() {
    if (!editing) return;

    if (!editing.displayNumber.trim()) {
      setError("Nomor tampilan wajib diisi.");
      return;
    }
    if (!editing.title.trim()) {
      setError("Judul wajib diisi.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    const isNew = !editing.id;
    const response = await cmsFetch(
      isNew ? "/api/cms/train-rental-spaces" : `/api/cms/train-rental-spaces/${editing.id}`,
      {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(editing)),
      }
    ).catch(() => null);

    if (!response?.ok) {
      const data = await response?.json().catch(() => null);
      setError(data?.error ?? "Gagal menyimpan ruang sewa.");
      setSaving(false);
      return;
    }

    setEditing(null);
    setMessage(isNew ? "Ruang sewa baru ditambahkan." : "Perubahan disimpan.");
    setSaving(false);
    await load();
  }

  async function deleteSpace(id: string) {
    if (!(await confirmDialog({
      title: "Hapus ruang sewa ini?",
      description: "Ruang sewa dan konfigurasinya akan dihapus dari landing train virtual tour.",
      confirmLabel: "Ya, Hapus",
      destructive: true,
    }))) return;

    const response = await cmsFetch(`/api/cms/train-rental-spaces/${id}`, {
      method: "DELETE",
    }).catch(() => null);

    if (!response?.ok) {
      setError("Gagal menghapus ruang sewa.");
      return;
    }

    setMessage("Ruang sewa dihapus.");
    await load();
  }

  async function uploadImage(file: File) {
    if (!editing?.id) {
      setError("Simpan ruang sewa terlebih dahulu sebelum upload gambar.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await cmsFetch(`/api/cms/train-rental-spaces/${editing.id}`, {
      method: "POST",
      body: formData,
    }).catch(() => null);

    if (!response?.ok) {
      const data = await response?.json().catch(() => null);
      setError(data?.error ?? "Gagal upload gambar.");
      return;
    }

    const data = await response.json();
    setEditing((current) =>
      current ? { ...current, imageUrl: data.space?.imageUrl ?? current.imageUrl } : current
    );
    setMessage("Gambar berhasil diupload.");
    await load();
  }

  const getSpaceSearchText = useCallback(
    (space: TrainSpace) =>
      [
        space.displayNumber,
        space.title,
        space.description ?? "",
        TRAIN_RENTAL_STATUS_LABELS[space.status],
        space.isActive ? "" : "nonaktif",
        formatCarTrainsetSummary(
          parseCarTrainsetMap(space.availableByCar, space.availableTrainsets),
          [],
          []
        ),
      ].join(" "),
    []
  );

  return (
    <div className="mx-auto max-w-6xl">
      {message ? (
        <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-[var(--work-success)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-[var(--work-danger)]">
          {error}
        </p>
      ) : null}

      <CmsMediaSearch
        items={spaces}
        placeholder="Cari nomor, judul, status, atau trainset…"
        emptyLabel="Belum ada ruang train rental."
        getSearchText={getSpaceSearchText}
        toolbar={
          <Button onClick={openCreate} className={cmsUi.primaryBtn}>
            <Plus className="mr-2 size-4" />
            Tambah Ruang
          </Button>
        }
      >
        {(filtered) => (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((space) => {
              const thumb = space.imageUrl ? resolvePublicAssetUrl(space.imageUrl) : null;
              const trainsetSummary = formatCarTrainsetSummary(
                parseCarTrainsetMap(space.availableByCar, space.availableTrainsets),
                [],
                []
              );
              const hasTrainsets =
                unionCarTrainsets(parseCarTrainsetMap(space.availableByCar, space.availableTrainsets))
                  .length > 0;

              return (
                <Card key={space.id} className={`overflow-hidden p-0 ${cmsUi.card}`}>
                  <div className={`relative aspect-[16/10] ${cmsUi.void}`}>
                    {thumb ? (
                      <Image
                        src={thumb}
                        alt={space.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                        className="object-cover"
                        style={{ objectPosition: space.objectPosition }}
                        unoptimized={shouldUnoptimizeImage(thumb)}
                      />
                    ) : (
                      <div className={`flex h-full items-center justify-center ${cmsUi.muted}`}>
                        <LayoutGrid className="size-8 opacity-40" />
                      </div>
                    )}
                    <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                      <Badge
                        variant="outline"
                        className={`bg-[var(--work-surface)]/95 ${trainRentalStatusBadgeClass(space.status)}`}
                      >
                        {TRAIN_RENTAL_STATUS_LABELS[space.status]}
                      </Badge>
                      {!space.isActive ? (
                        <Badge
                          variant="outline"
                          className={`bg-[var(--work-surface)]/95 ${cmsUi.inactiveBadge}`}
                        >
                          Nonaktif
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <CardContent className="space-y-3 p-4">
                    <div>
                      <p className="font-semibold tracking-tight text-[var(--work-text)]">
                        {space.displayNumber} · {space.title}
                      </p>
                      <p className={`mt-0.5 text-xs ${cmsUi.muted}`}>Urutan {space.order + 1}</p>
                      {hasTrainsets ? (
                        <p className={`mt-1 line-clamp-2 text-xs ${cmsUi.muted}`}>{trainsetSummary}</p>
                      ) : (
                        <p className={`mt-1 text-xs italic ${cmsUi.muted}`}>
                          Belum diatur trainset (TS).
                        </p>
                      )}
                      {space.description ? (
                        <p className={`mt-1 line-clamp-2 text-sm ${cmsUi.muted}`}>{space.description}</p>
                      ) : null}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cmsUi.outlineBtn}
                        onClick={() => openEdit(space)}
                      >
                        <Pencil className="mr-1.5 size-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-red-300 text-red-700 hover:bg-red-50"
                        onClick={() => void deleteSpace(space.id)}
                        aria-label={`Hapus ${space.title}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CmsMediaSearch>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-[var(--work-line)] bg-[var(--work-subtle)] p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--work-text)]">
                {editing.id ? "Edit Ruang Sewa" : "Tambah Ruang Sewa"}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg p-1 text-[var(--work-muted)] hover:bg-[var(--work-subtle)] hover:text-[var(--work-text)]"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-[var(--work-muted)]">Nomor Tampilan</Label>
                  <Input
                    value={editing.displayNumber}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, displayNumber: event.target.value } : current
                      )
                    }
                    placeholder="01"
                    className="mt-1.5 border-[var(--work-line)] bg-[var(--work-subtle)]"
                  />
                </div>
                <div>
                  <Label className="text-[var(--work-muted)]">Urutan</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editing.order}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, order: Number(event.target.value) || 0 } : current
                      )
                    }
                    className="mt-1.5 border-[var(--work-line)] bg-[var(--work-subtle)]"
                  />
                </div>
              </div>

              <div>
                <Label className="text-[var(--work-muted)]">Judul</Label>
                <Input
                  value={editing.title}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, title: event.target.value } : current
                    )
                  }
                  placeholder="Handgrip"
                  className="mt-1.5 border-[var(--work-line)] bg-[var(--work-subtle)]"
                />
              </div>

              <div>
                <Label className="text-[var(--work-muted)]">Deskripsi Detail</Label>
                <Textarea
                  value={editing.description ?? ""}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, description: event.target.value } : current
                    )
                  }
                  rows={4}
                  placeholder="Jelaskan ruang sewa ini untuk calon mitra iklan..."
                  className="mt-1.5 border-[var(--work-line)] bg-[var(--work-subtle)]"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-[var(--work-muted)]">Jenis pengajuan</Label>
                  <select value={editing.inquiryMode ?? "MEDIA"} onChange={event => {
                    const value = event.target.value;
                    if (value === "MEDIA" || value === "FULL_BRANDING") setEditing(current => current ? { ...current, inquiryMode: value } : current);
                  }} className="mt-1.5 mb-4 h-11 w-full rounded-md border border-[var(--work-line)] bg-[var(--work-subtle)] px-3 text-sm text-[var(--work-text)]">
                    <option value="MEDIA">Media iklan</option><option value="FULL_BRANDING">Full branding</option>
                  </select>
                  <Label className="text-[var(--work-muted)]">Status Penjualan</Label>
                  <select
                    value={editing.status}
                    onChange={(event) =>
                      setEditing((current) =>
                        current && isTrainRentalStatus(event.target.value)
                          ? { ...current, status: event.target.value }
                          : current
                      )
                    }
                    className="mt-1.5 h-10 w-full rounded-md border border-[var(--work-line)] bg-[var(--work-subtle)] px-3 text-sm text-[var(--work-text)]"
                  >
                    {TRAIN_RENTAL_STATUS_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {TRAIN_RENTAL_STATUS_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-[var(--work-muted)]">Harga sewa / bulan (opsional)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editing.monthlyRent ?? ""}
                    onChange={(event) =>
                      setEditing((current) =>
                        current
                          ? {
                              ...current,
                              monthlyRent: event.target.value === "" ? null : Number(event.target.value),
                            }
                          : current
                      )
                    }
                    placeholder="Kosongkan jika nego"
                    className="mt-1.5 border-[var(--work-line)] bg-[var(--work-subtle)]"
                  />
                </div>
              </div>

              <div>
                <Label className="text-[var(--work-muted)]">Tersedia di gerbong & train set</Label>
                <div className="mt-1.5">
                  <TrainCarTrainsetPicker
                    value={parseCarTrainsetMap(editing.availableByCar, editing.availableTrainsets)}
                    onChange={(availableByCar) =>
                      setEditing((current) =>
                        current
                          ? {
                              ...current,
                              availableByCar,
                              availableTrainsets: unionCarTrainsets(availableByCar),
                            }
                          : current
                      )
                    }
                  />
                </div>
              </div>

              <div>
                <Label className="text-[var(--work-muted)]">Cara Pemesanan</Label>
                <Textarea
                  value={editing.howToOrder ?? ""}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, howToOrder: event.target.value } : current
                    )
                  }
                  rows={3}
                  placeholder="Contoh: Hubungi tim komersial via WhatsApp, sebutkan jenis media dan nomor TS yang diinginkan."
                  className="mt-1.5 border-[var(--work-line)] bg-[var(--work-subtle)]"
                />
              </div>

              <div>
                <Label className="text-[var(--work-muted)]">Posisi Crop Gambar (object-position)</Label>
                <Input
                  value={editing.objectPosition}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, objectPosition: event.target.value } : current
                    )
                  }
                  placeholder="50% 50%"
                  className="mt-1.5 border-[var(--work-line)] bg-[var(--work-subtle)]"
                />
                <p className="mt-1 text-xs text-[var(--work-muted)]">
                  Contoh: 50% 12% (horizontal vertical). Atur fokus crop gambar di kartu carousel.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="space-active"
                  type="checkbox"
                  checked={editing.isActive}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, isActive: event.target.checked } : current
                    )
                  }
                  className="size-4 rounded border-[var(--work-line)]"
                />
                <Label htmlFor="space-active" className="text-[var(--work-muted)]">
                  Tampilkan di carousel publik
                </Label>
              </div>

              {editing.id ? (
                <div>
                  <Label className="text-[var(--work-muted)]">Gambar Kartu</Label>
                  <div className="mt-1.5 flex items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--work-line)] px-3 py-2 text-sm text-[var(--work-text)] hover:bg-[var(--work-subtle)]">
                      <Upload className="size-4" />
                      Upload Gambar
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadImage(file);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    {editing.imageUrl ? (
                      <span className="truncate text-xs text-[var(--work-muted)]">{editing.imageUrl}</span>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--work-muted)]">
                  Simpan dulu untuk mengupload gambar. Sebelum upload, kartu memakai gambar default.
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-[var(--work-line)]"
                  onClick={() => setEditing(null)}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  disabled={saving}
                  className={cmsUi.primaryBtn}
                  onClick={() => void saveSpace()}
                >
                  {saving ? "Menyimpan..." : "Simpan"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {confirmElement}
    </div>
  );
}
