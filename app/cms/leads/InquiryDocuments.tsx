"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { cmsFetch } from "@/lib/cms-fetch";
import { INQUIRY_DOCUMENT_TYPES, INQUIRY_DOCUMENT_LABELS, inquiryDocumentTypeSchema, isInquiryDocumentLocked, type InquiryDocumentType } from "@/lib/inquiry-media";

const responseSchema = z.object({
  canWrite: z.boolean(), verificationLocked: z.boolean(),
  media: z.array(z.object({
    id: z.string(), stepOrder: z.number().int(), mediaTitle: z.string(),
    documentType: z.string(), documentNumber: z.string().nullable(), mediaLink: z.string(),
    isStored: z.boolean(), fileName: z.string().nullable(), sizeBytes: z.number().nullable(),
    isVisibleToMitra: z.boolean(), verifiedAt: z.string().nullable(),
  })),
});
type Data = z.infer<typeof responseSchema>;
type Media = Data["media"][number];
const inputClass = "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D81435]/25 focus-visible:border-[#D81435] disabled:cursor-not-allowed disabled:opacity-50";
const actionClass = "inline-flex h-10 items-center rounded-md px-2 text-sm font-medium text-[#D81435] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D81435]/25 disabled:pointer-events-none disabled:opacity-50";

function documentHref(media: Media, leadId: string) {
  if (media.isStored) return `/api/inquiries/${encodeURIComponent(leadId)}/documents/${encodeURIComponent(media.id)}`;
  try {
    const url = new URL(media.mediaLink);
    if (url.protocol === "https:" && !url.username && !url.password) return url.href;
  } catch { /* Broken legacy links are shown as text, never as executable URLs. */ }
  return null;
}

async function responseError(response: Response, fallback: string) {
  const body: unknown = await response.json().catch(() => null);
  const parsed = z.object({ error: z.string() }).safeParse(body);
  return parsed.success ? parsed.data.error : fallback;
}

type Props = {
  leadId: string;
  onChange?: () => void;
  documentTypes?: readonly InquiryDocumentType[];
  onDraftChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  parentSaving?: boolean;
  leadStatus?: string;
};

