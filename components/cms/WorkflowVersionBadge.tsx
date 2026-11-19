import { GitBranch } from "lucide-react";

type StatusMeta = {
  label: string;
  badgeClass: string;
};

export function getWorkflowVersionStatusMeta(status?: string | null): StatusMeta {
  if (status === "ACTIVE") {
    return {
      label: "Aktif",
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (status === "DRAFT") {
    return {
      label: "Draf",
      badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }
  if (status === "ARCHIVED") {
    return {
      label: "Arsip",
      badgeClass: "border-slate-200 bg-slate-100 text-slate-600",
    };
  }
  return {
    label: "",
    badgeClass: "border-slate-200 bg-slate-50 text-slate-700",
  };
}

/** Pill konsisten untuk menampilkan versi workflow (`v1`, `v2`, dst.) di panel CMS Admin. */
export default function WorkflowVersionBadge({
  version,
  status,
  title,
  stepCount,
  prefix = "Alur",
  size = "sm",
  showIcon = true,
  compact = false,
}: {
  version: number | null;
  status?: string | null;
  title?: string | null;
  stepCount?: number;
  prefix?: string | null;
  size?: "xs" | "sm";
  showIcon?: boolean;
  compact?: boolean;
}) {
  const meta = getWorkflowVersionStatusMeta(status);
  const versionText =
    typeof version === "number" ? `v${version}` : "Calon Versi";
  const labelText = compact
    ? typeof version === "number"
      ? `v${version}`
      : meta.label || "Draf"
    : [
        prefix
          ? typeof version === "number"
            ? `${prefix} v${version}`
            : prefix
          : versionText,
        typeof stepCount === "number" ? `${stepCount} tahap` : null,
        meta.label || null,
      ]
        .filter(Boolean)
        .join(" · ");

  const fullTooltip = [
    title?.trim() || null,
    typeof version === "number" ? `Versi v${version}` : "Draf belum bernomor versi",
    meta.label ? `Status: ${meta.label}` : null,
  ]
    .filter(Boolean)
    .join(" — ");

  return (
    <span
      title={fullTooltip}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-md border font-semibold tabular-nums ${
        meta.badgeClass
      } ${
        size === "xs"
          ? "gap-1 px-2 py-0.5 text-xs"
          : "gap-1.5 px-2.5 py-1 text-xs"
      }`}
    >
      {showIcon && (
        <GitBranch
          className={size === "xs" ? "size-3 shrink-0" : "size-3.5 shrink-0"}
          strokeWidth={1.75}
          aria-hidden
        />
      )}
      <span>{labelText}</span>
    </span>
  );
}
