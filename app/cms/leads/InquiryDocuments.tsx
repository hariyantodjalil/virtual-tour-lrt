"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Link2,
  Pencil,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { cmsFetch } from "@/lib/cms-fetch";
import {
  INQUIRY_DOCUMENT_TYPES,
  INQUIRY_DOCUMENT_LABELS,
  inquiryDocumentTypeSchema,
  isInquiryDocumentLocked,
  type InquiryDocumentType,
} from "@/lib/inquiry-media";
import { registerBlobPreviewMeta, resolveDocumentPreview } from "@/lib/document-preview";
import DocumentPreviewModal, {
  type PreviewableDocumentItem,
} from "@/components/pipeline/DocumentPreviewModal";

const responseSchema = z.object({
  canWrite: z.boolean(),
  verificationLocked: z.boolean(),
  media: z.array(
    z.object({
      id: z.string(),
      stepOrder: z.number().int(),
      mediaTitle: z.string(),
      documentType: z.string(),
      documentNumber: z.string().nullable(),
      mediaLink: z.string(),
      isStored: z.boolean(),
      fileName: z.string().nullable(),
      sizeBytes: z.number().nullable(),
      isVisibleToMitra: z.boolean(),
      verifiedAt: z.string().nullable(),
      createdAt: z.string(),
    })
  ),
});
type Data = z.infer<typeof responseSchema>;
type Media = Data["media"][number];
type AddMode = "FILE" | "LINK";

const inputClass =
  "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D81435]/25 focus-visible:border-[#D81435] disabled:cursor-not-allowed disabled:opacity-50";
const actionClass =
  "inline-flex h-10 items-center rounded-md px-2 text-sm font-medium text-[#D81435] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D81435]/25 disabled:pointer-events-none disabled:opacity-50";
const secondaryClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D81435]/25 disabled:pointer-events-none disabled:opacity-50";
const chipClass =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[var(--work-accent)] disabled:pointer-events-none disabled:opacity-50";

