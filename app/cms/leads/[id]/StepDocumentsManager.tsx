"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { cmsFetch } from "@/lib/cms-fetch";
import type { StepMediaRequirementValue } from "@/lib/commercial-pipeline";
import {
  ALLOWED_INQUIRY_MIME_EXTENSIONS,
  INQUIRY_MAX_FILE_BYTES,
} from "@/lib/inquiry-media";
import {
  registerBlobPreviewMeta,
  resolveDocumentPreview,
} from "@/lib/document-preview";
import { formatDateId, type CmsInquiryMedia } from "../lead-types";

type InputMode = "FILE" | "LINK";

export type StepDocPreviewHandlers = {
  onCreate: (input: {
    mediaTitle: string;
    documentNumber: string | null;
    mediaLink: string;
    isVisibleToMitra: boolean;
  }) => void;
  onUpdate: (input: {
    id: string;
    mediaTitle: string;
    documentNumber: string | null;
    mediaLink?: string;
    isVisibleToMitra: boolean;
  }) => void;
  onToggleVisibility: (item: CmsInquiryMedia) => void;
  onDelete: (mediaId: string) => void;
};

function validateClientFile(file: File): string | null {
  if (!ALLOWED_INQUIRY_MIME_EXTENSIONS[file.type]) {
    return "Format berkas tidak didukung. Gunakan PDF, JPG, PNG, atau WebP.";
  }
  if (file.size <= 0 || file.size > INQUIRY_MAX_FILE_BYTES) {
    return "Ukuran berkas harus lebih dari 0 dan maksimal 10 MB.";
  }
  return null;
}

