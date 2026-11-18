"use client";

import { useState } from "react";
import { ArrowRight, CalendarClock, Check, ChevronRight, FileText, LockKeyhole, NotebookPen } from "lucide-react";
import { PUBLIC_LEAD_PROCESS_STEPS, canonicalLeadStatus, completedLeadStageIndex, SITE_VISIT_STATUS_LABELS, SITE_VISIT_STATUS_VALUES, type CommercialLeadStatus } from "@/lib/commercial-pipeline";
import { leaseExpiryReminder } from "@/lib/inquiry-workflow";
import type { InquiryDocumentType } from "@/lib/inquiry-media";
import InquiryDocuments from "./InquiryDocuments";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import type { LeadItem } from "@/lib/cms-leads-shared";

const control = "flex h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D81435]/25 focus-visible:border-[#D81435] disabled:cursor-not-allowed disabled:opacity-50";
const primary = "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#D81435] px-4 text-sm font-medium text-white hover:bg-[#B8112D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D81435]/25 disabled:pointer-events-none disabled:opacity-50";
const secondary = "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D81435]/25 disabled:pointer-events-none disabled:opacity-50";
const stageNames = ["Pengajuan", "Kontak mitra", "Negosiasi", "Desain", "PKS & periode", "Aktivasi sewa"];
const stageActions = ["", "Konfirmasi sudah dihubungi", "Selesaikan negosiasi", "Setujui desain", "Konfirmasi PKS", "Aktifkan sewa"];
const stageDocuments: Partial<Record<number, readonly InquiryDocumentType[]>> = {
  2: ["LOI", "NEGOTIATION_LETTER", "NEGOTIATION_MINUTES"],
  3: ["DESIGN_APPROVAL"],
  4: ["PKS_FINAL"],
};
type View = "stages" | "documents" | "notes";
type Draft = { start: string; end: string; payment: boolean; visit: string; scheduled: string; notes: string; reason: string };
function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value.slice(0, 16);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function dateLabel(value: string | null) {
  return value ? new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }) : "Belum ditetapkan";
}

