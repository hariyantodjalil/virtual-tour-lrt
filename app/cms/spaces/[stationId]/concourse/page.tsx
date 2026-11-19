"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cmsFetch } from "@/lib/cms-fetch";
import { cmsUi } from "@/lib/cms-ui";
import { CONCOURSE_ACCESS, CONCOURSE_LABELS, CONCOURSE_SECTIONS, concourseAssetCode, type ConcourseLayout, type ConcourseSlot } from "@/lib/concourse-plan";

type Catalog = {
  name: string;
  code: string | null;
  assetCodePrefix: string | null;
  concourseLayout: ConcourseLayout | null;
  concourseSlots: ConcourseSlot[];
  commercialSpaces: { id: string; code: string; name: string }[];
};

const rows = ["Atas", "Tengah", "Bawah"];
const initialSlot: ConcourseSlot = {
  id: "", spaceId: null, section: "CENTER", access: "UNP", kind: "F", sequence: 1, row: 1, position: 1,
};
const control = "min-h-11 w-full rounded-lg border border-[var(--work-line)] bg-[var(--work-subtle)] px-3 py-2 text-sm text-[var(--work-text)]";

export default function ConcourseEditorPage() {
  const { stationId } = useParams<{ stationId: string }>();
  const endpoint = `/api/cms/spaces/station/${encodeURIComponent(stationId)}/concourse`;
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [draft, setDraft] = useState<ConcourseSlot | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    cmsFetch(endpoint, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Gagal memuat denah stasiun.");
      const data: Catalog = await response.json();
      if (!controller.signal.aborted) setCatalog(data);
    }).catch(() => { if (!controller.signal.aborted) setMessage("Gagal memuat denah stasiun."); });
    return () => controller.abort();
  }, [endpoint]);

  const layout = catalog?.concourseLayout;
  const prefix = catalog?.assetCodePrefix ?? catalog?.code;
  const unitById = new Map(catalog?.commercialSpaces.map(unit => [unit.id, unit]));
  const linkedIds = new Set(catalog?.concourseSlots.map(slot => slot.spaceId));

  function add() {
    if (!layout || !catalog) return;
    const access = layout === "C" ? "UNP" : CONCOURSE_ACCESS[layout].CENTER;
    const lastUsed = Math.max(0, ...catalog.concourseSlots.filter(slot => slot.access === access).map(slot => slot.sequence));
    setDraft({ ...initialSlot, access, sequence: Math.min(lastUsed + 1, 999) });
    setMessage("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await cmsFetch(endpoint, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, id: draft.id || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan posisi.");
      const saved: ConcourseSlot = data;
      setCatalog(current => current && ({
        ...current, concourseSlots: [...current.concourseSlots.filter(slot => slot.id !== saved.id), saved],
      }));
      setDraft(null);
      setMessage("Kode dan posisi aset disimpan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan posisi.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="mx-auto max-w-4xl space-y-5">
    <Button variant="ghost" asChild><Link href={`/cms/spaces/${stationId}`}>Kembali ke Ruang Komersial</Link></Button>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-xl font-semibold text-[var(--work-text)]">Denah &amp; kode aset</h1>
        {catalog && <p className={`mt-1 text-sm ${cmsUi.muted}`}>{catalog.name}{layout && ` · Concourse · Tipe ${layout}`}</p>}
      </div>
      {layout && prefix && <Button type="button" className={cmsUi.primaryBtn} onClick={add} disabled={saving}>Tambah posisi</Button>}
    </div>
    {!catalog && !message && <p role="status">Memuat denah…</p>}
    {message && <p role="status" className="text-sm text-[var(--work-text)]">{message}</p>}
    {catalog && (!layout || !prefix) && <p className={cmsUi.muted}>Tipe denah atau kode stasiun belum tersedia.</p>}
    {draft && layout && prefix && <form onSubmit={save} className={`space-y-4 rounded-xl p-4 ${cmsUi.card}`}>
      <h2 className="font-semibold text-[var(--work-text)]">{concourseAssetCode(prefix, draft)}</h2>
      <fieldset disabled={saving} className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">Zona<select className={control} value={draft.section} onChange={event => {
          const section = event.target.value as ConcourseSlot["section"];
          setDraft({ ...draft, section, access: layout === "C" ? draft.access : CONCOURSE_ACCESS[layout][section] });
        }}>{CONCOURSE_SECTIONS.map(section => <option key={section} value={section}>{CONCOURSE_LABELS[layout][section]}</option>)}</select></label>
        {layout === "C" && <label className="space-y-1 text-sm">Akses<select className={control} value={draft.access}
          onChange={event => setDraft({ ...draft, access: event.target.value as ConcourseSlot["access"] })}>
          <option value="PAD">Paid</option><option value="UNP">Unpaid</option>
        </select></label>}
        <label className="space-y-1 text-sm">Jenis aset<select className={control} value={draft.kind}
          onChange={event => setDraft({ ...draft, kind: event.target.value as ConcourseSlot["kind"] })}>
          <option value="F">Fixed (F)</option><option value="Z">Zoning (Z)</option>
        </select></label>
        <label className="space-y-1 text-sm">Nomor urut {draft.access}<input className={control} required type="number" min={1} max={999} value={draft.sequence || ""}
          onChange={event => setDraft({ ...draft, sequence: Number(event.target.value) })} /></label>
        <label className="space-y-1 text-sm">Posisi baris<select className={control} value={draft.row}
          onChange={event => setDraft({ ...draft, row: Number(event.target.value) })}>
          {rows.map((row, index) => <option key={row} value={index}>{row}</option>)}
        </select></label>
        <label className="space-y-1 text-sm">Urutan kiri ke kanan<input className={control} required type="number" min={1} max={999} value={draft.position || ""}
          onChange={event => setDraft({ ...draft, position: Number(event.target.value) })} /></label>
        <label className="space-y-1 text-sm sm:col-span-3">Unit komersial<select className={control} value={draft.spaceId ?? ""}
          onChange={event => setDraft({ ...draft, spaceId: event.target.value || null })}>
          <option value="">Belum diverifikasi</option>
          {catalog?.commercialSpaces.filter(unit => unit.id === draft.spaceId || !linkedIds.has(unit.id))
            .map(unit => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}
        </select></label>
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" className={cmsUi.primaryBtn} disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</Button>
        <Button type="button" variant="outline" onClick={() => setDraft(null)} disabled={saving}>Batal</Button>
      </div>
    </form>}
    {layout && prefix && catalog && <ul className={`divide-y divide-[var(--work-line)] rounded-xl ${cmsUi.card}`}>
      {catalog.concourseSlots.length === 0 && <li className="p-4 text-sm">Belum ada posisi aset.</li>}
      {[...catalog.concourseSlots].sort((a, b) => a.access.localeCompare(b.access) || a.sequence - b.sequence).map(slot => {
        const unit = slot.spaceId ? unitById.get(slot.spaceId) : undefined;
        return <li key={slot.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="break-all text-sm font-semibold">{concourseAssetCode(prefix, slot)}</p>
            <p className={`mt-1 text-xs ${cmsUi.muted}`}>{CONCOURSE_LABELS[layout][slot.section]} · {rows[slot.row]} · {unit ? unit.name : "Belum diverifikasi"}</p>
          </div>
          <Button type="button" variant="outline" disabled={saving} onClick={() => { setDraft(slot); setMessage(""); }}>Edit</Button>
        </li>;
      })}
    </ul>}
  </div>;
}
