"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cmsFetch } from "@/lib/cms-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid, Pencil, Plus, Trash2, Upload, X } from "lucide-react";

type TrainSpace = {
  id: string;
  displayNumber: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  objectPosition: string;
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
    order,
    isActive: true,
  };
}

function toPayload(space: TrainSpace) {
  return {
    displayNumber: space.displayNumber.trim(),
    title: space.title.trim(),
    description: space.description?.trim() || null,
    imageUrl: space.imageUrl?.trim() || null,
    objectPosition: space.objectPosition.trim() || "50% 50%",
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
    setSpaces(Array.isArray(data) ? data : []);
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
    setEditing({ ...space, description: space.description ?? "" });
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
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Train Rental Space</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Kelola kartu carousel &quot;Apa yang Ingin Anda Sewa?&quot; di landing train virtual tour.
            Setiap item punya nomor, judul, gambar, dan deskripsi detail.
          </p>
        </div>
        <Button onClick={openCreate} className="bg-[#d32f2f] hover:bg-[#b71c1c]">
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
          <Card key={space.id} className="border-slate-800 bg-slate-900">
            <CardContent className="grid gap-4 p-4 sm:grid-cols-[88px_minmax(0,1fr)_auto] sm:items-center">
              <div className="relative h-24 w-full overflow-hidden rounded-lg bg-slate-800 sm:h-[88px] sm:w-[88px]">
                {space.imageUrl ? (
                  <Image
                    src={space.imageUrl}
                    alt={space.title}
                    fill
                    sizes="88px"
                    className="object-cover"
                    style={{ objectPosition: space.objectPosition }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-500">
                    <LayoutGrid className="size-6" />
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-white">
                    {space.displayNumber} · {space.title}
                  </p>
                  <Badge variant={space.isActive ? "default" : "secondary"}>
                    {space.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                  <span className="text-xs text-slate-500">Urutan {space.order + 1}</span>
                </div>
                {space.description ? (
                  <p className="line-clamp-2 text-sm text-slate-400">{space.description}</p>
                ) : (
                  <p className="text-sm italic text-slate-500">Belum ada deskripsi detail.</p>
                )}
              </div>

              <div className="flex items-center gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-slate-700"
                  onClick={() => openEdit(space)}
                >
                  <Pencil className="mr-1.5 size-3.5" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-slate-700 text-red-400 hover:text-red-300"
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
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {editing.id ? "Edit Ruang Sewa" : "Tambah Ruang Sewa"}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-slate-300">Nomor Tampilan</Label>
                  <Input
                    value={editing.displayNumber}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, displayNumber: event.target.value } : current
                      )
                    }
                    placeholder="01"
                    className="mt-1.5 border-slate-700 bg-slate-800"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Urutan</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editing.order}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, order: Number(event.target.value) || 0 } : current
                      )
                    }
                    className="mt-1.5 border-slate-700 bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <Label className="text-slate-300">Judul</Label>
                <Input
                  value={editing.title}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, title: event.target.value } : current
                    )
                  }
                  placeholder="Handgrip"
                  className="mt-1.5 border-slate-700 bg-slate-800"
                />
              </div>

              <div>
                <Label className="text-slate-300">Deskripsi Detail</Label>
                <Textarea
                  value={editing.description ?? ""}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, description: event.target.value } : current
                    )
                  }
                  rows={4}
                  placeholder="Jelaskan ruang sewa ini untuk calon mitra iklan..."
                  className="mt-1.5 border-slate-700 bg-slate-800"
                />
              </div>

              <div>
                <Label className="text-slate-300">Posisi Crop Gambar (object-position)</Label>
                <Input
                  value={editing.objectPosition}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, objectPosition: event.target.value } : current
                    )
                  }
                  placeholder="50% 50%"
                  className="mt-1.5 border-slate-700 bg-slate-800"
                />
                <p className="mt-1 text-xs text-slate-500">
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
                  className="size-4 rounded border-slate-600"
                />
                <Label htmlFor="space-active" className="text-slate-300">
                  Tampilkan di carousel publik
                </Label>
              </div>

              {editing.id ? (
                <div>
                  <Label className="text-slate-300">Gambar Kartu</Label>
                  <div className="mt-1.5 flex items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
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
                      <span className="truncate text-xs text-slate-400">{editing.imageUrl}</span>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Simpan dulu untuk mengupload gambar. Sebelum upload, kartu memakai gambar default.
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-slate-700"
                  onClick={() => setEditing(null)}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  disabled={saving}
                  className="bg-[#d32f2f] hover:bg-[#b71c1c]"
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
