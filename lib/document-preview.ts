import { isInquiryImage, isInquiryPdf } from "@/lib/inquiry-media";
import { getS3ProxyUrl } from "@/lib/s3-utils";

export type DocumentPreviewKind =
  | "IMAGE"
  | "PDF_NATIVE"
  | "GOOGLE_EMBED"
  | "EXTERNAL_WEB"
  | "UNSAFE";

export type ResolvedDocumentPreview = {
  kind: DocumentPreviewKind;
  /** Label format berkas ringkas (`PDF`, `JPG`, `PNG`, `Dokumen`, `Spreadsheet`, dst.), null bila tidak spesifik. */
  formatLabel: string | null;
  originalUrl: string;
  embedUrl: string | null;
};

type BlobPreviewMeta = {
  fileName: string;
  mimeType: string;
};

const blobPreviewMetaStore = new Map<string, BlobPreviewMeta>();

/** Mencatat tipe MIME & nama berkas untuk URL `blob:` hasil pemilihan file di client. */
export function registerBlobPreviewMeta(blobUrl: string, file: File): string {
  blobPreviewMetaStore.set(blobUrl, {
    fileName: file.name,
    mimeType: file.type,
  });
  return blobUrl;
}

export function getBlobPreviewMeta(blobUrl: string): BlobPreviewMeta | undefined {
  return blobPreviewMetaStore.get(blobUrl);
}

const INTERNAL_SAFE_PREFIXES = [
  "/api/s3-proxy/",
  "/api/inquiries/",
  "/uploads/",
  "/brand/",
  "/images/",
];

