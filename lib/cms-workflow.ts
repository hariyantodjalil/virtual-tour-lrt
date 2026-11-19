import type { LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  deriveStepLeadStatus,
  type PipelineStepTypeValue,
  type StepMediaRequirementValue,
  type StepSpaceEffectValue,
} from "@/lib/commercial-pipeline";

export type WorkflowVersionStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type CmsWorkflowStepDTO = {
  id: string;
  stepOrder: number;
  leadStatus: string;
  stepType: PipelineStepTypeValue;
  documentNumberLabel: string | null;
  slaHours: number | null;
  mediaRequirement: StepMediaRequirementValue;
  requiresMedia: boolean;
  spaceEffect: StepSpaceEffectValue;
  title: string;
  description: string | null;
  publicMessage: string;
  showInSummary: boolean;
};

export type CmsWorkflowVersionDTO = {
  id: string;
  version: number | null;
  title: string;
  description: string | null;
  status: WorkflowVersionStatus | string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  leadsCount: number;
  steps: CmsWorkflowStepDTO[];
};

export const cmsWorkflowVersionInclude = {
  steps: {
    orderBy: { stepOrder: "asc" as const },
    select: {
      id: true,
      stepOrder: true,
      leadStatus: true,
      stepType: true,
      documentNumberLabel: true,
      slaHours: true,
      mediaRequirement: true,
      requiresMedia: true,
      spaceEffect: true,
      title: true,
      description: true,
      publicMessage: true,
      showInSummary: true,
    },
  },
  _count: {
    select: { leads: true },
  },
} satisfies Prisma.PipelineWorkflowVersionInclude;

export type WorkflowVersionRow = Prisma.PipelineWorkflowVersionGetPayload<{
  include: typeof cmsWorkflowVersionInclude;
}>;

/** Memetakan record Prisma versi workflow ke DTO aman untuk Server/Client Component. */
export function serializeWorkflowVersion(row: WorkflowVersionRow): CmsWorkflowVersionDTO {
  return {
    id: row.id,
    version: row.version,
    title: row.title,
    description: row.description,
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    leadsCount: row._count.leads,
    steps: row.steps.map((step) => ({
      id: step.id,
      stepOrder: step.stepOrder,
      leadStatus: step.leadStatus,
      stepType: step.stepType as PipelineStepTypeValue,
      documentNumberLabel: step.documentNumberLabel,
      slaHours: step.slaHours,
      mediaRequirement: step.mediaRequirement as StepMediaRequirementValue,
      requiresMedia: step.requiresMedia,
      spaceEffect: step.spaceEffect as StepSpaceEffectValue,
      title: step.title,
      description: step.description,
      publicMessage: step.publicMessage,
      showInSummary: step.showInSummary,
    })),
  };
}

