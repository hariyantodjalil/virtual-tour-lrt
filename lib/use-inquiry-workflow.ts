"use client";
import { PUBLIC_LEAD_PROCESS_STEPS } from "@/lib/commercial-pipeline";

export type InquiryWorkflowStep = { id: string; stepOrder: number; leadStatus: string; title: string; publicMessage: string; showInSummary: boolean };
export type InquiryWorkflow = { id: string; version: number; title: string; steps: InquiryWorkflowStep[] };

const publicWorkflow: InquiryWorkflow = {
  id: "public-leasing", version: 1, title: "Tahapan pengajuan sewa",
  steps: PUBLIC_LEAD_PROCESS_STEPS.map((step, index) => ({ id: step.status, stepOrder: index + 1, leadStatus: step.status, title: step.title, publicMessage: step.detail, showInSummary: true })),
};

/** Public milestones are stable even when a lead retains an older CMS workflow. */
export function useInquiryWorkflow() {
  return publicWorkflow;
}
