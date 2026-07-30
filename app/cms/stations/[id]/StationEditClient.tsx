"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import { cmsFetch } from "@/lib/cms-fetch";
import { ArrowLeft, Upload } from "lucide-react";

export type StationEditData = {
  id: string;
  code: string | null;
  name: string;
  slug: string;
  line: string;
  address: string;
  location: string | null;
  dailyPassengers: number;
  description: string | null;
  commercialContactPhone: string | null;
  imageUrl: string | null;
  order: number;
  isActive: boolean;
};

export default function StationEditClient({ initialStation }: { initialStation: StationEditData }) {
  const [station, setStation] = useState(initialStation);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setIsError(false);
    try {
      const res = await cmsFetch(`/api/cms/stations/${station.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: station.code || null,
          name: station.name,
          slug: station.slug,
          line: station.line,
          address: station.address,
          location: station.location || null,
          dailyPassengers: station.dailyPassengers,
          description: station.description || null,
          commercialContactPhone: station.commercialContactPhone || null,
          order: station.order,
          isActive: station.isActive,
        }),
      });
      const data = await res.json().catch(() => null);
      setIsError(!res.ok);
      setMessage(res.ok ? "Perubahan stasiun berhasil disimpan." : data?.error ?? "Gagal menyimpan.");
    } catch {
      setIsError(true);
      setMessage("Gagal terhubung ke server.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const res = await cmsFetch(`/api/cms/stations/${station.id}/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (res.ok) {
      setStation({ ...station, imageUrl: data.imageUrl });
      setMessage("Foto berhasil diupload");
    }
  }

  return (
    <div>
      <Button asChild variant="ghost" className="mb-4 text-slate-300">
        <Link href="/cms/stations">
          <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
        </Link>
      </Button>
      <h1 className="text-2xl font-bold mb-6">Edit Stasiun — {station.name}</h1>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle>Informasi</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label>Kode Stasiun</Label>
                <Input
                  value={station.code ?? ""}
                  onChange={(e) => setStation({ ...station, code: e.target.value })}
                  placeholder="Contoh: DKA"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div>
                <Label>Nama</Label>
                <Input
                  value={station.name}
                  onChange={(e) => setStation({ ...station, name: e.target.value })}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div>
                <Label>Lintas / Line</Label>
                <Input
                  value={station.line}
                  onChange={(e) => setStation({ ...station, line: e.target.value })}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div>
                <Label>Slug</Label>
                <Input
                  value={station.slug}
                  onChange={(e) => setStation({ ...station, slug: e.target.value })}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div>
                <Label>Wilayah</Label>
                <Input
                  value={station.location ?? ""}
                  onChange={(e) => setStation({ ...station, location: e.target.value })}
                  placeholder="Contoh: Jakarta Selatan"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div>
                <Label>Alamat</Label>
                <Input
                  value={station.address}
                  onChange={(e) => setStation({ ...station, address: e.target.value })}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div>
                <Label>Urutan Tampil</Label>
                <Input
                  type="number"
                  min={0}
                  value={station.order}
                  onChange={(e) => setStation({ ...station, order: Number(e.target.value) })}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div>
                <Label>Status Stasiun</Label>
                <select
                  value={station.isActive ? "active" : "inactive"}
                  onChange={(e) =>
                    setStation({ ...station, isActive: e.target.value === "active" })
                  }
                  className="mt-2 h-10 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm"
                >
                  <option value="active">Aktif — tampil di halaman publik</option>
                  <option value="inactive">Nonaktif — sembunyikan beserta tenant dan tur</option>
                </select>
              </div>
              <div>
                <Label>Penumpang/hari</Label>
                <Input
                  type="number"
                  value={station.dailyPassengers}
                  onChange={(e) =>
                    setStation({ ...station, dailyPassengers: Number(e.target.value) })
                  }
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div>
                <Label>Override WhatsApp Komersial</Label>
                <Input
                  value={station.commercialContactPhone ?? ""}
                  onChange={(e) =>
                    setStation({ ...station, commercialContactPhone: e.target.value })
                  }
                  placeholder="Kosong = mengikuti profil tim komersial"
                  className="bg-slate-800 border-slate-700"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Isi hanya jika stasiun ini memiliki nomor kontak khusus.
                </p>
              </div>
              <div>
                <Label>Deskripsi</Label>
                <Textarea
                  value={station.description ?? ""}
                  onChange={(e) => setStation({ ...station, description: e.target.value })}
                  className="bg-slate-800 border-slate-700"
                  rows={4}
                />
              </div>
              <Button
                type="submit"
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
              {message && (
                <p
                  role={isError ? "alert" : "status"}
                  className={`text-sm ${isError ? "text-red-400" : "text-emerald-400"}`}
                >
                  {message}
                </p>
              )}
            </form>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle>Foto Stasiun</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {station.imageUrl && (
              <div className="relative h-48 rounded-lg overflow-hidden">
                <Image
                  src={getS3ProxyUrl(station.imageUrl)}
                  alt={station.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            )}
            <Label className="flex items-center gap-2 cursor-pointer border border-dashed border-slate-600 rounded-lg p-4 hover:border-emerald-500">
              <Upload className="h-4 w-4" />
              Upload foto stasiun
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </Label>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
