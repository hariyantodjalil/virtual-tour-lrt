import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export type S3AssetType =
  | "panoramas"
  | "floorplans"
  | "stations"
  | "spaces"
  | "thumbnails";

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

export function generateS3Key(type: S3AssetType, filename: string): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const extension = filename.split(".").pop()?.toLowerCase() || "jpg";

  switch (type) {
    case "panoramas":
      return `panoramas/panorama_${timestamp}_${randomId}.${extension}`;
    case "floorplans":
      return `floorplans/floorplan_${timestamp}_${randomId}.${extension}`;
    case "stations":
      return `stations/station_${timestamp}_${randomId}.${extension}`;
    case "spaces":
      return `spaces/space_${timestamp}_${randomId}.${extension}`;
    case "thumbnails":
      return `thumbnails/thumb_${timestamp}_${randomId}.${extension}`;
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

  if (url.includes("/api/s3-proxy/")) {
    return url.replace(/^.*\/api\/s3-proxy\//, "");
  }

  const prefixes = [
    "/panoramas/",
    "/floorplans/",
    "/stations/",
    "/spaces/",
    "/thumbnails/",
  ];

  for (const prefix of prefixes) {
    if (url.startsWith(prefix)) return url.substring(1);
  }

  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  if (endpoint && bucket && url.includes(`${endpoint}/${bucket}/`)) {
    return url.replace(`${endpoint}/${bucket}/`, "");
  }

  return null;
}
