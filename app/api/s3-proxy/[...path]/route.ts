import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireAuth } from "@/lib/auth";

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
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".json": "application/json",
};

function getContentType(path: string): string {
  const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
  return CONTENT_TYPE_MAP[ext] || "application/octet-stream";
}

function shouldServeDirectly(path: string): boolean {
  const imageExtensions = [".jpg", ".jpeg", ".png", ".webp"];
  const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
  return imageExtensions.includes(ext);
}

function validateS3Key(pathSegments: string[]): string | null {
  if (
    pathSegments.length === 0 ||
    pathSegments.some(
      (segment) => !segment || segment === "." || segment === ".." || !/^[a-zA-Z0-9._-]+$/.test(segment)
    )
  ) {
    return null;
  }
  const s3Key = pathSegments.join("/");
  if (s3Key.startsWith("/") || s3Key.length > 500) return null;
  return s3Key;
}

const PUBLIC_PREFIXES = [
  "virtual-tour/panoramas/",
  "virtual-tour/thumbnails/",
  "virtual-tour/ad-creatives/",
  "stations/covers/",
  "spaces/photos/",
  "panoramas/",
  "floorplans/",
  "thumbnails/",
];

function isPublicKey(key: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function toWebStream(body: {
  transformToWebStream?: () => ReadableStream;
}): ReadableStream | null {
  if (typeof body.transformToWebStream === "function") {
    return body.transformToWebStream();
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const s3Key = validateS3Key(path);
    if (!s3Key) {
      return new NextResponse("Resource not found", { status: 404 });
    }

    const isPublic = isPublicKey(s3Key);
    if (isPublic && !shouldServeDirectly(s3Key)) {
      return new NextResponse("Resource not found", { status: 404 });
    }
    if (!isPublic) {
      const auth = await requireAuth(request);
      if ("error" in auth) {
        return new NextResponse("Resource not found", { status: 404 });
      }
    }

    const contentType = getContentType(s3Key);

    if (shouldServeDirectly(s3Key) || s3Key.endsWith(".json")) {
      const getObjectCommand = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key });
      const s3Response = await s3Client.send(getObjectCommand);
      if (!s3Response.Body) {
        return new NextResponse("Resource not found", { status: 404 });
      }

      const stream = toWebStream(s3Response.Body);
      if (!stream) {
        return new NextResponse("Resource not found", { status: 404 });
      }

      const headers = new Headers({
        "Content-Type": contentType,
        "Cache-Control": isPublic
          ? "public, max-age=31536000, immutable"
          : "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      });
      if (typeof s3Response.ContentLength === "number") {
        headers.set("Content-Length", String(s3Response.ContentLength));
      }
      if (s3Response.ETag) {
        headers.set("ETag", s3Response.ETag);
      }

      return new NextResponse(stream, { headers });
    }

    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key });
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error("S3 proxy error:", error);
    return new NextResponse("Resource not found", { status: 404 });
  }
}
