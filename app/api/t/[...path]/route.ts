import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getBucketName, getS3Client } from "@/lib/s3";
import { resolveTileAlias } from "@/lib/panorama-tile-alias";
import { TILE_ALIAS_ID_PATTERN } from "@/lib/panorama-tile-path";

const TILE_KEY_PREFIX = "virtual-tour/panorama-tiles/";

function notFound() {
  return new NextResponse("Resource not found", { status: 404 });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const [id, level, file] = path;
  if (
    path.length !== 3 ||
    !TILE_ALIAS_ID_PATTERN.test(id) ||
    !/^\d{1,2}$/.test(level) ||
    !/^[fblrud]\d{1,3}_\d{1,3}\.jpg$/.test(file)
  ) {
    return notFound();
  }

  try {
    const basePath = await resolveTileAlias(id);
    if (!basePath) return notFound();
    const key = `${basePath.replace(/^\//, "")}/${level}/${file}`;
    if (!key.startsWith(TILE_KEY_PREFIX)) return notFound();

    const object = await getS3Client().send(new GetObjectCommand({ Bucket: getBucketName(), Key: key }));
    const stream = object.Body?.transformToWebStream();
    if (!stream) return notFound();

    const headers = new Headers({
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
    });
    if (typeof object.ContentLength === "number") headers.set("Content-Length", String(object.ContentLength));
    if (object.ETag) headers.set("ETag", object.ETag);
    return new NextResponse(stream, { headers });
  } catch (error) {
    console.error("Tile alias error:", error);
    return notFound();
  }
}
