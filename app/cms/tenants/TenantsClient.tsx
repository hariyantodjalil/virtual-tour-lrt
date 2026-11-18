"use client";

import { useCallback, useMemo, useState } from "react";
import { Building2, Plus, Trash2, Link2, Unlink, Pencil, Save, X } from "lucide-react";
import { cmsFetch } from "@/lib/cms-fetch";
import { cmsUi } from "@/lib/cms-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import CmsMediaSearch from "@/components/cms/CmsMediaSearch";

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

const emptyForm = {
  stationId: "",
  brandName: "",
  contactName: "",
  phone: "",
  email: "",
  notes: "",
  spaceId: "",
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
  const [form, setForm] = useState(emptyForm);
  const [linkSpaceId, setLinkSpaceId] = useState<Record<string, string>>({});
  const [editingName, setEditingName] = useState<{ id: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const { confirmDialog, confirmElement } = useConfirmDialog();

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
        setActionError(data.error ?? "Gagal menambah tenant");
        return;
      }
      setActionError("");
      setShowForm(false);
      setForm(emptyForm);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteTenant(tenant: TenantItem) {
    const confirmed = await confirmDialog({
      title: `Hapus tenant "${tenant.brandName}"?`,
      description: "Unit terkait akan jadi TERSEDIA.",
      confirmLabel: "Ya, Hapus",
      destructive: true,
    });
    if (!confirmed) return;
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
    const confirmed = await confirmDialog({
      title: "Lepas unit dari tenant ini?",
      description: "Unit akan kembali berstatus TERSEDIA dan bisa diisi tenant lain.",
      confirmLabel: "Ya, Lepas",
      destructive: true,
    });
    if (!confirmed) return;
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
        setActionError(data.error ?? "Gagal mengubah nama mitra.");
        return;
      }
      setActionError("");
      setEditingName(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  const getTenantSearchText = useCallback(
    (tenant: TenantItem) =>
      [
        tenant.brandName,
        tenant.station.name,
        tenant.contactName ?? "",
        tenant.phone ?? "",
        tenant.email ?? "",
        tenant.isActive ? "" : "nonaktif",
        ...tenant.occupancies.flatMap((o) => [o.space.code, o.space.name]),
      ].join(" "),
    []
  );

  return (
    <div>
      {actionError ? (
        <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {actionError}
        </p>
      ) : null}

      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setForm(emptyForm);
        }}
      >
        <DialogContent className={`max-w-lg ${cmsUi.modal}`}>
          <DialogHeader>
            <DialogTitle>Tambah penyewa aktif</DialogTitle>
          </DialogHeader>
          <form onSubmit={createTenant} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className={`mb-1.5 block text-xs ${cmsUi.muted}`}>Stasiun</Label>
              <Select
                value={form.stationId || undefined}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, stationId: value, spaceId: "" }))
                }
              >
                <SelectTrigger className={cmsUi.select}>
                  <SelectValue placeholder="Pilih stasiun" />
                </SelectTrigger>
                <SelectContent>
                  {stations.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className={`mb-1.5 block text-xs ${cmsUi.muted}`}>Brand / Nama Tenant</Label>
              <Input
                required
                value={form.brandName}
                onChange={(e) => setForm((f) => ({ ...f, brandName: e.target.value }))}
                className={cmsUi.input}
              />
            </div>
            <div>
              <Label className={`mb-1.5 block text-xs ${cmsUi.muted}`}>Kontak</Label>
              <Input
                value={form.contactName}
                onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                className={cmsUi.input}
              />
            </div>
            <div>
              <Label className={`mb-1.5 block text-xs ${cmsUi.muted}`}>Telepon</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className={cmsUi.input}
              />
            </div>
            <div>
              <Label className={`mb-1.5 block text-xs ${cmsUi.muted}`}>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={cmsUi.input}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className={`mb-1.5 block text-xs ${cmsUi.muted}`}>Unit (opsional)</Label>
              <Select
                value={form.spaceId || "__none"}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, spaceId: value === "__none" ? "" : value }))
                }
                disabled={!form.stationId}
              >
                <SelectTrigger className={cmsUi.select}>
                  <SelectValue placeholder="Belum assign unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Belum assign unit</SelectItem>
                  {formSpaces.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.code} — {s.name} ({s.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" className={cmsUi.outlineBtn} onClick={() => setShowForm(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={busy || !form.stationId} className={cmsUi.primaryBtn}>
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CmsMediaSearch
        items={tenants}
        placeholder="Cari brand, stasiun, kontak, atau unit…"
        emptyLabel="Belum ada tenant aktif."
        getSearchText={getTenantSearchText}
        toolbar={
          <Button onClick={() => setShowForm(true)} className={cmsUi.primaryBtn}>
            <Plus className="mr-1.5 size-4" />
            Tambah Penyewa
          </Button>
        }
      >
        {(filtered) => (
          <div className="grid gap-4 lg:grid-cols-2">
            {filtered.map((tenant) => {
              const stationSpaces = spaces.filter((s) => s.stationId === tenant.station.id);
              const occupiedIds = new Set(tenant.occupancies.map((o) => o.spaceId));
              const availableToLink = stationSpaces.filter((s) => !occupiedIds.has(s.id));

              return (
                <Card key={tenant.id} className={cmsUi.card}>
                  <CardContent className="space-y-4 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${cmsUi.nested}`}
                          >
                            <Building2 className="size-4 text-emerald-700" />
                          </span>
                          {editingName?.id === tenant.id ? (
                            <Input
                              autoFocus
                              value={editingName.value}
                              onChange={(event) =>
                                setEditingName({ id: tenant.id, value: event.target.value })
                              }
                              className={`h-8 w-56 ${cmsUi.input}`}
                            />
                          ) : (
                            <p className="font-semibold tracking-tight text-[var(--work-text)]">
                              {tenant.brandName}
                            </p>
                          )}
                          {!tenant.isActive ? (
                            <Badge variant="outline" className={cmsUi.inactiveBadge}>
                              Nonaktif
                            </Badge>
                          ) : null}
                        </div>
                        <p className={`mt-1.5 text-sm ${cmsUi.muted}`}>{tenant.station.name}</p>
                        <p className={`text-xs ${cmsUi.muted}`}>
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
                              className={cmsUi.outlineBtn}
                              onClick={saveTenantName}
                              disabled={busy || !editingName.value.trim()}
                              aria-label="Simpan nama mitra"
                            >
                              <Save className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingName(null)}
                              aria-label="Batal edit"
                            >
                              <X className="size-3.5" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className={cmsUi.outlineBtn}
                            onClick={() => setEditingName({ id: tenant.id, value: tenant.brandName })}
                            aria-label="Edit nama mitra"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() => deleteTenant(tenant)}
                          aria-label="Hapus penyewa"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className={`text-xs font-medium ${cmsUi.muted}`}>Unit ditempati</p>
                      {tenant.occupancies.length === 0 ? (
                        <p className={`text-xs ${cmsUi.muted}`}>Belum ada unit</p>
                      ) : (
                        tenant.occupancies.map((o) => (
                          <div
                            key={o.id}
                            className={`flex items-center justify-between rounded-lg border px-3 py-2 ${cmsUi.nested}`}
                          >
                            <div>
                              <p className="font-mono text-xs text-[var(--work-text)]">{o.space.code}</p>
                              <p className={`text-[11px] ${cmsUi.muted}`}>{o.space.name}</p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className={`h-7 px-2 text-xs ${cmsUi.muted}`}
                              onClick={() => unlinkSpace(tenant.id, o.spaceId)}
                            >
                              <Unlink className="mr-1 size-3" /> Lepas
                            </Button>
                          </div>
                        ))
                      )}

                      {availableToLink.length > 0 ? (
                        <div className="flex gap-2 pt-1">
                          <Select
                            value={linkSpaceId[tenant.id] || undefined}
                            onValueChange={(value) =>
                              setLinkSpaceId((prev) => ({ ...prev, [tenant.id]: value }))
                            }
                          >
                            <SelectTrigger className={`h-8 flex-1 text-xs ${cmsUi.select}`}>
                              <SelectValue placeholder="Tambah unit…" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableToLink.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.code} — {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-8 ${cmsUi.outlineBtn}`}
                            onClick={() => linkSpace(tenant.id)}
                            disabled={!linkSpaceId[tenant.id]}
                          >
                            <Link2 className="mr-1 size-3" /> Tautkan
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CmsMediaSearch>
      {confirmElement}
    </div>
  );
}
