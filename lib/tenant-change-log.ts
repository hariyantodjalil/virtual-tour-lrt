import type { Prisma, TenantChangeAction, TenantChangeEntity } from "@prisma/client";

type LogInput = {
  entityType: TenantChangeEntity;
  entityId: string;
  entityLabel: string;
  stationId?: string | null;
  action: TenantChangeAction;
  changedFields?: string[];
  hotspotsAffected?: number;
  performedBy: string;
};

/** Catat perubahan data tenant di dalam transaksi yang sama dengan perubahannya. */
export async function logTenantChange(tx: Prisma.TransactionClient, input: LogInput) {
  await tx.tenantChangeLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      entityLabel: input.entityLabel.slice(0, 200),
      stationId: input.stationId ?? null,
      action: input.action,
      changedFields: input.changedFields ?? [],
      hotspotsAffected: input.hotspotsAffected ?? 0,
      performedBy: input.performedBy,
    },
  });
}

function sameValue(a: unknown, b: unknown) {
  if (Array.isArray(a) || Array.isArray(b) || (a && typeof a === "object") || (b && typeof b === "object")) {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  }
  return (a ?? null) === (b ?? null);
}

/** Nama field yang nilainya berubah antara data lama dan data baru. */
export function diffChangedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  return Object.keys(after).filter((key) => !sameValue(before[key], after[key]));
}
