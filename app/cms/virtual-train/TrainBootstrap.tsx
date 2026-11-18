"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { cmsFetch } from "@/lib/cms-fetch";

export default function TrainBootstrap() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function create(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await cmsFetch("/api/cms/trains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Kereta gagal dibuat.");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Kereta gagal dibuat."); }
    finally { setSaving(false); }
  }
  return <form onSubmit={create} className="mt-5 space-y-3">
    <label htmlFor="first-train-name" className="block text-sm">Nama kereta</label>
    <input id="first-train-name" required minLength={2} maxLength={120} value={name} onChange={event => setName(event.target.value)} className="min-h-11 w-full rounded-lg border border-[var(--work-control)] bg-[var(--work-subtle)] px-3 text-sm text-[var(--work-text)]" />
    {error && <p role="alert" className="text-sm text-[var(--work-danger)]">{error}</p>}
    <button disabled={saving} className="min-h-11 rounded-lg bg-[#E31E2D] px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Menyimpan..." : "Tambah kereta"}</button>
  </form>;
}
