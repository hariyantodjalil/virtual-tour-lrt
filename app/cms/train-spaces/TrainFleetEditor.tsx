"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { cmsFetch } from "@/lib/cms-fetch";
import type { TrainFleet } from "@/lib/train-fleet-shared";

export default function TrainFleetEditor({ fleet, onChange }: { fleet: TrainFleet; onChange: () => Promise<void> }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [capacityDraft, setCapacityDraft] = useState<string | null>(null);
  async function mutate(method: "POST" | "PATCH", payload: unknown) {
    setSaving(true); setError("");
    try {
      const response = await cmsFetch("/api/cms/train-fleet", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Armada gagal diperbarui."); }
      setCode(""); await onChange();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Armada gagal diperbarui."); }
    finally { setSaving(false); }
  }
  function add(event: FormEvent) { event.preventDefault(); void mutate("POST", { code: code.trim().toUpperCase() }); }
  return <details className="mb-6 rounded-xl border border-white/15 bg-[#261015] p-4 text-[#F8ECEE]">
    <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Master armada</summary>
    <form onSubmit={event => { event.preventDefault(); const value = capacityDraft ?? String(fleet.advertisingCapacity ?? ""); void mutate("PATCH", { advertisingCapacity: value === "" ? null : Number(value) }); }} className="mt-4 flex flex-wrap items-end gap-2">
      <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm">Kapasitas armada iklan (trainset)
        <input type="number" min={0} max={999} value={capacityDraft ?? fleet.advertisingCapacity ?? ""} onChange={event => setCapacityDraft(event.target.value)} className="min-h-11 rounded-lg border border-white/20 bg-[#1C0A0E] px-3" />
      </label>
      <button disabled={saving || !fleet.trainId} className="min-h-11 rounded-lg bg-[#E31E2D] px-4 text-sm font-semibold disabled:opacity-50">Simpan kapasitas</button>
    </form>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm">{fleet.cars.filter(car => car.isActive).length} gerbong aktif</p>
      <Link href="/cms/virtual-train" className="inline-flex min-h-11 items-center text-sm text-[#FF858D] underline underline-offset-4">Kelola gerbong</Link>
    </div>
    <form onSubmit={add} className="mt-3 flex gap-2">
      <label htmlFor="fleet-code" className="sr-only">Kode train set baru</label>
      <input id="fleet-code" value={code} onChange={event => setCode(event.target.value)} required pattern="[Tt][Ss][0-9]{2,6}" placeholder="Kode train set" className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/20 bg-[#1C0A0E] px-3 text-sm" />
      <button disabled={saving || !fleet.trainId} className="min-h-11 rounded-lg bg-[#E31E2D] px-4 text-sm font-semibold disabled:opacity-50">Tambah</button>
    </form>
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      {fleet.trainsets.map(trainset => <li key={trainset.id}><label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-white/15 px-3 text-sm"><input type="checkbox" checked={trainset.isActive} disabled={saving} onChange={event => void mutate("PATCH", { id: trainset.id, isActive: event.target.checked })} />{trainset.code}</label></li>)}
    </ul>
  </details>;
}
