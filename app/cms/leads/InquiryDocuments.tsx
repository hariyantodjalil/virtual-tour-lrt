"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { cmsFetch } from "@/lib/cms-fetch";

const responseSchema = z.object({
  steps: z.array(z.object({ stepOrder: z.number().int(), title: z.string() })),
  media: z.array(z.object({ id: z.string(), stepOrder: z.number().int(), mediaTitle: z.string(), documentNumber: z.string().nullable(), mediaLink: z.string().url(), isVisibleToMitra: z.boolean() })),
});
type Data = z.infer<typeof responseSchema>;
const inputClass = "min-h-11 w-full rounded-md border border-white/15 bg-[#261015] px-3 py-2 text-sm text-[#F8ECEE] focus-visible:outline-2 focus-visible:outline-[#E31E2D]";

export default function InquiryDocuments({ leadId }: { leadId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ stepOrder: 1, mediaTitle: "", documentNumber: "", mediaLink: "", isVisibleToMitra: false });
  const endpoint = `/api/cms/leads/${encodeURIComponent(leadId)}/media`;
  const load = useCallback(async () => {
    const response = await cmsFetch(endpoint);
    if (!response.ok) throw new Error("Dokumen gagal dimuat.");
    return responseSchema.parse(await response.json());
  }, [endpoint]);
  useEffect(() => {
    let cancelled = false;
    void load().then(value => { if (!cancelled) setData(value); }).catch(() => { if (!cancelled) setError("Dokumen gagal dimuat."); });
    return () => { cancelled = true; };
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError("");
    try {
      const response = await cmsFetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!response.ok) throw new Error("Dokumen gagal disimpan. Periksa tautan HTTPS dan tahap pengajuan.");
      setData(await load());
      setForm(current => ({ ...current, mediaTitle: "", documentNumber: "", mediaLink: "", isVisibleToMitra: false }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Dokumen gagal disimpan."); }
    finally { setSaving(false); }
  }

  async function toggle(media: Data["media"][number]) {
    if (saving) return;
    setSaving(true); setError("");
    try {
      const response = await cmsFetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: media.id, isVisibleToMitra: !media.isVisibleToMitra }) });
      if (!response.ok) throw new Error("Visibilitas dokumen gagal diperbarui.");
      setData(await load());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Dokumen gagal diperbarui."); }
    finally { setSaving(false); }
  }

  const id = `inquiry-${leadId}`;
  return <section className="space-y-3 border-t border-white/15 pt-4">
    <h3 className="text-sm font-semibold text-[#F8ECEE]">Dokumen pengajuan</h3>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {!data && !error && <p role="status" className="text-sm text-[#C4A8AD]">Memuat dokumen...</p>}
    {data && <ul className="divide-y divide-white/10">
      {data.media.map(media => <li key={media.id} className="space-y-1 py-3">
        <a href={media.mediaLink} target="_blank" rel="noopener noreferrer" className="block text-sm font-medium text-white underline underline-offset-4">{media.mediaTitle}</a>
        <p className="text-xs text-[#C4A8AD]">Tahap {media.stepOrder}{media.documentNumber ? ` · ${media.documentNumber}` : ""} · {media.isVisibleToMitra ? "Terlihat oleh mitra" : "Internal"}</p>
        <button type="button" disabled={saving} onClick={() => void toggle(media)} className="min-h-11 text-sm text-[#FF858D] underline underline-offset-4 disabled:opacity-50">{media.isVisibleToMitra ? "Sembunyikan dari mitra" : "Tampilkan ke mitra"}</button>
      </li>)}
    </ul>}
    <details className="text-sm text-[#F8ECEE]">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium">Tambahkan tautan dokumen</summary>
      <form onSubmit={event => void save(event)} className="mt-2 space-y-3">
        <div><label htmlFor={`${id}-step`} className="mb-1 block text-xs text-[#C4A8AD]">Tahap</label><select id={`${id}-step`} className={inputClass} value={form.stepOrder} onChange={event => setForm(current => ({ ...current, stepOrder: Number(event.target.value) }))}>{data?.steps.map(step => <option key={step.stepOrder} value={step.stepOrder}>{step.stepOrder}. {step.title}</option>)}</select></div>
        <div><label htmlFor={`${id}-title`} className="mb-1 block text-xs text-[#C4A8AD]">Judul dokumen</label><input id={`${id}-title`} className={inputClass} required minLength={2} maxLength={160} value={form.mediaTitle} onChange={event => setForm(current => ({ ...current, mediaTitle: event.target.value }))} /></div>
        <div><label htmlFor={`${id}-number`} className="mb-1 block text-xs text-[#C4A8AD]">Nomor dokumen (opsional)</label><input id={`${id}-number`} className={inputClass} maxLength={160} value={form.documentNumber} onChange={event => setForm(current => ({ ...current, documentNumber: event.target.value }))} /></div>
        <div><label htmlFor={`${id}-url`} className="mb-1 block text-xs text-[#C4A8AD]">Tautan HTTPS</label><input id={`${id}-url`} className={inputClass} type="url" required maxLength={2048} value={form.mediaLink} onChange={event => setForm(current => ({ ...current, mediaLink: event.target.value }))} /></div>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={form.isVisibleToMitra} onChange={event => setForm(current => ({ ...current, isVisibleToMitra: event.target.checked }))} />Tampilkan ke mitra</label>
        <button type="submit" disabled={saving || !data?.steps.length} className="min-h-11 w-full rounded-md bg-[#E31E2D] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Menyimpan..." : "Simpan dokumen"}</button>
      </form>
    </details>
  </section>;
}
