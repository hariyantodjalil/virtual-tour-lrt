import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireAuth, requireRole } from "@/lib/auth";
import { isLocalStorageEnabled, readLocalObject } from "@/lib/local-storage";
import { prisma } from "@/lib/prisma";

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
  ".pdf": "application/pdf",
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

function shouldServeInquiryInline(path: string): boolean {
  return path.startsWith("inquiries/") && (shouldServeDirectly(path) || path.toLowerCase().endsWith(".pdf"));
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
  "virtual-tour/panorama-tiles/",
  "virtual-tour/thumbnails/",
  "virtual-tour/ad-creatives/",
  "stations/covers/",
  "spaces/photos/",
  "spaces/train-rental/",
  "misc/",
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
    const isInquiryObject = s3Key.startsWith("inquiries/");
    if (isPublic && !shouldServeDirectly(s3Key)) {
      return new NextResponse("Resource not found", { status: 404 });
    }
    if (!isPublic) {
      if (isInquiryObject) {
        const auth = await requireRole(request, ["ADMIN", "EDITOR", "MITRA"]);
        if ("error" in auth) {
          return new NextResponse("Resource not found", { status: 404 });
        }
        if (auth.user.role === "MITRA") {
          const [, leadId] = s3Key.split("/");
          if (!leadId) {
            return new NextResponse("Resource not found", { status: 404 });
          }
          const expectedProxyPath = `/api/s3-proxy/${s3Key}`;
          const visibleMedia = await prisma.inquiryMedia.findFirst({
            where: {
              tenantLeadId: leadId,
              isVisibleToMitra: true,
              mediaLink: { in: [expectedProxyPath, `/${s3Key}`] },
              tenantLead: { userId: auth.user.userId },
            },
            select: { id: true },
          });
          if (!visibleMedia) {
            return new NextResponse("Resource not found", { status: 404 });
          }
        }
      } else {
        const auth = await requireAuth(request);
        if ("error" in auth) {
          return new NextResponse("Resource not found", { status: 404 });
        }
      }
    }

    const contentType = getContentType(s3Key);

    // Development tanpa S3: layani file dari penyimpanan lokal (lihat lib/local-storage.ts).
    if (isLocalStorageEnabled()) {
      const local = await readLocalObject(s3Key);
      if (!local) return new NextResponse("Resource not found", { status: 404 });
      const headers: Record<string, string> = {
        "Content-Type": contentType,
        "Content-Length": String(local.length),
        "Cache-Control": isPublic ? "public, max-age=31536000, immutable" : "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      };
      if (isInquiryObject) {
        headers["Content-Disposition"] = "inline";
      }
      return new NextResponse(new Uint8Array(local), { headers });
    }

    if (shouldServeDirectly(s3Key) || s3Key.endsWith(".json") || shouldServeInquiryInline(s3Key)) {
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
      if (isInquiryObject) {
        headers.set("Content-Disposition", "inline");
      }
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
