"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

type Space = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
  area: number;
  monthlyRent: number;
  floor: string;
  location: string;
};

export default function CmsSpacesStationPage() {
  const { stationId } = useParams<{ stationId: string }>();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [editing, setEditing] = useState<Space | null>(null);

  async function load() {
    const res = await fetch(`/api/cms/spaces/station/${stationId}`);
    setSpaces(await res.json());
  }

  useEffect(() => { load(); }, [stationId]);

  async function saveSpace() {
    if (!editing) return;
    await fetch(`/api/cms/spaces/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    setEditing(null);
    load();
  }

  async function deleteSpace(id: string) {
    if (!confirm("Hapus unit ini?")) return;
    await fetch(`/api/cms/spaces/${id}`, { method: "DELETE" });
    load();
  }

  async function addSpace() {
    const code = prompt("Kode unit:");
    const name = prompt("Nama unit:");
    if (!code || !name) return;
    await fetch(`/api/cms/spaces/station/${stationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        name,
        type: "KIOS",
        status: "TERSEDIA",
        area: 12,
        monthlyRent: 8000000,
        floor: "G",
        location: "Concourse",
      }),
    });
    load();
  }

  return (
    <div>
      <Button asChild variant="ghost" className="mb-4 text-slate-300">
        <Link href="/cms/spaces"><ArrowLeft className="h-4 w-4 mr-1" /> Kembali</Link>
      </Button>
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">Ruang Komersial</h1>
        <Button onClick={addSpace} className="bg-emerald-600 hover:bg-emerald-500">Tambah Unit</Button>
      </div>
      <div className="space-y-3">
        {spaces.map((space) => (
          <Card key={space.id} className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{space.code} — {space.name}</p>
                <p className="text-sm text-slate-400">{space.type} · {space.floor} · {space.location}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{space.status}</Badge>
                <Button size="sm" variant="outline" className="border-slate-700" onClick={() => setEditing(space)}>Edit</Button>
                <Button size="sm" variant="ghost" className="text-red-400" onClick={() => deleteSpace(space.id)}>Hapus</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {editing && (
        <Card className="fixed inset-x-4 bottom-4 md:inset-auto md:right-8 md:bottom-8 md:w-96 bg-slate-900 border-slate-700 shadow-xl z-50">
          <CardHeader><CardTitle>Edit {editing.code}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Nama</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="bg-slate-800 border-slate-700" /></div>
            <div><Label>Status</Label>
              <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 text-sm">
                <option value="TERSEDIA">TERSEDIA</option>
                <option value="TERISI">TERISI</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
              </select>
            </div>
            <div><Label>Sewa/bulan</Label><Input type="number" value={editing.monthlyRent} onChange={(e) => setEditing({ ...editing, monthlyRent: Number(e.target.value) })} className="bg-slate-800 border-slate-700" /></div>
            <div className="flex gap-2">
              <Button onClick={saveSpace} className="bg-emerald-600">Simpan</Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>Batal</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
