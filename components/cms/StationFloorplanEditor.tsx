"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { MapPinned, Package, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import FloorplanImage from "@/components/tour/FloorplanImage";
import Image from "next/image";
import { resolvePublicAssetUrl } from "@/lib/s3-utils";
import { cmsFetch } from "@/lib/cms-fetch";
import { cmsUi } from "@/lib/cms-ui";
import { concourseAssetCode, type ConcourseSlot } from "@/lib/concourse-plan";
import { newPlacedAssetId, type FloorPlanLayer, type PlacedAsset, type StationFloorplanData } from "@/lib/station-floorplan";

type SpaceRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  tenantBrand: string | null;
  tenantLogoUrl: string | null;
};

type Payload = {
  station: { name: string; code: string | null; assetCodePrefix: string | null };
  data: StationFloorplanData;
  updatedAt: string | null;
  palette: {
    spaces: SpaceRow[];
    slots: ConcourseSlot[];
    levels: { id: string; label: string }[];
  };
};

const PIN_KINDS = {
  space: "Unit retail",
  tenant: "Tenant",
  vending: "Vending",
  slot_marker: "Kode slot",
};
type DraftKind = keyof typeof PIN_KINDS;
type Position = Pick<PlacedAsset, "x" | "y">;
type Drag = Position & { id: string; pointerId: number; clientX: number; clientY: number };
const selectClass = `h-10 min-w-0 w-full rounded-lg border px-2.5 text-sm ${cmsUi.input}`;

const newPinMime = "application/x-lrt-floorplan-pin";

const directions: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};

