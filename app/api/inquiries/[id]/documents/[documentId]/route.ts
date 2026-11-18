import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isInquiryDocumentKey, signInquiryDocumentDownload } from "@/lib/inquiry-document-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR", "MITRA"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status, headers });
  const { id, documentId } = await params;
  // The ownership/visibility predicate is part of the query, not a later UI check.
  const media = await prisma.inquiryMedia.findFirst({ where: {
    id: documentId, tenantLeadId: id,
    ...(auth.user.role === "MITRA" ? { isVisibleToMitra: true, tenantLead: { userId: auth.user.userId } } : {}),
  }, select: { storageKey: true, documentType: true, fileName: true } });
  if (!media?.storageKey || !isInquiryDocumentKey(media.storageKey, id, media.documentType)) {
    // Legacy links must be opened separately; never fetch or sign a user-supplied URL.
    return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404, headers });
  }
  try {
    const signedUrl = await signInquiryDocumentDownload(media.storageKey, media.fileName || "document.pdf");
    return new NextResponse(null, { status: 307, headers: { ...headers, Location: signedUrl } });
  } catch {
    return NextResponse.json({ error: "Unduhan tidak tersedia. Coba lagi nanti." }, { status: 503, headers });
  }
}