export default function StepDocumentsManager({
  leadId,
  stepOrder,
  mediaRequirement,
  defaultDocumentNumber,
  mediaItems,
  isEditable,
  defaultShowAddForm = false,
  previewHandlers,
  onRefreshLead,
  onPreviewMedia,
}: {
  leadId: string;
  stepOrder: number;
  mediaRequirement: StepMediaRequirementValue;
  defaultDocumentNumber?: string | null;
  mediaItems: CmsInquiryMedia[];
  isEditable: boolean;
  defaultShowAddForm?: boolean;
  previewHandlers?: StepDocPreviewHandlers;
  onRefreshLead: () => Promise<void>;
  onPreviewMedia: (media: CmsInquiryMedia) => void;
}) {
  const [showAddForm, setShowAddForm] = useState(defaultShowAddForm);
  const [addMode, setAddMode] = useState<InputMode>("FILE");
  const [newTitle, setNewTitle] = useState("");
  const [newDocNo, setNewDocNo] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newLink, setNewLink] = useState("");
  const [newVisible, setNewVisible] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<InputMode>("FILE");
  const [editTitle, setEditTitle] = useState("");
  const [editDocNo, setEditDocNo] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editLink, setEditLink] = useState("");
  const [editVisible, setEditVisible] = useState(true);
  const [replaceSource, setReplaceSource] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileObjectUrlsRef = useRef<Map<File, string>>(new Map());

  useEffect(() => {
    const cache = fileObjectUrlsRef.current;
    return () => {
      if (!previewHandlers) {
        cache.forEach((url) => URL.revokeObjectURL(url));
        cache.clear();
      }
    };
  }, [previewHandlers]);

  function getOrCreateFilePreviewUrl(file: File): string {
    const existing = fileObjectUrlsRef.current.get(file);
    if (existing) return existing;
    const blobUrl = registerBlobPreviewMeta(URL.createObjectURL(file), file);
    fileObjectUrlsRef.current.set(file, blobUrl);
    return blobUrl;
  }

  function triggerDraftFilePreview(
    file: File,
    titleCandidate: string,
    docNoCandidate: string
  ) {
    setErrorMsg(null);
    const fileErr = validateClientFile(file);
    if (fileErr) {
      setErrorMsg(fileErr);
      return;
    }
    const blobUrl = getOrCreateFilePreviewUrl(file);
    onPreviewMedia({
      id: `draft-file-${file.name}`,
      stepOrder,
      mediaTitle: titleCandidate.trim() || file.name,
      documentNumber: docNoCandidate.trim() || null,
      mediaLink: blobUrl,
      isVisibleToMitra: true,
      uploadedByAdmin: "Pratinjau Lokal",
      createdAt: new Date().toISOString(),
    });
  }

  function triggerDraftLinkPreview(
    rawLink: string,
    titleCandidate: string,
    docNoCandidate: string
  ) {
    setErrorMsg(null);
    const trimmed = rawLink.trim();
    const resolved = resolveDocumentPreview(trimmed, titleCandidate);
    if (resolved.kind === "UNSAFE" || !resolved.embedUrl) {
      setErrorMsg("Masukkan tautan URL http(s) yang valid untuk melihat pratinjau.");
      return;
    }
    onPreviewMedia({
      id: `draft-link-${Date.now()}`,
      stepOrder,
      mediaTitle: titleCandidate.trim() || "Pratinjau Dokumen",
      documentNumber: docNoCandidate.trim() || null,
      mediaLink: trimmed,
      isVisibleToMitra: true,
      uploadedByAdmin: "Pratinjau Tautan",
      createdAt: new Date().toISOString(),
    });
  }

  if (mediaRequirement === "NONE") {
    if (!isEditable) return null;
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
        Tahap ini dikonfigurasi tidak menerima unggahan dokumen.
      </div>
    );
  }

  function openAddForm() {
    setErrorMsg(null);
    setNewTitle("");
    setNewDocNo(defaultDocumentNumber?.trim() || "");
    setNewFile(null);
    setNewLink("");
    setNewVisible(true);
    setShowAddForm(true);
  }

  function startEditing(item: CmsInquiryMedia) {
    setErrorMsg(null);
    setConfirmDeleteId(null);
    setEditingId(item.id);
    setEditTitle(item.mediaTitle);
    setEditDocNo(item.documentNumber ?? "");
    setEditLink(item.mediaLink);
    setEditFile(null);
    setEditVisible(item.isVisibleToMitra);
    setEditMode(item.mediaLink.startsWith("/api/s3-proxy/") ? "FILE" : "LINK");
    setReplaceSource(false);
  }

  async function handleCreateMedia(event: React.FormEvent) {
    event.preventDefault();
    setErrorMsg(null);

    const trimmedTitle = newTitle.trim();
    if (trimmedTitle.length < 2) {
      setErrorMsg("Judul dokumen minimal 2 karakter.");
      return;
    }

    if (previewHandlers) {
      let simulatedLink = newLink.trim();
      if (addMode === "FILE") {
        if (!newFile) {
          setErrorMsg("Pilih file dokumen terlebih dahulu.");
          return;
        }
        const fileErr = validateClientFile(newFile);
        if (fileErr) {
          setErrorMsg(fileErr);
          return;
        }
        simulatedLink = getOrCreateFilePreviewUrl(newFile);
      } else if (!simulatedLink) {
        setErrorMsg("Masukkan tautan URL dokumen yang valid.");
        return;
      }

      previewHandlers.onCreate({
        mediaTitle: trimmedTitle,
        documentNumber: newDocNo.trim() || null,
        mediaLink: simulatedLink,
        isVisibleToMitra: newVisible,
      });
      setNewTitle("");
      setNewDocNo("");
      setNewFile(null);
      setNewLink("");
      setShowAddForm(false);
      return;
    }

    setBusyId("create");
    try {
      let res: Response;
      if (addMode === "FILE") {
        if (!newFile) {
          setErrorMsg("Pilih file dokumen terlebih dahulu.");
          return;
        }
        const fileErr = validateClientFile(newFile);
        if (fileErr) {
          setErrorMsg(fileErr);
          return;
        }

        const formData = new FormData();
        formData.set("stepOrder", String(stepOrder));
        formData.set("mediaTitle", trimmedTitle);
        if (newDocNo.trim()) formData.set("documentNumber", newDocNo.trim());
        formData.set("isVisibleToMitra", String(newVisible));
        formData.set("file", newFile);

        res = await cmsFetch(`/api/cms/leads/${leadId}/media`, {
          method: "POST",
          body: formData,
        });
      } else {
        const trimmedLink = newLink.trim();
        if (!trimmedLink) {
          setErrorMsg("Masukkan tautan URL dokumen yang valid.");
          return;
        }

        res = await cmsFetch(`/api/cms/leads/${leadId}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stepOrder,
            mediaTitle: trimmedTitle,
            documentNumber: newDocNo.trim() || null,
            mediaLink: trimmedLink,
            isVisibleToMitra: newVisible,
          }),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal menyimpan dokumen.");
      }

      setShowAddForm(false);
      await onRefreshLead();
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Gagal menyimpan dokumen."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleUpdateMedia(item: CmsInquiryMedia, event: React.FormEvent) {
    event.preventDefault();
    setErrorMsg(null);

    const trimmedTitle = editTitle.trim();
    if (trimmedTitle.length < 2) {
      setErrorMsg("Judul dokumen minimal 2 karakter.");
      return;
    }

    if (previewHandlers) {
      let nextMediaLink: string | undefined;
      if (replaceSource) {
        if (editMode === "FILE") {
          if (!editFile) {
            setErrorMsg("Pilih file pengganti terlebih dahulu.");
            return;
          }
          const fileErr = validateClientFile(editFile);
          if (fileErr) {
            setErrorMsg(fileErr);
            return;
          }
          nextMediaLink = getOrCreateFilePreviewUrl(editFile);
        } else {
          if (!editLink.trim()) {
            setErrorMsg("Tautan dokumen tidak boleh kosong.");
            return;
          }
          nextMediaLink = editLink.trim();
        }
      }

      previewHandlers.onUpdate({
        id: item.id,
        mediaTitle: trimmedTitle,
        documentNumber: editDocNo.trim() || null,
        mediaLink: nextMediaLink,
        isVisibleToMitra: editVisible,
      });
      setEditingId(null);
      return;
    }

    setBusyId(item.id);
    try {
      let res: Response;
      if (replaceSource && editMode === "FILE") {
        if (!editFile) {
          setErrorMsg("Pilih file pengganti terlebih dahulu.");
          return;
        }
        const fileErr = validateClientFile(editFile);
        if (fileErr) {
          setErrorMsg(fileErr);
          return;
        }

        const formData = new FormData();
        formData.set("mediaId", item.id);
        formData.set("mediaTitle", trimmedTitle);
        formData.set("documentNumber", editDocNo.trim());
        formData.set("isVisibleToMitra", String(editVisible));
        formData.set("file", editFile);

        res = await cmsFetch(`/api/cms/leads/${leadId}/media`, {
          method: "PATCH",
          body: formData,
        });
      } else {
        const payload: Record<string, unknown> = {
          mediaId: item.id,
          mediaTitle: trimmedTitle,
          documentNumber: editDocNo.trim() || null,
          isVisibleToMitra: editVisible,
        };
        if (replaceSource && editMode === "LINK") {
          if (!editLink.trim()) {
            setErrorMsg("Tautan dokumen tidak boleh kosong.");
            return;
          }
          payload.mediaLink = editLink.trim();
        }

        res = await cmsFetch(`/api/cms/leads/${leadId}/media`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal memperbarui dokumen.");
      }

      setEditingId(null);
      await onRefreshLead();
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Gagal memperbarui dokumen."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleVisibility(item: CmsInquiryMedia) {
    setErrorMsg(null);
    if (previewHandlers) {
      previewHandlers.onToggleVisibility(item);
      return;
    }
    setBusyId(`vis-${item.id}`);
    try {
      const res = await cmsFetch(`/api/cms/leads/${leadId}/media`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId: item.id,
          isVisibleToMitra: !item.isVisibleToMitra,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal mengubah visibilitas dokumen.");
      }
      await onRefreshLead();
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Gagal mengubah visibilitas."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteMedia(mediaId: string) {
    setErrorMsg(null);
    if (previewHandlers) {
      previewHandlers.onDelete(mediaId);
      setConfirmDeleteId(null);
      return;
    }
    setBusyId(`del-${mediaId}`);
    try {
      const res = await cmsFetch(
        `/api/cms/leads/${leadId}/media?mediaId=${encodeURIComponent(mediaId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal menghapus dokumen.");
      }
      setConfirmDeleteId(null);
      await onRefreshLead();
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Gagal menghapus dokumen."
      );
    } finally {
      setBusyId(null);
    }
  }

  const requirementSatisfied =
    mediaRequirement === "REQUIRED" ? mediaItems.length > 0 : true;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      {/* Header Dokumen Tahap */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#101828]">
            Dokumen Resmi Tahap {stepOrder}
          </span>
          {isEditable ? (
            mediaRequirement === "REQUIRED" ? (
              requirementSatisfied ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="size-3.5" strokeWidth={1.5} />
                  Syarat Dokumen Terpenuhi ({mediaItems.length})
                </span>
              ) : (
                <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                  Wajib Unggah Minimal 1 Dokumen
                </span>
              )
            ) : (
              <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600">
                Dokumen Opsional
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-500">
              <Lock className="size-3.5" strokeWidth={1.5} />
              Arsip Terkunci ({mediaItems.length})
            </span>
          )}
        </div>

        {isEditable && !showAddForm && (
          <button
            type="button"
            onClick={openAddForm}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-[#101828] transition-colors hover:border-[#c41230] hover:text-[#c41230]"
          >
            <Plus className="size-3.5" strokeWidth={1.5} />
            Tambah Dokumen
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {errorMsg}
        </div>
      )}

      {/* Form Tambah Dokumen Inline Dual-Mode */}
      {isEditable && showAddForm && (
        <form
          onSubmit={handleCreateMedia}
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[#101828]">
              Tambah Dokumen ke Tahap {stepOrder}
            </p>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Tutup form dokumen"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setAddMode("FILE")}
              className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors ${
                addMode === "FILE"
                  ? "border border-slate-200 bg-white font-semibold text-[#101828]"
                  : "border border-transparent text-slate-600 hover:text-[#101828]"
              }`}
            >
              <UploadCloud className="size-3.5" strokeWidth={1.5} />
              Unggah File (Maks. 10 MB)
            </button>
            <button
              type="button"
              onClick={() => setAddMode("LINK")}
              className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors ${
                addMode === "LINK"
                  ? "border border-slate-200 bg-white font-semibold text-[#101828]"
                  : "border border-transparent text-slate-600 hover:text-[#101828]"
              }`}
            >
              <Link2 className="size-3.5" strokeWidth={1.5} />
              Tautan URL Resmi
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">
                Judul Dokumen <span className="text-[#c41230]">*</span>
              </span>
              <input
                type="text"
                required
                minLength={2}
                maxLength={160}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Mis. Surat Penawaran Resmi (RDS)"
                className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs text-[#101828] focus:border-[#c41230] focus:outline-none"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">
                Nomor Dokumen / Surat (Opsional)
              </span>
              <input
                type="text"
                maxLength={160}
                value={newDocNo}
                onChange={(e) => setNewDocNo(e.target.value)}
                placeholder="Mis. RDS/001/XI/2026"
                className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs text-[#101828] tabular-nums focus:border-[#c41230] focus:outline-none"
              />
            </label>
          </div>

          {addMode === "FILE" ? (
            <div className="space-y-2">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/70 px-4 py-4 text-center transition-colors hover:border-[#c41230] hover:bg-rose-50/30">
                <UploadCloud className="size-5 text-[#c41230]" strokeWidth={1.5} />
                <span className="mt-1.5 text-xs font-semibold text-[#101828]">
                  {newFile
                    ? `${newFile.name} (${(newFile.size / 1024 / 1024).toFixed(2)} MB)`
                    : "Pilih file PDF, JPG, PNG, atau WebP"}
                </span>
                <span className="mt-0.5 text-xs text-slate-500">
                  Maksimal 10 MB
                </span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
                />
              </label>

              {newFile && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="truncate text-xs text-slate-600">
                    Siap diunggah:{" "}
                    <strong className="font-medium text-[#101828]">
                      {newFile.name}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      triggerDraftFilePreview(newFile, newTitle, newDocNo)
                    }
                    className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-[#101828] transition-colors hover:border-[#c41230] hover:text-[#c41230]"
                  >
                    <Eye className="size-3.5" strokeWidth={1.5} />
                    Pratinjau
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <label
                htmlFor={`new-doc-link-${stepOrder}`}
                className="block text-xs font-medium text-slate-700"
              >
                Tautan Dokumen (HTTPS) <span className="text-[#c41230]">*</span>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  id={`new-doc-link-${stepOrder}`}
                  type="url"
                  required
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  placeholder="https://drive.google.com/file/..."
                  className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-xs text-[#101828] focus:border-[#c41230] focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!newLink.trim()}
                  onClick={() =>
                    triggerDraftLinkPreview(newLink, newTitle, newDocNo)
                  }
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-[#101828] transition-colors hover:border-[#c41230] hover:text-[#c41230] disabled:opacity-45"
                >
                  <Eye className="size-3.5" strokeWidth={1.5} />
                  Pratinjau
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={newVisible}
                onChange={(e) => setNewVisible(e.target.checked)}
                className="size-4 rounded border-slate-300 accent-[#c41230]"
              />
              <span>Tampilkan ke Mitra di Portal Mitra</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={busyId === "create"}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#c41230] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#a60f28] disabled:opacity-50"
              >
                {busyId === "create" && <Loader2 className="size-3.5 animate-spin" />}
                Simpan Dokumen
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Daftar Dokumen pada Tahap Ini */}
      {mediaItems.length === 0 ? (
        <p className="py-1 text-xs text-slate-500">
          {isEditable
            ? "Belum ada dokumen diunggah pada tahap ini."
            : "Tidak ada dokumen yang dilampirkan pada tahap ini."}
        </p>
      ) : (
        <ul className="space-y-2">
          {mediaItems.map((item) => {
            const resolvedItem = resolveDocumentPreview(
              item.mediaLink,
              item.mediaTitle
            );
            const isImg = resolvedItem.kind === "IMAGE";
            const isEditing = isEditable && editingId === item.id;
            const isConfirmingDelete = isEditable && confirmDeleteId === item.id;

            if (isEditing) {
              return (
                <li
                  key={item.id}
                  className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm"
                >
                  <form
                    onSubmit={(e) => void handleUpdateMedia(item, e)}
                    className="space-y-3"
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-slate-700">
                          Judul Dokumen
                        </span>
                        <input
                          type="text"
                          required
                          minLength={2}
                          maxLength={160}
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs text-[#101828] focus:border-[#c41230] focus:outline-none"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-slate-700">
                          Nomor Dokumen
                        </span>
                        <input
                          type="text"
                          maxLength={160}
                          value={editDocNo}
                          onChange={(e) => setEditDocNo(e.target.value)}
                          className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs text-[#101828] tabular-nums focus:border-[#c41230] focus:outline-none"
                        />
                      </label>
                    </div>

                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={replaceSource}
                        onChange={(e) => setReplaceSource(e.target.checked)}
                        className="size-4 rounded border-slate-300 accent-[#c41230]"
                      />
                      <span>Ganti berkas atau tautan dokumen</span>
                    </label>

                    {replaceSource && (
                      <div className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-200/70 p-1">
                          <button
                            type="button"
                            onClick={() => setEditMode("FILE")}
                            className={`h-8 rounded-md px-2.5 text-xs font-medium transition-colors ${
                              editMode === "FILE"
                                ? "border border-slate-200 bg-white font-semibold text-[#101828]"
                                : "border border-transparent text-slate-600 hover:text-[#101828]"
                            }`}
                          >
                            Upload File Baru
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditMode("LINK")}
                            className={`h-8 rounded-md px-2.5 text-xs font-medium transition-colors ${
                              editMode === "LINK"
                                ? "border border-slate-200 bg-white font-semibold text-[#101828]"
                                : "border border-transparent text-slate-600 hover:text-[#101828]"
                            }`}
                          >
                            Tautan URL Baru
                          </button>
                        </div>

                        {editMode === "FILE" ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                              onChange={(e) => setEditFile(e.target.files?.[0] ?? null)}
                              className="block min-w-0 flex-1 text-xs text-slate-600 file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-2.5 file:py-1.5 file:text-xs file:font-medium"
                            />
                            {editFile && (
                              <button
                                type="button"
                                onClick={() =>
                                  triggerDraftFilePreview(
                                    editFile,
                                    editTitle,
                                    editDocNo
                                  )
                                }
                                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-[#101828] hover:border-[#c41230] hover:text-[#c41230]"
                              >
                                <Eye className="size-3.5" strokeWidth={1.5} />
                                Pratinjau
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input
                              type="url"
                              value={editLink}
                              onChange={(e) => setEditLink(e.target.value)}
                              placeholder="https://..."
                              className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs focus:border-[#c41230] focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={!editLink.trim()}
                              onClick={() =>
                                triggerDraftLinkPreview(
                                  editLink,
                                  editTitle,
                                  editDocNo
                                )
                              }
                              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-[#101828] hover:border-[#c41230] hover:text-[#c41230] disabled:opacity-45"
                            >
                              <Eye className="size-3.5" strokeWidth={1.5} />
                              Pratinjau
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={editVisible}
                          onChange={(e) => setEditVisible(e.target.checked)}
                          className="size-4 rounded border-slate-300 accent-[#c41230]"
                        />
                        <span>Tampilkan ke Mitra</span>
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          disabled={busyId === item.id}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#c41230] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#a60f28] disabled:opacity-50"
                        >
                          {busyId === item.id && (
                            <Loader2 className="size-3.5 animate-spin" />
                          )}
                          Simpan
                        </button>
                      </div>
                    </div>
                  </form>
                </li>
              );
            }

            return (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    {isImg ? (
                      <ImageIcon className="size-4" strokeWidth={1.5} />
                    ) : (
                      <FileText className="size-4" strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#101828]">
                      {item.mediaTitle}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                      {item.documentNumber && (
                        <span className="font-medium text-slate-700 tabular-nums">
                          No. {item.documentNumber}
                        </span>
                      )}
                      <span className="tabular-nums">{formatDateId(item.createdAt, true)}</span>
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                          item.isVisibleToMitra
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {item.isVisibleToMitra ? "Terlihat oleh Mitra" : "Internal Tim"}
                      </span>
                      {resolvedItem.formatLabel && (
                        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                          {resolvedItem.formatLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onPreviewMedia(item)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <Eye className="size-3.5" strokeWidth={1.5} />
                    Pratinjau
                  </button>

                  {isEditable && (
                    <>
                      <button
                        type="button"
                        disabled={busyId === `vis-${item.id}`}
                        onClick={() => void handleToggleVisibility(item)}
                        title={
                          item.isVisibleToMitra
                            ? "Sembunyikan dari Mitra"
                            : "Tampilkan ke Mitra"
                        }
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                      >
                        {item.isVisibleToMitra ? (
                          <EyeOff className="size-3.5 text-slate-500" strokeWidth={1.5} />
                        ) : (
                          <Eye className="size-3.5 text-emerald-600" strokeWidth={1.5} />
                        )}
                        {item.isVisibleToMitra ? "Sembunyikan" : "Bagikan"}
                      </button>

                      <button
                        type="button"
                        onClick={() => startEditing(item)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Pencil className="size-3.5" strokeWidth={1.5} />
                        Edit
                      </button>

                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={busyId === `del-${item.id}`}
                            onClick={() => void handleDeleteMedia(item.id)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-rose-600 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
                          >
                            {busyId === `del-${item.id}` ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              "Ya, Hapus"
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="h-8 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="inline-flex h-8 items-center rounded-lg border border-rose-200 bg-rose-50/70 px-2.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100"
                          aria-label={`Hapus ${item.mediaTitle}`}
                        >
                          <Trash2 className="size-3.5" strokeWidth={1.5} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
