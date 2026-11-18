"use client";

import type { ReactNode } from "react";
import { Glasses } from "lucide-react";

type Props = {
  displayName: string;
  title: string;
  subtitle: string;
  onExplore?: () => void;
  pickerReady?: boolean;
  action?: ReactNode | null;
};

/** Header seragam seluruh sub-halaman Portal Mitra. */
export default function PartnerSectionHeader({
  displayName,
  title,
  subtitle,
  onExplore,
  pickerReady = false,
  action,
}: Props) {
  const rightSlot =
    action === undefined && onExplore ? (
      <button
        type="button"
        onClick={onExplore}
        disabled={!pickerReady}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#c41230] px-4 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#a60f28] disabled:opacity-50"
      >
        <Glasses className="size-4" strokeWidth={1.5} />
        Jelajahi Virtual Tour
      </button>
    ) : (
      action
    );

  return (
    <>
      <p className="text-sm text-slate-500">
        Halo, <span className="font-medium text-[#101828]">{displayName}</span>
      </p>

      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#101828] md:text-[28px]">
            {title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p>
        </div>
        {rightSlot}
      </div>
    </>
  );
}