function formatMediaDate(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

function documentHref(media: Media, leadId: string) {
  if (media.isStored) {
    return `/api/inquiries/${encodeURIComponent(leadId)}/documents/${encodeURIComponent(media.id)}`;
  }
  try {
    const url = new URL(media.mediaLink);
    if (url.protocol === "https:" && !url.username && !url.password) return url.href;
  } catch {
    /* Broken links stay text-only. */
  }
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

export default function InquiryDocuments({
  leadId,
  onChange,
  documentTypes,
  onDraftChange,
  onBusyChange,
  parentSaving = false,
  leadStatus,
}: Props) {
  const types = documentTypes ?? INQUIRY_DOCUMENT_TYPES;
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("FILE");
  const [documentType, setDocumentType] = useState<InquiryDocumentType>(types[0]);
  const [mediaTitle, setMediaTitle] = useState(INQUIRY_DOCUMENT_LABELS[types[0]]);
  const [documentNumber, setDocumentNumber] = useState("");
  const [mediaLink, setMediaLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [visibleToMitra, setVisibleToMitra] = useState(true);
  const [preview, setPreview] = useState<PreviewableDocumentItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNumber, setEditNumber] = useState("");
  const [editLink, setEditLink] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const previewReturnRef = useRef<HTMLButtonElement | null>(null);
  const busy = saving || parentSaving;
  const verificationLocked = leadStatus
    ? isInquiryDocumentLocked(leadStatus)
    : data?.verificationLocked;
  const endpoint = `/api/cms/leads/${encodeURIComponent(leadId)}/media`;

  const markDraft = useCallback(() => onDraftChange?.(true), [onDraftChange]);

  const resetForm = useCallback(() => {
    setAddMode("FILE");
    setDocumentType(types[0]);
    setMediaTitle(INQUIRY_DOCUMENT_LABELS[types[0]]);
    setDocumentNumber("");
    setMediaLink("");
    setFile(null);
    setVisibleToMitra(true);
    onDraftChange?.(false);
  }, [onDraftChange, types]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
    const response = await cmsFetch(endpoint, { cache: "no-store", signal });
      if (!response.ok) {
        throw new Error(await responseError(response, "Dokumen gagal dimuat. Coba muat ulang."));
      }
    return responseSchema.parse(await response.json());
    },
    [endpoint]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal)
      .then(setData)
      .catch(() => {
      if (!controller.signal.aborted) setError("Dokumen gagal dimuat. Coba muat ulang.");
    });
    return () => {
      controller.abort();
      onBusyChange?.(false);
    };
  }, [load, leadStatus, onBusyChange]);

  async function retry() {
    setRetrying(true);
    setError("");
    try {
      setData(await load());
    } catch {
      setError("Dokumen gagal dimuat. Coba muat ulang.");
    } finally {
      setRetrying(false);
    }
  }

  function openPreview(item: PreviewableDocumentItem, trigger?: HTMLButtonElement | null) {
    previewReturnRef.current = trigger ?? null;
    setPreview(item);
  }

  function previewDraftLink(trigger: HTMLButtonElement | null) {
    const trimmed = mediaLink.trim();
    if (!trimmed) {
      setError("Isi tautan HTTPS terlebih dahulu untuk pratinjau.");
      return;
    }
    openPreview(
      {
        mediaTitle: mediaTitle.trim() || "Pratinjau tautan",
        documentNumber: documentNumber.trim() || null,
        mediaLink: trimmed,
      },
      trigger
    );
  }

  function previewDraftFile(trigger: HTMLButtonElement | null) {
    if (!file) {
      setError("Pilih berkas PDF terlebih dahulu untuk pratinjau.");
      return;
    }
    const blobUrl = registerBlobPreviewMeta(URL.createObjectURL(file), file);
    openPreview(
      {
        mediaTitle: mediaTitle.trim() || file.name,
        documentNumber: documentNumber.trim() || null,
        mediaLink: blobUrl,
      },
      trigger
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const title = mediaTitle.trim();
    if (title.length < 2) {
      setError("Judul dokumen minimal 2 karakter.");
      return;
    }
    if (addMode === "FILE") {
      if (
        !file ||
        !file.size ||
        file.size > 10 * 1024 * 1024 ||
        !/\.pdf$/i.test(file.name) ||
        file.type !== "application/pdf"
      ) {
        setError("Pilih satu berkas PDF (.pdf) maksimal 10 MB.");
        return;
      }
    } else if (!mediaLink.trim()) {
      setError("Masukkan tautan HTTPS dokumen yang valid.");
      return;
    }

    setSaving(true);
    onBusyChange?.(true);
    setError("");
    setNotice("");

    try {
      let response: Response;
      if (addMode === "FILE" && file) {
        const body = new FormData();
        body.set("documentType", documentType);
        body.set("mediaTitle", title);
        if (documentNumber.trim()) body.set("documentNumber", documentNumber.trim());
        body.set("isVisibleToMitra", visibleToMitra ? "true" : "false");
        body.set("file", file);
        response = await cmsFetch(endpoint, { method: "POST", body });
      } else {
        response = await cmsFetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentType,
            mediaTitle: title,
            documentNumber: documentNumber.trim() || null,
            mediaLink: mediaLink.trim(),
            isVisibleToMitra: visibleToMitra,
          }),
        });
      }

      if (!response.ok) {
        throw new Error(
          await responseError(
            response,
            addMode === "FILE" ? "Dokumen gagal diunggah. Coba lagi." : "Tautan gagal disimpan. Coba lagi."
          )
        );
      }

      setShowForm(false);
      resetForm();
      setNotice(
        addMode === "FILE"
          ? "PDF tersimpan. Periksa isi dokumen, lalu verifikasi secara terpisah."
          : "Tautan tersimpan. Tautan eksternal tidak menggantikan unggah PDF untuk verifikasi tahap."
      );
      onChange?.();
      setData(await load());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dokumen gagal disimpan.");
    } finally {
      setSaving(false);
      onBusyChange?.(false);
    }
  }

  async function update(
    media: Media,
    changes: {
      isVisibleToMitra?: boolean;
      verified?: boolean;
      mediaTitle?: string;
      documentNumber?: string | null;
      mediaLink?: string;
    }
  ) {
    if (busy) return;
    setSaving(true);
    onBusyChange?.(true);
    setError("");
    setNotice("");
    try {
      const response = await cmsFetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: media.id, ...changes }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, "Dokumen gagal diperbarui. Coba lagi."));
      }
      setNotice(
        changes.verified === true
          ? "Dokumen telah diverifikasi."
          : changes.verified === false
            ? "Verifikasi dibatalkan."
            : changes.mediaTitle !== undefined || changes.mediaLink !== undefined
              ? "Dokumen diperbarui."
              : "Visibilitas dokumen diperbarui."
      );
      setEditingId(null);
      setConfirmDeleteId(null);
      onChange?.();
      setData(await load());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dokumen gagal diperbarui.");
    } finally {
      setSaving(false);
      onBusyChange?.(false);
    }
  }

  async function remove(media: Media) {
    if (busy) return;
    setSaving(true);
    onBusyChange?.(true);
    setError("");
    setNotice("");
    try {
      const response = await cmsFetch(
        `${endpoint}?mediaId=${encodeURIComponent(media.id)}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        throw new Error(await responseError(response, "Dokumen gagal dihapus. Coba lagi."));
      }
      setNotice("Dokumen dihapus.");
      setConfirmDeleteId(null);
      setEditingId(null);
      onChange?.();
      setData(await load());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dokumen gagal dihapus.");
    } finally {
      setSaving(false);
      onBusyChange?.(false);
    }
  }

  function startEditing(media: Media) {
    setConfirmDeleteId(null);
    setEditingId(media.id);
    setEditTitle(media.mediaTitle);
    setEditNumber(media.documentNumber ?? "");
    setEditLink(media.isStored ? "" : media.mediaLink);
    markDraft();
  }

  function renderMedia(media: Media) {
    const href = documentHref(media, leadId);
    const previewResolved = resolveDocumentPreview(href || media.mediaLink, media.mediaTitle);
    const formatLabel =
      previewResolved.formatLabel ||
      (media.isStored ? "PDF" : media.fileName?.split(".").pop()?.toUpperCase() || "URL");

    if (editingId === media.id && data?.canWrite) {
      return (
        <li
          key={media.id}
          className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm"
        >
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void update(media, {
                mediaTitle: editTitle.trim(),
                documentNumber: editNumber.trim() || null,
                ...(!media.isStored && editLink.trim()
                  ? { mediaLink: editLink.trim() }
                  : {}),
              });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[var(--work-muted)]">Judul dokumen</label>
                <input
                  className={inputClass}
                  required
                  minLength={2}
                  maxLength={160}
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--work-muted)]">Nomor dokumen</label>
                <input
                  className={inputClass}
                  maxLength={160}
                  value={editNumber}
                  onChange={(event) => setEditNumber(event.target.value)}
                />
              </div>
            </div>
            {!media.isStored ? (
              <div>
                <label className="mb-1 block text-xs text-[var(--work-muted)]">
                  Tautan dokumen (HTTPS)
                </label>
                <input
                  type="url"
                  className={inputClass}
                  required
                  value={editLink}
                  onChange={(event) => setEditLink(event.target.value)}
                  placeholder="https://drive.google.com/file/..."
                />
              </div>
            ) : (
              <p className="text-xs text-[var(--work-muted)]">
                PDF tersimpan tidak diganti lewat edit. Unggah PDF baru bila perlu mengganti berkas.
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={chipClass}
                disabled={busy}
                onClick={() => setEditingId(null)}
              >
                Batal
              </button>
              <button
                type="submit"
                className="inline-flex h-8 items-center rounded-lg bg-[#E31E2D] px-3 text-xs font-semibold text-white hover:bg-[#c91826] disabled:opacity-50"
                disabled={busy}
              >
                Simpan
              </button>
            </div>
          </form>
        </li>
      );
    }

    return (
      <li
        key={media.id}
        className="flex flex-col gap-3 rounded-xl border border-[var(--work-line)] bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <FileText className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--work-text)]">
              {media.mediaTitle}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[var(--work-muted)]">
              {media.documentNumber ? (
                <span className="font-medium text-slate-700">No. {media.documentNumber}</span>
              ) : null}
              <span className="tabular-nums">{formatMediaDate(media.createdAt)}</span>
              <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-medium text-slate-600">
                {formatLabel}
              </span>
              {media.isVisibleToMitra ? (
                <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                  Terlihat oleh Mitra
                </span>
              ) : (
                <span className="text-[var(--work-muted)]">Internal</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {href ? (
            <button
              type="button"
              className={chipClass}
              onClick={(event) =>
                openPreview(
                  {
                    mediaTitle: media.mediaTitle,
                    documentNumber: media.documentNumber,
                    mediaLink: href,
                  },
                  event.currentTarget
                )
              }
            >
              <Eye className="size-3.5" aria-hidden />
              Pratinjau
            </button>
          ) : null}

          {data?.canWrite ? (
            <>
              <button
                type="button"
                className={chipClass}
                disabled={busy}
                title={
                  media.isVisibleToMitra ? "Sembunyikan dari Mitra" : "Tampilkan ke Mitra"
                }
                onClick={() =>
                  void update(media, { isVisibleToMitra: !media.isVisibleToMitra })
                }
              >
                {media.isVisibleToMitra ? (
                  <EyeOff className="size-3.5 text-slate-500" aria-hidden />
                ) : (
                  <Eye className="size-3.5 text-emerald-600" aria-hidden />
                )}
                {media.isVisibleToMitra ? "Sembunyikan" : "Bagikan"}
              </button>

              {media.isStored ? (
                <button
                  type="button"
                  className={chipClass}
                  disabled={busy || (!!media.verifiedAt && verificationLocked)}
                  title={
                    media.verifiedAt
                      ? verificationLocked
                        ? "Verifikasi terkunci"
                        : "Batalkan verifikasi"
                      : "Tandai PDF terverifikasi"
                  }
                  onClick={() => void update(media, { verified: !media.verifiedAt })}
                >
                  <CheckCircle2
                    className={`size-3.5 ${media.verifiedAt ? "text-emerald-600" : "text-slate-500"}`}
                    aria-hidden
                  />
                  {media.verifiedAt
                    ? verificationLocked
                      ? "Terverifikasi"
                      : "Batalkan verifikasi"
                    : "Verifikasi"}
                </button>
              ) : null}

              <button
                type="button"
                className={chipClass}
                disabled={busy}
                onClick={() => startEditing(media)}
              >
                <Pencil className="size-3.5" aria-hidden />
                Edit
              </button>

              {confirmDeleteId === media.id ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="inline-flex h-8 items-center rounded-lg bg-rose-600 px-2.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void remove(media)}
                  >
                    Ya, Hapus
                  </button>
                  <button
                    type="button"
                    className={chipClass}
                    disabled={busy}
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="inline-flex h-8 items-center rounded-lg border border-rose-200 bg-rose-50/70 px-2.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  disabled={busy || (!!media.verifiedAt && verificationLocked)}
                  aria-label={`Hapus ${media.mediaTitle}`}
                  onClick={() => setConfirmDeleteId(media.id)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              )}
            </>
          ) : null}
        </div>
      </li>
    );
  }

  const id = `inquiry-${leadId}`;

  return (
    <section aria-labelledby={`${id}-heading`} aria-busy={busy || retrying} className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`${id}-heading`} className="text-sm font-semibold text-[var(--work-text)]">
            {documentTypes ? "Dokumen tahap ini" : "Semua dokumen pengajuan"}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[var(--work-muted)]">
            Unggah PDF untuk verifikasi tahap, atau simpan tautan resmi (Drive/SharePoint) untuk
            dibagikan ke mitra.
          </p>
        </div>
        {data?.canWrite && !showForm && (
          <button
            type="button"
            className={secondaryClass}
            disabled={busy}
            onClick={() => {
              resetForm();
              setShowForm(true);
              markDraft();
            }}
          >
            <UploadCloud className="size-4" aria-hidden />
            Tambah dokumen
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="text-sm text-[var(--work-danger)]">
          <p>{error}</p>
          <button
            type="button"
            disabled={retrying || busy}
            onClick={() => void retry()}
            className={actionClass}
          >
            {retrying ? "Memuat ulang..." : "Muat ulang dokumen"}
          </button>
        </div>
      )}
      <p role="status" className="text-sm text-[var(--work-muted)]">
        {saving
          ? "Menyimpan perubahan dokumen..."
          : notice || (!data && !error ? "Memuat dokumen..." : "")}
      </p>

      {data && (
        <>
          {!data.canWrite && (
            <p className="text-sm text-[var(--work-muted)]">
              Akses baca saja. Unggahan dan verifikasi hanya dapat dilakukan ADMIN.
            </p>
          )}

          <div className="space-y-5">
            {types.map((type) => {
              const documents = data.media.filter(
                (media) => media.isStored && media.documentType === type
              );
              const linked = data.media.filter(
                (media) => !media.isStored && media.documentType === type
              );
              const items = [...documents, ...linked];
              return (
                <section key={type} aria-labelledby={`${id}-${type}`} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 id={`${id}-${type}`} className="text-sm font-semibold text-[var(--work-text)]">
                      {INQUIRY_DOCUMENT_LABELS[type]}
                      {type === "OTHER" ? " (opsional)" : ""}
                    </h4>
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                        documents.some((media) => media.verifiedAt)
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : items.length
                            ? "border-slate-200 bg-slate-50 text-slate-600"
                            : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      {documents.some((media) => media.verifiedAt)
                        ? "Terverifikasi"
                        : documents.length
                          ? "Perlu verifikasi"
                          : linked.length
                            ? "Tautan tersimpan"
                            : "Belum diunggah"}
                    </span>
                  </div>
                  {items.length > 0 ? (
                    <ul className="space-y-2">{items.map(renderMedia)}</ul>
                  ) : (
                    <p className="text-xs text-[var(--work-muted)]">
                      Belum ada dokumen pada jenis ini.
                    </p>
                  )}
                </section>
              );
            })}
          </div>

          {data.canWrite && showForm && (
            <form
              onSubmit={(event) => void save(event)}
              onChange={markDraft}
              className="min-w-0 max-w-full space-y-3 overflow-hidden rounded-xl border border-[var(--work-line)] bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--work-text)]">Tambah dokumen</p>
                <button
                  type="button"
                  className={secondaryClass}
                  disabled={busy}
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  Batal
                </button>
              </div>

              <div
                role="group"
                aria-label="Sumber dokumen"
                className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--work-subtle)] p-1"
              >
                {(
                  [
                    { key: "FILE", label: "Unggah File (Maks. 10 MB)", icon: UploadCloud },
                    { key: "LINK", label: "Tautan URL Resmi", icon: Link2 },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={addMode === item.key}
                    disabled={busy}
                    onClick={() => {
                      setAddMode(item.key);
                      markDraft();
                    }}
                    className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-[var(--work-accent)] disabled:opacity-50 ${
                      addMode === item.key
                        ? "border border-slate-200 bg-white font-semibold text-[var(--work-text)] shadow-sm"
                        : "border border-transparent text-[var(--work-muted)] hover:text-[var(--work-text)]"
                    }`}
                  >
                    <item.icon className="size-3.5 shrink-0" aria-hidden />
                    <span className="text-left leading-snug">{item.label}</span>
                  </button>
                ))}
              </div>

              <fieldset disabled={busy} className="min-w-0 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`${id}-type`} className="mb-1 block text-sm text-[var(--work-muted)]">
                      Jenis dokumen
                    </label>
                    <select
                      id={`${id}-type`}
                      className={inputClass}
                      value={documentType}
                      onChange={(event) => {
                        const next = inquiryDocumentTypeSchema.parse(event.target.value);
                        setDocumentType(next);
                        setMediaTitle((current) =>
                          !current.trim() ||
                          current === INQUIRY_DOCUMENT_LABELS[documentType]
                            ? INQUIRY_DOCUMENT_LABELS[next]
                            : current
                        );
                      }}
                    >
                      {types.map((type) => (
                        <option key={type} value={type}>
                          {INQUIRY_DOCUMENT_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor={`${id}-number`}
                      className="mb-1 block text-sm text-[var(--work-muted)]"
                    >
                      Nomor dokumen / surat (opsional)
                    </label>
                    <input
                      id={`${id}-number`}
                      className={inputClass}
                      maxLength={160}
                      value={documentNumber}
                      onChange={(event) => setDocumentNumber(event.target.value)}
                      placeholder="Mis. RDS/001/XI/2026"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor={`${id}-title`} className="mb-1 block text-sm text-[var(--work-muted)]">
                    Judul dokumen <span className="text-[var(--work-danger)]">*</span>
                  </label>
                  <input
                    id={`${id}-title`}
                    className={inputClass}
                    required
                    minLength={2}
                    maxLength={160}
                    value={mediaTitle}
                    onChange={(event) => setMediaTitle(event.target.value)}
                    placeholder="Mis. Surat Penawaran Resmi (RDS)"
                  />
                </div>

                {addMode === "FILE" ? (
                  <div className="min-w-0 space-y-2">
                    <label className="flex min-w-0 max-w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-[var(--work-subtle)] px-4 py-5 text-center hover:border-[var(--work-accent)]">
                      <UploadCloud className="size-5 shrink-0 text-[var(--work-accent)]" aria-hidden />
                      {file ? (
                        <>
                          <span
                            className="mt-2 block w-full min-w-0 truncate px-1 text-sm font-medium text-[var(--work-text)]"
                            title={file.name}
                          >
                            {file.name}
                          </span>
                          <span className="mt-1 text-xs text-[var(--work-muted)]">
                            {(file.size / 1024 / 1024).toFixed(2)} MB · Maksimal 10 MB
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="mt-2 text-sm font-medium text-[var(--work-text)]">
                            Pilih berkas PDF
                          </span>
                          <span className="mt-1 text-xs text-[var(--work-muted)]">Maksimal 10 MB</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="sr-only"
                        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                      />
                    </label>
                    {file ? (
                      <div className="flex min-w-0 items-center gap-2 rounded-lg border border-[var(--work-line)] px-3 py-2">
                        <p
                          className="min-w-0 flex-1 overflow-hidden text-sm text-[var(--work-muted)]"
                          title={file.name}
                        >
                          <span className="block truncate">
                            Siap diunggah:{" "}
                            <span className="font-medium text-[var(--work-text)]">{file.name}</span>
                          </span>
                        </p>
                        <button
                          type="button"
                          className={`${secondaryClass} shrink-0`}
                          onClick={(event) => previewDraftFile(event.currentTarget)}
                        >
                          <Eye className="size-4" aria-hidden />
                          Pratinjau
                        </button>
                      </div>
                    ) : null}
                    <p className="text-xs leading-relaxed text-[var(--work-muted)]">
                      PDF yang diunggah bisa diverifikasi dan dipakai sebagai syarat maju tahap.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label
                      htmlFor={`${id}-link`}
                      className="mb-1 block text-sm text-[var(--work-muted)]"
                    >
                      Tautan dokumen (HTTPS) <span className="text-[var(--work-danger)]">*</span>
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        id={`${id}-link`}
                        type="url"
                        required
                        className={`${inputClass} min-w-0 flex-1`}
                        value={mediaLink}
                        onChange={(event) => setMediaLink(event.target.value)}
                        placeholder="https://drive.google.com/file/..."
                      />
                      <button
                        type="button"
                        className={secondaryClass}
                        disabled={!mediaLink.trim()}
                        onClick={(event) => previewDraftLink(event.currentTarget)}
                      >
                        <Eye className="size-4" aria-hidden />
                        Pratinjau
                      </button>
                    </div>
                    <p className="text-xs leading-relaxed text-[var(--work-muted)]">
                      Cocok untuk Drive/SharePoint. Tautan tidak menggantikan unggah PDF untuk
                      verifikasi tahap.
                    </p>
                  </div>
                )}

                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[#E31E2D]"
                    checked={visibleToMitra}
                    onChange={(event) => setVisibleToMitra(event.target.checked)}
                  />
                  Tampilkan ke mitra di Portal Mitra
                </label>

                <div className="flex flex-wrap justify-end gap-2 pt-1">
                  <button
                    type="button"
                    className={secondaryClass}
                    disabled={busy}
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center justify-center rounded-md bg-[#E31E2D] px-4 text-sm font-semibold text-white hover:bg-[#c91826] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--work-accent)] disabled:opacity-50"
                    disabled={busy}
                  >
                    {saving ? "Menyimpan…" : "Simpan dokumen"}
                  </button>
                </div>
          </fieldset>
        </form>
          )}
        </>
      )}

      {preview ? (
        <DocumentPreviewModal
          documentItem={preview}
          returnFocusRef={previewReturnRef}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </section>
  );
}