/** Mengambil seluruh versi workflow: terpublikasi terurut versi terbaru, draf terurut waktu edit terbaru. */
export async function getAllWorkflowVersions(): Promise<CmsWorkflowVersionDTO[]> {
  const rows = await prisma.pipelineWorkflowVersion.findMany({
    orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
    include: cmsWorkflowVersionInclude,
  });
  return rows.map(serializeWorkflowVersion).sort((a, b) => {
    const aPub = a.version ?? -1;
    const bPub = b.version ?? -1;
    if (aPub !== bPub) return bPub - aPub;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

/** Mengambil satu versi workflow berdasarkan ID (atau `null` jika tidak ada). */
export async function getWorkflowVersionById(
  id: string
): Promise<CmsWorkflowVersionDTO | null> {
  const row = await prisma.pipelineWorkflowVersion.findUnique({
    where: { id },
    include: cmsWorkflowVersionInclude,
  });
  return row ? serializeWorkflowVersion(row) : null;
}

/** Menghitung nomor versi resmi berikutnya secara berurutan dari seluruh versi terpublikasi. */
export async function getNextPublishedVersionNumber(
  tx: Prisma.TransactionClient
): Promise<number> {
  const latest = await tx.pipelineWorkflowVersion.findFirst({
    where: { version: { not: null } },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return (latest?.version ?? 0) + 1;
}

export type WorkflowStepDraftInput = {
  stepOrder: number;
  leadStatus: LeadStatus;
  stepType: PipelineStepTypeValue;
  documentNumberLabel?: string | null;
  slaHours?: number | null;
  mediaRequirement: StepMediaRequirementValue;
  spaceEffect: StepSpaceEffectValue;
  title: string;
  description?: string | null;
  publicMessage: string;
  showInSummary?: boolean;
};

/**
 * Menormalkan urutan step (`1..N`), `requiresMedia`, label nomor dokumen,
 * serta memastikan tahap awal (`NEW`) dan tahap akhir (`COMMERCIAL_OPERATION`) konsisten.
 */
export function normalizeWorkflowStepsForSave(
  steps: WorkflowStepDraftInput[],
  workflowVersionId: string
) {
  const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

  return sorted.map((step, index) => {
    const stepOrder = index + 1;
    const leadStatus: LeadStatus = deriveStepLeadStatus({
      index,
      totalSteps: sorted.length,
      stepType: step.stepType,
      spaceEffect: step.spaceEffect,
      title: step.title,
      existingLeadStatus: step.leadStatus,
    });

    return {
      workflowVersionId,
      stepOrder,
      leadStatus,
      stepType: step.stepType,
      documentNumberLabel:
        step.stepType === "DOCUMENT_ISSUANCE"
          ? step.documentNumberLabel?.trim() || null
          : null,
      slaHours: step.slaHours && step.slaHours > 0 ? step.slaHours : null,
      mediaRequirement: step.mediaRequirement,
      requiresMedia: step.mediaRequirement === "REQUIRED",
      spaceEffect: step.spaceEffect,
      title: step.title.trim(),
      description: step.description?.trim() || null,
      publicMessage: step.publicMessage.trim(),
      showInSummary: step.showInSummary ?? true,
    };
  });
}

/** Guardrail validasi integritas sebelum versi DRAFT dipublikasikan ke ACTIVE. */
export function validateWorkflowForPublish(
  steps: Array<{
    stepOrder: number;
    stepType: string;
    documentNumberLabel: string | null;
    spaceEffect: string;
    title: string;
    publicMessage: string;
  }>
): string[] {
  const issues: string[] = [];

  if (steps.length < 2) {
    issues.push("Workflow wajib memiliki minimal 2 tahapan sebelum dipublikasikan.");
    return issues;
  }

  const ordered = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
  const hasContiguousOrder = ordered.every((step, idx) => step.stepOrder === idx + 1);
  if (!hasContiguousOrder) {
    issues.push("Urutan stepOrder harus berurutan rapat mulai dari 1 hingga N.");
  }

  for (const step of ordered) {
    if (!step.title.trim() || step.title.trim().length < 2) {
      issues.push(`Tahap ${step.stepOrder}: judul tahap minimal 2 karakter.`);
    }
    if (!step.publicMessage.trim() || step.publicMessage.trim().length < 5) {
      issues.push(`Tahap ${step.stepOrder}: pesan panduan publik minimal 5 karakter.`);
    }
    if (step.stepType === "DOCUMENT_ISSUANCE" && !step.documentNumberLabel?.trim()) {
      issues.push(
        `Tahap ${step.stepOrder} (${step.title}): label nomor surat resmi wajib diisi untuk tipe DOCUMENT_ISSUANCE.`
      );
    }
  }

  const lastStep = ordered[ordered.length - 1];
  if (!lastStep || lastStep.spaceEffect !== "ACTIVATE_TENANT") {
    issues.push(
      "Tahap terakhir wajib menggunakan efek unit ACTIVATE_TENANT agar pengajuan dapat meresmikan penyewa dan mengubah unit menjadi TERISI."
    );
  }

  return issues;
}
