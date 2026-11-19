"use client";

import { useTourLanguage } from "@/components/tour/TourLanguageProvider";
import Image from "next/image";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, MapPin, Package, X } from "lucide-react";
import MobileTourSheet from "./MobileTourSheet";
import FloorplanImage from "./FloorplanImage";
import { CONCOURSE_LABELS, CONCOURSE_SECTIONS, concourseAssetCode, type ConcourseLayout, type ConcourseSlot } from "@/lib/concourse-plan";
import type { SpaceAvailabilityStatus } from "@/lib/space-availability";
import { resolvePublicAssetUrl } from "@/lib/s3-utils";
import type { FloorPlanLayer, PlacedAsset, StationFloorplanData } from "@/lib/station-floorplan";

type Space = {
  id: string;
  code: string;
  name: string;
  displayName?: string;
  status: SpaceAvailabilityStatus;
  floor: string;
  tenantLogoUrl?: string | null;
};

const STATUS = {
  TERSEDIA: "Tersedia",
  TERISI: "Terisi",
  RESERVED: "Dipesan",
  FIT_OUT: "Fit-out",
  MAINTENANCE: "Pemeliharaan",
};

function statusStyle(status?: SpaceAvailabilityStatus) {
  if (!status) return "border-dashed border-slate-400 bg-white text-slate-600";
  if (status === "TERSEDIA") return "border-emerald-300 bg-emerald-100 text-emerald-900";
  return "border-slate-300 bg-slate-200 text-slate-800";
}

const planWidth = 760;
const planHeight = 300;
const sectionEdges = [0, 198, 470, 668];

function project(x: number, y: number) {
  return { x: 32 + x * 0.94 + y * 0.38, y: 119 - x * 0.13 + y * 0.98 };
}

function zonePath(left: number, right: number, depth = 0) {
  return [[left, 0], [right, 0], [right, 160], [left, 160]].map(([x, y]) => {
    const point = project(x, y);
    return `${point.x},${point.y + depth}`;
  }).join(" ");
}

type Props = {
  stationName: string;
  layout: ConcourseLayout | null;
  prefix: string;
  slots: ConcourseSlot[];
  spaces: Space[];
  floorplan?: StationFloorplanData | null;
  mobile: boolean;
  onClose: () => void;
  onSpaceSelect: (spaceId: string) => void;
};

