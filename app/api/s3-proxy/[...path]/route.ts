import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.S3_BUCKET || "virtual-tour-lrt";

const CONTENT_TYPE_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".json": "application/json",
};

function getContentType(path: string): string {
  const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
  return CONTENT_TYPE_MAP[ext] || "application/octet-stream";
}

function shouldServeDirectly(path: string): boolean {
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
  const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
  return imageExtensions.includes(ext);
}

function validateS3Key(pathSegments: string[]): string | null {
  const sanitizedSegments = pathSegments
    .map((segment) => segment.replace(/[^a-zA-Z0-9._\-/]/g, "").replace(/\.\./g, ""))
    .filter((segment) => segment.length > 0);

  if (sanitizedSegments.length === 0) return null;
  const s3Key = sanitizedSegments.join("/");
  if (s3Key.startsWith("/") || s3Key.length > 500) return null;
  return s3Key;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const s3Key = validateS3Key(path);
    if (!s3Key) {
      return new NextResponse("Resource not found", { status: 404 });
    }

    const contentType = getContentType(s3Key);

    if (shouldServeDirectly(s3Key) || s3Key.endsWith(".json")) {
      const getObjectCommand = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key });
      const s3Response = await s3Client.send(getObjectCommand);
      if (!s3Response.Body) {
        return new NextResponse("Resource not found", { status: 404 });
      }

      const chunks: Uint8Array[] = [];
      for await (const chunk of s3Response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key });
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error("S3 proxy error:", error);
    return new NextResponse("Resource not found", { status: 404 });
  }
}