export default function LeadWorkflowPanel({ lead, saving, canManage, onSave, onReload }: {
  lead: LeadItem; saving: boolean; canManage: boolean;
  onSave: (body: Record<string, unknown>) => Promise<boolean>;
  onReload: () => Promise<void>;
}) {
  const completed = completedLeadStageIndex(lead.status);
  const status = canonicalLeadStatus(lead.status as CommercialLeadStatus);
  const stopped = status === "CLOSED_LOST";
  const active = status === "COMMERCIAL_OPERATION";
  const next = status === "NEW" ? "CONTACTED" : ["CONTACTED", "NEGOTIATING"].includes(status) ? "BA_SIGNED" : status === "BA_SIGNED" ? "DESIGN_REVIEW" : status === "DESIGN_REVIEW" ? "PKS" : status === "PKS" ? "COMMERCIAL_OPERATION" : null;
  const nextIndex = PUBLIC_LEAD_PROCESS_STEPS.findIndex(step => step.status === next);
  const [selected, setSelected] = useState(() => nextIndex >= 0 ? nextIndex : active ? 5 : 0);
  const [view, setView] = useState<View>("stages");
  // Keep only local edits. Server refreshes update clean fields without discarding other drafts.
  const [changes, setChanges] = useState<Partial<Draft>>({});
  const draft: Draft = { start: lead.leaseStartAt?.slice(0, 10) ?? "", end: lead.leaseEndAt?.slice(0, 10) ?? "", payment: Boolean(lead.paymentVerifiedAt), visit: lead.siteVisitStatus, scheduled: localDateTime(lead.siteVisitScheduledAt), notes: lead.notes ?? "", reason: lead.rejectionReason ?? "", ...changes };
  const change = <K extends keyof Draft>(key: K, value: Draft[K]) => setChanges(current => ({ ...current, [key]: value }));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploadDirty, setUploadDirty] = useState(false);
  const [documentBusy, setDocumentBusy] = useState(false);
  const { confirmDialog, confirmElement } = useConfirmDialog();
  const busy = saving || documentBusy;
  const disabled = !canManage || busy;
  const id = `workflow-${lead.id}`;
  const step = PUBLIC_LEAD_PROCESS_STEPS[selected];
  const reminder = active ? leaseExpiryReminder(lead.leaseEndAt) : null;
  const documentTypes = view === "stages" ? stageDocuments[selected] : undefined;
  const showDocuments = view === "documents" || (view === "stages" && Boolean(documentTypes));
  const stageDraftDirty = selected === 2 ? changes.visit !== undefined || changes.scheduled !== undefined : selected === 4 ? changes.start !== undefined || changes.end !== undefined : selected === 5 ? changes.payment !== undefined : false;

  async function navigate(target: View, stage = selected) {
    if (busy || (target === view && stage === selected)) return;
    if (uploadDirty) {
      const confirmed = await confirmDialog({
        title: "Pindah bagian editor?",
        description: "Berkas yang dipilih belum diunggah. Pindah bagian akan membatalkan pilihan berkas.",
        confirmLabel: "Pindah",
      });
      if (!confirmed) return;
    }
    setUploadDirty(false); setView(target); setSelected(stage); setError(""); setMessage("");
  }
  async function confirmStop() {
    const confirmed = await confirmDialog({
      title: "Hentikan pengajuan ini?",
      description: "Reservasi unit dilepas dan alasan akan terlihat oleh mitra. Dokumen tetap disimpan untuk audit.",
      confirmLabel: "Ya, Hentikan",
      destructive: true,
    });
    if (confirmed) void save({ status: "CLOSED_LOST", rejectionReason: draft.reason }, ["reason"]);
  }
  async function save(body: Record<string, unknown>, fields: readonly (keyof Draft)[] = []) {
    if (disabled) return;
    setError(""); setMessage("");
    try {
      if (await onSave(body)) {
        setChanges(current => { const rest = { ...current }; for (const field of fields) delete rest[field]; return rest; });
        setMessage("Perubahan tersimpan.");
      } else setError("Perubahan belum tersimpan. Silakan coba lagi.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Perubahan belum tersimpan. Periksa koneksi lalu coba lagi."); }
  }

  return <section className="min-w-0 text-[var(--work-text)]" aria-label="Editor pengajuan">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-base font-semibold">Kelola pengajuan</h3><p className="mt-1 text-sm text-[var(--work-muted)]">{stopped ? "Pengajuan dihentikan. Dokumen tetap tersedia sebagai riwayat." : active ? "Sewa sudah aktif. Pantau periode dan dokumen pengajuan." : `${Math.max(0, completed + 1)} dari 6 tahap selesai · lanjutkan dari ${stageNames[Math.max(0, nextIndex)]}.`}</p></div>
      {!canManage && <span className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[var(--work-line)] px-2 text-xs text-[var(--work-muted)]"><LockKeyhole className="size-3.5" aria-hidden="true" />Akses baca</span>}
    </div>
    {stopped && lead.rejectionReason && <p className="mt-4 rounded-lg border border-red-200 bg-[var(--work-danger-soft)] p-3 text-sm text-[var(--work-danger)]">Alasan penghentian: {lead.rejectionReason}</p>}
    <nav aria-label="Bagian editor pengajuan" className="mt-5 grid grid-cols-3 gap-1 border-b border-[var(--work-line)] sm:flex sm:flex-wrap sm:gap-x-5">
      {([{ key: "stages", label: "Tahapan", short: "Tahapan", icon: CalendarClock }, { key: "documents", label: "Semua dokumen", short: "Dokumen", icon: FileText }, { key: "notes", label: "Catatan & pengelolaan", short: "Catatan", icon: NotebookPen }] as const).map(item => <button key={item.key} type="button" aria-pressed={view === item.key} disabled={busy} onClick={() => navigate(item.key)} className={`inline-flex min-h-11 items-center justify-center gap-2 border-b-2 px-1 py-3 text-xs sm:justify-start sm:text-sm focus-visible:outline-2 focus-visible:outline-[var(--work-accent)] disabled:opacity-50 ${view === item.key ? "border-[var(--work-accent)] font-semibold text-[var(--work-accent)]" : "border-transparent text-[var(--work-muted)] hover:text-[var(--work-accent)]"}`}><item.icon aria-hidden="true" className="hidden size-4 sm:block" /><span className="sm:hidden">{item.short}</span><span className="hidden sm:inline">{item.label}</span></button>)}
    </nav>
    <div className={view === "stages" ? "mt-5 grid min-w-0 gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]" : "mt-5 min-w-0"}>
      {view === "stages" && <>
        <div className="lg:hidden"><label htmlFor={`${id}-stage`} className="mb-2 block text-xs font-medium text-[var(--work-muted)]">Lihat tahap</label><select id={`${id}-stage`} value={selected} disabled={busy} onChange={event => navigate("stages", Number(event.target.value))} className={control}>{PUBLIC_LEAD_PROCESS_STEPS.map((item, index) => <option key={item.status} value={index}>{index + 1}. {item.title}{index <= completed ? " · selesai" : ""}</option>)}</select></div>
        <nav aria-label="Enam tahap pengajuan" className="hidden lg:block"><ol className="space-y-1">{PUBLIC_LEAD_PROCESS_STEPS.map((item, index) => <li key={item.status}><button type="button" disabled={busy} aria-current={selected === index ? "step" : undefined} onClick={() => navigate("stages", index)} className={`flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-[var(--work-accent)] disabled:opacity-50 ${selected === index ? "bg-[var(--work-accent-soft)] text-[var(--work-accent)]" : "text-[var(--work-muted)] hover:bg-[var(--work-subtle)]"}`}><span aria-hidden="true" className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${index <= completed ? "bg-[var(--work-success-soft)] text-[var(--work-success)]" : selected === index ? "bg-[#E31E2D] text-white" : "border border-[var(--work-control)]"}`}>{index <= completed ? <Check className="size-3.5" /> : index + 1}</span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{stageNames[index]}</span>{index > completed && (stopped ? <span className="mt-0.5 block text-xs text-[var(--work-muted)]">Tidak dilanjutkan</span> : index === nextIndex ? <span className="mt-0.5 block text-xs font-medium text-[var(--work-accent)]">Perlu ditindaklanjuti</span> : null)}</span>{selected === index && <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" />}</button></li>)}</ol></nav>
      </>}
      <div className="min-w-0 space-y-5">
        {view === "stages" && <header className="border-b border-[var(--work-line)] pb-4"><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-[var(--work-muted)]">Tahap {selected + 1} dari 6</span>{selected <= completed ? <span className="inline-flex items-center gap-1 text-xs text-[var(--work-success)]"><Check aria-hidden="true" className="size-3.5" />Selesai</span> : <span className="rounded-md bg-[var(--work-subtle)] px-2 py-1 text-xs text-[var(--work-muted)]">{stopped ? "Tidak dilanjutkan" : "Belum dikonfirmasi"}</span>}</div><h4 className="mt-1 text-lg font-semibold">{step.title}</h4><p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--work-muted)]">{step.detail}</p></header>}
        {view === "stages" && selected === 0 && <dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-[var(--work-muted)]">Nomor pengajuan</dt><dd className="mt-1 font-medium">{lead.inquiryCode}</dd></div><div><dt className="text-xs text-[var(--work-muted)]">Diterima</dt><dd className="mt-1">{dateLabel(lead.createdAt)}</dd></div></dl>}
        {view === "stages" && selected === 1 && <div className="space-y-3 text-sm"><p className="text-[var(--work-muted)]">Hubungi penanggung jawab, lalu konfirmasikan tahap ini setelah komunikasi dilakukan.</p><dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-[var(--work-muted)]">Penanggung jawab</dt><dd className="mt-1 break-words font-medium">{lead.contactName}</dd></div><div><dt className="text-xs text-[var(--work-muted)]">Telepon</dt><dd className="mt-1 break-words">{lead.phone}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-[var(--work-muted)]">Email</dt><dd className="mt-1 break-all">{lead.email}</dd></div></dl></div>}
        {showDocuments && <InquiryDocuments key={`${view}-${selected}`} leadId={lead.id} documentTypes={documentTypes} parentSaving={saving} leadStatus={lead.status} onChange={() => { void onReload(); }} onDraftChange={setUploadDirty} onBusyChange={setDocumentBusy} />}
        {view === "stages" && selected === 2 && <details className="border-t border-[var(--work-line)] pt-3" open={lead.siteVisitStatus !== "NONE"}><summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[var(--work-accent)]"><CalendarClock aria-hidden="true" className="size-4" />Site visit<span className="ml-auto text-xs font-normal text-[var(--work-muted)]">{SITE_VISIT_STATUS_LABELS[lead.siteVisitStatus as keyof typeof SITE_VISIT_STATUS_LABELS] ?? lead.siteVisitStatus}</span></summary><div className="mt-3 space-y-3">
          {lead.surveyPreference && <p className="break-words text-sm leading-relaxed text-[var(--work-muted)]">Permintaan mitra: {lead.surveyPreference}</p>}
          {completed < 2 && !stopped ? <fieldset disabled={disabled} className="min-w-0 space-y-3"><legend className="sr-only">Jadwal site visit selama negosiasi</legend><div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor={`${id}-visit`} className="mb-2 block text-xs text-[var(--work-muted)]">Status kunjungan</label><select id={`${id}-visit`} className={control} value={draft.visit} onChange={event => change("visit", event.target.value)}>{SITE_VISIT_STATUS_VALUES.map(value => <option key={value} value={value}>{SITE_VISIT_STATUS_LABELS[value]}</option>)}</select></div><div><label htmlFor={`${id}-scheduled`} className="mb-2 block text-xs text-[var(--work-muted)]">Jadwal · waktu lokal perangkat</label><input id={`${id}-scheduled`} type="datetime-local" className={control} value={draft.scheduled} onChange={event => change("scheduled", event.target.value)} /></div></div><button type="button" className={secondary} onClick={() => { if (draft.scheduled && !Number.isFinite(Date.parse(draft.scheduled))) { setError("Periksa tanggal dan waktu site visit."); return; } void save({ siteVisitStatus: draft.visit, siteVisitScheduledAt: draft.scheduled ? new Date(draft.scheduled).toISOString() : null }, ["visit", "scheduled"]); }}>Simpan site visit</button></fieldset> : <p className="text-sm text-[var(--work-muted)]">{lead.siteVisitScheduledAt ? new Date(lead.siteVisitScheduledAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB" : "Tidak ada jadwal tersimpan."} Pengelolaan site visit selesai bersama negosiasi.</p>}
        </div></details>}
        {view === "stages" && selected === 4 && <fieldset disabled={disabled || active || stopped} className="min-w-0 space-y-4 border-t border-[var(--work-line)] pt-4"><legend className="sr-only">Periode sewa pada PKS</legend><h5 className="text-sm font-semibold">Periode sewa sesuai PKS</h5><div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor={`${id}-start`} className="mb-2 block text-xs text-[var(--work-muted)]">Tanggal mulai</label><input id={`${id}-start`} type="date" className={control} value={draft.start} onChange={event => change("start", event.target.value)} /></div><div><label htmlFor={`${id}-end`} className="mb-2 block text-xs text-[var(--work-muted)]">Tanggal berakhir</label><input id={`${id}-end`} type="date" min={draft.start || undefined} className={control} value={draft.end} onChange={event => change("end", event.target.value)} /></div></div><button type="button" className={secondary} onClick={() => void save({ leaseStartAt: draft.start || null, leaseEndAt: draft.end || null }, ["start", "end"])}>Simpan periode sewa</button></fieldset>}
        {view === "stages" && selected === 5 && <div className="space-y-5"><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-[var(--work-muted)]">Mulai sewa · WIB</dt><dd className="mt-1">{dateLabel(lead.leaseStartAt)}</dd></div><div><dt className="text-xs text-[var(--work-muted)]">Akhir sewa · WIB</dt><dd className="mt-1">{dateLabel(lead.leaseEndAt)}</dd></div></dl><fieldset disabled={disabled || active || stopped || completed < 4} className="space-y-3 border-t border-[var(--work-line)] pt-4"><legend className="sr-only">Verifikasi pembayaran</legend><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-[#E31E2D]" checked={draft.payment} onChange={event => change("payment", event.target.checked)} />Pembayaran telah diperiksa dan diverifikasi admin</label><button type="button" className={secondary} onClick={() => void save({ paymentVerified: draft.payment }, ["payment"])}>Simpan verifikasi pembayaran</button></fieldset>{completed < 4 && <p className="text-xs text-[var(--work-muted)]">Verifikasi pembayaran tersedia setelah PKS dikonfirmasi.</p>}{lead.paymentVerifiedAt && <p className="text-sm text-[var(--work-success)]">Pembayaran terverifikasi {new Date(lead.paymentVerifiedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB.</p>}{reminder && <div role="status" className="rounded-lg border border-amber-200 bg-[var(--work-warning-soft)] p-3"><p className="text-sm font-semibold text-[var(--work-warning)]">{reminder.label} · internal</p><p className="mt-1 text-sm text-[var(--work-warning)]">{reminder.remainingDays >= 0 ? `${reminder.remainingDays} hari sebelum sewa berakhir.` : `${Math.abs(reminder.remainingDays)} hari sejak sewa berakhir.`} Hubungi mitra untuk tindak lanjut.</p></div>}</div>}
        {view === "notes" && <div className="max-w-2xl space-y-6"><div><h4 className="text-base font-semibold">Catatan internal</h4><p className="mt-1 text-sm text-[var(--work-muted)]">Hanya untuk tim pengelola. Tidak ditampilkan kepada mitra.</p><label htmlFor={`${id}-notes`} className="sr-only">Catatan internal</label><textarea id={`${id}-notes`} className={`${control} mt-3`} rows={4} maxLength={5000} disabled={disabled} value={draft.notes} onChange={event => change("notes", event.target.value)} /><button type="button" className={`${secondary} mt-3`} disabled={disabled} onClick={() => void save({ notes: draft.notes || null }, ["notes"])}>Simpan catatan</button></div><details className="border-t border-red-200 pt-4"><summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-[var(--work-danger)] focus-visible:outline-2 focus-visible:outline-[var(--work-danger)]">Hentikan pengajuan</summary><p className="mt-2 text-sm leading-relaxed text-[var(--work-muted)]">Alasan akan terlihat oleh mitra. Reservasi dilepas, dokumen tetap disimpan untuk audit.</p><label htmlFor={`${id}-reason`} className="mt-4 mb-2 block text-xs text-[var(--work-muted)]">Alasan penghentian</label><textarea id={`${id}-reason`} className={control} rows={3} maxLength={2000} disabled={disabled || active || stopped} value={draft.reason} onChange={event => change("reason", event.target.value)} /><button type="button" disabled={disabled || active || stopped || !draft.reason.trim()} className="mt-3 min-h-11 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-[var(--work-danger)] disabled:opacity-50" onClick={() => void confirmStop()}>Konfirmasi penghentian</button></details></div>}
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-[var(--work-danger-soft)] p-3 text-sm text-[var(--work-danger)]">{error}</p>}
        {message && <p role="status" className="text-sm text-[var(--work-success)]">{message}</p>}
        {view === "stages" && next && <footer className="flex flex-col gap-3 border-t border-[var(--work-line)] pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-prose text-xs leading-relaxed text-[var(--work-muted)]">{selected === nextIndex ? "Simpan perubahan terlebih dahulu. Konfirmasi tahap diperiksa kembali oleh sistem." : "Memilih tahap hanya mengubah tampilan, bukan status pengajuan."}</p><div className="flex shrink-0 flex-wrap gap-2">{selected === 2 && status === "CONTACTED" && <button type="button" disabled={disabled} className={secondary} onClick={() => void save({ status: "NEGOTIATING" })}>Mulai negosiasi</button>}{selected === nextIndex ? <button type="button" className={primary} disabled={disabled || uploadDirty || stageDraftDirty} onClick={() => void save({ status: next })}>{saving ? "Menyimpan…" : stageActions[selected]}<ArrowRight aria-hidden="true" className="size-4" /></button> : <button type="button" className={secondary} disabled={busy} onClick={() => navigate("stages", nextIndex)}>Ke tahap berikutnya<ArrowRight aria-hidden="true" className="size-4" /></button>}</div></footer>}
      </div>
    </div>
    {confirmElement}
  </section>;
}
