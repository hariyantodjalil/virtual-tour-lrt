"use client";

import { useRef, type ComponentProps } from "react";
import { Check, ChevronRight, MapPin, Maximize2, Phone, Play, Route, Store } from "lucide-react";
import MobileTourSheet, { TourSheetAction } from "./MobileTourSheet";
import type TourUnitsPanel from "./TourUnitsPanel";
import type { StationInfo } from "@/lib/tour-types";
import { SPACE_STATUS_LABELS } from "@/lib/commercial-pipeline";

type Unit = ComponentProps<typeof TourUnitsPanel>["spaces"][number];
export type TourUnitListView = { scrollTop: number; expanded: boolean };
export type MobileTourPanel = "info" | "route" | "units";
type Props = {
  panel: MobileTourPanel;
  station: StationInfo;
  spaces: Unit[];
  typeLabels: Record<string, string>;
  contactUrl: string;
  activeSceneId: string;
  unitListView: TourUnitListView;
  onUnitListViewChange: (view: TourUnitListView) => void;
  onClose: () => void;
  onSelectUnit: (unit: Unit) => void;
  onViewMap: () => void;
  route: {
    from: string;
    to: string;
    onFromChange: (id: string) => void;
    onToChange: (id: string) => void;
    groups: { key: string; label: string; items: { sceneId: string; title: string; index: number }[] }[];
    onSelectScene: (id: string) => void;
    onStart: (autoplay: boolean) => void;
  };
};

const primary = "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#E31E2D] px-3 py-2 text-sm font-semibold text-white hover:bg-[#c41926] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D]";
const secondary = "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D]";
const scrollClass = "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]";

export default function MobileTourPanels({ panel, station, spaces, typeLabels, contactUrl, activeSceneId, unitListView, onUnitListViewChange, onClose, onSelectUnit, onViewMap, route }: Props) {
  const unitScrollTop = useRef(unitListView.scrollTop);
  if (panel === "info") {
    const available = spaces.filter(space => space.status === "TERSEDIA").length;
    const occupied = spaces.filter(space => space.status === "TERISI").length;
    return <MobileTourSheet title="Info Stasiun" size="content" onClose={onClose}
      footer={<a href={contactUrl} target="_blank" rel="noopener noreferrer" className={primary}><Phone className="size-4" />Hubungi Tim Komersial</a>}>
      <div className={scrollClass}>
        <p className="text-lg font-semibold">{station.name}</p>
        <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-slate-600"><MapPin className="mt-0.5 size-4 shrink-0" />{station.address}</p>
        <dl className="mt-5 grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-200 py-4 text-center">
          {[["Tersedia", available], ["Terisi", occupied], ["Total unit", spaces.length]].map(([label, value]) => <div key={label}>
            <dd className="text-xl font-semibold tabular-nums">{value}</dd><dt className="mt-1 text-xs text-slate-600">{label}</dt>
          </div>)}
        </dl>
      </div>
    </MobileTourSheet>;
  }

  if (panel === "units") {
    return <MobileTourSheet title="Unit Komersial" size="list" onClose={() => { onUnitListViewChange({ ...unitListView, scrollTop: unitScrollTop.current }); onClose(); }} initialExpanded={unitListView.expanded}
      onExpandedChange={expanded => onUnitListViewChange({ expanded, scrollTop: unitScrollTop.current })}
      footer={<TourSheetAction afterClose={onViewMap} className={secondary}><Maximize2 className="size-4" />Lihat Peta Unit</TourSheetAction>}>
      <div ref={node => { if (node) node.scrollTop = unitListView.scrollTop; }} onScroll={event => { unitScrollTop.current = event.currentTarget.scrollTop; }} className={scrollClass}>
        <p className="pb-2 text-sm text-slate-600">{spaces.length} unit</p>
        <ul className="divide-y divide-slate-200">
          {spaces.map(space => <li key={space.id}><TourSheetAction afterClose={() => onSelectUnit(space)}
            className="flex min-h-20 w-full items-start gap-3 rounded-lg py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#E31E2D]">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Store className="size-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm leading-snug font-semibold">{space.status === "TERISI" && space.tenantBrand ? space.tenantBrand : space.name}</span>
              <span className="mt-1 block text-xs break-words text-slate-500">{space.code}</span>
              <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                <span>{typeLabels[space.type] ?? space.type} · {space.area} m²</span>
                <span className={`rounded-full px-2 py-0.5 font-medium ${space.status === "TERSEDIA" ? "bg-emerald-50 text-emerald-800" : space.status === "TERISI" ? "bg-red-50 text-red-800" : "bg-slate-100 text-slate-700"}`}>{SPACE_STATUS_LABELS[space.status]}</span>
              </span>
            </span>
            <ChevronRight className="mt-2 size-4 shrink-0 text-slate-500" />
          </TourSheetAction></li>)}
        </ul>
        {!spaces.length && <p className="py-8 text-center text-sm text-slate-600">Belum ada unit untuk stasiun ini.</p>}
      </div>
    </MobileTourSheet>;
  }

  return <MobileTourSheet title="Rute Tur" size="list" onClose={onClose}
    footer={<div className="grid grid-cols-2 gap-2">
      <TourSheetAction className={primary} afterClose={() => route.onStart(true)}><Play className="size-4 shrink-0" />Putar otomatis</TourSheetAction>
      <TourSheetAction className={secondary} afterClose={() => route.onStart(false)}><Route className="size-4 shrink-0" />Rute manual</TourSheetAction>
    </div>}>
    <div className={scrollClass}>
      <div className="space-y-3 border-b border-slate-200 pb-4">
        {[{ id: "tour-route-from", label: "Dari", value: route.from, change: route.onFromChange }, { id: "tour-route-to", label: "Ke", value: route.to, change: route.onToChange }].map(field => <div key={field.id}>
          <label htmlFor={field.id} className="mb-1 block text-xs font-medium text-slate-600">{field.label}</label>
          <select id={field.id} value={field.value} onChange={event => field.change(event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus:border-[#E31E2D] focus:ring-2 focus:ring-[#E31E2D]/20">
            {station.scenes.map(scene => <option key={scene.id} value={scene.id}>{scene.title}</option>)}
          </select>
        </div>)}
      </div>
      {route.groups.map(group => <section key={group.key} className="pt-4">
        <h3 className="mb-2 text-xs font-semibold text-slate-600">{group.label}</h3>
        <ol className="space-y-1">
          {group.items.map(item => <li key={item.sceneId}><TourSheetAction aria-current={item.sceneId === activeSceneId ? "location" : undefined} afterClose={() => route.onSelectScene(item.sceneId)}
            className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-[#E31E2D] ${item.sceneId === activeSceneId ? "bg-red-50 font-semibold text-[#a81724]" : "text-slate-700 hover:bg-slate-50"}`}>
            <span className="w-5 shrink-0 text-center text-xs tabular-nums">{item.index + 1}</span><span className="min-w-0 flex-1 break-words">{item.title}</span>
            {item.sceneId === activeSceneId && <Check className="size-4 shrink-0" />}
          </TourSheetAction></li>)}
        </ol>
      </section>)}
    </div>
  </MobileTourSheet>;
}
