"use client";

import { useTourLanguage } from "@/components/tour/TourLanguageProvider";
import { useMemo, useRef, useState, type ComponentProps } from "react";
import { ChevronRight, MapPin, Maximize2, Phone, Play, Route, Search, Store } from "lucide-react";
import MobileTourSheet, { TourSheetAction } from "./MobileTourSheet";
import type TourUnitsPanel from "./TourUnitsPanel";
import type { StationInfo } from "@/lib/tour-types";
import { SPACE_STATUS_LABELS } from "@/lib/commercial-pipeline";
import {
  isWaypointActive,
  type RouteStop,
  type RouteWaypoint,
} from "@/lib/tour-route-waypoints";
import TourRouteStopPicker from "./TourRouteStopPicker";

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
    fromStops: RouteStop[];
    stops: RouteStop[];
    waypoints: RouteWaypoint[];
    sceneCount: number;
    onSelectScene: (id: string) => void;
    onStart: (autoplay: boolean) => void;
  };
};

const primary = "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#E31E2D] px-3 py-2 text-sm font-semibold text-white hover:bg-[#c41926] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D]";
const secondaryOperate = "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D]";
const secondaryVoid = "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[color:rgb(255_214_218_/_0.22)] bg-[#3A161C] px-3 py-2 text-sm font-semibold text-[#F8ECEE] hover:bg-[#4a1c24] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D]";
const scrollClass = "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]";

function unitMatches(space: Unit, query: string, typeLabels: Record<string, string>, translate: (text: string) => string, locale: string) {
  const q = query.trim().toLocaleLowerCase(locale);
  if (!q) return true;
  const fields = [space.displayName, space.name, space.code, space.assetCode, space.tenantBrand, typeLabels[space.type] ?? space.type, SPACE_STATUS_LABELS[space.status]]
    .filter((value): value is string => Boolean(value));
  return [...fields, ...fields.map(translate)].join(" ")
    .toLocaleLowerCase(locale)
    .includes(q);
}

