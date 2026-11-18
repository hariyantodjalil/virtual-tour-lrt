"use client";

import { useEffect, useMemo, useState } from "react";
import { cmsFetch } from "@/lib/cms-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, ChevronLeft, ChevronRight, Pencil, PlusCircle, Search, X } from "lucide-react";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
};

const roleBadge = { ADMIN: "default", EDITOR: "secondary", MITRA: "outline" } as const;
const PAGE_SIZES = [10, 25, 50];

export default function CmsUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "EDITOR" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await cmsFetch("/api/cms/users");
    if (res.ok) setUsers(await res.json());
    else setError("Akses ditolak — hanya ADMIN.");
    setLoaded(true);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setCreateError("");
    try {
      const res = await cmsFetch("/api/cms/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "User gagal dibuat.");
      const createdEmail = form.email;
      setCreateOpen(false);
      setForm({ email: "", name: "", password: "", role: "EDITOR" });
      setNotice(`User ${createdEmail} berhasil dibuat.`);
      await load();
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : "User gagal dibuat.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(user: User) {
    if (savingUserId) return;
    setSavingUserId(user.id);
    setError("");
    setNotice("");
    try {
      const res = await cmsFetch(`/api/cms/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Status user gagal diubah.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Status user gagal diubah.");
    } finally {
      setSavingUserId(null);
    }
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
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Gagal mengubah nama Mitra.");

      const updated = data as User;
      setUsers((current) =>
        current.map((item) => (item.id === updated.id ? { ...item, name: updated.name } : item))
      );
      cancelEditName();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal terhubung ke server.");
    } finally {
      setSavingUserId(null);
    }
  }

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return users.filter(
      (user) =>
        (roleFilter === "ALL" || user.role === roleFilter) &&
        ((statusFilter === "ALL" || (statusFilter === "AKTIF") === user.isActive) &&
          (!text ||
            user.name.toLowerCase().includes(text) ||
            user.email.toLowerCase().includes(text)))
    );
  }, [users, query, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const from = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, filtered.length);
  const filtersActive = Boolean(query.trim()) || roleFilter !== "ALL" || statusFilter !== "ALL";

  function resetFilters() {
    setQuery("");
    setRoleFilter("ALL");
    setStatusFilter("ALL");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Daftar User</CardTitle>
            <CardDescription>{users.length} user terdaftar.</CardDescription>
          </div>
          <Button
            type="button"
            onClick={() => {
              setCreateError("");
              setCreateOpen(true);
            }}
          >
            <PlusCircle className="h-4 w-4" />
            Tambah User
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Cari nama atau email…"
                aria-label="Cari user berdasarkan nama atau email"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={roleFilter}
                onValueChange={(value) => {
                  setRoleFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-32" aria-label="Filter role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua role</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                  <SelectItem value="EDITOR">EDITOR</SelectItem>
                  <SelectItem value="MITRA">MITRA</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-36" aria-label="Filter status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua status</SelectItem>
                  <SelectItem value="AKTIF">Aktif</SelectItem>
                  <SelectItem value="NONAKTIF">Nonaktif</SelectItem>
                </SelectContent>
              </Select>
              {filtersActive && (
                <Button type="button" size="sm" variant="ghost" onClick={resetFilters}>
                  <X className="h-3.5 w-3.5" />
                  Reset
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="max-w-64">
                      {editingUserId === user.id ? (
                        <div className="flex min-w-48 items-center gap-2">
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
                            className="h-9"
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="h-9 px-2.5"
                            onClick={() => void saveName(user)}
                            disabled={savingUserId === user.id}
                            aria-label="Simpan nama Mitra"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-9 px-2.5"
                            onClick={cancelEditName}
                            disabled={savingUserId === user.id}
                            aria-label="Batal mengedit nama"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="break-words font-medium">{user.name}</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-64 break-all text-slate-600">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={roleBadge[user.role as keyof typeof roleBadge] ?? "outline"}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.isActive ? (
                        <span className="sr-only">Aktif</span>
                      ) : (
                        <Badge variant="maintenance">Nonaktif</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {user.role === "MITRA" && editingUserId !== user.id && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => startEditName(user)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit Nama
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void toggleActive(user)}
                          disabled={savingUserId === user.id}
                        >
                          {user.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loaded && users.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="py-10 text-center text-slate-500">
                      Memuat data user…
                    </TableCell>
                  </TableRow>
                )}
                {loaded && users.length > 0 && filtered.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="py-10 text-center text-slate-500">
                      Tidak ada user yang cocok dengan pencarian atau filter.
                    </TableCell>
                  </TableRow>
                )}
                {loaded && users.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="py-10 text-center text-slate-500">
                      Belum ada user terdaftar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Menampilkan {from}–{to} dari {filtered.length} user
              {filtered.length !== users.length ? ` (total ${users.length})` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="page-size" className="text-sm text-slate-600">
                  Baris/halaman
                </Label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger id="page-size" className="h-9 w-[4.5rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-slate-600">
                Halaman {currentPage} dari {totalPages}
              </p>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0"
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  aria-label="Halaman sebelumnya"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0"
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  aria-label="Halaman berikutnya"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateError("");
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah User</DialogTitle>
            <DialogDescription>
              Password minimal 12 karakter. Role MITRA otomatis mengakses portal mitra, bukan CMS.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createUser} className="grid gap-4">
            {createError && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {createError}
              </p>
            )}
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="user-name">Nama</Label>
                <Input
                  id="user-name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-email">Email</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  required
                  maxLength={254}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-password">Password</Label>
                <Input
                  id="user-password"
                  type="password"
                  minLength={12}
                  maxLength={128}
                  placeholder="Minimal 12 karakter"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-role">Role</Label>
                <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value })}>
                  <SelectTrigger id="user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EDITOR">EDITOR</SelectItem>
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                    <SelectItem value="MITRA">MITRA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)} disabled={submitting}>
                Batal
              </Button>
              <Button type="submit" disabled={submitting}>
                <PlusCircle className="h-4 w-4" />
                {submitting ? "Membuat…" : "Buat User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
