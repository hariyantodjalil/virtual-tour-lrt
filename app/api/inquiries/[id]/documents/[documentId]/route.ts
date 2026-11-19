import { NextRequest, NextResponse } from "next/server";
import { parseTourLanguage, TOUR_LANGUAGE_COOKIE, translateTourMessage } from "@/lib/tour-language";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isInquiryDocumentKey, signInquiryDocumentDownload } from "@/lib/inquiry-document-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const language = parseTourLanguage(request.cookies.get(TOUR_LANGUAGE_COOKIE)?.value);
  const errorResponse = (message: string, status: number) => NextResponse.json({ error: translateTourMessage(language, message) }, { status, headers });
  const auth = await requireRole(request, ["ADMIN", "EDITOR", "MITRA"]);
  if ("error" in auth) return errorResponse(auth.status === 401 ? "Sesi berakhir. Masuk kembali untuk melanjutkan." : "Akses ditolak.", auth.status);
  const { id, documentId } = await params;
  // The ownership/visibility predicate is part of the query, not a later UI check.
  const media = await prisma.inquiryMedia.findFirst({ where: {
    id: documentId, tenantLeadId: id,
    ...(auth.user.role === "MITRA" ? { isVisibleToMitra: true, tenantLead: { userId: auth.user.userId } } : {}),
  }, select: { storageKey: true, documentType: true, fileName: true } });
  if (!media?.storageKey || !isInquiryDocumentKey(media.storageKey, id, media.documentType)) {
    // Legacy links must be opened separately; never fetch or sign a user-supplied URL.
    return errorResponse("Dokumen tidak ditemukan.", 404);
  }
  try {
    const mode =
      request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
    const signedUrl = await signInquiryDocumentDownload(
      media.storageKey,
      media.fileName || "document.pdf",
      mode
    );
    return new NextResponse(null, { status: 307, headers: { ...headers, Location: signedUrl } });
  } catch {
    return errorResponse("Unduhan tidak tersedia. Coba lagi nanti.", 503);
  }
}