/** Unduhan privat bukti PDF pengajuan — selalu PDF, tanpa ekstensi di path. */
const PRIVATE_INQUIRY_DOCUMENT_PATH =
  /^\/api\/inquiries\/[^/?#]+\/documents\/[^/?#]+$/;

const EXTENSION_FORMAT_MAP: Record<string, string> = {
  pdf: "PDF",
  jpg: "JPG",
  jpeg: "JPG",
  png: "PNG",
  webp: "WebP",
  gif: "GIF",
  doc: "DOC",
  docx: "DOCX",
  xls: "XLS",
  xlsx: "XLSX",
  ppt: "PPT",
  pptx: "PPTX",
  csv: "CSV",
  txt: "TXT",
};

function inferFormatLabelFromPath(target?: string | null): string | null {
  if (!target) return null;
  const clean = target.split(/[?#]/)[0]?.trim() ?? "";
  const match = clean.match(/\.([a-z0-9]{2,5})$/i);
  if (!match?.[1]) return null;
  return EXTENSION_FORMAT_MAP[match[1].toLowerCase()] ?? match[1].toUpperCase();
}

function parseSafeExternalHttpUrl(raw: string): URL | null {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function resolveGoogleWorkspaceEmbed(
  url: URL,
  titleHint?: string | null
): { embedUrl: string; formatLabel: string | null } | null {
  const host = url.hostname.toLowerCase();
  const path = url.pathname;
  const resourceKey = url.searchParams.get("resourcekey");
  const titleFormat = inferFormatLabelFromPath(titleHint);
  const appendResourceKey = (target: string) =>
    resourceKey
      ? `${target}${target.includes("?") ? "&" : "?"}resourcekey=${encodeURIComponent(resourceKey)}`
      : target;

  // 1. Google Drive files & folders
  if (host === "drive.google.com" || host === "drive.usercontent.google.com") {
    const fileMatch = path.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch?.[1]) {
      return {
        embedUrl: appendResourceKey(
          `https://drive.google.com/file/d/${fileMatch[1]}/preview`
        ),
        formatLabel: titleFormat,
      };
    }

    const folderMatch = path.match(
      /\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/
    );
    if (folderMatch?.[1]) {
      return {
        embedUrl: appendResourceKey(
          `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}#list`
        ),
        formatLabel: "Folder",
      };
    }

    const queryId = url.searchParams.get("id");
    if (queryId && /^[a-zA-Z0-9_-]+$/.test(queryId)) {
      return {
        embedUrl: appendResourceKey(
          `https://drive.google.com/file/d/${queryId}/preview`
        ),
        formatLabel: titleFormat,
      };
    }

    return {
      embedUrl: url.toString(),
      formatLabel: titleFormat,
    };
  }

  // 2. Google Docs / Sheets / Slides
  if (host === "docs.google.com") {
    const docMatch = path.match(
      /^\/(document|spreadsheets|presentation)\/d\/(?!e\/)([a-zA-Z0-9_-]+)/
    );
    if (docMatch?.[1] && docMatch?.[2]) {
      const product = docMatch[1];
      const docId = docMatch[2];
      const formatLabel =
        titleFormat ??
        (product === "spreadsheets"
          ? "Spreadsheet"
          : product === "presentation"
            ? "Presentasi"
            : "Dokumen");
      return {
        embedUrl: appendResourceKey(
          `https://docs.google.com/${product}/d/${docId}/preview`
        ),
        formatLabel,
      };
    }

    const pubMatch = path.match(
      /^\/(document|spreadsheets|presentation)\/d\/e\/([a-zA-Z0-9_-]+)/
    );
    if (pubMatch?.[1] && pubMatch?.[2]) {
      const product = pubMatch[1];
      const formatLabel =
        titleFormat ??
        (product === "spreadsheets"
          ? "Spreadsheet"
          : product === "presentation"
            ? "Presentasi"
            : "Dokumen");
      const pubUrl = new URL(url.toString());
      if (product === "document" || product === "spreadsheets") {
        pubUrl.searchParams.set("embedded", "true");
      }
      return {
        embedUrl: pubUrl.toString(),
        formatLabel,
      };
    }

    return {
      embedUrl: url.toString(),
      formatLabel: titleFormat ?? "Dokumen",
    };
  }

  return null;
}

/**
 * Mengubah URL berkas/tautan (S3 proxy, blob lokal, gambar, PDF eksternal, atau tautan Drive)
 * menjadi target preview in-app yang aman dengan label format berkas ringkas.
 */
export function resolveDocumentPreview(
  rawLink: string,
  titleHint?: string | null
): ResolvedDocumentPreview {
  const trimmed = rawLink.trim();
  if (!trimmed || /[\s\0]/.test(trimmed)) {
    return {
      kind: "UNSAFE",
      formatLabel: null,
      originalUrl: trimmed,
      embedUrl: null,
    };
  }

  // 1. Blob URL lokal (pratinjau file sebelum simpan / simulasi)
  if (trimmed.startsWith("blob:")) {
    const meta = getBlobPreviewMeta(trimmed);
    const mime = meta?.mimeType.toLowerCase() ?? "";
    const fileName = meta?.fileName.toLowerCase() ?? "";
    const extLabel =
      inferFormatLabelFromPath(meta?.fileName) ??
      inferFormatLabelFromPath(titleHint);
    const isPdf = mime === "application/pdf" || fileName.endsWith(".pdf");
    const isImg =
      mime.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(fileName);

    return {
      kind: isImg ? "IMAGE" : "PDF_NATIVE",
      formatLabel: extLabel ?? (isImg ? "Gambar" : isPdf ? "PDF" : "Berkas"),
      originalUrl: trimmed,
      embedUrl: trimmed,
    };
  }

  // 2. Path internal S3 / static app / dokumen privat pengajuan
  if (
    INTERNAL_SAFE_PREFIXES.some((prefix) => trimmed.startsWith(prefix)) &&
    !trimmed.includes("..")
  ) {
    const pathOnly = trimmed.split(/[?#]/)[0] ?? trimmed;
    if (PRIVATE_INQUIRY_DOCUMENT_PATH.test(pathOnly)) {
      return {
        kind: "PDF_NATIVE",
        formatLabel:
          inferFormatLabelFromPath(titleHint) ?? "PDF",
        originalUrl: trimmed,
        embedUrl: trimmed,
      };
    }

    const resolvedUrl = getS3ProxyUrl(trimmed);
    const extLabel =
      inferFormatLabelFromPath(resolvedUrl) ??
      inferFormatLabelFromPath(titleHint);
    if (isInquiryImage(resolvedUrl)) {
      return {
        kind: "IMAGE",
        formatLabel: extLabel ?? "Gambar",
        originalUrl: resolvedUrl,
        embedUrl: resolvedUrl,
      };
    }
    if (isInquiryPdf(resolvedUrl)) {
      return {
        kind: "PDF_NATIVE",
        formatLabel: "PDF",
        originalUrl: resolvedUrl,
        embedUrl: resolvedUrl,
      };
    }
    return {
      kind: "EXTERNAL_WEB",
      formatLabel: extLabel ?? "Berkas",
      originalUrl: resolvedUrl,
      embedUrl: resolvedUrl,
    };
  }

  // 3. Tautan eksternal HTTP/HTTPS
  const parsed = parseSafeExternalHttpUrl(trimmed);
  if (!parsed) {
    return {
      kind: "UNSAFE",
      formatLabel: null,
      originalUrl: trimmed,
      embedUrl: null,
    };
  }

  const extLabel =
    inferFormatLabelFromPath(parsed.pathname) ??
    inferFormatLabelFromPath(titleHint);

  // 3a. Tautan Drive / Docs / Sheets / Slides dinormalisasi ke mode embed
  const googleEmbed = resolveGoogleWorkspaceEmbed(parsed, titleHint);
  if (googleEmbed) {
    return {
      kind: "GOOGLE_EMBED",
      formatLabel: googleEmbed.formatLabel,
      originalUrl: parsed.toString(),
      embedUrl: googleEmbed.embedUrl,
    };
  }

  // 3b. URL Gambar langsung
  if (isInquiryImage(parsed.toString())) {
    return {
      kind: "IMAGE",
      formatLabel: extLabel ?? "Gambar",
      originalUrl: parsed.toString(),
      embedUrl: parsed.toString(),
    };
  }

  // 3c. URL PDF langsung
  if (isInquiryPdf(parsed.toString())) {
    return {
      kind: "PDF_NATIVE",
      formatLabel: "PDF",
      originalUrl: parsed.toString(),
      embedUrl: parsed.toString(),
    };
  }

  // 3d. Tautan web eksternal lainnya
  return {
    kind: "EXTERNAL_WEB",
    formatLabel: extLabel,
    originalUrl: parsed.toString(),
    embedUrl: parsed.toString(),
  };
}
