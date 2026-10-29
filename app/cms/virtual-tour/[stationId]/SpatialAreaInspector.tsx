"use client";

import type { ReactNode } from "react";
import { Hexagon, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SpatialEntity } from "@/lib/spatial/types";
import {
  spaceStatusColor,
  type SpaceAvailabilityStatus,
} from "@/lib/space-availability";
import { UnitPicker } from "./UnitPicker";

type SpaceOpt = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: SpaceAvailabilityStatus;
  tenantBrand?: string | null;
};

type Props = {
  entity: SpatialEntity | null;
  draftVertexCount: number;
  draftWarning?: string | null;
  /** Info draft “sisi lain” yang sedang digambar untuk unit yang sama. */
  pendingSiblingUnitCode?: string | null;
  siblingFaceCount?: number;
  spaces: SpaceOpt[];
  onUpdate: (patch: Partial<SpatialEntity>) => void;
  onDelete: () => void;
  onCommitDraft: () => void;
  onCancelDraft: () => void;
  onAddSiblingFace?: () => void;
  scenes?: { sceneId: string; title: string }[];
  onPopLastDraftVertex?: () => void;
};

function Section({
  title,
  children,
  collapsible = false,
}: {
  title: string;
  children: ReactNode;
  collapsible?: boolean;
}) {
  if (collapsible) return (
    <details className="border-t border-[rgba(255,214,218,0.12)] pt-3">
      <summary className="cursor-pointer text-xs font-medium text-[#C4A8AD] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{title}</summary>
      <div className="space-y-3 pt-3">{children}</div>
    </details>
  );
  return (
    <section className="space-y-2 border-t border-[rgba(255,214,218,0.12)] pt-3 first:border-t-0 first:pt-0">
      <h4 className="text-xs font-medium text-[#C4A8AD]">
        {title}
      </h4>
      {children}
    </section>
  );
}

