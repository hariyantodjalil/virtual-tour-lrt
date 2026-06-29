"use client";

import { useEffect, useState } from "react";
import { cmsFetch } from "@/lib/cms-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
};

export default function CmsUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "EDITOR" });
  const [error, setError] = useState("");

  async function load() {
    const res = await cmsFetch("/api/cms/users");
    if (res.ok) setUsers(await res.json());
    else setError("Akses ditolak — hanya ADMIN");
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    const res = await cmsFetch("/api/cms/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ email: "", name: "", password: "", role: "EDITOR" });
      load();
    }
  }

  async function toggleActive(user: User) {
    await cmsFetch(`/api/cms/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Manajemen User</h1>
      {error && <p className="text-red-400 mb-4">{error}</p>}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader><CardTitle>Daftar User</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-700">
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-slate-400">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{user.role}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(user)}>
                    {user.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader><CardTitle>Tambah User</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={createUser} className="space-y-3">
              <div><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-slate-800 border-slate-700" required /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-slate-800 border-slate-700" required /></div>
              <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="bg-slate-800 border-slate-700" required /></div>
              <div>
                <Label>Role</Label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 text-sm">
                  <option value="EDITOR">EDITOR</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500">Buat User</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
