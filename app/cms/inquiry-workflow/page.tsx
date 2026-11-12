"use client";

import { useEffect, useState, type FormEvent } from "react";
import { cmsFetch } from "@/lib/cms-fetch";
import type { InquiryWorkflow } from "@/lib/use-inquiry-workflow";

const control = "min-h-11 w-full rounded-lg border border-white/20 bg-[#1C0A0E] px-3 py-2 text-sm text-[#F8ECEE] focus-visible:outline-2 focus-visible:outline-[#E31E2D]";

export default function InquiryWorkflowPage() {
  const [workflow, setWorkflow] = useState<InquiryWorkflow | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void cmsFetch("/api/cms/inquiry-workflow", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Alur pengajuan tidak dapat dimuat.");
      setWorkflow(await response.json());
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Alur gagal dimuat."); });
    return () => controller.abort();
  }, []);
  async function save(event: FormEvent) {
    event.preventDefault(); if (!workflow || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await cmsFetch("/api/cms/inquiry-workflow", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseVersionId: workflow.id, title: workflow.title, steps: workflow.steps.map(({ id, title, publicMessage, showInSummary }) => ({ id, title, publicMessage, showInSummary })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Alur gagal disimpan.");
      setWorkflow(data); setMessage(`Versi ${data.version} aktif untuk pengajuan baru.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Alur gagal disimpan."); }
    finally { setSaving(false); }
  }
  return <div className="mx-auto max-w-3xl text-[#F8ECEE]">
    <h1 className="text-xl font-semibold">Alur pengajuan</h1>
    {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
    {message && <p role="status" className="mt-4 text-sm text-emerald-300">{message}</p>}
    {!workflow && !error && <p role="status" className="mt-4 text-sm">Memuat alur...</p>}
    {workflow && <form onSubmit={save} className="mt-5 space-y-5">
      <div><label htmlFor="workflow-title" className="mb-2 block text-sm">Nama alur · Versi {workflow.version}</label><input id="workflow-title" className={control} required minLength={2} maxLength={120} value={workflow.title} onChange={event => setWorkflow({ ...workflow, title: event.target.value })} /></div>
      {workflow.steps.map((step, index) => <fieldset key={step.id} className="space-y-3 rounded-xl border border-white/15 bg-[#261015] p-4">
        <legend className="px-2 text-sm font-semibold">Tahap {step.stepOrder}</legend>
        <div><label htmlFor={`step-title-${step.id}`} className="mb-1 block text-sm">Judul</label><input id={`step-title-${step.id}`} className={control} required minLength={2} maxLength={120} value={step.title} onChange={event => setWorkflow({ ...workflow, steps: workflow.steps.map((item, i) => i === index ? { ...item, title: event.target.value } : item) })} /></div>
        <div><label htmlFor={`step-message-${step.id}`} className="mb-1 block text-sm">Keterangan untuk mitra</label><textarea id={`step-message-${step.id}`} className={control} required minLength={2} maxLength={2000} rows={2} value={step.publicMessage} onChange={event => setWorkflow({ ...workflow, steps: workflow.steps.map((item, i) => i === index ? { ...item, publicMessage: event.target.value } : item) })} /></div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={step.showInSummary} onChange={event => setWorkflow({ ...workflow, steps: workflow.steps.map((item, i) => i === index ? { ...item, showInSummary: event.target.checked } : item) })} />Tampilkan pada ringkasan detail unit</label>
      </fieldset>)}
      <p className="text-sm text-[#C4A8AD]">Pengajuan yang sudah masuk tetap memakai versi sebelumnya.</p>
      <button disabled={saving} className="min-h-11 rounded-lg bg-[#E31E2D] px-5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Menyimpan..." : "Simpan versi baru"}</button>
    </form>}
  </div>;
}