export default function FloorPlanMap({
  stationName, layout, prefix, slots, spaces, floorplan, mobile, onClose, onSpaceSelect,
}: Props) {
  const { t, content: translateContent } = useTourLanguage();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layerId, setLayerId] = useState(floorplan?.floorPlans.find((layer) => layer.isActive)?.id ?? "");
  const byId = new Map(spaces.map(space => [space.id, space]));
  const [loadedLayer, setLoadedLayer] = useState("");
  const [failedLayer, setFailedLayer] = useState("");
  const selected = slots.find(slot => slot.id === selectedId);
  const selectedUnit = selected?.spaceId ? byId.get(selected.spaceId) : undefined;
  const hasDraftSlots = slots.some(slot => !slot.spaceId || !byId.has(slot.spaceId));
  const title = t("Peta Unit · {station}", { station: stationName });
  const groups = CONCOURSE_SECTIONS.map(section => [0, 1, 2].map(row => slots
    .filter(slot => slot.section === section && slot.row === row)
    .sort((a, b) => a.position - b.position || a.sequence - b.sequence)));
  const isometric = !mobile && groups.every(rows => rows.every(row => row.length <= 3));
  const layers = floorplan?.floorPlans.filter((layer) => layer.isActive !== false) ?? [];
  const activeLayer: FloorPlanLayer | undefined = layers.find((layer) => layer.id === layerId) ?? layers[0];
  const mapAssets = (floorplan?.placedAssets ?? []).filter(asset => asset.kind !== "scene");
  const layerAssets = mapAssets.filter(asset => asset.floorPlanId === activeLayer?.id);
  const hasCanvas = mapAssets.some(asset => layers.some(layer => layer.id === asset.floorPlanId));
  const useCanvas = Boolean(activeLayer && hasCanvas && failedLayer !== activeLayer.id);
  const showLayerTabs = hasCanvas && layers.length > 1;
  const placedSpaceIds = new Set(useCanvas ? layerAssets.flatMap(asset => {
    if (asset.kind === "space" || asset.kind === "tenant") return [asset.spaceId];
    if (asset.kind !== "slot_marker") return [];
    const id = slots.find(slot => slot.id === asset.slotId)?.spaceId;
    return id ? [id] : [];
  }) : slots.map(slot => slot.spaceId));
  const unplaced = spaces.filter(space => !placedSpaceIds.has(space.id));

  function slotButton(slot: ConcourseSlot) {
    const space = slot.spaceId ? byId.get(slot.spaceId) : undefined;
    const shortCode = `${slot.access === "PAD" ? "P" : "U"}${String(slot.sequence).padStart(2, "0")}`;
    const code = concourseAssetCode(prefix, slot);
    return <button key={slot.id} type="button" onClick={() => setSelectedId(slot.id)}
      aria-label={`${code} · ${space ? t(STATUS[space.status]) : t("Belum diverifikasi")}`}
      aria-pressed={selectedId === slot.id}
      className={`min-h-11 min-w-11 rounded-md border px-1 text-xs font-semibold hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B3A6B] aria-pressed:ring-2 aria-pressed:ring-inset aria-pressed:ring-[#1B3A6B] ${statusStyle(space?.status)}`}>
      {shortCode}
    </button>;
  }

  function canvasMarkerLabel(asset: PlacedAsset): string {
    if (asset.kind === "vending") return asset.label || "Vending";
    if ("slotId" in asset) {
      const slot = slots.find(row => row.id === asset.slotId);
      if (slot) return concourseAssetCode(prefix, slot);
    }
    if (asset.kind === "space" || asset.kind === "tenant") {
      const space = byId.get(asset.spaceId);
      return space?.code ?? "Unit";
    }
    return asset.kind;
  }

  const content = <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-6">
    {showLayerTabs && (
      <div className="flex flex-wrap gap-2">
        {layers.map(layer => (
          <button key={layer.id} type="button" aria-pressed={activeLayer?.id === layer.id}
            onClick={() => { if (layer.id === activeLayer?.id && !failedLayer) return; setLayerId(layer.id); setSelectedId(null); setFailedLayer(""); setLoadedLayer(""); }}
            className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 aria-pressed:border-[#1B3A6B] aria-pressed:bg-[#1B3A6B] aria-pressed:text-white">
            {translateContent(layer.name)}
          </button>
        ))}
      </div>
    )}
    {failedLayer && failedLayer === activeLayer?.id && <p role="status" className="text-sm text-slate-600">{t("Gambar denah belum dapat dimuat.")}</p>}
    {useCanvas && activeLayer && <section aria-label={t("Skema concourse")}>
      {!showLayerTabs && <h3 className="mb-3 text-base font-semibold text-slate-900">{translateContent(activeLayer.name)}</h3>}
      <div className="relative mx-auto overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200"
        style={{ aspectRatio: activeLayer.width / activeLayer.height, width: `min(100%, ${56 * activeLayer.width / activeLayer.height}dvh)` }}>
        <FloorplanImage key={activeLayer.id} src={resolvePublicAssetUrl(activeLayer.url)} name={activeLayer.name}
          onLoad={() => setLoadedLayer(activeLayer.id)} onError={() => setFailedLayer(activeLayer.id)} />
        {loadedLayer === activeLayer.id && layerAssets.map(asset => {
          const spaceId = asset.kind === "space" || asset.kind === "tenant" ? asset.spaceId : undefined;
          const space = spaceId ? byId.get(spaceId) : undefined;
          const slot = "slotId" in asset ? slots.find(item => item.id === asset.slotId) : undefined;
          const linkedSpace = space ?? (slot?.spaceId ? byId.get(slot.spaceId) : undefined);
          const label = canvasMarkerLabel(asset);
          const icon = <span className={`relative grid size-7 place-items-center rounded-lg border border-white text-white shadow-sm ${linkedSpace?.status === "TERSEDIA" ? "bg-emerald-700" : "bg-[#1B3A6B]"}`}
            style={{ transform: `rotate(${asset.rotation}deg) scale(${asset.scale})` }}>
            {slot ? <span aria-hidden="true" className="text-[10px] font-semibold">{slot.access === "PAD" ? "P" : "U"}{String(slot.sequence).padStart(2, "0")}</span>
              : asset.kind === "vending" ? <Package aria-hidden="true" className="size-4" />
              : <MapPin aria-hidden="true" className="size-4" />}
            {asset.kind === "tenant" && space?.tenantLogoUrl && <MapTenantLogo key={space.tenantLogoUrl} url={space.tenantLogoUrl} />}
          </span>;
          const position = { left: `${asset.x / activeLayer.width * 100}%`, top: `${asset.y / activeLayer.height * 100}%` };
          const className = "absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-lg";
          return space || slot ? <button key={asset.id} type="button" title={label}
            aria-label={`${label} · ${linkedSpace ? t(STATUS[linkedSpace.status]) : t("Belum diverifikasi")}`}
            className={`${className} focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-[#1B3A6B]`} style={position}
            onClick={() => { if (space) onSpaceSelect(space.id); else if (slot) setSelectedId(slot.id); }}>
            {icon}
          </button> : <span key={asset.id} aria-label={label} className={className} style={position}>{icon}</span>;
        })}
      </div>
      {loadedLayer === activeLayer.id && !layerAssets.length && <p className="mt-3 text-sm text-slate-600">{t("Posisi unit pada denah belum tersedia.")}</p>}
      {selected && <div className="mt-4 rounded-lg border border-slate-200 px-4 py-3" aria-live="polite">
        <p className="break-all text-sm font-semibold text-slate-900">{concourseAssetCode(prefix, selected)}</p>
        <p className="mt-1 text-xs text-slate-600">{selected.kind === "F" ? "Fixed" : "Zoning"} · {selectedUnit ? t(STATUS[selectedUnit.status]) : t("Belum diverifikasi")}</p>
        {selectedUnit && <button type="button" onClick={() => onSpaceSelect(selectedUnit.id)} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg text-left text-sm font-semibold text-[#1B3A6B] hover:underline focus-visible:outline-2">
          {translateContent(selectedUnit.displayName || selectedUnit.name)}<ArrowUpRight className="size-4 shrink-0" />
        </button>}
      </div>}
    </section>}

    {layout && !useCanvas && <section aria-label={t("Skema concourse")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">Concourse</h3>
        <p className="text-xs text-slate-600">{t("Skema zona · Tipe")} {layout}</p>
      </div>
      {isometric ? <div className="relative mt-3">
        <svg viewBox={`0 0 ${planWidth} ${planHeight}`} className="block w-full" aria-hidden="true">
          <polygon points={zonePath(0, 668, 12)} fill="#cbd5e1" stroke="#94a3b8" strokeLinejoin="round" />
          {CONCOURSE_SECTIONS.map((section, index) => <polygon key={section}
            points={zonePath(sectionEdges[index], sectionEdges[index + 1])}
            fill={index === 1 ? "#f8fafc" : "#e9eff5"} stroke="#94a3b8" strokeLinejoin="round" />)}
          {CONCOURSE_SECTIONS.map((section, index) => {
            const label = project((sectionEdges[index] + sectionEdges[index + 1]) / 2, 0);
            return <text key={section} x={label.x} y={label.y - 12} textAnchor="middle" fill="#334155" fontSize="14" fontWeight="600">{t(CONCOURSE_LABELS[layout][section])}</text>;
          })}
        </svg>
        {groups.map((rows, sectionIndex) => rows.map((row, rowIndex) => row.map((slot, index) => {
          const start = sectionEdges[sectionIndex];
          const width = sectionEdges[sectionIndex + 1] - start;
          const point = project(start + width * (index + 1) / (row.length + 1), 30 + rowIndex * 50);
          return <div key={slot.id} className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${point.x / planWidth * 100}%`, top: `${point.y / planHeight * 100}%` }}>
            {slotButton(slot)}
          </div>;
        })))}
      </div> : <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] divide-x divide-slate-300 overflow-hidden rounded-xl border border-slate-300 bg-slate-50">
        {CONCOURSE_SECTIONS.map((section, index) => <div key={section} className="min-w-0">
          <h4 className="border-b border-slate-200 bg-slate-100 px-1 py-2 text-center text-xs font-semibold text-slate-700">{t(CONCOURSE_LABELS[layout][section])}</h4>
          {[0, 1, 2].map(row => <div key={row} className={`flex min-h-14 flex-wrap content-center justify-center gap-1 p-1 sm:gap-2 sm:p-2 ${row === 1 ? "bg-white" : ""}`}>
            {groups[index][row].map(slotButton)}
          </div>)}
        </div>)}
      </div>}
      {slots.length === 0 && <p className="mt-2 text-sm text-slate-600">{t("Posisi unit pada denah belum tersedia.")}</p>}
      {slots.length > 0 && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
        {[
          { label: t("Tersedia"), status: "TERSEDIA" as const },
          { label: t("Tidak tersedia"), status: "TERISI" as const },
          ...(hasDraftSlots ? [{ label: t("Belum diverifikasi"), status: undefined }] : []),
        ].map(item => <span key={item.label} className="inline-flex items-center gap-2"><span className={`size-3.5 rounded-sm border ${statusStyle(item.status)}`} />{item.label}</span>)}
      </div>}
      {selected && <div className="mt-4 rounded-lg border border-slate-200 px-4 py-3" aria-live="polite">
        <p className="break-all text-sm font-semibold text-slate-900">{concourseAssetCode(prefix, selected)}</p>
        <p className="mt-1 text-xs text-slate-600">{selected.kind === "F" ? "Fixed" : "Zoning"} · {selectedUnit ? t(STATUS[selectedUnit.status]) : t("Belum diverifikasi")}</p>
        {selectedUnit && <button type="button" onClick={() => onSpaceSelect(selectedUnit.id)} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg text-left text-sm font-semibold text-[#1B3A6B] hover:underline focus-visible:outline-2">
          {translateContent(selectedUnit.displayName || selectedUnit.name)}<ArrowUpRight className="size-4 shrink-0" />
        </button>}
      </div>}
    </section>}

    {unplaced.length > 0 && <section>
      <h3 className="text-sm font-semibold text-slate-900">{t("Unit belum dipetakan")}</h3>
      <ul className="mt-2 divide-y divide-slate-200">
        {unplaced.map(space => <li key={space.id}>
          <button type="button" onClick={() => onSpaceSelect(space.id)} className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B3A6B]">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-slate-900">{translateContent(space.displayName || space.name)}</span>
              <span className="block break-words text-xs text-slate-600">{space.code} · {space.floor}</span>
            </span>
            <span className={`shrink-0 rounded-full border px-2 py-1 text-xs font-medium ${statusStyle(space.status)}`}>{t(STATUS[space.status])}</span>
          </button>
        </li>)}
      </ul>
    </section>}
    {!useCanvas && !slots.length && !unplaced.length && <p className="text-sm text-slate-600">{t("Data ruang komersial belum tersedia.")}</p>}
  </div>;

  if (mobile) return <MobileTourSheet title={title} size="list" initialExpanded onClose={onClose}>{content}</MobileTourSheet>;
  const fullscreen = typeof document !== "undefined" && document.fullscreenElement instanceof HTMLElement ? document.fullscreenElement : undefined;
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal container={fullscreen}>
      <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/40" />
      <Dialog.Content aria-describedby={undefined} className="fixed inset-0 z-[91] m-auto flex h-fit max-h-[calc(100dvh-2rem)] w-[min(820px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-white text-slate-900 shadow-xl">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-6 py-2">
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Close aria-label={t("Tutup peta unit")} className="flex size-11 items-center justify-center rounded-full hover:bg-slate-100 focus-visible:outline-2"><X className="size-5" /></Dialog.Close>
        </header>
        {content}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

function MapTenantLogo({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? null : <Image src={resolvePublicAssetUrl(url)} alt="" fill unoptimized onError={() => setFailed(true)}
    className="pointer-events-none rounded-lg bg-white object-contain" />;
}
