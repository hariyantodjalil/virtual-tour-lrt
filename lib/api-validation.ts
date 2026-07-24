import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export type ParsedJson<T> =
  | { success: true; data: T }
  | { success: false; response: NextResponse };

export async function parseJsonRequest<T>(
  request: NextRequest,
  schema: z.ZodType<T>,
  maxBytes = 1_000_000
): Promise<ParsedJson<T>> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return {
      success: false,
      response: NextResponse.json({ error: "Body JSON terlalu besar" }, { status: 413 }),
    };
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > maxBytes) {
      return {
        success: false,
        response: NextResponse.json({ error: "Body JSON terlalu besar" }, { status: 413 }),
      };
    }
    body = JSON.parse(raw);
  } catch {
    return {
      success: false,
      response: NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 }),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: "Data tidak valid",
          details: result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: result.data };
}
