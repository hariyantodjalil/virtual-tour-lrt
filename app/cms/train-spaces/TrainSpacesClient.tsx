"use client";

import { useEffect, useState } from "react";
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
import { LayoutGrid, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import {
  TRAIN_RENTAL_STATUS_LABELS,
  TRAIN_RENTAL_STATUS_VALUES,
  emptyCarTrainsetMap,
  formatCarTrainsetSummary,
  isTrainRentalStatus,
  parseCarTrainsetMap,
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
    if (!window.confirm("Hapus ruang sewa ini?")) return;

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

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-end gap-4">
        <Button onClick={openCreate} className={cmsUi.primaryBtn}>
          <Plus className="mr-2 size-4" />
          Tambah Ruang
        </Button>
      </div>

      {message ? (
        <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3">
        {spaces.map((space) => (
          <Card key={space.id} className="border-[rgba(255,214,218,0.14)] bg-[#3A161C] text-[#F8ECEE]">
            <CardContent className="grid gap-4 p-4 sm:grid-cols-[88px_minmax(0,1fr)_auto] sm:items-center">
              <div className="relative h-24 w-full overflow-hidden rounded-lg bg-[#261015] sm:h-[88px] sm:w-[88px]">
                {space.imageUrl ? (
                  <Image
                    src={resolvePublicAssetUrl(space.imageUrl)}
                    alt={space.title}
                    fill
                    sizes="88px"
                    className="object-cover"
                    style={{ objectPosition: space.objectPosition }}
                    unoptimized={shouldUnoptimizeImage(resolvePublicAssetUrl(space.imageUrl))}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[#A88990]">
                    <LayoutGrid className="size-6" />
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-white">
                    {space.displayNumber} · {space.title}
                  </p>
                  <Badge
                    variant="outline"
                    className={space.isActive ? cmsUi.successBadge : cmsUi.inactiveBadge}
                  >
                    {space.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                  <Badge variant="outline" className={cmsUi.outlineBadge}>
                    {TRAIN_RENTAL_STATUS_LABELS[space.status]}
                  </Badge>
                  <span className="text-xs text-[#A88990]">Urutan {space.order + 1}</span>
                </div>
                {unionCarTrainsets(parseCarTrainsetMap(space.availableByCar, space.availableTrainsets)).length === 0 ? (
                  <p className="mb-1 text-xs italic text-[#A88990]">Belum diatur trainset (TS) mana yang tersedia.</p>
                ) : (
                  <p className="mb-1 text-xs text-[#C4A8AD]">
                    {formatCarTrainsetSummary(parseCarTrainsetMap(space.availableByCar, space.availableTrainsets))}
                  </p>
                )}
                {space.description ? (
                  <p className="line-clamp-2 text-sm text-[#C4A8AD]">{space.description}</p>
                ) : (
                  <p className="text-sm italic text-[#A88990]">Belum ada deskripsi detail.</p>
                )}
              </div>

              <div className="flex items-center gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[rgba(255,214,218,0.14)]"
                  onClick={() => openEdit(space)}
                >
                  <Pencil className="mr-1.5 size-3.5" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[rgba(255,214,218,0.14)] text-red-400 hover:text-red-300"
                  onClick={() => void deleteSpace(space.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {editing.id ? "Edit Ruang Sewa" : "Tambah Ruang Sewa"}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg p-1 text-[#C4A8AD] hover:bg-[#261015] hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-[#F0DDE1]">Nomor Tampilan</Label>
                  <Input
                    value={editing.displayNumber}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, displayNumber: event.target.value } : current
                      )
                    }
                    placeholder="01"
                    className="mt-1.5 border-[rgba(255,214,218,0.14)] bg-[#1C0A0E]"
                  />
                </div>
                <div>
                  <Label className="text-[#F0DDE1]">Urutan</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editing.order}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, order: Number(event.target.value) || 0 } : current
                      )
                    }
                    className="mt-1.5 border-[rgba(255,214,218,0.14)] bg-[#1C0A0E]"
                  />
                </div>
              </div>

              <div>
                <Label className="text-[#F0DDE1]">Judul</Label>
                <Input
                  value={editing.title}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, title: event.target.value } : current
                    )
                  }
                  placeholder="Handgrip"
                  className="mt-1.5 border-[rgba(255,214,218,0.14)] bg-[#1C0A0E]"
                />
              </div>

              <div>
                <Label className="text-[#F0DDE1]">Deskripsi Detail</Label>
                <Textarea
                  value={editing.description ?? ""}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, description: event.target.value } : current
                    )
                  }
                  rows={4}
                  placeholder="Jelaskan ruang sewa ini untuk calon mitra iklan..."
                  className="mt-1.5 border-[rgba(255,214,218,0.14)] bg-[#1C0A0E]"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-[#F0DDE1]">Status Penjualan</Label>
                  <select
                    value={editing.status}
                    onChange={(event) =>
                      setEditing((current) =>
                        current && isTrainRentalStatus(event.target.value)
                          ? { ...current, status: event.target.value }
                          : current
                      )
                    }
                    className="mt-1.5 h-10 w-full rounded-md border border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] px-3 text-sm text-white"
                  >
                    {TRAIN_RENTAL_STATUS_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {TRAIN_RENTAL_STATUS_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-[#F0DDE1]">Harga sewa / bulan (opsional)</Label>
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
                    className="mt-1.5 border-[rgba(255,214,218,0.14)] bg-[#1C0A0E]"
                  />
                </div>
              </div>

              <div>
                <Label className="text-[#F0DDE1]">Tersedia di gerbong & train set</Label>
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
                <Label className="text-[#F0DDE1]">Cara Pemesanan</Label>
                <Textarea
                  value={editing.howToOrder ?? ""}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, howToOrder: event.target.value } : current
                    )
                  }
                  rows={3}
                  placeholder="Contoh: Hubungi tim komersial via WhatsApp, sebutkan jenis media dan nomor TS yang diinginkan."
                  className="mt-1.5 border-[rgba(255,214,218,0.14)] bg-[#1C0A0E]"
                />
              </div>

              <div>
                <Label className="text-[#F0DDE1]">Posisi Crop Gambar (object-position)</Label>
                <Input
                  value={editing.objectPosition}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, objectPosition: event.target.value } : current
                    )
                  }
                  placeholder="50% 50%"
                  className="mt-1.5 border-[rgba(255,214,218,0.14)] bg-[#1C0A0E]"
                />
                <p className="mt-1 text-xs text-[#A88990]">
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
                  className="size-4 rounded border-[rgba(255,214,218,0.18)]"
                />
                <Label htmlFor="space-active" className="text-[#F0DDE1]">
                  Tampilkan di carousel publik
                </Label>
              </div>

              {editing.id ? (
                <div>
                  <Label className="text-[#F0DDE1]">Gambar Kartu</Label>
                  <div className="mt-1.5 flex items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[rgba(255,214,218,0.14)] px-3 py-2 text-sm text-[#F8ECEE] hover:bg-[#261015]">
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
                      <span className="truncate text-xs text-[#C4A8AD]">{editing.imageUrl}</span>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#A88990]">
                  Simpan dulu untuk mengupload gambar. Sebelum upload, kartu memakai gambar default.
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-[rgba(255,214,218,0.14)]"
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
    </div>
  );
}
