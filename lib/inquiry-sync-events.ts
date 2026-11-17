/** Event sinkronisasi real-time antara CMS Admin dan Portal Mitra. */
export type InquirySyncEventKind =
  | "lead-created"
  | "lead-updated"
  | "lead-deleted"
  | "media-updated"
  | "tenancy-updated";

export type InquirySyncEvent = {
  eventId: string;
  kind: InquirySyncEventKind;
  leadId?: string;
  userId?: string | null;
  occurredAt: string;
};

export const PARTNER_LEADS_UPDATED_EVENT = "lrt-partner-leads-updated";
export const CMS_LEADS_UPDATED_EVENT = "lrt-cms-leads-updated";

/** Mengabari listener lokal di Portal Mitra bahwa data pengajuan berubah. */
export function notifyPartnerLeadsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PARTNER_LEADS_UPDATED_EVENT));
}

/** Mengabari listener lokal di CMS Admin bahwa daftar/notifikasi pengajuan berubah. */
export function notifyCmsLeadsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CMS_LEADS_UPDATED_EVENT));
}
