import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

export type S3AssetType =
  | "panoramas"       // virtual-tour/panoramas/{station-slug}/
  | "floorplans"      // virtual-tour/floorplans/{station-slug}/
  | "stations"        // stations/covers/
  | "spaces"          // spaces/photos/
  | "thumbnails"      // virtual-tour/thumbnails/{station-slug}/
  | "misc";           // misc/

function getS3Client() {
  if (!process.env.S3_ENDPOINT || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
    throw new Error("S3 configuration is missing");
  }
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
}

function getBucketName() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET is not configured");
  return bucket;
}

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
}

/**
 * Generate S3 key dengan struktur folder terorganisir per kategori.
 *
 * Struktur bucket:
 *   virtual-tour/
 *     panoramas/{station-slug}/panorama_xxx.jpg   ← panorama 360°
 *     floorplans/{station-slug}/floorplan_xxx.jpg ← denah lantai
 *     thumbnails/{station-slug}/thumb_xxx.jpg      ← thumbnail scene
 *   stations/
 *     covers/station_xxx.jpg                       ← foto cover stasiun
 *   spaces/
 *     photos/space_xxx.jpg                         ← foto unit komersial
 *   misc/
 *     misc_xxx.jpg
 */
export function generateS3Key(
  type: S3AssetType,
  filename: string,
  context?: { stationSlug?: string }
): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 10);
  const extension = filename.split(".").pop()?.toLowerCase() || "jpg";
  // Sanitize station slug agar aman sebagai path segment
  const slug = context?.stationSlug
    ? context.stationSlug.replace(/[^a-z0-9-]/gi, "-").toLowerCase()
    : "unknown";

  switch (type) {
    case "panoramas":
      return `virtual-tour/panoramas/${slug}/panorama_${timestamp}_${randomId}.${extension}`;
    case "floorplans":
      return `virtual-tour/floorplans/${slug}/floorplan_${timestamp}_${randomId}.${extension}`;
    case "thumbnails":
      return `virtual-tour/thumbnails/${slug}/thumb_${timestamp}_${randomId}.${extension}`;
    case "stations":
      return `stations/covers/station_${timestamp}_${randomId}.${extension}`;
    case "spaces":
      return `spaces/photos/space_${timestamp}_${randomId}.${extension}`;
    case "misc":
    default:
      return `misc/misc_${timestamp}_${randomId}.${extension}`;
  }
}

export async function uploadToS3(
  file: Buffer,
  key: string,
  contentType: string,
  metadata?: Record<string, string>
): Promise<UploadResult> {
  const s3Client = getS3Client();
  const bucket = getBucketName();

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file,
      ContentType: contentType,
      Metadata: metadata,
    })
  );

  return {
    url: `${process.env.S3_ENDPOINT}/${bucket}/${key}`,
    key,
    bucket,
  };
}

export async function downloadFromS3(key: string): Promise<Buffer> {
  const s3Client = getS3Client();
  const bucket = getBucketName();
  const res = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = res.Body;
  if (!body) throw new Error("S3 object kosong");

  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deleteFromS3(key: string): Promise<void> {
  const s3Client = getS3Client();
  const bucket = getBucketName();
  await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export function getPublicUrl(key: string): string {
  return `${process.env.S3_ENDPOINT}/${getBucketName()}/${key}`;
}

export function extractS3KeyFromUrl(url: string): string | null {
  if (!url) return null;

  // Sudah dalam bentuk proxy URL
  if (url.includes("/api/s3-proxy/")) {
    return url.replace(/^.*\/api\/s3-proxy\//, "");
  }

  // Path relatif yang dimulai dengan folder-folder yang dikenali
  const knownRootFolders = [
    "/virtual-tour/",
    "/stations/",
    "/spaces/",
    "/misc/",
    // Legacy paths (backward compat)
    "/panoramas/",
    "/floorplans/",
    "/thumbnails/",
  ];

  for (const prefix of knownRootFolders) {
    if (url.startsWith(prefix)) return url.substring(1); // hapus leading slash
  }

  // URL penuh S3 endpoint
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  if (endpoint && bucket && url.includes(`${endpoint}/${bucket}/`)) {
    return url.replace(`${endpoint}/${bucket}/`, "");
  }

  return null;
}