export default function StationFloorplanEditor({ stationId, open, onClose }: {
  stationId: string;
  open: boolean;
  onClose: () => void;
}) {
  const endpoint = `/api/cms/virtual-tour/${encodeURIComponent(stationId)}/floorplan`;
  const { confirmDialog, confirmElement } = useConfirmDialog();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [data, setData] = useState<StationFloorplanData | null>(null);
  const [layerId, setLayerId] = useState("");
  const [loadedLayer, setLoadedLayer] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [kind, setKind] = useState<DraftKind>("space");
  const [spaceId, setSpaceId] = useState("");
  const [slotId, setSlotId] = useState("");
  const [uploadLevelId, setUploadLevelId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"save" | "upload" | "delete" | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [cursor, setCursor] = useState({ x: 0.5, y: 0.5 });
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  const layer = data?.floorPlans.find(item => item.id === layerId);
  const layerPins = data?.placedAssets.filter(asset => asset.floorPlanId === layerId) ?? [];
  const selected = layerPins.find(asset => asset.id === selectedId);
  const ready = Boolean(layer && loadedLayer === layer.id);
  const dirty = Boolean(data && data !== payload?.data);
  const spaces = payload?.palette.spaces ?? [];
  const slots = payload?.palette.slots ?? [];
  const filteredSpaces = spaces.filter(space => (!statusFilter || space.status === statusFilter) && (kind !== "tenant" || Boolean(space.tenantBrand || space.tenantLogoUrl)));
  const availableSlots = kind === "slot_marker" ? slots : slots.filter(slot => !slot.spaceId || slot.spaceId === spaceId);
  const prefix = payload?.station.assetCodePrefix || payload?.station.code;
  const slotLabel = (slot: ConcourseSlot) => prefix ? concourseAssetCode(prefix, slot) : `${slot.access} · ${slot.sequence}`;

  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    async function load() {
      try {
        const res = await cmsFetch(endpoint, { signal: abort.signal });
        if (!res.ok) throw Error("Gagal memuat denah stasiun.");
        const body: Payload = await res.json();
        if (abort.signal.aborted) return;
        setPayload(body);
        setData(body.data);
        setLayerId(body.data.floorPlans.find(item => item.isActive)?.id ?? body.data.floorPlans[0]?.id ?? "");
      } catch {
        if (!abort.signal.aborted) setError("Gagal memuat denah stasiun.");
      }
    }
    void load();
    return () => abort.abort();
  }, [endpoint, open, attempt]);

  function selectLayer(next: string) {
    setLayerId(next);
    setLoadedLayer("");
    setSelectedId(null);
    setCursor({ x: 0.5, y: 0.5 });
  }

  async function requestClose() {
    if (busy) return;
    if (dirty && !await confirmDialog({
      title: "Buang perubahan denah?",
      description: "Posisi pin yang belum disimpan akan hilang.",
      confirmLabel: "Buang perubahan",
      destructive: true,
    })) return;
    onClose();
  }

  function clampPosition(floor: FloorPlanLayer, x: number, y: number): Position {
    return { x: Math.min(floor.width, Math.max(0, x)), y: Math.min(floor.height, Math.max(0, y)) };
  }

  function placeAtPointer(floor: FloorPlanLayer, rect: DOMRect, x: number, y: number) {
    place(clampPosition(floor, (x - rect.left) / rect.width * floor.width, (y - rect.top) / rect.height * floor.height));
  }

  function updatePin(id: string, patch: Partial<Position & { scale: number; rotation: number }>) {
    if (busy) return;
    setData(prev => prev && { ...prev, placedAssets: prev.placedAssets.map(asset => asset.id === id ? { ...asset, ...patch } : asset) });
    setNotice("");
  }

  function place(position: Position) {
    if (!layer || !data || !ready || busy) return;
    const base = { id: newPlacedAssetId(kind), floorPlanId: layer.id, ...position, scale: 1, rotation: 0 };
    let asset: PlacedAsset;
    if (kind === "vending") {
      asset = { ...base, kind };
    } else if (kind === "slot_marker") {
      if (!slots.some(slot => slot.id === slotId)) return setError("Pilih slot kodifikasi.");
      asset = { ...base, kind, slotId };
    } else {
      if (!filteredSpaces.some(space => space.id === spaceId)) return setError("Pilih unit untuk pin ini.");
      const selectedSlot = availableSlots.find(slot => slot.id === slotId);
      asset = kind === "tenant"
        ? { ...base, kind, spaceId }
        : { ...base, kind: "space", spaceId, slotId: selectedSlot?.id };
    }
    if (data.placedAssets.length >= 500) return setError("Maksimal 500 pin per stasiun.");
    setError("");
    setNotice("");
    setData(prev => prev && { ...prev, placedAssets: [...prev.placedAssets, asset] });
    setSelectedId(asset.id);
  }

  function movePin(event: PointerEvent<HTMLButtonElement>) {
    const gesture = drag.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!ready || !layer || !rect || !gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.clientX;
    const dy = event.clientY - gesture.clientY;
    if (Math.hypot(dx, dy) < 3) return;
    updatePin(gesture.id, clampPosition(layer, gesture.x + dx * layer.width / rect.width, gesture.y + dy * layer.height / rect.height));
  }

  function nudgePin(event: KeyboardEvent<HTMLButtonElement>, asset: PlacedAsset) {
    const direction = directions[event.key];
    if (!direction || !layer || !ready || busy) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 10 : 2;
    updatePin(asset.id, clampPosition(layer, asset.x + direction[0] * step, asset.y + direction[1] * step));
  }

  async function persist(operation: NonNullable<typeof busy>, method: string, body: string | FormData) {
    if (!payload || busy) return;
    setBusy(operation);
    setError("");
    setNotice("");
    try {
      const response = await cmsFetch(endpoint, {
        method,
        headers: {
          "If-Match": JSON.stringify(payload.updatedAt ?? "new"),
          ...(typeof body === "string" ? { "Content-Type": "application/json" } : {}),
        },
        body,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.data) {
        setError(result.error || "Perubahan denah belum tersimpan. Coba lagi.");
        return;
      }
      setData(result.data);
      setPayload({ ...payload, data: result.data, updatedAt: result.updatedAt });
      if (operation !== "save") selectLayer(result.layer?.id ?? result.data.floorPlans[0]?.id ?? "");
      setNotice(operation === "upload" ? "Denah diunggah." : operation === "delete" ? "Layer dihapus." : "Denah disimpan.");
    } catch {
      setError("Koneksi terputus. Periksa jaringan lalu coba lagi.");
    } finally {
      setBusy(null);
    }
  }

  async function upload(file: File) {
    if (dirty || busy) return;
    const form = new FormData();
    form.set("file", file);
    form.set("name", file.name.replace(/\.[^.]+$/, ""));
    if (uploadLevelId) form.set("levelId", uploadLevelId);
    await persist("upload", "POST", form);
  }

  async function deleteLayer() {
    if (!layer || dirty || busy) return;
    if (!await confirmDialog({
      title: `Hapus layer ${layer.name}?`,
      description: "Pin di layer ini juga dilepas dari denah stasiun.",
      confirmLabel: "Hapus layer",
      destructive: true,
    })) return;
    await persist("delete", "DELETE", JSON.stringify({ layerId: layer.id }));
  }

  function markerLabel(asset: PlacedAsset) {
    if (asset.kind === "vending") return asset.label || "Vending";
    if (asset.kind === "scene") return asset.label || asset.sceneId;
    if (asset.kind === "slot_marker" || (asset.kind === "space" && asset.slotId)) {
      const slot = slots.find(item => item.id === asset.slotId);
      if (slot) return slotLabel(slot);
    }
    if (asset.kind === "space" || asset.kind === "tenant") {
      const space = spaces.find(item => item.id === asset.spaceId);
      return (asset.kind === "tenant" ? space?.tenantBrand : space?.code) ?? space?.name ?? "Unit";
    }
    return "Slot";
  }

  return <><Dialog open={open} onOpenChange={next => { if (!next) void requestClose(); }}>
    <DialogContent className={`flex w-[calc(100vw-1rem)] max-w-6xl flex-col gap-0 overflow-hidden border p-0 ${cmsUi.modal}`}>
      <DialogHeader className={`shrink-0 border-b px-4 py-4 pr-14 text-left sm:px-6 sm:pr-14 ${cmsUi.hairline}`}>
        <DialogTitle>Kelola denah stasiun</DialogTitle>
        <DialogDescription className={cmsUi.muted}>{payload?.station.name ?? "Denah dan lokasi aset komersial"}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {!data ? (
          error ? <div className="space-y-3">
            <p role="alert" className="text-sm text-red-800">{error}</p>
            <Button variant="outline" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Coba lagi</Button>
          </div> : <p role="status" className={`text-sm ${cmsUi.muted}`}>Memuat denah…</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 items-end gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:gap-3">
              <label className="grid min-w-0 gap-1.5 text-sm font-medium">
                Layer denah
                <select className={selectClass} value={layerId} disabled={Boolean(busy) || !data.floorPlans.length} onChange={e => selectLayer(e.target.value)}>
                  {!data.floorPlans.length && <option value="">Belum ada denah</option>}
                  {data.floorPlans.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="grid min-w-0 gap-1.5 text-sm font-medium">
                Lantai upload
                <select value={uploadLevelId} className={selectClass} disabled={Boolean(busy) || dirty} onChange={e => setUploadLevelId(e.target.value)}>
                  <option value="">Tanpa lantai</option>
                  {payload?.palette.levels.map(level => <option key={level.id} value={level.id}>{level.label}</option>)}
                </select>
              </label>
              <input ref={fileRef} type="file" accept="image/webp,image/png,image/jpeg,image/svg+xml,.webp,.png,.jpg,.jpeg,.svg" hidden
                onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
              <Button type="button" variant="outline" disabled={Boolean(busy) || dirty} onClick={() => fileRef.current?.click()}>
                <Upload aria-hidden="true" className="size-4" />{busy === "upload" ? "Mengunggah…" : "Upload denah"}
              </Button>
              <Button type="button" variant="outline" disabled={!layer || Boolean(busy) || dirty} onClick={() => void deleteLayer()}>Hapus layer</Button>
            </div>
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
              <section aria-label="Kanvas denah" className="min-w-0">
                {layer ? (
                  <div ref={canvasRef} className="relative mx-auto overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200"
                    onDragOver={event => {
                      if (ready && !busy && event.dataTransfer.types.includes(newPinMime)) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "copy";
                      }
                    }}
                    onDrop={event => {
                      if (!event.dataTransfer.types.includes(newPinMime)) return;
                      event.preventDefault();
                      placeAtPointer(layer, event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY);
                    }}
                    style={{ aspectRatio: layer.width / layer.height, width: `min(100%, ${52 * layer.width / layer.height}dvh)` }}>
                    <button type="button" aria-label="Tambah pin pada denah. Gunakan tombol panah untuk memilih posisi."
                      disabled={!ready || Boolean(busy)}
                      className="group absolute inset-0 size-full cursor-crosshair focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D81435] disabled:cursor-default"
                      onClick={e => {
                        if (e.detail === 0) place(clampPosition(layer, cursor.x * layer.width, cursor.y * layer.height));
                        else placeAtPointer(layer, e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);
                      }}
                      onKeyDown={e => {
                        const direction = directions[e.key];
                        if (!direction) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setCursor(prev => ({ x: Math.min(1, Math.max(0, prev.x + direction[0] * .02)), y: Math.min(1, Math.max(0, prev.y + direction[1] * .02)) }));
                      }}>
                      <FloorplanImage key={layer.id} src={layer.url} name={layer.name} onLoad={() => setLoadedLayer(layer.id)} />
                      <span aria-hidden="true" className="pointer-events-none absolute hidden size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-900 bg-white group-focus-visible:block"
                        style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }} />
                    </button>
                    {ready && layerPins.map(pin => {
                      const label = markerLabel(pin);
                      const slot = "slotId" in pin ? slots.find(item => item.id === pin.slotId) : undefined;
                      const space = spaces.find(item => item.id === ("spaceId" in pin ? pin.spaceId : slot?.spaceId));
                      const logo = pin.kind === "tenant" ? space?.tenantLogoUrl : null;
                      const shortCode = slot ? `${slot.access === "PAD" ? "P" : "U"}${String(slot.sequence).padStart(2, "0")}` : null;
                      return <button key={pin.id} type="button" title={label} aria-label={label} aria-pressed={selectedId === pin.id} disabled={Boolean(busy)}
                        className={`absolute grid size-8 touch-none cursor-grab select-none place-items-center rounded-lg border border-white text-xs font-semibold text-white shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D81435] aria-pressed:ring-2 aria-pressed:ring-[#D81435] active:cursor-grabbing ${space?.status === "TERSEDIA" ? "bg-emerald-700" : "bg-[#1B3A6B]"}`}
                        style={{ left: `${pin.x / layer.width * 100}%`, top: `${pin.y / layer.height * 100}%`, transform: `translate(-50%, -50%) rotate(${pin.rotation}deg) scale(${pin.scale})` }}
                        onClick={() => setSelectedId(pin.id)}
                        onPointerDown={event => {
                          if (event.button !== 0) return;
                          drag.current = { id: pin.id, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: pin.x, y: pin.y };
                          event.currentTarget.setPointerCapture(event.pointerId);
                          setSelectedId(pin.id);
                        }}
                        onPointerMove={movePin}
                        onLostPointerCapture={() => { drag.current = null; }}
                        onKeyDown={event => nudgePin(event, pin)}>
                        {logo ? <TenantPinImage key={logo} url={logo} /> : shortCode ?? (pin.kind === "vending"
                          ? <Package aria-hidden="true" className="size-4" /> : <MapPinned aria-hidden="true" className="size-4" />)}
                      </button>;
                    })}
                  </div>
                ) : <div className="grid min-h-40 place-content-center rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-600">Upload denah untuk mulai memasang pin.</div>}
                {ready && <p className={`mt-2 text-xs ${cmsUi.muted}`}>Klik denah untuk menambah pin. Seret pin untuk memindahkannya.</p>}
              </section>
              <aside aria-label="Pengaturan pin" className={`min-w-0 space-y-3 rounded-xl border p-3 ${cmsUi.nested}`}>
                <label className="grid gap-1.5 text-sm font-medium">
                  Jenis pin
                  <select className={selectClass} value={kind} disabled={Boolean(busy)} onChange={event => { setKind(event.target.value as DraftKind); setSpaceId(""); setSlotId(""); setStatusFilter(""); setError(""); }}>
                    {Object.entries(PIN_KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                {(kind === "space" || kind === "tenant") && <>
                  {kind === "space" && <label className="grid gap-1.5 text-sm font-medium">
                    Status unit
                    <select className={selectClass} value={statusFilter} disabled={Boolean(busy)} onChange={e => { setStatusFilter(e.target.value); setSpaceId(""); setSlotId(""); }}>
                      <option value="">Semua status</option>
                      {[...new Set(spaces.map(space => space.status))].map(status => <option key={status}>{status}</option>)}
                    </select>
                  </label>}
                  <label className="grid gap-1.5 text-sm font-medium">
                    {kind === "tenant" ? "Tenant" : "Unit"}
                    <select className={selectClass} value={spaceId} disabled={Boolean(busy)} onChange={e => { setSpaceId(e.target.value); setSlotId(""); }}>
                      <option value="">{filteredSpaces.length ? "Pilih unit" : "Unit tidak tersedia"}</option>
                      {filteredSpaces.map(space => <option key={space.id} value={space.id}>{space.code} · {space.tenantBrand || space.name}</option>)}
                    </select>
                  </label>
                </>}
                {(kind === "slot_marker" || kind === "space") && <label className="grid gap-1.5 text-sm font-medium">
                  Slot kodifikasi
                  <select className={selectClass} value={slotId} disabled={Boolean(busy)} onChange={e => setSlotId(e.target.value)}>
                    <option value="">{kind === "space" ? "Tanpa slot" : "Pilih slot"}</option>
                    {availableSlots.map(slot => <option key={slot.id} value={slot.id}>{slotLabel(slot)}</option>)}
                  </select>
                </label>}
                {ready && <div draggable={!busy} onDragStart={event => {
                  event.dataTransfer.setData(newPinMime, kind);
                  event.dataTransfer.effectAllowed = "copy";
                }} className="hidden min-h-10 cursor-grab items-center gap-2 rounded-lg border border-dashed border-slate-300 px-2.5 text-sm font-medium lg:flex">
                  <MapPinned aria-hidden="true" className="size-4" />Tarik pin ke denah
                </div>}
                {layerPins.length > 0 && <div className={`space-y-3 border-t pt-3 ${cmsUi.hairline}`}>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Pin pada layer
                    <select className={selectClass} value={selectedId ?? ""} disabled={Boolean(busy)} onChange={e => setSelectedId(e.target.value || null)}>
                      <option value="">Pilih pin</option>
                      {layerPins.map(pin => <option key={pin.id} value={pin.id}>{markerLabel(pin)}</option>)}
                    </select>
                  </label>
                  {selected && <>
                    <label className="grid gap-1 text-sm">Ukuran · {Math.round(selected.scale * 100)}%
                      <input type="range" min={0.25} max={8} step={0.05} value={selected.scale} disabled={Boolean(busy)} onChange={e => updatePin(selected.id, { scale: Number(e.target.value) })} />
                    </label>
                    <label className="grid gap-1 text-sm">Rotasi · {selected.rotation}°
                      <input type="range" min={-360} max={360} value={selected.rotation} disabled={Boolean(busy)} onChange={e => updatePin(selected.id, { rotation: Number(e.target.value) })} />
                    </label>
                    <Button type="button" variant="outline" disabled={Boolean(busy)} onClick={() => {
                      setData(prev => prev && { ...prev, placedAssets: prev.placedAssets.filter(pin => pin.id !== selected.id) });
                      setSelectedId(null);
                      setNotice("");
                    }}><Trash2 aria-hidden="true" className="size-4" />Hapus pin</Button>
                  </>}
                </div>}
              </aside>
            </div>
          </div>
        )}
      </div>
      <DialogFooter className={`shrink-0 flex-row flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:space-x-0 sm:px-6 ${cmsUi.hairline}`}>
        <div className="min-w-0 flex-1 basis-48 text-sm">
          {data && error ? <p role="alert" className="break-words text-red-800">{error}</p>
            : <p role="status" className={cmsUi.muted}>{notice || (dirty ? "Ada perubahan yang belum disimpan." : "")}</p>}
        </div>
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={Boolean(busy)}>Tutup</Button>
          <Button type="button" onClick={() => void persist("save", "PUT", JSON.stringify(data))} disabled={!dirty || Boolean(busy)}>
            {busy === "save" ? "Menyimpan…" : "Simpan denah"}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>{confirmElement}</>;
}

function TenantPinImage({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? <MapPinned aria-hidden="true" className="size-4" /> : <Image src={resolvePublicAssetUrl(url)} alt="" fill unoptimized
    className="pointer-events-none rounded-lg bg-white object-contain" draggable={false} onError={() => setFailed(true)} />;
}
