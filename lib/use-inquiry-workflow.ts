"use client";
import { useEffect, useState } from "react";

export type InquiryWorkflowStep = { id: string; stepOrder: number; leadStatus: string; title: string; publicMessage: string; showInSummary: boolean };
export type InquiryWorkflow = { id: string; version: number; title: string; steps: InquiryWorkflowStep[] };

export function useInquiryWorkflow() {
  const [workflow, setWorkflow] = useState<InquiryWorkflow | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/workflow/active", { signal: controller.signal, cache: "no-store" }).then(async response => {
      if (response.ok) setWorkflow(await response.json());
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  return workflow;
}
