import { randomUUID } from "node:crypto";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getBucketName, getS3Client, INQUIRY_DOCUMENTS_ROOT } from "@/lib/s3";
import { inquiryDocumentTypeSchema, type InquiryDocumentType } from "./inquiry-media";

export const MAX_INQUIRY_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_INQUIRY_MULTIPART_BYTES = MAX_INQUIRY_DOCUMENT_BYTES + 64 * 1024;
const UUID_PDF = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/i;

/** Root kanonis di bucket `virtual-tour-lrt` untuk bukti PDF pengajuan. */
export const INQUIRY_DOCUMENT_STORAGE_ROOT = INQUIRY_DOCUMENTS_ROOT;

/**
 * Prefix lama yang masih diterima saat verifikasi/unduh/hapus
 * (objek yang sudah tersimpan sebelum penataan folder).
 */
export const LEGACY_INQUIRY_DOCUMENT_ROOTS = [
  "vtour/inquiries",
  "inquiries",
] as const;

function safeLeadId(leadId: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(leadId)) throw new Error("Invalid inquiry id");
  return leadId;
}

/** @deprecated Gunakan INQUIRY_DOCUMENT_STORAGE_ROOT; dipertahankan untuk tes/compat. */
export function inquiryDocumentPrefix() {
  return INQUIRY_DOCUMENT_STORAGE_ROOT;
}

/**
 * Key S3 baru:
 *   inquiries/documents/{leadId}/{DOCUMENT_TYPE}/{uuid}.pdf
 */
export function generateInquiryDocumentKey(
  leadId: string,
  type: InquiryDocumentType,
  uuid: string = randomUUID(),
  root: string = INQUIRY_DOCUMENT_STORAGE_ROOT
) {
  if (!UUID_PDF.test(`${uuid}.pdf`)) throw new Error("Invalid document id");
  return `${root}/${safeLeadId(leadId)}/${inquiryDocumentTypeSchema.parse(type)}/${uuid}.pdf`;
}

function allowedRootsForKey(preferredRoot?: string) {
  const roots = new Set<string>([
    INQUIRY_DOCUMENT_STORAGE_ROOT,
    ...LEGACY_INQUIRY_DOCUMENT_ROOTS,
  ]);
  if (preferredRoot) roots.add(preferredRoot);
  return [...roots];
}

export function isInquiryDocumentKey(
  key: string,
  leadId: string,
  type: string,
  preferredRoot?: string
) {
  if (!inquiryDocumentTypeSchema.safeParse(type).success) return false;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(leadId)) return false;
  if (key.includes("..") || key.startsWith("/") || key.length > 500) return false;

  for (const root of allowedRootsForKey(preferredRoot)) {
    // Hindari false-positive: root lama "inquiries" tidak boleh match
    // key baru "inquiries/documents/…" sebagai `{root}/{leadId}/…` palsu.
    if (root === "inquiries" && key.startsWith(`${INQUIRY_DOCUMENT_STORAGE_ROOT}/`)) {
      continue;
    }
    const expected = `${root}/${leadId}/${type}/`;
    if (key.startsWith(expected) && UUID_PDF.test(key.slice(expected.length))) {
      return true;
    }
  }
  return false;
}

export function safeInquiryDocumentFilename(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "document.pdf";
  const stem = base.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9 _.-]/g, "_").replace(/^\.+/, "").trim().slice(0, 140);
  return `${stem || "document"}.pdf`;
}

export function inquiryDocumentDisposition(
  name: string,
  mode: "inline" | "attachment" = "inline"
) {
  return `${mode}; filename="${safeInquiryDocumentFilename(name)}"`;
}

export function validateInquiryPdf(bytes: Uint8Array, filename: string, mimeType: string) {
  if (bytes.length === 0 || bytes.length > MAX_INQUIRY_DOCUMENT_BYTES) throw new Error("Ukuran PDF harus 1 byte–10 MB.");
  if (!/\.pdf$/i.test(filename) || mimeType !== "application/pdf") throw new Error("Unggah berkas PDF (.pdf) saja.");
  // PDF header must be at the beginning: do not accept disguised HTML/polyglot prefixes.
  const header = Buffer.from(bytes.subarray(0, 8)).toString("ascii");
  if (!/^%PDF-(1\.[0-7]|2\.0)/.test(header)) throw new Error("Isi berkas bukan PDF yang valid.");
}

// Bound the entire multipart body before formData() allocates file buffers, including
// chunked requests without Content-Length. Do not trust the client length header.
export async function readInquiryMultipart(request: Request): Promise<FormData> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;")) throw new Error("Gunakan unggahan multipart/form-data.");
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_INQUIRY_MULTIPART_BYTES) throw new Error("Ukuran unggahan melebihi 10 MB.");
  if (!request.body) throw new Error("Berkas PDF wajib diunggah.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_INQUIRY_MULTIPART_BYTES) {
        await reader.cancel();
        throw new Error("Ukuran unggahan melebihi 10 MB.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new Response(Buffer.concat(chunks), {
    headers: { "content-type": request.headers.get("content-type")! },
  }).formData();
}

/**
 * Upload privat ke S3 bucket proyek.
 * Tidak memakai URL publik / s3-proxy — unduhan hanya lewat API dokumen pengajuan.
 */
export async function storeInquiryDocument(bytes: Buffer, key: string) {
  const client = getS3Client();
  const bucket = getBucketName();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentType: "application/pdf",
      ACL: "private",
      CacheControl: "private, no-store",
      Metadata: {
        purpose: "inquiry-document",
        namespace: INQUIRY_DOCUMENT_STORAGE_ROOT,
      },
    })
  );
}

export async function signInquiryDocumentDownload(
  key: string,
  filename: string,
  mode: "inline" | "attachment" = "inline"
) {
  const client = getS3Client();
  const bucket = getBucketName();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentType: "application/pdf",
      ResponseContentDisposition: inquiryDocumentDisposition(filename, mode),
      ResponseCacheControl: "private, no-store",
    }),
    { expiresIn: 60 }
  );
}

export async function deleteInquiryDocument(key: string) {
  const client = getS3Client();
  const bucket = getBucketName();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
