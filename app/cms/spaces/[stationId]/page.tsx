"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { cmsFetch } from "@/lib/cms-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { FACILITY_ICONS, isFacilityIconId, type FacilityIconId } from "@/lib/facility-icons";
import {
  SPACE_STATUS_LABELS,
  SPACE_STATUS_VALUES,
  type CommercialSpaceStatus,
} from "@/lib/commercial-pipeline";

type SpaceStatus = CommercialSpaceStatus;

type Space = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: SpaceStatus;
  area: number;
  monthlyRent: number;
  deposit: number;
  floor: string;
  location: string;
  nearestExit: string | null;
  nearbyFacilities: FacilityIconId[];
  exposure: number;
  powerSupply: string | null;
  waterAccess: boolean;
  airConditioning: boolean;
  description: string | null;
  panoramaUrl: string | null;
  tenantId: string | null;
  tenantBrand: string | null;
};

type TenantOption = {
  id: string;
  brandName: string;
  isActive: boolean;
};

const SPACE_TYPES = [
  { value: "KIOS", label: "Kios" },
  { value: "RUKO", label: "Ruko" },
  { value: "ATM", label: "ATM" },
  { value: "VENDING", label: "Vending Machine" },
  { value: "MEDIA_IKLAN", label: "Media Iklan" },
  { value: "AREA_PROMOSI", label: "Area Promosi" },
];

const STATUSES = SPACE_STATUS_VALUES;

function normalizeFacilities(value: unknown): FacilityIconId[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isFacilityIconId);
}

function createDraft(): Space {
  return {
    id: "",
    code: "",
    name: "",
    type: "KIOS",
    status: "TERSEDIA",
    area: 12,
    monthlyRent: 0,
    deposit: 0,
    floor: "G",
    location: "Concourse",
    nearestExit: "",
    nearbyFacilities: [],
    exposure: 0,
    powerSupply: "",
    waterAccess: false,
    airConditioning: false,
    description: "",
    panoramaUrl: "",
    tenantId: null,
    tenantBrand: null,
  };
}

function toPayload(space: Space) {
  return {
    code: space.code.trim(),
    name: space.name.trim(),
    type: space.type,
    status: space.status,
    area: Number(space.area) || 0,
    monthlyRent: Number(space.monthlyRent) || 0,
    deposit: Number(space.deposit) || 0,
    floor: space.floor.trim() || "G",
    location: space.location.trim(),
    nearestExit: space.nearestExit?.trim() || null,
    nearbyFacilities: space.nearbyFacilities,
    exposure: Math.round(Number(space.exposure) || 0),
    powerSupply: space.powerSupply?.trim() || null,
    waterAccess: Boolean(space.waterAccess),
    airConditioning: Boolean(space.airConditioning),
    description: space.description?.trim() || null,
    panoramaUrl: space.panoramaUrl?.trim() || null,
    tenantId: space.status === "TERISI" ? space.tenantId : null,
  };
}

const FIELD_LABELS: Record<string, string> = {
  code: "Kode unit",
  name: "Nama unit",
  floor: "Lantai",
  location: "Lokasi",
  exposure: "Eksposur penumpang",
  area: "Luas",
  monthlyRent: "Sewa bulanan",
};

function validateSpace(space: Space): string | null {
  if (!space.code.trim()) return "Kode unit wajib diisi.";
  if (!space.name.trim()) return "Nama unit wajib diisi.";
  if (!space.floor.trim()) return "Lantai wajib diisi.";
  if (!space.location.trim()) return "Lokasi wajib diisi.";
  if (!Number.isFinite(Number(space.exposure))) return "Eksposur penumpang harus angka.";
  if (space.status === "TERISI" && !space.tenantId) {
    return "Penyewa wajib dipilih untuk unit berstatus TERISI.";
  }
  return null;
}

async function readSaveError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as {
      error?: string;
      details?: Array<{ path?: string; message?: string }>;
    };
    if (data.details?.length) {
      const parts = data.details.map((issue) => {
        const label = FIELD_LABELS[issue.path ?? ""] ?? issue.path ?? "Field";
        return `${label}: ${issue.message ?? "tidak valid"}`;
      });
      return parts.join(" · ");
    }
    if (data.error === "Data tidak valid") {
      return "Data tidak valid. Periksa kode unit, nama, lantai, dan lokasi.";
    }
    return data.error ?? "Gagal menyimpan unit.";
  } catch {
    return "Gagal menyimpan unit. Coba refresh halaman atau restart server.";
  }
}

