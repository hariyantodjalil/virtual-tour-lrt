"use client";

import { useMemo, useState } from "react";
import { Building2, Plus, Trash2, Link2, Unlink, Pencil, Save, X } from "lucide-react";
import { cmsFetch } from "@/lib/cms-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type StationOption = { id: string; name: string; slug: string };
export type SpaceOption = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
  stationId: string;
};
export type OccupancyItem = {
  id: string;
  spaceId: string;
  space: {
    id: string;
    code: string;
    name: string;
    type: string;
    status: string;
  };
  startDate: string | null;
  endDate: string | null;
};
export type TenantItem = {
  id: string;
  brandName: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  isActive: boolean;
  station: StationOption;
  occupancies: OccupancyItem[];
};

type Props = {
  initialTenants: TenantItem[];
  initialStations: StationOption[];
  initialSpaces: SpaceOption[];
};

export default function TenantsClient({
  initialTenants,
  initialStations,
  initialSpaces,
}: Props) {
  const [tenants, setTenants] = useState(initialTenants);
  const [stations, setStations] = useState(initialStations);
  const [spaces, setSpaces] = useState(initialSpaces);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    stationId: "",
    brandName: "",
    contactName: "",
    phone: "",
    email: "",
    notes: "",
    spaceId: "",
  });
  const [linkSpaceId, setLinkSpaceId] = useState<Record<string, string>>({});
  const [editingName, setEditingName] = useState<{ id: string; value: string } | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  async function load() {
    const [tRes, sRes] = await Promise.all([
      cmsFetch("/api/cms/tenants"),
      cmsFetch("/api/cms/stations"),
    ]);
    const tData = await tRes.json();
    const sData = await sRes.json();
    setTenants(Array.isArray(tData) ? tData : []);
    const stationList: StationOption[] = Array.isArray(sData) ? sData : sData.stations ?? [];
    setStations(stationList);

    const spaceLists = await Promise.all(
      stationList.map(async (st) => {
        const res = await cmsFetch(`/api/cms/spaces/station/${st.id}`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.spaces ?? [];
        return list.map((sp: Omit<SpaceOption, "stationId">) => ({ ...sp, stationId: st.id }));
      })
    );
    setSpaces(spaceLists.flat());
  }

  const formSpaces = useMemo(
    () => spaces.filter((s) => s.stationId === form.stationId),
    [spaces, form.stationId]
  );

  async function createTenant(e: React.FormEvent) {
    e.preventDefault();
    if (!form.stationId || !form.brandName.trim()) return;
    setBusy(true);
    try {
      const res = await cmsFetch("/api/cms/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stationId: form.stationId,
          brandName: form.brandName,
          contactName: form.contactName || null,
          phone: form.phone || null,
          email: form.email || null,
          notes: form.notes || null,
          spaceId: form.spaceId || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Gagal menambah tenant");
        return;
      }
      setShowForm(false);
      setForm({
        stationId: "",
        brandName: "",
        contactName: "",
        phone: "",
        email: "",
        notes: "",
        spaceId: "",
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteTenant(tenant: TenantItem) {
    if (!confirm(`Hapus tenant "${tenant.brandName}"? Unit terkait akan jadi TERSEDIA.`)) return;
    await cmsFetch(`/api/cms/tenants/${tenant.id}`, { method: "DELETE" });
    await load();
  }

  async function linkSpace(tenantId: string) {
    const spaceId = linkSpaceId[tenantId];
    if (!spaceId) return;
    await cmsFetch(`/api/cms/tenants/${tenantId}/occupancy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spaceId }),
    });
    setLinkSpaceId((prev) => ({ ...prev, [tenantId]: "" }));
    await load();
  }

  async function unlinkSpace(tenantId: string, spaceId: string) {
    if (!confirm("Lepas unit dari tenant ini?")) return;
    await cmsFetch(`/api/cms/tenants/${tenantId}/occupancy?spaceId=${spaceId}`, {
      method: "DELETE",
    });
    await load();
  }

  async function saveTenantName() {
    if (!editingName?.value.trim()) return;
    setBusy(true);
    try {
      const res = await cmsFetch(`/api/cms/tenants/${editingName.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName: editingName.value.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Gagal mengubah nama mitra.");
        return;
      }
      setEditingName(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Penyewa Aktif</h1>
          <p className="text-sm text-slate-400">Brand atau mitra yang mengisi unit di stasiun</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} className="bg-emerald-600 hover:bg-emerald-500">
          <Plus className="mr-1.5 h-4 w-4" />
          Tambah Penyewa
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6 border-slate-800 bg-slate-900">
          <CardContent className="space-y-3 p-4">
            <form onSubmit={createTenant} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="mb-1.5 block text-xs text-slate-400">Stasiun</Label>
                <select
                  required
                  value={form.stationId}
                  onChange={(e) => setForm((f) => ({ ...f, stationId: e.target.value, spaceId: "" }))}
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm"
                >
                  <option value="">Pilih stasiun</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-slate-400">Brand / Nama Tenant</Label>
                <Input
                  required
                  value={form.brandName}
                  onChange={(e) => setForm((f) => ({ ...f, brandName: e.target.value }))}
                  className="border-slate-700 bg-slate-800"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-slate-400">Kontak</Label>
                <Input
                  value={form.contactName}
                  onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                  className="border-slate-700 bg-slate-800"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-slate-400">Telepon</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="border-slate-700 bg-slate-800"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-slate-400">Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="border-slate-700 bg-slate-800"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="mb-1.5 block text-xs text-slate-400">Unit (opsional)</Label>
                <select
                  value={form.spaceId}
                  onChange={(e) => setForm((f) => ({ ...f, spaceId: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm"
                  disabled={!form.stationId}
                >
                  <option value="">Belum assign unit</option>
                  {formSpaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name} ({s.status})
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" disabled={busy} className="bg-emerald-600 hover:bg-emerald-500">
                  Simpan
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Batal
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {tenants.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada tenant aktif.</p>
        ) : (
          tenants.map((tenant) => {
            const stationSpaces = spaces.filter((s) => s.stationId === tenant.station.id);
            const occupiedIds = new Set(tenant.occupancies.map((o) => o.spaceId));
            const availableToLink = stationSpaces.filter((s) => !occupiedIds.has(s.id));

            return (
              <Card key={tenant.id} className="border-slate-800 bg-slate-900">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-emerald-400" />
                        {editingName?.id === tenant.id ? (
                          <Input
                            autoFocus
                            value={editingName.value}
                            onChange={(event) =>
                              setEditingName({ id: tenant.id, value: event.target.value })
                            }
                            className="h-8 w-56 border-slate-700 bg-slate-800"
                          />
                        ) : (
                          <p className="font-semibold text-white">{tenant.brandName}</p>
                        )}
                        <Badge variant="outline">{tenant.isActive ? "Aktif" : "Nonaktif"}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{tenant.station.name}</p>
                      <p className="text-xs text-slate-500">
                        {[tenant.contactName, tenant.phone, tenant.email].filter(Boolean).join(" · ") ||
                          "Tanpa kontak"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {editingName?.id === tenant.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={saveTenantName}
                            disabled={busy || !editingName.value.trim()}
                            aria-label="Simpan nama mitra"
                          >
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingName(null)}
                            aria-label="Batal edit"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setEditingName({ id: tenant.id, value: tenant.brandName })
                          }
                          aria-label="Edit nama mitra"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-800 text-red-300 hover:bg-red-950"
                        onClick={() => deleteTenant(tenant)}
                        aria-label="Hapus penyewa"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Unit ditempati
                    </p>
                    {tenant.occupancies.length === 0 ? (
                      <p className="text-xs text-slate-600">Belum ada unit</p>
                    ) : (
                      tenant.occupancies.map((o) => (
                        <div
                          key={o.id}
                          className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2"
                        >
                          <div>
                            <p className="font-mono text-xs text-slate-200">{o.space.code}</p>
                            <p className="text-[11px] text-slate-500">{o.space.name}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => unlinkSpace(tenant.id, o.spaceId)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-white"
                          >
                            <Unlink className="h-3 w-3" /> Lepas
                          </button>
                        </div>
                      ))
                    )}

                    {availableToLink.length > 0 && (
                      <div className="flex gap-2 pt-1">
                        <select
                          value={linkSpaceId[tenant.id] ?? ""}
                          onChange={(e) =>
                            setLinkSpaceId((prev) => ({ ...prev, [tenant.id]: e.target.value }))
                          }
                          className="h-8 flex-1 rounded-md border border-slate-700 bg-slate-800 px-2 text-xs"
                        >
                          <option value="">Tambah unit…</option>
                          {availableToLink.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} — {s.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-slate-600"
                          onClick={() => linkSpace(tenant.id)}
                          disabled={!linkSpaceId[tenant.id]}
                        >
                          <Link2 className="mr-1 h-3 w-3" /> Tautkan
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