export function SpatialAreaInspector({
  entity,
  draftVertexCount,
  draftWarning = null,
  pendingSiblingUnitCode = null,
  siblingFaceCount = 0,
  spaces,
  onUpdate,
  onDelete,
  onCommitDraft,
  onCancelDraft,
  onAddSiblingFace,
  scenes = [],
  onPopLastDraftVertex,
}: Props) {
  if (!entity && draftVertexCount === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[rgba(255,214,218,0.2)] bg-[#261015]/40 px-3 py-4 text-center">
        <Hexagon className="mx-auto mb-2 h-5 w-5 text-emerald-400/80" />
        {pendingSiblingUnitCode ? (
          <p className="text-xs text-[#C4A8AD]">
            Sisi baru · <strong className="font-mono text-[#F8ECEE]">{pendingSiblingUnitCode}</strong><br />Klik minimal 3 sudut.
          </p>
        ) : (
          <p className="text-xs text-[#C4A8AD]">
            Pilih area di kanvas, atau gunakan Unit → Spatial untuk menggambar.
          </p>
        )}
      </div>
    );
  }

  if (!entity && draftVertexCount > 0) {
    const ready = draftVertexCount >= 3 && !draftWarning;
    return (
      <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-[#261015]/60 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
              {pendingSiblingUnitCode
                ? `Draft sisi · ${pendingSiblingUnitCode}`
                : "Area baru"}
            </h3>
            <p className="mt-1 text-xs text-[#C4A8AD]">
              {draftVertexCount} titik
              {!ready && draftVertexCount < 3
                ? " · minimal 3"
                : ""}
            </p>
          </div>
          {ready ? (
            <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              Siap
            </span>
          ) : draftWarning ? (
            <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              Melencong
            </span>
          ) : null}
        </div>
        {draftWarning && (
          <p className="rounded-md bg-amber-500/10 px-2 py-1.5 text-[10px] leading-snug text-amber-200">
            {draftWarning}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="bg-emerald-700 text-white hover:bg-emerald-600"
            disabled={!ready}
            onClick={onCommitDraft}
          >
            Selesaikan area
          </Button>
          {onPopLastDraftVertex && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onPopLastDraftVertex}
              title="Backspace"
            >
              Hapus titik terakhir
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={onCancelDraft}>
            Batal
          </Button>
        </div>
      </div>
    );
  }

  if (!entity) return null;

  const spaceCode = entity.spaceCode ?? "";
  const linked = spaces.find((s) => s.code === spaceCode);
  const fill = entity.style.fillColor ?? "#22C55E";
  const stroke = entity.style.strokeColor ?? "#4ADE80";
  const outlineOnly = entity.style.outlineOnly !== false;
  const showLabel = entity.style.showLabel !== false;
  const showHint = entity.style.showBoundaryHint === true;
  const strokeW = entity.style.strokeWidthPx ?? 2.5;
  const fillOpacity = Math.round((entity.style.fillOpacity ?? 0.1) * 100);
  const vertexCount =
    entity.geometry.type === "spherical_polygon" ? entity.geometry.vertices.length : 0;
  const polygonOk = vertexCount >= 3;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-[#F8ECEE]">
            <Hexagon className="h-3.5 w-3.5 text-emerald-400" />
            Area Spatial
          </h3>
          <p
            className={`mt-1 text-xs ${
              polygonOk
                ? "text-[#C4A8AD]"
                : "text-amber-300"
            }`}
          >
            {polygonOk ? `${vertexCount} titik` : "Perlu minimal 3 titik"}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 shrink-0 px-2 text-red-300 hover:text-red-200"
          onClick={onDelete}
          title="Hapus Spatial Area"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Section title="Unit">
        <div className="space-y-1">
          <UnitPicker
            spaces={spaces}
            value={spaceCode || undefined}
            onChange={(code, space) => {
              const statusColor = space ? spaceStatusColor(space.status) : null;
              onUpdate({
                spaceCode: code || null,
                unitId: space?.id ?? null,
                action: {
                  type: code ? "unit_detail" : "none",
                  targetId: space?.id ?? null,
                },
                ...(statusColor
                  ? {
                      style: {
                        ...entity.style,
                        fillColor: statusColor,
                        strokeColor: statusColor,
                      },
                    }
                  : {}),
              });
            }}
          />
          {spaceCode && siblingFaceCount > 0 && (
            <p className="text-[10px] text-emerald-300/90">
              {siblingFaceCount} sisi
            </p>
          )}
          {spaceCode && onAddSiblingFace && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-1 h-8 w-full border-emerald-500/40 bg-emerald-950/30 text-xs text-emerald-200 hover:bg-emerald-900/40"
              onClick={onAddSiblingFace}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Tambah sisi lain
            </Button>
          )}
        </div>
        <label className="block space-y-1">
          <span className="text-xs text-[#C4A8AD]">Label area</span>
          <input
            className="w-full rounded-md border border-[rgba(255,214,218,0.18)] bg-[#1C0A0E] px-2 py-1.5 text-xs text-[#F8ECEE]"
            value={entity.label ?? ""}
            placeholder={
              linked
                ? `Ruang ${linked.status === "TERSEDIA" ? "tersedia" : "unit"} — ${linked.code}`
                : "Contoh: Ruang tersedia — Cawang F-002"
            }
            onChange={(e) => onUpdate({ label: e.target.value })}
          />
        </label>
      </Section>

      <Section title="Tampilan area" collapsible>
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-xs text-[#C4A8AD]">Warna isi</span>
            <input
              type="color"
              className="h-8 w-full cursor-pointer rounded border border-[rgba(255,214,218,0.18)] bg-transparent"
              value={fill}
              onChange={(e) =>
                onUpdate({
                  style: {
                    ...entity.style,
                    fillColor: e.target.value,
                    strokeColor: e.target.value,
                  },
                })
              }
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[#C4A8AD]">Garis tepi</span>
            <input
              type="color"
              className="h-8 w-full cursor-pointer rounded border border-[rgba(255,214,218,0.18)] bg-transparent"
              value={stroke}
              onChange={(e) =>
                onUpdate({ style: { ...entity.style, strokeColor: e.target.value } })
              }
            />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-xs text-[#C4A8AD]">
            Opasitas isi ({fillOpacity}%)
          </span>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={fillOpacity}
            className="w-full"
            onChange={(e) =>
              onUpdate({
                style: {
                  ...entity.style,
                  fillOpacity: Number(e.target.value) / 100,
                  outlineOnly: Number(e.target.value) <= 18,
                },
              })
            }
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-[#C4A8AD]">
            Ketebalan garis ({strokeW}px)
          </span>
          <input
            type="range"
            min={1}
            max={8}
            step={0.5}
            value={strokeW}
            className="w-full"
            onChange={(e) =>
              onUpdate({
                style: { ...entity.style, strokeWidthPx: Number(e.target.value) },
              })
            }
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-[#C4A8AD]">
          <input type="checkbox" checked={outlineOnly} onChange={(e) => onUpdate({ style: { ...entity.style, outlineOnly: e.target.checked } })} />
          Garis tepi dominan
        </label>
        <label className="flex items-center gap-2 text-xs text-[#C4A8AD]" title="Tampilkan caption Boundary Indicative*">
          <input type="checkbox" checked={showHint} onChange={(e) => onUpdate({ style: { ...entity.style, showBoundaryHint: e.target.checked } })} />
          Catatan batas area
        </label>
      </Section>

      <Section title="Interaksi">
        <label className="block space-y-1 text-xs text-[#C4A8AD]">
          Aksi klik
          <select
            className="w-full rounded border border-white/20 bg-[#1C0A0E] p-2"
            value={entity.action.type}
            onChange={(event) => {
              const type = event.target.value;
              if (type === "none" || type === "info_detail" || type === "open_scene" || type === "unit_detail") {
                onUpdate({ action: { type, targetId: type === "unit_detail" ? entity.unitId : undefined } });
              }
            }}
          >
            <option value="none">Tidak ada aksi</option>
            <option value="unit_detail" disabled={!entity.unitId}>Buka detail unit</option>
            <option value="info_detail">Tampilkan informasi</option>
            <option value="open_scene">Pindah scene</option>
          </select>
        </label>
        {entity.action.type === "open_scene" && (
          <label className="block text-xs text-[#C4A8AD]">
            Target scene
            <select className="mt-1 w-full rounded border border-white/20 bg-[#1C0A0E] p-2"
              value={entity.action.targetId ?? ""}
              onChange={(e) => onUpdate({ action: { ...entity.action, targetId: e.target.value } })}>
              <option value="">Pilih scene</option>
              {scenes.map((scene) => <option key={scene.sceneId} value={scene.sceneId}>{scene.title}</option>)}
            </select>
          </label>
        )}
        {entity.action.type === "info_detail" && (
          <>
            <label className="block text-xs text-[#C4A8AD]">Judul informasi
              <input className="mt-1 w-full rounded border border-white/20 bg-[#1C0A0E] p-2"
                maxLength={160} value={entity.action.title ?? ""}
                onChange={(e) => onUpdate({ action: { ...entity.action, title: e.target.value } })} />
            </label>
            <label className="block text-xs text-[#C4A8AD]">Isi informasi
              <textarea className="mt-1 w-full rounded border border-white/20 bg-[#1C0A0E] p-2"
                maxLength={2000} value={entity.action.description ?? ""}
                onChange={(e) => onUpdate({ action: { ...entity.action, description: e.target.value } })} />
            </label>
          </>
        )}
        <label className="flex items-center gap-2 text-xs text-[#C4A8AD]">
          <input
            type="checkbox"
            checked={showLabel}
            onChange={(e) =>
              onUpdate({ style: { ...entity.style, showLabel: e.target.checked } })
            }
          />
          Tampilkan label
        </label>
        <label className="flex items-center gap-2 text-xs text-[#C4A8AD]">
          <input
            type="checkbox"
            checked={entity.enabled}
            onChange={(e) => onUpdate({ enabled: e.target.checked })}
          />
          Area aktif
        </label>
      </Section>

    </div>
  );
}