export default function CmsSpacesStationPage() {
  const { stationId } = useParams<{ stationId: string }>();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [editing, setEditing] = useState<Space | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const [spacesRes, tenantsRes] = await Promise.all([
      cmsFetch(`/api/cms/spaces/station/${stationId}`),
      cmsFetch(`/api/cms/tenants?stationId=${encodeURIComponent(stationId)}`),
    ]);
    if (!spacesRes.ok) return;
    const data = await spacesRes.json().catch(() => null);
    const list = Array.isArray(data) ? data : [];
    setSpaces(
      list.map((item: Space) => ({
        ...item,
        nearbyFacilities: normalizeFacilities(item.nearbyFacilities),
      }))
    );
    if (tenantsRes.ok) {
      const tenantData = await tenantsRes.json().catch(() => null);
      const tenantList: TenantOption[] = Array.isArray(tenantData) ? tenantData : [];
      setTenants(tenantList.filter((tenant) => tenant.isActive));
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId]);

  async function saveSpace() {
    if (!editing) return;

    const validationError = validateSpace(editing);
    if (validationError) {
      setMessage(validationError);
      return;
    }

    if (
      editing.id &&
      editing.tenantBrand &&
      editing.status !== "TERISI" &&
      !confirm(
        `Ubah unit menjadi ${editing.status}? Occupancy ${editing.tenantBrand} akan dilepas dari unit ini.`
      )
    ) {
      return;
    }

    setSaving(true);
    setMessage("");

    const isEdit = Boolean(editing.id);
    const res = await cmsFetch(
      isEdit ? `/api/cms/spaces/${editing.id}` : `/api/cms/spaces/station/${stationId}`,
      {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(editing)),
      }
    );

    setSaving(false);
    if (!res.ok) {
      setMessage(await readSaveError(res));
      return;
    }

    setEditing(null);
    await load();
  }

  async function uploadSpacePhoto(file: File) {
    if (!editing?.id) {
      setMessage("Simpan unit terlebih dahulu sebelum upload foto.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    const res = await cmsFetch(`/api/cms/spaces/${editing.id}`, { method: "POST", body: formData });
    const data = await res.json();
    if (res.ok) {
      setEditing({
        ...editing,
        ...data.space,
        tenantId: editing.tenantId,
        tenantBrand: editing.tenantBrand,
        nearbyFacilities: normalizeFacilities(data.space?.nearbyFacilities),
      });
      setMessage("Foto unit berhasil diupload.");
      await load();
    } else {
      setMessage(data.error ?? "Upload foto gagal.");
    }
  }

  async function deleteSpace(id: string) {
    if (!confirm("Hapus unit ini?")) return;
    await cmsFetch(`/api/cms/spaces/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <Button asChild variant="ghost" className="mb-4 text-slate-300">
        <Link href="/cms/spaces"><ArrowLeft className="h-4 w-4 mr-1" /> Kembali</Link>
      </Button>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ruang Komersial</h1>
          <p className="mt-1 text-sm text-slate-400">Kelola semua field yang muncul di virtual tour publik.</p>
        </div>
        <Button onClick={() => { setMessage(""); setEditing(createDraft()); }} className="bg-emerald-600 hover:bg-emerald-500">
          <Plus className="h-4 w-4" />
          Tambah Unit
        </Button>
      </div>

      <div className="grid gap-3">
        {spaces.map((space) => (
          <Card key={space.id} className="bg-slate-900 border-slate-800">
            <CardContent className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-white">{space.code} - {space.name}</p>
                  <Badge variant="outline" className="border-slate-700 text-slate-300">{space.status}</Badge>
                  <Badge variant="outline" className="border-slate-700 text-slate-300">{SPACE_TYPES.find((t) => t.value === space.type)?.label ?? space.type}</Badge>
                  {space.status === "TERISI" && space.tenantBrand && (
                    <Badge
                      variant="outline"
                      className="border-emerald-700 bg-emerald-950/40 text-emerald-300"
                    >
                      Penyewa: {space.tenantBrand}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-400">
                  {space.floor} · {space.location} · {space.area} m²
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Exposure {Number(space.exposure).toLocaleString("id-ID")} orang/hari
                  {space.nearestExit ? ` · ${space.nearestExit}` : ""}
                  {space.powerSupply ? ` · ${space.powerSupply}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="border-slate-700" onClick={() => { setMessage(""); setEditing({ ...space, nearbyFacilities: normalizeFacilities(space.nearbyFacilities) }); }}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-950/40" onClick={() => deleteSpace(space.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[calc(100vh-32px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 px-6 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                  {editing.id ? "Edit Unit" : "Tambah Unit"}
                </p>
                <h2 className="mt-1 text-xl font-black text-white">{editing.code || "Unit Baru"}</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Tutup form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Kode Unit" required>
                  <Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} className="bg-slate-900 border-slate-700" />
                </Field>
                <Field label="Nama Unit" required>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="bg-slate-900 border-slate-700" />
                </Field>
                <Field label="Tipe">
                  <select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })} className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white">
                    {SPACE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select
                    value={editing.status}
                    onChange={(e) => {
                      const status = e.target.value as SpaceStatus;
                      setEditing({
                        ...editing,
                        status,
                        tenantId: status === "TERISI" ? editing.tenantId : null,
                      });
                    }}
                    className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white"
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {SPACE_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </Field>
                {editing.status === "TERISI" && (
                  <Field label="Penyewa Aktif" required>
                    <select
                      value={editing.tenantId ?? ""}
                      onChange={(e) => {
                        const tenantId = e.target.value || null;
                        const tenant = tenants.find((item) => item.id === tenantId);
                        setEditing({
                          ...editing,
                          tenantId,
                          tenantBrand: tenant?.brandName ?? null,
                        });
                      }}
                      className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white"
                    >
                      <option value="">Pilih penyewa</option>
                      {tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.brandName}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">
                        Memilih penyewa akan membuat status occupancy unit menjadi terisi.
                      </p>
                      <Link
                        href="/cms/tenants"
                        className="shrink-0 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                      >
                        Tambah penyewa
                      </Link>
                    </div>
                  </Field>
                )}
                <Field label="Luas (m2)">
                  <Input type="number" value={editing.area} onChange={(e) => setEditing({ ...editing, area: Number(e.target.value) })} className="bg-slate-900 border-slate-700" />
                </Field>
                <Field label="Sewa Bulanan (Rp)">
                  <Input type="number" value={editing.monthlyRent} onChange={(e) => setEditing({ ...editing, monthlyRent: Number(e.target.value) })} className="bg-slate-900 border-slate-700" />
                </Field>
                <Field label="Deposit">
                  <Input type="number" value={editing.deposit} onChange={(e) => setEditing({ ...editing, deposit: Number(e.target.value) })} className="bg-slate-900 border-slate-700" />
                </Field>
                <Field label="Eksposur Penumpang / Hari">
                  <Input type="number" value={editing.exposure} onChange={(e) => setEditing({ ...editing, exposure: Number(e.target.value) })} className="bg-slate-900 border-slate-700" />
                </Field>
                <Field label="Lantai" required>
                  <Input value={editing.floor} onChange={(e) => setEditing({ ...editing, floor: e.target.value })} className="bg-slate-900 border-slate-700" />
                </Field>
                <Field label="Lokasi" required>
                  <Input value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })} className="bg-slate-900 border-slate-700" />
                </Field>
                <Field label="Exit Terdekat">
                  <Input value={editing.nearestExit ?? ""} onChange={(e) => setEditing({ ...editing, nearestExit: e.target.value })} className="bg-slate-900 border-slate-700" />
                </Field>
                <Field label="Daya Listrik">
                  <Input value={editing.powerSupply ?? ""} onChange={(e) => setEditing({ ...editing, powerSupply: e.target.value })} placeholder="contoh: 2200 VA" className="bg-slate-900 border-slate-700" />
                </Field>
                <div className="md:col-span-2">
                  <Label>Daftar Fasilitas Terdekat</Label>
                  <div className="mt-2 grid gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:grid-cols-2 lg:grid-cols-3">
                    {FACILITY_ICONS.map((facility) => {
                      const checked = editing.nearbyFacilities.includes(facility.id);
                      return (
                        <label
                          key={facility.id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-700/80 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-200 transition hover:border-slate-500"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...editing.nearbyFacilities, facility.id]
                                : editing.nearbyFacilities.filter((id) => id !== facility.id);
                              setEditing({ ...editing, nearbyFacilities: next });
                            }}
                          />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={facility.src} alt="" className="size-6 rounded-full object-cover" />
                          <span>{facility.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <Field label="URL Foto/Panorama Unit">
                  <Input value={editing.panoramaUrl ?? ""} onChange={(e) => setEditing({ ...editing, panoramaUrl: e.target.value })} className="bg-slate-900 border-slate-700" />
                </Field>
                <div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 md:col-span-2 md:grid-cols-3">
                  <label className="flex items-center gap-3 text-sm text-slate-200">
                    <input type="checkbox" checked={editing.waterAccess} onChange={(e) => setEditing({ ...editing, waterAccess: e.target.checked })} />
                    Air bersih tersedia
                  </label>
                  <label className="flex items-center gap-3 text-sm text-slate-200">
                    <input type="checkbox" checked={editing.airConditioning} onChange={(e) => setEditing({ ...editing, airConditioning: e.target.checked })} />
                    AC tersedia
                  </label>
                  <Label className="flex cursor-pointer items-center gap-3 text-sm text-slate-200">
                    <Upload className="h-4 w-4" />
                    Upload foto unit
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadSpacePhoto(e.target.files[0])} />
                  </Label>
                </div>
                <div className="md:col-span-2">
                  <Label>Deskripsi</Label>
                  <Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="mt-2 min-h-28 bg-slate-900 border-slate-700" />
                </div>
              </div>
              {message && <p className="mt-4 text-sm text-amber-300">{message}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-6 py-4">
              <Button variant="ghost" onClick={() => setEditing(null)}>Batal</Button>
              <Button onClick={saveSpace} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500">
                {saving ? "Menyimpan..." : "Simpan Unit"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <Label>
        {label}
        {required ? <span className="text-amber-400"> *</span> : null}
      </Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}
