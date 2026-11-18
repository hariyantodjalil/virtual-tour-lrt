import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { inquiryDocumentTypeSchema, type InquiryDocumentType } from "./inquiry-media";

export const MAX_INQUIRY_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_INQUIRY_MULTIPART_BYTES = MAX_INQUIRY_DOCUMENT_BYTES + 64 * 1024;
const UUID_PDF = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/i;

// S3_BUCKET can be the existing vtour root itself. Do not add vtour twice.
export function inquiryDocumentPrefix(bucket = process.env.S3_BUCKET ?? "", endpoint = process.env.S3_ENDPOINT ?? "") {
  const root = bucket.replace(/\/+$/, "").split("/").pop();
  let endpointRoot = "";
  try { endpointRoot = new URL(endpoint).pathname.replace(/\/+$/, "").split("/").pop() ?? ""; } catch { /* checked by S3 config */ }
  return root === "vtour" || endpointRoot === "vtour" ? "inquiries" : "vtour/inquiries";
}

function safeLeadId(leadId: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(leadId)) throw new Error("Invalid inquiry id");
  return leadId;
}

export function generateInquiryDocumentKey(leadId: string, type: InquiryDocumentType, uuid: string = randomUUID(), prefix = inquiryDocumentPrefix()) {
  if (!UUID_PDF.test(`${uuid}.pdf`)) throw new Error("Invalid document id");
  return `${prefix}/${safeLeadId(leadId)}/${inquiryDocumentTypeSchema.parse(type)}/${uuid}.pdf`;
}

export function isInquiryDocumentKey(key: string, leadId: string, type: string, prefix = inquiryDocumentPrefix()) {
  if (!inquiryDocumentTypeSchema.safeParse(type).success || !/^[a-zA-Z0-9_-]{1,128}$/.test(leadId)) return false;
  const expected = `${prefix}/${leadId}/${type}/`;
  return key.startsWith(expected) && UUID_PDF.test(key.slice(expected.length));
}

export function safeInquiryDocumentFilename(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "document.pdf";
  const stem = base.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9 _.-]/g, "_").replace(/^\.+/, "").trim().slice(0, 140);
  return `${stem || "document"}.pdf`;
}

export function inquiryDocumentDisposition(name: string) {
  return `attachment; filename="${safeInquiryDocumentFilename(name)}"`;
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
  } finally { reader.releaseLock(); }
  return new Response(Buffer.concat(chunks), { headers: { "content-type": request.headers.get("content-type")! } }).formData();
}

// Match lib/s3.ts configuration, but deliberately never generate a public URL or
// use the public asset uploader/proxy for private inquiry evidence.
function storageConfig() {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) throw new Error("S3 configuration is missing");
  return {
    bucket,
    client: new S3Client({ endpoint, region: process.env.S3_REGION || "us-east-1", credentials: { accessKeyId, secretAccessKey }, forcePathStyle: true }),
  };
}

export async function storeInquiryDocument(bytes: Buffer, key: string) {
  const { client, bucket } = storageConfig();
  await client.send(new PutObjectCommand({
    Bucket: bucket, Key: key, Body: bytes, ContentType: "application/pdf",
    ACL: "private", CacheControl: "private, no-store",
  }));
}

export async function signInquiryDocumentDownload(key: string, filename: string) {
  const { client, bucket } = storageConfig();
  return getSignedUrl(client, new GetObjectCommand({
    Bucket: bucket, Key: key, ResponseContentType: "application/pdf",
    ResponseContentDisposition: inquiryDocumentDisposition(filename), ResponseCacheControl: "private, no-store",
  }), { expiresIn: 60 });
}