export default function MobileTourPanels({ panel, station, spaces, typeLabels, contactUrl, activeSceneId, unitListView, onUnitListViewChange, onClose, onSelectUnit, onViewMap, route }: Props) {
  const { t, content, locale } = useTourLanguage();
  const unitScrollTop = useRef(unitListView.scrollTop);
  const [unitQuery, setUnitQuery] = useState("");
  const filteredUnits = useMemo(
    () => spaces.filter(space => unitMatches(space, unitQuery, typeLabels, content, locale)),
    [spaces, unitQuery, typeLabels, content, locale]
  );
  if (panel === "info") {
    const available = spaces.filter(space => space.status === "TERSEDIA").length;
    const occupied = spaces.filter(space => space.status === "TERISI").length;
    return <MobileTourSheet title={t("Info Stasiun")} size="content" tone="void" onClose={onClose}
      footer={<a href={contactUrl} target="_blank" rel="noopener noreferrer" className={primary}><Phone className="size-4" />{available === 0 ? t("Tanya Ketersediaan") : t("Hubungi Tim Komersial")}</a>}>
      <div className={scrollClass}>
        <p className="text-lg font-semibold text-[#F8ECEE]">{station.name}</p>
        <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-[#C4A8AD]"><MapPin className="mt-0.5 size-4 shrink-0" />{content(station.address ?? "")}</p>
        <dl className="mt-5 grid grid-cols-3 divide-x divide-[color:rgb(255_214_218_/_0.12)] border-t border-[color:rgb(255_214_218_/_0.12)] py-4 text-center">
          {[[t("Tersedia"), available, "text-[#34d399]"], [t("Terisi"), occupied, "text-[#ff8a93]"], [t("Total unit"), spaces.length, "text-[#F8ECEE]"]].map(([label, value, tone]) => <div key={label}>
            <dd className={`text-xl font-semibold tabular-nums ${tone}`}>{value}</dd><dt className="mt-1 text-xs text-[#C4A8AD]">{label}</dt>
          </div>)}
        </dl>
        {available === 0 && <p className="mt-2 rounded-xl bg-panel px-3 py-2 text-xs leading-relaxed text-fog">{spaces.length === 0 ? t("Belum ada unit di inventori stasiun ini. Tanya tim komersial untuk opsi stasiun lain.") : t("Semua unit di stasiun ini terisi. Tanya stok stasiun lain ke tim komersial.")}</p>}
      </div>
    </MobileTourSheet>;
  }

  if (panel === "units") {
    const available = spaces.filter(space => space.status === "TERSEDIA").length;
    const noneAvailable = spaces.length > 0 && available === 0;
    const showSearch = spaces.length >= 5;
    return <MobileTourSheet title={t("Unit Komersial")} size="list" tone="operate" onClose={() => { onUnitListViewChange({ ...unitListView, scrollTop: unitScrollTop.current }); onClose(); }} initialExpanded={unitListView.expanded}
      onExpandedChange={expanded => onUnitListViewChange({ expanded, scrollTop: unitScrollTop.current })}
      footer={<div className="space-y-2">
        {noneAvailable && contactUrl && <a href={contactUrl} target="_blank" rel="noopener noreferrer" className={primary}><Phone className="size-4" />{t("Tanya Ketersediaan Stasiun Lain")}</a>}
        <TourSheetAction afterClose={onViewMap} className={secondaryOperate}><Maximize2 className="size-4" />{t("Lihat Peta Unit")}</TourSheetAction>
      </div>}>
      <div ref={node => { if (node) node.scrollTop = unitListView.scrollTop; }} onScroll={event => { unitScrollTop.current = event.currentTarget.scrollTop; }} className={scrollClass}>
        {showSearch ? <div className="pb-3">
          <label htmlFor="tour-unit-search-mobile" className="sr-only">{t("Cari unit")}</label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input id="tour-unit-search-mobile" type="search" value={unitQuery} onChange={event => setUnitQuery(event.target.value)} placeholder={t("Cari nama, kode, atau tipe…")} autoComplete="off"
              className="h-11 w-full rounded-xl border border-slate-300 bg-white py-2 pr-3 pl-9 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-signal focus:ring-2 focus:ring-signal/20" />
          </div>
          <p className="mt-2 text-sm text-slate-600">{unitQuery.trim() ? `${filteredUnits.length} dari ${spaces.length} unit` : `${spaces.length} unit`}</p>
        </div> : <p className="pb-2 text-sm text-slate-600">{spaces.length} {t("unit")}</p>}
        <ul className="divide-y divide-slate-200">
          {filteredUnits.map(space => <li key={space.id}><TourSheetAction afterClose={() => onSelectUnit(space)}
            className="flex min-h-20 w-full items-start gap-3 rounded-lg py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-signal">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Store className="size-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm leading-snug font-semibold">{content(space.displayName || space.name)}</span>
              <span className="mt-1 block text-xs break-words text-slate-500">{space.assetCode ?? space.code}</span>
              <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                <span>{t(typeLabels[space.type] ?? space.type)} · {new Intl.NumberFormat(locale).format(space.area)} m²</span>
                <span className={`rounded-full px-2 py-0.5 font-medium ${space.status === "TERSEDIA" ? "bg-emerald-50 text-emerald-800" : space.status === "TERISI" ? "bg-red-50 text-red-800" : "bg-slate-100 text-slate-800"}`}>{t(SPACE_STATUS_LABELS[space.status])}</span>
              </span>
            </span>
            <ChevronRight className="mt-2 size-4 shrink-0 text-slate-500" />
          </TourSheetAction></li>)}
        </ul>
        {spaces.length > 0 && filteredUnits.length === 0 && unitQuery.trim() && <p className="py-8 text-center text-sm text-slate-600">{t("Tidak ada unit yang cocok dengan “")}{unitQuery.trim()}”.</p>}
        {!spaces.length && <div className="py-8 text-center">
          <p className="text-sm font-semibold text-slate-900">{t("Belum ada unit di inventori stasiun ini")}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{t("Data unit belum dipublikasikan. Tanya tim komersial untuk opsi stasiun lain.")}</p>
          {contactUrl && <a href={contactUrl} target="_blank" rel="noopener noreferrer" className={`${primary} mt-4`}><Phone className="size-4" />{t("Tanya Ketersediaan")}</a>}
        </div>}
      </div>
    </MobileTourSheet>;
  }

  return <MobileTourSheet title={t("Rute Tur")} size="content" tone="void" onClose={onClose}
    footer={<div className="grid grid-cols-2 gap-2">
      <TourSheetAction className={primary} afterClose={() => route.onStart(true)}><Play className="size-4 shrink-0" />{t("Putar otomatis")}</TourSheetAction>
      <TourSheetAction className={secondaryVoid} afterClose={() => route.onStart(false)}><Route className="size-4 shrink-0" />{t("Jelajah manual")}</TourSheetAction>
    </div>}>
    <div className={scrollClass}>
      <p className="text-sm leading-relaxed text-fog">{t("Navigasi mengikuti pinpoint antar panorama — dari posisi sekarang atau titik ke titik.")}</p>
      <div className="mt-4 space-y-3">
        <TourRouteStopPicker id="tour-route-from" label={t("Dari")} value={route.from} stops={route.fromStops} levels={station.levels} onChange={route.onFromChange} />
        <TourRouteStopPicker id="tour-route-to" label={t("Ke")} value={route.to} stops={route.stops} levels={station.levels} onChange={route.onToChange} />
      </div>
      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold text-fog">{t("Jalur")}</p>
        <ol>
          {route.waypoints.map((point, index) => {
            const current = isWaypointActive(point, activeSceneId, station.levels);
            return <li key={`${point.key}-${index}`} className="flex gap-3">
              <div className="flex w-5 flex-col items-center">
                <span className={`mt-2 size-2.5 shrink-0 rounded-full ${current ? "bg-signal" : "bg-fog/50"}`} />
                {index < route.waypoints.length - 1 && <span className="mt-1 w-px flex-1 bg-[color:rgb(255_214_218_/_0.22)]" aria-hidden="true" />}
              </div>
              <TourSheetAction afterClose={() => route.onSelectScene(point.sceneId)}
                className={`mb-3 min-h-11 min-w-0 flex-1 rounded-lg px-2 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-signal ${current ? "font-semibold text-ink" : "text-ink/85 hover:bg-panel"}`}>
                {content(point.label)}
              </TourSheetAction>
            </li>;
          })}
        </ol>
        <p className="text-xs text-fog">{route.waypoints.length} {t("tujuan ·")} {route.sceneCount} {t("panorama di jalur")}</p>
      </div>
    </div>
  </MobileTourSheet>;
}
