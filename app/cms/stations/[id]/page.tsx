"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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

type Station = {
  id: string;
  name: string;
  slug: string;
  line: string;
  address: string;
  dailyPassengers: number;
  description: string | null;
  commercialContactPhone: string | null;
  imageUrl: string | null;
  order: number;
};

export default function CmsStationEditPage() {
  const { id } = useParams<{ id: string }>();
  const [station, setStation] = useState<Station | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    cmsFetch(`/api/cms/stations/${id}`)
      .then((r) => r.json())
      .then(setStation);
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!station) return;
    setSaving(true);
    const res = await cmsFetch(`/api/cms/stations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: station.name,
        slug: station.slug,
        line: station.line,
        address: station.address,
        dailyPassengers: station.dailyPassengers,
        description: station.description,
        commercialContactPhone: station.commercialContactPhone,
        order: station.order,
      }),
    });
    setSaving(false);
    setMessage(res.ok ? "Berhasil disimpan" : "Gagal menyimpan");
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const res = await cmsFetch(`/api/cms/stations/${id}/upload`, { method: "POST", body: formData });
    const data = await res.json();
    if (res.ok && station) {
      setStation({ ...station, imageUrl: data.imageUrl });
      setMessage("Foto berhasil diupload");
    }
  }

  if (!station) return <p className="text-slate-400">Memuat...</p>;

  return (
    <div>
      <Button asChild variant="ghost" className="mb-4 text-slate-300">
        <Link href="/cms/stations"><ArrowLeft className="h-4 w-4 mr-1" /> Kembali</Link>
      </Button>
      <h1 className="text-2xl font-bold mb-6">Edit Stasiun — {station.name}</h1>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader><CardTitle>Informasi</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div><Label>Nama</Label><Input value={station.name} onChange={(e) => setStation({ ...station, name: e.target.value })} className="bg-slate-800 border-slate-700" /></div>
              <div><Label>Slug</Label><Input value={station.slug} onChange={(e) => setStation({ ...station, slug: e.target.value })} className="bg-slate-800 border-slate-700" /></div>
              <div><Label>Alamat</Label><Input value={station.address} onChange={(e) => setStation({ ...station, address: e.target.value })} className="bg-slate-800 border-slate-700" /></div>
              <div><Label>Penumpang/hari</Label><Input type="number" value={station.dailyPassengers} onChange={(e) => setStation({ ...station, dailyPassengers: Number(e.target.value) })} className="bg-slate-800 border-slate-700" /></div>
              <div><Label>WhatsApp Tim Komersial</Label><Input value={station.commercialContactPhone ?? ""} onChange={(e) => setStation({ ...station, commercialContactPhone: e.target.value })} placeholder="628118012012" className="bg-slate-800 border-slate-700" /></div>
              <div><Label>Deskripsi</Label><Textarea value={station.description ?? ""} onChange={(e) => setStation({ ...station, description: e.target.value })} className="bg-slate-800 border-slate-700" rows={4} /></div>
              <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500">{saving ? "Menyimpan..." : "Simpan"}</Button>
              {message && <p className="text-sm text-emerald-400">{message}</p>}
            </form>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader><CardTitle>Foto Stasiun</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {station.imageUrl && (
              <div className="relative h-48 rounded-lg overflow-hidden">
                <Image src={getS3ProxyUrl(station.imageUrl)} alt={station.name} fill className="object-cover" unoptimized />
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
