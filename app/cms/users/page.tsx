"use client";

import { useEffect, useState } from "react";
import { cmsFetch } from "@/lib/cms-fetch";
import { cmsUi } from "@/lib/cms-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Pencil, X } from "lucide-react";

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
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

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

  function startEditName(user: User) {
    setEditingUserId(user.id);
    setNameDraft(user.name);
    setError("");
  }

  function cancelEditName() {
    setEditingUserId(null);
    setNameDraft("");
  }

  async function saveName(user: User) {
    const name = nameDraft.trim();
    if (!name) {
      setError("Nama Mitra wajib diisi.");
      return;
    }

    setSavingUserId(user.id);
    setError("");
    try {
      const res = await cmsFetch(`/api/cms/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Gagal mengubah nama Mitra.");
        return;
      }

      const updated = (await res.json()) as User;
      setUsers((current) =>
        current.map((item) => (item.id === updated.id ? { ...item, name: updated.name } : item))
      );
      cancelEditName();
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setSavingUserId(null);
    }
  }

  return (
    <div>
      {error && <p className="mb-4 text-red-400">{error}</p>}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-[rgba(255,214,218,0.14)] bg-[#3A161C] text-[#F8ECEE]">
          <CardHeader><CardTitle>Daftar User</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-[rgba(255,214,218,0.14)]">
                <div className="min-w-0 flex-1">
                  {editingUserId === user.id ? (
                    <div className="flex max-w-md items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <Label htmlFor={`mitra-name-${user.id}`} className="sr-only">
                          Nama Mitra
                        </Label>
                        <Input
                          id={`mitra-name-${user.id}`}
                          value={nameDraft}
                          onChange={(event) => setNameDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void saveName(user);
                            if (event.key === "Escape") cancelEditName();
                          }}
                          maxLength={160}
                          autoFocus
                          className="h-9 border-[rgba(255,214,218,0.14)] bg-[#261015]"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void saveName(user)}
                        disabled={savingUserId === user.id}
                        className="bg-[#E31E2D] hover:bg-[#c41926]"
                        aria-label="Simpan nama Mitra"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {savingUserId === user.id ? "Menyimpan..." : "Simpan"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={cancelEditName}
                        disabled={savingUserId === user.id}
                        aria-label="Batal mengedit nama"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <p className="font-medium">{user.name}</p>
                  )}
                  <p className="text-sm text-[#C4A8AD]">{user.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cmsUi.outlineBadge}>
                    {user.role}
                  </Badge>
                  {user.role === "MITRA" && editingUserId !== user.id && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => startEditName(user)}
                      className="border-[rgba(255,214,218,0.14)]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit Nama
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(user)}>
                    {user.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-[rgba(255,214,218,0.14)] bg-[#3A161C] text-[#F8ECEE]">
          <CardHeader><CardTitle>Tambah User</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={createUser} className="space-y-3">
              <div><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border-[rgba(255,214,218,0.14)] bg-[#1C0A0E]" required /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="border-[rgba(255,214,218,0.14)] bg-[#1C0A0E]" required /></div>
              <div><Label>Password</Label><Input type="password" minLength={12} maxLength={128} placeholder="Minimal 12 karakter" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="border-[rgba(255,214,218,0.14)] bg-[#1C0A0E]" required /></div>
              <div>
                <Label>Role</Label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full bg-[#261015] border border-[rgba(255,214,218,0.14)] rounded-md p-2 text-sm">
                  <option value="EDITOR">EDITOR</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="MITRA">MITRA</option>
                </select>
              </div>
              <Button type="submit" className="bg-[#E31E2D] hover:bg-[#c41926]">Buat User</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
