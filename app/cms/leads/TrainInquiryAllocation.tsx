"use client";

import { useState, type FormEvent } from "react";
import { cmsFetch } from "@/lib/cms-fetch";
import { trainCampaignPeriod, type CmsTrainInquiry } from "@/lib/train-advertising-shared";

export default function TrainInquiryAllocation({ leadId, inquiry, onSaved }: {
  leadId: string; inquiry: CmsTrainInquiry; onSaved: () => Promise<void>;
}) {
  const [codes, setCodes] = useState(inquiry.allocatedTrainsets);
  const [notes, setNotes] = useState(inquiry.allocationNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback("");
    try {
      const response = await cmsFetch(`/api/cms/leads/${leadId}/train-allocation`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocatedTrainsets: codes, allocationNotes: notes.trim() || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Alokasi gagal disimpan.");
      await onSaved();
      setFeedback("Alokasi disimpan.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Alokasi gagal disimpan.");
    } finally { setSaving(false); }
  }

  return <section className="mt-4 rounded-xl border border-[var(--work-line)] bg-[var(--work-subtle)] p-4 text-[var(--work-text)]">
    <h3 className="text-sm font-semibold">{inquiry.mediaCode} · {inquiry.mediaTitle}</h3>
    <p className="mt-2 text-sm text-[var(--work-muted)]">{inquiry.train.name} · {trainCampaignPeriod(inquiry)}</p>
    {inquiry.requestedTrainsetCount !== null && <p className="mt-2 text-sm">Permintaan {inquiry.requestedTrainsetCount} trainset</p>}
    {inquiry.carPreferences.length > 0 && <p className="mt-2 text-sm">{inquiry.carPreferences.map(car => car.carLabel).join(", ")}</p>}
    {inquiry.applicantStatusLabel && <dl className="mt-3 space-y-2 text-sm">
      <div><dt className="text-[var(--work-muted)]">Status pengaju</dt><dd>{inquiry.applicantStatusLabel}</dd></div>
      {inquiry.representedBrand && <div><dt className="text-[var(--work-muted)]">Brand yang diwakili</dt><dd>{inquiry.representedBrand}</dd></div>}
      <div><dt className="text-[var(--work-muted)]">Kategori bisnis</dt><dd>{inquiry.businessCategoryOther ?? inquiry.businessCategoryLabel}</dd></div>
    </dl>}
    {inquiry.campaignNeeds && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--work-muted)]">{inquiry.campaignNeeds}</p>}
    <form onSubmit={submit} className="mt-4 border-t border-[var(--work-line)] pt-4">
      <fieldset disabled={saving}>
        <legend className="text-sm font-semibold">Alokasi trainset internal</legend>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {inquiry.train.trainsets.map(trainset => <label key={trainset.code} className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--work-line)] px-3 text-sm">
            <input type="checkbox" checked={codes.includes(trainset.code)} disabled={!trainset.isActive && !codes.includes(trainset.code)}
              onChange={event => setCodes(current => event.target.checked ? [...current, trainset.code] : current.filter(code => code !== trainset.code))} />
            {trainset.code}{!trainset.isActive && " (nonaktif)"}
          </label>)}
        </div>
        <label className="mt-4 block text-sm">Catatan internal<textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength={5000} rows={3} className="mt-2 w-full rounded-lg border border-[var(--work-control)] bg-[var(--work-surface)] p-3 text-sm" /></label>
      </fieldset>
      <button disabled={saving} className="mt-3 min-h-11 rounded-lg bg-[#E31E2D] px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Menyimpan…" : "Simpan alokasi"}</button>
      {feedback && <p role="status" className="mt-3 text-sm">{feedback}</p>}
    </form>
  </section>;
}