export default function InquiryDocuments({ leadId, onChange, documentTypes, onDraftChange, onBusyChange, parentSaving = false, leadStatus }: Props) {
  const types = documentTypes ?? INQUIRY_DOCUMENT_TYPES;
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [documentType, setDocumentType] = useState<InquiryDocumentType>(types[0]);
  const busy = saving || parentSaving;
  const verificationLocked = leadStatus ? isInquiryDocumentLocked(leadStatus) : data?.verificationLocked;
  const endpoint = `/api/cms/leads/${encodeURIComponent(leadId)}/media`;
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await cmsFetch(endpoint, { cache: "no-store", signal });
    if (!response.ok) throw new Error(await responseError(response, "Dokumen gagal dimuat. Coba muat ulang."));
    return responseSchema.parse(await response.json());
  }, [endpoint]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).then(setData).catch(() => {
      if (!controller.signal.aborted) setError("Dokumen gagal dimuat. Coba muat ulang.");
    });
    return () => { controller.abort(); };
  }, [load, leadStatus]);

  async function retry() {
    setRetrying(true); setError("");
    try { setData(await load()); }
    catch { setError("Dokumen gagal dimuat. Coba muat ulang."); }
    finally { setRetrying(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const body = new FormData(form);
    const file = body.get("file");
    if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024 || !/\.pdf$/i.test(file.name) || file.type !== "application/pdf") {
      setError("Pilih satu berkas PDF (.pdf) maksimal 10 MB."); return;
    }
    body.set("isVisibleToMitra", body.get("isVisibleToMitra") === "on" ? "true" : "false");
    setSaving(true); onBusyChange?.(true); setError(""); setNotice("");
    try {
      const response = await cmsFetch(endpoint, { method: "POST", body });
      if (!response.ok) throw new Error(await responseError(response, "Dokumen gagal diunggah. Coba lagi."));
      form.reset(); setDocumentType(types[0]); onDraftChange?.(false);
      setNotice("PDF tersimpan. Periksa isi dokumen, lalu verifikasi secara terpisah.");
      onChange?.();
      setData(await load());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Dokumen gagal diunggah."); }
    finally { setSaving(false); onBusyChange?.(false); }
  }

  async function update(media: Media, changes: { isVisibleToMitra?: boolean; verified?: boolean }) {
    if (busy) return;
    setSaving(true); onBusyChange?.(true); setError(""); setNotice("");
    try {
      const response = await cmsFetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: media.id, ...changes }) });
      if (!response.ok) throw new Error(await responseError(response, "Dokumen gagal diperbarui. Coba lagi."));
      setNotice(changes.verified === true ? "Dokumen telah diverifikasi." : changes.verified === false ? "Verifikasi dibatalkan." : "Visibilitas dokumen diperbarui.");
      onChange?.();
      setData(await load());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Dokumen gagal diperbarui."); }
    finally { setSaving(false); onBusyChange?.(false); }
  }

  function renderMedia(media: Media) {
    const href = documentHref(media, leadId);
    return <li key={media.id} className="min-w-0 space-y-1 py-3">
      {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 max-w-full items-center break-all text-sm font-medium text-[var(--work-accent)] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[var(--work-accent)]">{media.fileName || media.mediaTitle}<span className="sr-only"> (buka di tab baru)</span></a> : <p className="break-all text-sm text-[var(--work-text)]">{media.mediaTitle} · Tautan tidak valid</p>}
      <p className="break-words text-sm text-[var(--work-muted)]">{media.documentNumber ? `No. ${media.documentNumber} · ` : ""}{media.isVisibleToMitra ? "Dibagikan ke mitra" : "Internal"}{media.sizeBytes ? ` · ${(media.sizeBytes / 1024 / 1024).toLocaleString("id-ID", { maximumFractionDigits: 2 })} MB` : ""}</p>
      <p className={`text-sm ${media.verifiedAt ? "text-[var(--work-success)]" : "text-[var(--work-muted)]"}`}>{!media.isStored ? "Tautan lama · tidak dihitung sebagai dokumen terverifikasi" : media.verifiedAt ? "Terverifikasi oleh admin" : "Belum diverifikasi"}</p>
      {data?.canWrite && <div className="flex flex-wrap gap-x-3">
        <button type="button" disabled={busy} onClick={() => void update(media, { isVisibleToMitra: !media.isVisibleToMitra })} className={actionClass}>{media.isVisibleToMitra ? "Jadikan internal" : "Bagikan ke mitra"}<span className="sr-only">: {media.fileName || media.mediaTitle}</span></button>
        {media.isStored && <button type="button" disabled={busy || (!!media.verifiedAt && verificationLocked)} onClick={() => void update(media, { verified: !media.verifiedAt })} className={actionClass}>{media.verifiedAt ? verificationLocked ? "Verifikasi terkunci" : "Batalkan verifikasi" : "Verifikasi PDF"}<span className="sr-only">: {media.fileName || media.mediaTitle}</span></button>}
      </div>}
    </li>;
  }

  const id = `inquiry-${leadId}`;
  const legacy = !documentTypes ? data?.media.filter(media => !media.isStored) ?? [] : [];
  return <section aria-labelledby={`${id}-heading`} aria-busy={busy || retrying} className="min-w-0 space-y-4">
    <div><h3 id={`${id}-heading`} className="text-sm font-semibold text-[var(--work-text)]">{documentTypes ? "Dokumen tahap ini" : "Semua dokumen pengajuan"}</h3><p className="mt-1 text-xs leading-relaxed text-[var(--work-muted)]">PDF maksimal 10 MB. Unggah, periksa isi, lalu verifikasi secara terpisah.</p></div>
    {error && <div role="alert" className="text-sm text-[var(--work-danger)]"><p>{error}</p><button type="button" disabled={retrying || busy} onClick={() => void retry()} className={actionClass}>{retrying ? "Memuat ulang..." : "Muat ulang dokumen"}</button></div>}
    <p role="status" className="text-sm text-[var(--work-muted)]">{saving ? "Menyimpan perubahan dokumen..." : notice || (!data && !error ? "Memuat dokumen..." : "")}</p>
    {data && <>
      {!data.canWrite && <p className="text-sm text-[var(--work-muted)]">Akses baca saja. Unggahan dan verifikasi hanya dapat dilakukan ADMIN.</p>}
      <div className="divide-y divide-[var(--work-line)] rounded-lg border border-[var(--work-line)] px-4">{types.map(type => {
        const documents = data.media.filter(media => media.isStored && media.documentType === type);
        return <section key={type} aria-labelledby={`${id}-${type}`} className="py-3">
          <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2"><h4 id={`${id}-${type}`} className="text-sm font-medium text-[var(--work-text)]">{INQUIRY_DOCUMENT_LABELS[type]}{type === "OTHER" ? " (opsional)" : ""}</h4><span className={`text-xs ${documents.some(media => media.verifiedAt) ? "text-[var(--work-success)]" : "text-[var(--work-muted)]"}`}>{documents.some(media => media.verifiedAt) ? "Terverifikasi" : documents.length ? "Perlu verifikasi" : "Belum diunggah"}</span></div>
          {documents.length > 0 && <ul className="divide-y divide-[var(--work-line)]">{documents.map(renderMedia)}</ul>}
        </section>;
      })}</div>
      {legacy.length > 0 && <section aria-labelledby={`${id}-legacy`} className="border-t border-[var(--work-line)] pt-3"><h4 id={`${id}-legacy`} className="text-sm font-semibold text-[var(--work-text)]">Tautan dokumen lama</h4><p className="mt-1 text-sm text-[var(--work-muted)]">Tetap dapat dibaca. Unggah ulang PDF untuk memenuhi persyaratan verifikasi.</p><ul className="divide-y divide-[var(--work-line)]">{legacy.map(renderMedia)}</ul></section>}
      {data.canWrite && <details className="border-t border-[var(--work-line)] pt-2 text-sm text-[var(--work-text)]">
        <summary className="min-h-11 cursor-pointer py-3 font-medium text-[var(--work-accent)] focus-visible:outline-2 focus-visible:outline-[var(--work-accent)]">Unggah PDF baru</summary>
        <form onSubmit={event => void save(event)} onChange={() => onDraftChange?.(true)} className="mt-2 space-y-3">
          <fieldset disabled={busy} className="space-y-3">
            <div><label htmlFor={`${id}-type`} className="mb-1 block text-sm text-[var(--work-muted)]">Jenis dokumen</label><select id={`${id}-type`} name="documentType" className={inputClass} value={documentType} onChange={event => setDocumentType(inquiryDocumentTypeSchema.parse(event.target.value))}>{types.map(type => <option key={type} value={type}>{INQUIRY_DOCUMENT_LABELS[type]}</option>)}</select></div>
            <div><label htmlFor={`${id}-number`} className="mb-1 block text-sm text-[var(--work-muted)]">Nomor dokumen (opsional)</label><input id={`${id}-number`} name="documentNumber" className={inputClass} maxLength={160} /></div>
            <div><label htmlFor={`${id}-file`} className="mb-1 block text-sm text-[var(--work-muted)]">Berkas PDF</label><input id={`${id}-file`} name="file" type="file" accept="application/pdf,.pdf" required aria-describedby={`${id}-hint`} className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-[var(--work-subtle)] file:px-3 file:py-1 file:text-[var(--work-text)]`} /><p id={`${id}-hint`} className="mt-1 text-sm text-[var(--work-muted)]">Maksimal 10 MB. Unggahan baru belum otomatis terverifikasi.</p></div>
            <label className="flex min-h-11 items-center gap-2"><input name="isVisibleToMitra" type="checkbox" className="size-4 accent-[#E31E2D]" />Bagikan dokumen ke mitra pemilik pengajuan</label>
            <button type="submit" className="min-h-11 w-full rounded-md bg-[#E31E2D] px-3 py-2 text-sm font-semibold text-white hover:bg-[#c91826] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--work-accent)] disabled:opacity-50" disabled={busy}>{saving ? "Mengunggah..." : "Unggah PDF"}</button>
          </fieldset>
        </form>
      </details>}
    </>}
  </section>;
}
