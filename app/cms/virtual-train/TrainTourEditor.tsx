"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cmsFetch } from "@/lib/cms-fetch";
import type { TrainTourCar } from "@/lib/train-tour-structure";
import type { TourLevel, TourArea } from "@/lib/virtual-tour-structure";
import type { HotspotItem, AddMode } from "@/lib/hotspot-types";
import {
  HOTSPOT_SCALE_DEFAULT,
} from "@/lib/hotspot-types";
import { normalizeHotspots } from "@/lib/hotspot-normalize";
import type { SpaceAvailabilityStatus } from "@/lib/space-availability";
import { isTrainRentalStatus, trainRentalStatusToSpaceStatus, type TrainRentalStatus } from "@/lib/train-rental-sales";
import type { FacilityIconId } from "@/lib/facility-icons";
import {
  BLUR_HEIGHT_DEFAULT,
  BLUR_INTENSITY_DEFAULT,
  BLUR_RADIUS_DEFAULT,
  BLUR_RADIUS_MAX,
  BLUR_SCALE_DEFAULT,
  BLUR_WIDTH_DEFAULT,
  clampBlurSize,
  clampBlurIntensity,
  clampBlurRadius,
  clampBlurScale,
  type PrivacyBlurItem,
} from "@/lib/privacy-blur-types";
import {
  extractPrivacyBlursFromCanvasData,
  mergePrivacyBlursIntoCanvasData,
  isPrivacyBlurBakedInPanorama,
} from "@/lib/privacy-blur-normalize";
import {
  extractInitialViewFromCanvasData,
  mergeInitialViewIntoCanvasData,
} from "@/lib/scene-initial-view";
import type { SceneInitialView, TourLevelPublic } from "@/lib/tour-types";
import {
  ArrowLeft,
  Save,
  Upload,
  MousePointer,
  ArrowRightLeft,
  Info,
  Loader2,
  Eye,
  EyeOff,
  Package,
  X,
  AlertCircle,
  Check,
  Store,
  Megaphone,
  Undo2,
  Redo2,
  Copy,
  Crosshair,
  Network,
  RotateCcw,
} from "lucide-react";
import {
  PannellumEditor,
  type EditorPanoramaPreviewMode,
  type PannellumEditorHandle,
} from "../virtual-tour/[stationId]/PannellumEditor";
import { PannellumPreview } from "../virtual-tour/[stationId]/PannellumPreview";
import { TourStructureSidebar } from "../virtual-tour/[stationId]/TourStructureSidebar";
import { ConnectionMapDialog } from "../virtual-tour/[stationId]/ConnectionMapDialog";
import { IncomingSceneViews } from "../virtual-tour/[stationId]/IncomingSceneViews";
import { TrainTourEditorSidebar } from "./TrainTourEditorSidebar";
import { BakePrivacyBlurDialog } from "@/components/cms/BakePrivacyBlurDialog";
import { useCompactCmsViewport } from "@/components/cms/useCompactCmsViewport";
import { EditorNotice, useEditorNotice } from "@/components/cms/EditorNotice";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import type { PrivacyBlurBakeTarget } from "@/components/cms/BakePrivacyBlurDialog";
import { extractMultiResProfilesFromCanvasData } from "@/lib/panorama-profile";
import { extractHdMultiResProfilesFromCanvasData } from "@/lib/panorama-hd-profile";

type Scene = {
  id: string;
  sceneId: string;
  title: string;
  car: string;
  level: string;
  carId?: string | null;
  zoneId?: string | null;
  areaId?: string | null;
  levelId?: string | null;
  panoramaUrl: string;
  originalPanoramaUrl?: string | null;
  thumbnailUrl?: string | null;
  order: number;
  hotspots: Omit<HotspotItem, "_id">[];
  canvasData?: unknown;
  isActive: boolean;
};

type BulkRow = {
  key: string;
  file: File;
  sceneId: string;
  title: string;
  areaId: string;
  levelSlug: string;
  status: "pending" | "creating" | "uploading" | "done" | "error";
  error?: string;
};

export type TrainEditorTarget = { sceneId: string; code: string; kind: "space" | "ad"; yaw: number; pitch: number };

type Props = {
  initialTarget?: TrainEditorTarget;
  trainId: string;
  trainName: string;
  trainSlug: string;
};

let _tempId = 0;
function tempId() {
  return `hs-${Date.now()}-${++_tempId}`;
}

function sceneToHotspots(scene: Scene): HotspotItem[] {
  return normalizeHotspots(scene.hotspots).map((h, i) => ({
    ...h,
    _id: `hs-${scene.sceneId}-${i}`,
  }));
}

function carsToTourLevels(cars: TrainTourCar[]): TourLevel[] {
  return cars.map((car) => ({
    id: car.id,
    stationId: car.trainId,
    slug: car.slug,
    label: car.label,
    color: car.color,
    hint: car.hint,
    order: car.order,
    isActive: car.isActive,
    areas: car.zones.map((zone) => ({
      id: zone.id,
      stationId: zone.trainId,
      levelId: zone.carId,
      slug: zone.slug,
      label: zone.label,
      order: zone.order,
      isActive: zone.isActive,
    })),
  }));
}

function findArea(levels: TourLevel[], areaId: string): { area: TourArea; level: TourLevel } | null {
  for (const level of levels) {
    const area = level.areas.find((a) => a.id === areaId);
    if (area) return { area, level };
  }
  return null;
}

function suggestSceneId(areaId: string, levelSlug: string, levels: TourLevel[], existingScenes: Scene[]): string {
  const found = findArea(levels, areaId);
  const prefix = found?.area.slug ?? levelSlug;
  const count = existingScenes.filter((s) => s.areaId === areaId).length + 1;
  return `${prefix}-${String(count).padStart(2, "0")}`;
}

function titleToId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type TrainEditorSpace = {
  id: string;
  code: string;
  name: string;
  type: "TRAIN_RENTAL";
  status: SpaceAvailabilityStatus;
  rentalStatus: TrainRentalStatus;
  tenantBrand?: string | null;
};

async function loadTrainRentalSpaces(): Promise<TrainEditorSpace[]> {
  const response = await cmsFetch("/api/cms/train-rental-spaces");
  if (!response.ok) return [];
  const rows: Array<{
    id: string;
    displayNumber: string;
    title: string;
    status?: string;
  }> = await response.json();
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const rentalStatus = isTrainRentalStatus(row.status) ? row.status : "TERSEDIA";
    return {
      id: row.id,
      code: row.displayNumber,
      name: row.title,
      type: "TRAIN_RENTAL",
      status: trainRentalStatusToSpaceStatus(rentalStatus),
      rentalStatus,
    };
  });
}

type EditorSnapshot = {
  hotspots: HotspotItem[];
  privacyBlurs: PrivacyBlurItem[];
  canvasData: unknown;
};

function getLevelConfig(levelSlug: string | undefined, tourLevels: TourLevel[]) {
  const slug = (levelSlug ?? "gerbong-1").toLowerCase();
  const found = tourLevels.find((l) => l.slug === slug || l.slug === levelSlug);
  if (found) return { label: found.label, color: found.color, hint: found.hint ?? "", slug: found.slug };
  return { label: levelSlug ?? "Gerbong", color: "#10b981", hint: "", slug };
}

function tempBlurId() {
  return `blur-${Date.now()}-${++_tempId}`;
}

function sceneToPrivacyBlurs(scene: Scene): PrivacyBlurItem[] {
  return extractPrivacyBlursFromCanvasData(scene.canvasData).map((b, i) => ({
    ...b,
    _id: `blur-${scene.sceneId}-${i}`,
  }));
}

function blursToSave(blurs: PrivacyBlurItem[]) {
  return blurs.map(({ pitch, yaw, width, height, intensity, radius, scale }) => ({
    pitch,
    yaw,
    width,
    height,
    intensity,
    radius,
    scale,
  }));
}

function sceneCanvasWithBlurs(scene: Scene, blurs: PrivacyBlurItem[]) {
  return mergePrivacyBlursIntoCanvasData(scene.canvasData, blursToSave(blurs));
}

function hotspotsToSave(hs: HotspotItem[]): Omit<HotspotItem, "_id">[] {
  return hs.map((hotspot) => {
    const rest: Partial<HotspotItem> = { ...hotspot };
    delete rest._id;
    return rest as Omit<HotspotItem, "_id">;
  });
}

function wrapYaw(yaw: number): number {
  let y = yaw;
  while (y > 180) y -= 360;
  while (y <= -180) y += 360;
  return y;
}

function mapSceneRow(raw: Scene): Scene {
  return {
    ...raw,
    level: raw.car,
    levelId: raw.carId,
    areaId: raw.zoneId ?? raw.areaId,
  };
}

function toPreviewLevels(cars: TrainTourCar[]): TourLevelPublic[] {
  return cars
    .filter((c) => c.isActive)
    .map((car) => ({
      id: car.id,
      slug: car.slug,
      label: car.label,
      color: car.color,
      order: car.order,
      areas: car.zones
        .filter((z) => z.isActive)
        .map((zone) => ({
          id: zone.id,
          slug: zone.slug,
          label: zone.label,
          order: zone.order,
          sceneIds: [],
        })),
      sceneIds: [],
    }));
}

export default function TrainTourEditor({ trainId, trainName, trainSlug, initialTarget }: Props) {
  const editorRef = useRef<PannellumEditorHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const creativeInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const savedSceneRef = useRef<Scene | null>(null);
  const historyPast = useRef<EditorSnapshot[]>([]);
  const historyFuture = useRef<EditorSnapshot[]>([]);
  const moveHistoryPushed = useRef(false);
  const hotspotsRef = useRef<HotspotItem[]>([]);
  const privacyBlursRef = useRef<PrivacyBlurItem[]>([]);
  const currentSceneRef = useRef<Scene | null>(null);

  const [cars, setCars] = useState<TrainTourCar[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const { confirmDialog, confirmElement } = useConfirmDialog();
  const [rentalSpaces, setRentalSpaces] = useState<TrainEditorSpace[]>([]);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [hotspots, setHotspots] = useState<HotspotItem[]>([]);
  const [privacyBlurs, setPrivacyBlurs] = useState<PrivacyBlurItem[]>([]);
  const [addMode, setAddMode] = useState<AddMode>("none");
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [selectedBlurId, setSelectedBlurId] = useState<string | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCreative, setUploadingCreative] = useState(false);
  const [bakingPrivacyBlur, setBakingPrivacyBlur] = useState(false);
  const [bakePrivacyProgress, setBakePrivacyProgress] = useState<{
    percent: number;
    label: string;
  } | null>(null);
  const [bakeBlurConfirmOpen, setBakeBlurConfirmOpen] = useState(false);
  const [editorPreviewMode, setEditorPreviewMode] =
    useState<EditorPanoramaPreviewMode>("display");
  const [blurSizeLinked, setBlurSizeLinked] = useState(true);
  const [isPreview, setIsPreview] = useState(false);
  const compactViewport = useCompactCmsViewport();
  const [explorerPreference, setExplorerCollapsed] = useState<boolean | null>(null);
  const explorerCollapsed = explorerPreference ?? compactViewport;
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [linkedMediaView, setLinkedMediaView] = useState<{ sceneId: string; view: SceneInitialView } | null>(null);
  const [previewEntryView, setPreviewEntryView] = useState<{ sceneId: string; view: SceneInitialView } | null>(null);
  const { notice, showToast } = useEditorNotice();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [showConnectionMap, setShowConnectionMap] = useState(false);

  const [showAddScene, setShowAddScene] = useState(false);
  const [newSceneId, setNewSceneId] = useState("");
  const [newSceneTitle, setNewSceneTitle] = useState("");
  const [newSceneAreaId, setNewSceneAreaId] = useState("");
  const [newSceneLevel, setNewSceneLevel] = useState("gerbong-1");

  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkDefaultAreaId, setBulkDefaultAreaId] = useState("");

  const levels = carsToTourLevels(cars);
  const currentScene = scenes[selectedSceneIndex] ?? null;
  const selectedHotspot = hotspots.find((h) => h._id === selectedHotspotId) ?? null;
  const selectedBlur = privacyBlurs.find((b) => b._id === selectedBlurId) ?? null;
  const editorHematMultiRes = currentScene
    ? extractMultiResProfilesFromCanvasData(currentScene.canvasData)?.desktop ?? null
    : null;
  const editorHdMultiRes = currentScene
    ? extractHdMultiResProfilesFromCanvasData(
        currentScene.canvasData,
        currentScene.panoramaUrl
      )?.desktop ?? null
    : null;
  const privacyBlurGuideOnly = currentScene
    ? isPrivacyBlurBakedInPanorama(currentScene.canvasData)
    : false;
  const selectedBlurRadiusMax = selectedBlur
    ? Math.min(
        BLUR_RADIUS_MAX,
        Math.floor(
          Math.min(
            selectedBlur.width ?? BLUR_WIDTH_DEFAULT,
            selectedBlur.height ?? BLUR_HEIGHT_DEFAULT
          ) / 2
        )
      )
    : BLUR_RADIUS_MAX;

  const incomingMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of scenes) {
      for (const h of s.hotspots ?? []) {
        if (h.type === "scene" && h.sceneId) {
          map.set(h.sceneId, (map.get(h.sceneId) ?? 0) + 1);
        }
      }
    }
    return map;
  }, [scenes]);


  function rememberSavedScene(scene: Scene | null) {
    savedSceneRef.current = scene ? (JSON.parse(JSON.stringify(scene)) as Scene) : null;
  }

  useEffect(() => {
    hotspotsRef.current = hotspots;
  }, [hotspots]);

  useEffect(() => {
    privacyBlursRef.current = privacyBlurs;
  }, [privacyBlurs]);

  useEffect(() => {
    currentSceneRef.current = currentScene;
  }, [currentScene]);

  useEffect(() => {
    moveHistoryPushed.current = false;
  }, [selectedHotspotId, selectedBlurId]);

  function clearHistory() {
    historyPast.current = [];
    historyFuture.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }

  function captureSnapshot(): EditorSnapshot {
    return {
      hotspots: JSON.parse(JSON.stringify(hotspotsRef.current)) as HotspotItem[],
      privacyBlurs: JSON.parse(JSON.stringify(privacyBlursRef.current)) as PrivacyBlurItem[],
      canvasData: currentSceneRef.current?.canvasData
        ? JSON.parse(JSON.stringify(currentSceneRef.current.canvasData))
        : undefined,
    };
  }

  function applySnapshot(snap: EditorSnapshot) {
    setHotspots(snap.hotspots);
    setPrivacyBlurs(snap.privacyBlurs);
    setScenes((prev) =>
      prev.map((s, i) => (i === selectedSceneIndex ? { ...s, canvasData: snap.canvasData } : s))
    );
    setHasUnsaved(true);
  }

  const pushHistory = useCallback(() => {
    historyPast.current.push(captureSnapshot());
    if (historyPast.current.length > 50) historyPast.current.shift();
    historyFuture.current = [];
    setCanUndo(historyPast.current.length > 0);
    setCanRedo(false);
  }, []);

  function undo() {
    if (historyPast.current.length === 0) return;
    historyFuture.current.push(captureSnapshot());
    const snap = historyPast.current.pop();
    if (snap) applySnapshot(snap);
    setCanUndo(historyPast.current.length > 0);
    setCanRedo(historyFuture.current.length > 0);
  }

  function redo() {
    if (historyFuture.current.length === 0) return;
    historyPast.current.push(captureSnapshot());
    const snap = historyFuture.current.pop();
    if (snap) applySnapshot(snap);
    setCanUndo(historyPast.current.length > 0);
    setCanRedo(historyFuture.current.length > 0);
  }

  function restoreSceneState(scene: Scene) {
    setHotspots(sceneToHotspots(scene));
    setPrivacyBlurs(sceneToPrivacyBlurs(scene));
    setSelectedHotspotId(null);
    setSelectedBlurId(null);
    setAddMode("none");
    setHasUnsaved(false);
    clearHistory();
  }

  const load = useCallback(
    async (keepIndex?: number, openLinkedTarget = false) => {
      const [structRes, spaces] = await Promise.all([
        cmsFetch(`/api/cms/virtual-train/${trainId}/structure`),
        loadTrainRentalSpaces(),
      ]);
      if (!structRes.ok) {
        showToast("err", "Gagal memuat struktur tur kereta");
        return;
      }

      const data = await structRes.json();
      const sc: Scene[] = (data.scenes ?? []).map(mapSceneRow);
      const carData: TrainTourCar[] = data.cars ?? [];
      setCars(carData);
      setScenes(sc);
      setRentalSpaces(spaces);
      if (!bulkDefaultAreaId && carData[0]?.zones[0]?.id) {
        setBulkDefaultAreaId(carData[0].zones[0].id);
      }
      if (sc.length > 0) {
        const linkedIndex = openLinkedTarget && initialTarget ? sc.findIndex(scene => scene.sceneId === initialTarget.sceneId) : -1;
        if (openLinkedTarget && initialTarget && linkedIndex < 0) {
          showToast("err", "Scene untuk pinpoint ini tidak ditemukan.");
        }
        const idx = linkedIndex >= 0 ? linkedIndex :
          keepIndex !== undefined && keepIndex < sc.length
            ? keepIndex
            : Math.min(selectedSceneIndex, Math.max(0, sc.length - 1));
        setSelectedSceneIndex(idx);
        rememberSavedScene(sc[idx]);
        const sceneHotspots = sceneToHotspots(sc[idx]);
        setHotspots(sceneHotspots);
        setPrivacyBlurs(sceneToPrivacyBlurs(sc[idx]));
        if (linkedIndex >= 0 && initialTarget) {
          const pins = sceneHotspots.filter(hotspot => hotspot.type === initialTarget.kind && hotspot.spaceCode === initialTarget.code);
          const selected = pins.find(pin => pin.yaw === initialTarget.yaw && pin.pitch === initialTarget.pitch)
            ?? (pins.length === 1 ? pins[0] : undefined);
          if (selected) {
            setSelectedHotspotId(selected._id);
            setLinkedMediaView({ sceneId: initialTarget.sceneId, view: { yaw: selected.yaw, pitch: selected.pitch } });
          } else {
            showToast("err", "Pinpoint media tidak ditemukan di scene ini.");
          }
        }
      } else {
        rememberSavedScene(null);
        setHotspots([]);
        setPrivacyBlurs([]);
      }
      setHasUnsaved(false);
    },
    [trainId, bulkDefaultAreaId, selectedSceneIndex, initialTarget]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(undefined, true);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainId, initialTarget]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.ctrlKey && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.ctrlKey && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSceneIndex]);

  async function selectScene(index: number) {
    if (hasUnsaved) {
      const confirmed = await confirmDialog({
        title: "Pindah scene?",
        description: "Ada perubahan belum disimpan pada scene ini. Perubahan tersebut akan dibuang.",
        confirmLabel: "Pindah Scene",
      });
      if (!confirmed) return;
      const saved = savedSceneRef.current;
      if (saved) {
        setScenes((prev) => prev.map((s) => (s.sceneId === saved.sceneId ? { ...saved } : s)));
      }
    }
    const next = scenes[index];
    if (!next) return;
    setSelectedSceneIndex(index);
    setLinkedMediaView(null);
    setEditorPreviewMode("display");
    rememberSavedScene(next);
    restoreSceneState(next);
    setIsPreview(false);
  }

  async function resetChanges() {
    if (!hasUnsaved || !currentScene) return;
    const confirmed = await confirmDialog({
      title: "Buang semua perubahan yang belum disimpan?",
      description: "Scene akan dikembalikan ke versi terakhir yang tersimpan.",
      confirmLabel: "Ya, Buang Perubahan",
    });
    if (!confirmed) return;
    const saved = savedSceneRef.current;
    if (saved && saved.sceneId === currentScene.sceneId) {
      setScenes((prev) => prev.map((s, i) => (i === selectedSceneIndex ? { ...saved } : s)));
      restoreSceneState(saved);
      showToast("ok", "Perubahan dibatalkan");
      return;
    }
    void load(selectedSceneIndex).then(() => {
      setSelectedHotspotId(null);
      setSelectedBlurId(null);
      setAddMode("none");
      showToast("ok", "Perubahan dibatalkan");
    });
  }

  async function saveScene() {
    if (!currentScene) return;
    setSaving(true);
    try {
      const view = editorRef.current?.getView();
      let canvasData = sceneCanvasWithBlurs(currentScene, privacyBlurs);
      if (view) {
        canvasData = mergeInitialViewIntoCanvasData(canvasData, view);
      }

      const res = await cmsFetch(`/api/cms/virtual-train/${trainId}/${currentScene.sceneId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: currentScene.title,
          hotspots: hotspotsToSave(hotspots),
          canvasData,
          areaId: currentScene.areaId,
          levelId: currentScene.levelId,
        }),
      });
      if (!res.ok) {
        showToast("err", "Gagal menyimpan scene");
        return;
      }
      const updated = mapSceneRow(await res.json());
      rememberSavedScene(updated);
      setScenes((prev) => prev.map((s, i) => (i === selectedSceneIndex ? { ...s, ...updated } : s)));
      if (updated.hotspots.length !== hotspots.length) {
        setHotspots(sceneToHotspots(updated));
        setSelectedHotspotId(null);
      }
      setHasUnsaved(false);
      showToast("ok", "Scene disimpan");
    } catch {
      showToast("err", "Error jaringan");
    } finally {
      setSaving(false);
    }
  }

  function requestBakePrivacyBlurs() {
    if (!currentScene?.panoramaUrl || privacyBlurs.length === 0 || bakingPrivacyBlur) return;
    setBakeBlurConfirmOpen(true);
  }

  async function bakePrivacyBlursToPanorama(target: PrivacyBlurBakeTarget = "both") {
    if (!currentScene?.panoramaUrl || privacyBlurs.length === 0) return;
    setBakeBlurConfirmOpen(false);

    const viewerCtx = editorRef.current?.getViewerBakeContext();
    setBakingPrivacyBlur(true);
    setBakePrivacyProgress({ percent: 0, label: "Menyiapkan…" });
    try {
      const res = await cmsFetch(
        `/api/cms/virtual-train/${trainId}/${currentScene.sceneId}/bake-privacy-blur`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/x-ndjson",
          },
          body: JSON.stringify({
            privacyBlurs: blursToSave(privacyBlurs),
            viewerWidth: viewerCtx?.viewerWidth,
            viewerHeight: viewerCtx?.viewerHeight,
            hfov: viewerCtx?.hfov,
            target,
          }),
        }
      );
      if (res.status === 401) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast("err", (data as { error?: string }).error ?? "Gagal bake blur ke panorama");
        return;
      }
      const { consumeBakePrivacyBlurStream } = await import("@/lib/cms-bake-progress-client");
      const data = await consumeBakePrivacyBlurStream(res, {
        onProgress: (percent, label) => setBakePrivacyProgress({ percent, label }),
      });
      const hd = data.hd as { status?: string; reason?: string } | undefined;
      if (target === "hd") {
        showToast(
          "ok",
          hd?.status === "done" ? "Tile HD dibake" : data.message || "Bake HD selesai"
        );
        setEditorPreviewMode("hd");
      } else {
        const hdMsg =
          hd?.status === "queued"
            ? " · HD diantrikan"
            : hd?.status === "skipped"
              ? ` · HD dilewati (${hd.reason ?? "tidak tersedia"})`
              : "";
        showToast("ok", `Blur dibake ke panorama Hemat${hdMsg}`);
        setEditorPreviewMode("display");
      }
      setHasUnsaved(false);
      await load(selectedSceneIndex);
    } catch (err) {
      showToast("err", err instanceof Error ? err.message : "Error jaringan saat bake blur");
    } finally {
      setBakingPrivacyBlur(false);
      setBakePrivacyProgress(null);
    }
  }

  async function uploadPanorama(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentScene) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await cmsFetch(`/api/cms/virtual-train/${trainId}/${currentScene.sceneId}`, {
        method: "POST",
        body: fd,
      });
      if (res.ok) {
        showToast("ok", "Panorama diupload");
        await load(selectedSceneIndex);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast("err", data.error ?? "Upload gagal");
      }
    } catch {
      showToast("err", "Error upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function openAddScene(areaId: string, levelSlug: string) {
    setNewSceneAreaId(areaId);
    setNewSceneLevel(levelSlug);
    setNewSceneId(suggestSceneId(areaId, levelSlug, levels, scenes));
    setNewSceneTitle("");
    setShowAddScene(true);
  }

  async function addScene(e: React.FormEvent) {
    e.preventDefault();
    if (!newSceneId.trim() || !newSceneTitle.trim() || !newSceneAreaId) return;
    if (scenes.some((s) => s.sceneId === newSceneId.trim())) {
      showToast("err", `Scene ID "${newSceneId}" sudah ada`);
      return;
    }

    const res = await cmsFetch(`/api/cms/virtual-train/${trainId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sceneId: newSceneId.trim(),
        title: newSceneTitle.trim(),
        level: newSceneLevel,
        areaId: newSceneAreaId,
        order: scenes.filter((s) => s.areaId === newSceneAreaId).length,
      }),
    });
    if (!res.ok) {
      showToast("err", "Gagal tambah scene");
      return;
    }
    setShowAddScene(false);
    await load();
    showToast("ok", "Scene ditambahkan");
  }

  async function deleteScene(scene: Scene) {
    const confirmed = await confirmDialog({
      title: `Hapus scene "${scene.title}"?`,
      description: "Panah yang menuju scene ini ikut dihapus.",
      confirmLabel: "Ya, Hapus",
      destructive: true,
    });
    if (!confirmed) return;
    const res = await cmsFetch(`/api/cms/virtual-train/${trainId}/${scene.sceneId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      showToast("err", "Gagal menghapus scene");
      return;
    }
    await load();
    showToast("ok", "Scene dihapus");
  }

  async function moveScene(index: number, dir: "up" | "down") {
    const scene = scenes[index];
    if (!scene?.areaId) return;

    const areaScenes = scenes
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.areaId === scene.areaId)
      .sort((a, b) => a.s.order - b.s.order);

    const posInArea = areaScenes.findIndex(({ i }) => i === index);
    const swapPos = dir === "up" ? posInArea - 1 : posInArea + 1;
    if (swapPos < 0 || swapPos >= areaScenes.length) return;

    const a = areaScenes[posInArea];
    const b = areaScenes[swapPos];

    const res = await cmsFetch(`/api/cms/virtual-train/${trainId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orders: [
          { sceneId: a.s.sceneId, order: b.s.order },
          { sceneId: b.s.sceneId, order: a.s.order },
        ],
      }),
    });
    if (res.ok) await load();
  }

  function handleBulkFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const defaultArea = bulkDefaultAreaId || levels[0]?.areas[0]?.id || "";
    const defaultLevel = findArea(levels, defaultArea)?.level.slug ?? levels[0]?.slug ?? "gerbong-1";

    const rows: BulkRow[] = files.map((file, i) => {
      const areaId = defaultArea;
      const levelSlug = defaultLevel;
      const baseCount = scenes.filter((s) => s.areaId === areaId).length + i + 1;
      const areaSlug = findArea(levels, areaId)?.area.slug ?? levelSlug;
      const sceneId = `${areaSlug}-${String(baseCount).padStart(2, "0")}`;
      const title = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ");
      return { key: `${file.name}-${i}`, file, sceneId, title, areaId, levelSlug, status: "pending" as const };
    });
    setBulkRows(rows);
  }

  function updateBulkRow(key: string, field: keyof BulkRow, value: string) {
    setBulkRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        if (field === "areaId") {
          const found = findArea(levels, value);
          return { ...r, areaId: value, levelSlug: found?.level.slug ?? r.levelSlug };
        }
        return { ...r, [field]: value };
      })
    );
  }

  async function runBulkImport() {
    if (bulkRunning) return;
    setBulkRunning(true);
    let anySucceeded = false;

    for (const row of bulkRows) {
      if (row.status === "done") {
        anySucceeded = true;
        continue;
      }

      setBulkRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, status: "creating" } : r)));

      const createRes = await cmsFetch(`/api/cms/virtual-train/${trainId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: row.sceneId,
          title: row.title,
          level: row.levelSlug,
          areaId: row.areaId,
          order: scenes.filter((s) => s.areaId === row.areaId).length + bulkRows.indexOf(row),
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json().catch(() => ({}));
        setBulkRows((prev) =>
          prev.map((r) =>
            r.key === row.key ? { ...r, status: "error", error: data.error ?? "Gagal membuat scene" } : r
          )
        );
        continue;
      }

      setBulkRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, status: "uploading" } : r)));

      const fd = new FormData();
      fd.append("file", row.file);
      const uploadRes = await cmsFetch(`/api/cms/virtual-train/${trainId}/${row.sceneId}`, {
        method: "POST",
        body: fd,
      });

      if (uploadRes.ok) {
        anySucceeded = true;
        setBulkRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, status: "done" } : r)));
      } else {
        const data = await uploadRes.json().catch(() => ({}));
        setBulkRows((prev) =>
          prev.map((r) =>
            r.key === row.key ? { ...r, status: "error", error: data.error ?? "Gagal upload" } : r
          )
        );
      }
    }

    setBulkRunning(false);
    if (anySucceeded) {
      showToast("ok", "Bulk import selesai");
      await load();
    }
  }

  const handleHotspotAdd = useCallback(
    (yaw: number, pitch: number) => {
      if (addMode === "blur") return;
      pushHistory();
      const type =
        addMode === "scene"
          ? "scene"
          : addMode === "space"
            ? "space"
            : addMode === "ad"
              ? "ad"
              : "info";
      const newH: HotspotItem = {
        _id: tempId(),
        yaw,
        pitch,
        type,
        text:
          type === "scene"
            ? "Scene baru"
            : type === "space"
              ? "Unit baru"
              : type === "ad"
                ? "Iklan baru"
                : "Info baru",
        scale: HOTSPOT_SCALE_DEFAULT,
        ...(type === "info" ? { description: "" } : {}),
      };
      setHotspots((prev) => [...prev, newH]);
      setSelectedHotspotId(newH._id);
      setSelectedBlurId(null);
      setAddMode("none");
      setHasUnsaved(true);
    },
    [addMode, pushHistory]
  );

  const handleBlurAdd = useCallback(
    (yaw: number, pitch: number) => {
      pushHistory();
      const newBlur: PrivacyBlurItem = {
        _id: tempBlurId(),
        yaw,
        pitch,
        width: BLUR_WIDTH_DEFAULT,
        height: BLUR_HEIGHT_DEFAULT,
        intensity: BLUR_INTENSITY_DEFAULT,
        radius: BLUR_RADIUS_DEFAULT,
        scale: BLUR_SCALE_DEFAULT,
      };
      setPrivacyBlurs((prev) => [...prev, newBlur]);
      setSelectedBlurId(newBlur._id);
      setSelectedHotspotId(null);
      setAddMode("none");
      setHasUnsaved(true);
    },
    [pushHistory]
  );

  const handleHotspotMove = useCallback(
    (id: string, yaw: number, pitch: number) => {
      if (!moveHistoryPushed.current) {
        pushHistory();
        moveHistoryPushed.current = true;
      }
      setHotspots((prev) => prev.map((h) => (h._id === id ? { ...h, yaw, pitch } : h)));
      setHasUnsaved(true);
    },
    [pushHistory]
  );

  const handleHotspotSelect = useCallback((id: string | null) => {
    setSelectedHotspotId(id);
    if (id) setSelectedBlurId(null);
  }, []);

  const handleHotspotDelete = useCallback(
    (id: string) => {
      pushHistory();
      setHotspots((prev) => prev.filter((h) => h._id !== id));
      setSelectedHotspotId((sel) => (sel === id ? null : sel));
      setHasUnsaved(true);
    },
    [pushHistory]
  );

  const handleBlurMove = useCallback(
    (id: string, yaw: number, pitch: number) => {
      if (!moveHistoryPushed.current) {
        pushHistory();
        moveHistoryPushed.current = true;
      }
      setPrivacyBlurs((prev) => prev.map((b) => (b._id === id ? { ...b, yaw, pitch } : b)));
      setHasUnsaved(true);
    },
    [pushHistory]
  );

  const handleBlurSelect = useCallback((id: string | null) => {
    setSelectedBlurId(id);
    if (id) setSelectedHotspotId(null);
  }, []);

  const handleBlurDelete = useCallback(
    (id: string) => {
      pushHistory();
      setPrivacyBlurs((prev) => prev.filter((b) => b._id !== id));
      setSelectedBlurId((sel) => (sel === id ? null : sel));
      setHasUnsaved(true);
    },
    [pushHistory]
  );

  function updateHotspot(field: keyof HotspotItem, value: string | number | undefined) {
    if (!selectedHotspotId) return;
    if (field === "type") {
      pushHistory();
      const newType = value as HotspotItem["type"];
      setHotspots((prev) =>
        prev.map((h) => {
          if (h._id !== selectedHotspotId) return h;
          const next: HotspotItem = { ...h, type: newType };
          if (newType !== "scene") delete next.targetView;
          if (newType === "scene") {
            delete next.spaceCode;
            delete next.description;
            delete next.facilityIcon;
            delete next.creativeUrl;
            delete next.creativeTitle;
          } else if (newType === "space") {
            delete next.sceneId;
            delete next.direction;
            delete next.description;
            delete next.facilityIcon;
            delete next.creativeUrl;
            delete next.creativeTitle;
          } else if (newType === "info") {
            delete next.sceneId;
            delete next.direction;
            delete next.spaceCode;
            delete next.creativeUrl;
            delete next.creativeTitle;
            if (!next.description) next.description = "";
          } else if (newType === "ad") {
            delete next.sceneId;
            delete next.direction;
            delete next.description;
            delete next.facilityIcon;
          }
          return next;
        })
      );
    } else if (field === "facilityIcon") {
      setHotspots((prev) =>
        prev.map((h) => {
          if (h._id !== selectedHotspotId) return h;
          const next = { ...h };
          if (value === "" || value == null) {
            delete next.facilityIcon;
          } else {
            next.facilityIcon = value as FacilityIconId;
          }
          return next;
        })
      );
    } else {
      setHotspots((prev) =>
        prev.map((h) => h._id === selectedHotspotId
          ? { ...h, [field]: value, ...(field === "sceneId" && h.sceneId !== value ? { targetView: undefined } : {}) }
          : h)
      );
    }
    setHasUnsaved(true);
  }

  function assignHotspotSpace(code: string, name: string) {
    if (!selectedHotspotId) return;
    pushHistory();
    setHotspots((prev) =>
      prev.map((h) =>
        h._id === selectedHotspotId
          ? {
              ...h,
              spaceCode: code,
              text: h.text === "Unit baru" || h.text === "Iklan baru" || !h.text.trim() ? name : h.text,
            }
          : h
      )
    );
    setHasUnsaved(true);
  }

  function handleSetInitialView() {
    const view = editorRef.current?.getView();
    if (!view || !currentScene) return;
    pushHistory();
    const canvasData = mergeInitialViewIntoCanvasData(currentScene.canvasData, view);
    setScenes((prev) => prev.map((s, i) => (i === selectedSceneIndex ? { ...s, canvasData } : s)));
    setHasUnsaved(true);
    showToast("ok", "View awal diset dari posisi kamera saat ini");
  }

  function duplicateSelected() {
    if (selectedHotspot) {
      pushHistory();
      const clone: HotspotItem = {
        ...selectedHotspot,
        _id: tempId(),
        yaw: wrapYaw(selectedHotspot.yaw + 8),
      };
      setHotspots((prev) => [...prev, clone]);
      setSelectedHotspotId(clone._id);
      setSelectedBlurId(null);
      setHasUnsaved(true);
      return;
    }
    if (selectedBlur) {
      pushHistory();
      const clone: PrivacyBlurItem = {
        ...selectedBlur,
        _id: tempBlurId(),
        yaw: wrapYaw(selectedBlur.yaw + 8),
      };
      setPrivacyBlurs((prev) => [...prev, clone]);
      setSelectedBlurId(clone._id);
      setSelectedHotspotId(null);
      setHasUnsaved(true);
    }
  }

  async function jumpToHotspot(sceneId: string, hotspotIndex: number) {
    const idx = scenes.findIndex((s) => s.sceneId === sceneId);
    if (idx < 0) return;
    const scene = scenes[idx];
    const hs = sceneToHotspots(scene);
    const target = hs[hotspotIndex];
    if (!target) return;

    if (idx !== selectedSceneIndex) {
      if (hasUnsaved) {
        const confirmed = await confirmDialog({
          title: "Pindah scene?",
          description: "Ada perubahan belum disimpan pada scene ini. Perubahan tersebut akan dibuang.",
          confirmLabel: "Pindah Scene",
        });
        if (!confirmed) return;
        const saved = savedSceneRef.current;
        if (saved) {
          setScenes((prev) => prev.map((s) => (s.sceneId === saved.sceneId ? { ...saved } : s)));
        }
      }
      setSelectedSceneIndex(idx);
      rememberSavedScene(scene);
      setHotspots(hs);
      setPrivacyBlurs(sceneToPrivacyBlurs(scene));
      setHasUnsaved(false);
      clearHistory();
    }
    setSelectedHotspotId(target._id);
    setSelectedBlurId(null);
    setAddMode("none");
  }

  async function uploadAdCreative(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedHotspotId) return;
    setUploadingCreative(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await cmsFetch(`/api/cms/virtual-train/${trainId}/ad-creative`, {
        method: "POST",
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        pushHistory();
        updateHotspot("creativeUrl", data.creativeUrl as string);
        showToast("ok", "Kreatif iklan diupload");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast("err", data.error ?? "Upload kreatif gagal");
      }
    } catch {
      showToast("err", "Error upload kreatif");
    } finally {
      setUploadingCreative(false);
      if (creativeInputRef.current) creativeInputRef.current.value = "";
    }
  }

  function updateBlur(field: keyof PrivacyBlurItem, value: number) {
    if (!selectedBlurId) return;
    let next = value;
    if (field === "intensity") next = clampBlurIntensity(value);
    if (field === "radius") next = clampBlurRadius(value);
    if (field === "scale") next = clampBlurScale(value);
    if (field === "width" || field === "height") {
      next = clampBlurSize(value, field === "width" ? BLUR_WIDTH_DEFAULT : BLUR_HEIGHT_DEFAULT);
    }
    setPrivacyBlurs((prev) => prev.map((b) => (b._id === selectedBlurId ? { ...b, [field]: next } : b)));
    setHasUnsaved(true);
  }

  function updateBlurSize(field: "width" | "height", rawValue: number) {
    if (!selectedBlurId || !selectedBlur) return;
    const w0 = selectedBlur.width ?? BLUR_WIDTH_DEFAULT;
    const h0 = selectedBlur.height ?? BLUR_HEIGHT_DEFAULT;
    const v = clampBlurSize(rawValue, field === "width" ? BLUR_WIDTH_DEFAULT : BLUR_HEIGHT_DEFAULT);

    if (!blurSizeLinked) {
      updateBlur(field, v);
      return;
    }

    const ratio = w0 / Math.max(1, h0);
    if (field === "width") {
      const width = v;
      const height = clampBlurSize(Math.round(width / ratio), BLUR_HEIGHT_DEFAULT);
      setPrivacyBlurs((prev) =>
        prev.map((b) => (b._id === selectedBlurId ? { ...b, width, height } : b))
      );
    } else {
      const height = v;
      const width = clampBlurSize(Math.round(height * ratio), BLUR_WIDTH_DEFAULT);
      setPrivacyBlurs((prev) =>
        prev.map((b) => (b._id === selectedBlurId ? { ...b, width, height } : b))
      );
    }
    setHasUnsaved(true);
  }

  function updateSelectedScene(field: keyof Scene, value: string | number | boolean) {
    setScenes((prev) => prev.map((s, i) => (i === selectedSceneIndex ? { ...s, [field]: value } : s)));
    setHasUnsaved(true);
  }

  function handleSceneAreaChange(areaId: string) {
    const found = findArea(levels, areaId);
    if (!found) return;
    setScenes((prev) =>
      prev.map((s, i) =>
        i === selectedSceneIndex
          ? { ...s, areaId, levelId: found.level.id, level: found.level.slug }
          : s
      )
    );
    setHasUnsaved(true);
  }

  function previewNavigateScene(sceneId: string, entryView?: SceneInitialView) {
    const updatedScenes = scenes.map((s, i) =>
      i === selectedSceneIndex
        ? {
            ...s,
            hotspots: hotspotsToSave(hotspots),
            canvasData: sceneCanvasWithBlurs(s, privacyBlurs),
          }
        : s
    );
    const idx = updatedScenes.findIndex((s) => s.sceneId === sceneId);
    if (idx < 0) return;
    setPreviewEntryView(entryView ? { sceneId, view: entryView } : null);
    setScenes(updatedScenes);
    setSelectedSceneIndex(idx);
    setHotspots(sceneToHotspots(updatedScenes[idx]));
    setPrivacyBlurs(sceneToPrivacyBlurs(updatedScenes[idx]));
    setSelectedHotspotId(null);
    setSelectedBlurId(null);
  }

  return (
    <div className="cms-vt-editor flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="relative z-30 flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--work-line)] bg-[var(--work-subtle)] px-3 py-2 text-[var(--work-text)]">
        <Button asChild variant="ghost" size="sm" className="shrink-0 text-[var(--work-muted)] hover:text-[var(--work-text)]">
          <Link href="/cms/dashboard" aria-label="Dashboard">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 basis-[calc(100%-3.5rem)] items-center gap-1.5 sm:basis-auto">
          <span className="truncate text-sm font-semibold text-[var(--work-text)]">{trainName}</span>
          {currentScene && (
            <>
              <span className="text-[var(--work-muted)]">›</span>
              <span
                className="truncate text-sm font-medium"
                style={{ color: getLevelConfig(currentScene.level, levels).color }}
              >
                {currentScene.title}
              </span>
            </>
          )}
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 border-[var(--work-line)]">
          <Link href={`/train/${trainSlug}`} target="_blank">
            Preview Publik
          </Link>
        </Button>
        <button
          type="button"
          className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
            isPreview
              ? "border-purple-500 bg-purple-600 text-white"
              : "border-[var(--work-line)] bg-[var(--work-subtle)] text-[var(--work-muted)] hover:border-purple-500 hover:text-purple-300"
          }`}
          onClick={() => {
            setPreviewEntryView(null);
            setIsPreview((p) => !p);
            setAddMode("none");
          }}
        >
          {isPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {isPreview ? "Kembali Edit" : "Preview"}
        </button>
        {hasUnsaved && (
          <span className="flex shrink-0 items-center gap-1 text-xs text-amber-400">
            <AlertCircle className="h-3.5 w-3.5" /> Belum disimpan
          </span>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => void resetChanges()}
          disabled={!hasUnsaved || saving || !currentScene}
          className="shrink-0 border-[var(--work-line)] bg-[var(--work-subtle)] text-[var(--work-text)] hover:bg-[var(--work-surface)] hover:text-[var(--work-text)] disabled:opacity-40"
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
        </Button>
        <Button
          size="sm"
          onClick={() => void saveScene()}
          disabled={!currentScene || saving}
          className="ml-auto shrink-0 bg-[#E31E2D] hover:bg-[#c41926] sm:ml-0"
        >
          {saving ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Menyimpan…
            </>
          ) : (
            <>
              <Save className="mr-1 h-4 w-4" /> Simpan
            </>
          )}
        </Button>
      </div>

      <div className="flex shrink-0 items-center gap-2 overflow-x-auto whitespace-nowrap border-b border-[var(--work-line)] bg-[var(--work-subtle)] px-3 py-1" role="group" aria-label="Alat editor kereta">
        {currentScene && compactViewport ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 border-[var(--work-line)]"
            aria-expanded={inspectorOpen}
            aria-controls="train-editor-inspector"
            onClick={() => setInspectorOpen(open => !open)}
          >
            Detail scene
          </Button>
        ) : null}
        <div className="flex shrink-0 items-center gap-1 rounded-lg bg-[var(--work-surface)] p-1">
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              addMode === "none" ? "bg-[#E31E2D] text-white" : "text-[var(--work-muted)] hover:text-[var(--work-text)]"
            }`}
            onClick={() => setAddMode("none")}
            title="Mode Seleksi"
          >
            <MousePointer className="h-3.5 w-3.5" /> Pilih
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              addMode === "scene" ? "bg-emerald-600 text-white" : "text-[var(--work-muted)] hover:text-[var(--work-text)]"
            }`}
            onClick={() => setAddMode((m) => (m === "scene" ? "none" : "scene"))}
            title="Tambah hotspot scene"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" /> + Scene
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              addMode === "space" ? "bg-amber-600 text-white" : "text-[var(--work-muted)] hover:text-[var(--work-text)]"
            }`}
            onClick={() => setAddMode((m) => (m === "space" ? "none" : "space"))}
            title="Tambah hotspot unit"
          >
            <Store className="h-3.5 w-3.5" /> + Unit
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              addMode === "info" ? "bg-blue-600 text-white" : "text-[var(--work-muted)] hover:text-[var(--work-text)]"
            }`}
            onClick={() => setAddMode((m) => (m === "info" ? "none" : "info"))}
            title="Tambah hotspot info"
          >
            <Info className="h-3.5 w-3.5" /> + Info
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              addMode === "ad" ? "bg-purple-600 text-white" : "text-[var(--work-muted)] hover:text-[var(--work-text)]"
            }`}
            onClick={() => setAddMode((m) => (m === "ad" ? "none" : "ad"))}
            title="Tambah hotspot iklan"
          >
            <Megaphone className="h-3.5 w-3.5" /> + Iklan
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              addMode === "blur" ? "bg-[#E31E2D] text-white ring-1 ring-purple-500/50" : "text-[var(--work-muted)] hover:text-[var(--work-text)]"
            }`}
            onClick={() => setAddMode((m) => (m === "blur" ? "none" : "blur"))}
            title="Tambah blur privasi"
          >
            <EyeOff className="h-3.5 w-3.5" /> + Blur
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-lg bg-[var(--work-surface)] p-1">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--work-muted)] hover:text-[var(--work-text)] disabled:pointer-events-none disabled:opacity-30"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--work-muted)] hover:text-[var(--work-text)] disabled:pointer-events-none disabled:opacity-30"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--work-muted)] hover:text-[var(--work-text)] disabled:pointer-events-none disabled:opacity-30"
            onClick={duplicateSelected}
            disabled={!selectedHotspot && !selectedBlur}
            title="Duplikat hotspot/blur terpilih"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--work-muted)] hover:text-[var(--work-text)] disabled:pointer-events-none disabled:opacity-30"
            onClick={handleSetInitialView}
            disabled={!currentScene || isPreview}
            title="Set arah bawaan scene dari kamera saat ini"
          >
            <Crosshair className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--work-muted)] hover:text-[var(--work-text)]"
            onClick={() => setShowConnectionMap(true)}
            title="Peta koneksi antar scene"
          >
            <Network className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <EditorNotice notice={notice} />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <TourStructureSidebar
          levels={levels}
          scenes={scenes}
          selectedSceneIndex={selectedSceneIndex}
          incomingMap={incomingMap}
          onSelectScene={(index) => {
            if (compactViewport) setExplorerCollapsed(true);
            void selectScene(index);
          }}
          onMoveScene={moveScene}
          onDeleteScene={(scene) => {
            void deleteScene(scene as Scene);
          }}
          onAddScene={openAddScene}
          onBulkImport={() => {
            setBulkRows([]);
            setShowBulkImport(true);
          }}
          onManageLevels={() => showToast("ok", "Gerbong default: Gerbong 1–3 sudah tersedia.")}
          onReorderLevels={() => {}}
          onAddArea={() => showToast("ok", "Zona default per gerbong sudah tersedia.")}
          onEditArea={() => showToast("ok", "Edit zona menyusul — gunakan gerbong/zona default dulu.")}
          onDeleteArea={() => showToast("err", "Zona default tidak bisa dihapus.")}
          onAutoWalkPath={() => showToast("ok", "Auto walk path menyusul untuk kereta.")}
          collapsed={explorerCollapsed}
          onToggleCollapse={() => setExplorerCollapsed(!explorerCollapsed)}
        />

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-black">
          {currentScene?.panoramaUrl ? (
            isPreview ? (
              <PannellumPreview
                spaceMarker="info-pin"
                key={`preview-${currentScene.sceneId}-${hotspots.length}-${privacyBlurs.length}`}
                panoramaUrl={currentScene.panoramaUrl}
                hotspots={hotspots}
                privacyBlurs={privacyBlurs}
                sceneId={currentScene.sceneId}
                sceneName={currentScene.title}
                scenes={scenes.map((s) => ({ sceneId: s.sceneId, title: s.title, initialView: extractInitialViewFromCanvasData(s.canvasData) }))}
                levels={toPreviewLevels(cars)}
                stationName={trainName}
                onSceneNavigate={previewNavigateScene}
                initialView={previewEntryView?.sceneId === currentScene.sceneId ? previewEntryView.view : extractInitialViewFromCanvasData(currentScene.canvasData)}
              />
            ) : (
              <PannellumEditor
                spaceMarker="info-pin"
                ref={editorRef}
                key={`editor-${currentScene.sceneId}-${currentScene.panoramaUrl || "none"}`}
                panoramaUrl={currentScene.panoramaUrl}
                originalPanoramaUrl={currentScene.originalPanoramaUrl ?? null}
                hematMultiRes={editorHematMultiRes}
                hdMultiRes={editorHdMultiRes}
                previewMode={editorPreviewMode}
                onPreviewModeChange={setEditorPreviewMode}
                hotspots={hotspots}
                privacyBlurs={privacyBlurs}
                selectedId={selectedHotspotId}
                selectedBlurId={selectedBlurId}
                addMode={addMode}
                onHotspotAdd={handleHotspotAdd}
                onBlurAdd={handleBlurAdd}
                onHotspotMove={handleHotspotMove}
                onBlurMove={handleBlurMove}
                onHotspotSelect={handleHotspotSelect}
                onBlurSelect={handleBlurSelect}
                onHotspotDelete={handleHotspotDelete}
                onBlurDelete={handleBlurDelete}
                spaces={rentalSpaces.map((s) => ({ code: s.code, status: s.status }))}
                scenes={scenes.map((s) => ({ sceneId: s.sceneId, title: s.title }))}
                initialView={linkedMediaView?.sceneId === currentScene.sceneId ? linkedMediaView.view : extractInitialViewFromCanvasData(currentScene.canvasData) ?? null}
                privacyBlurGuideOnly={privacyBlurGuideOnly}
              />
            )
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-[var(--work-muted)]">
              <p className="px-4 text-center">Pilih atau tambah scene dari Struktur Tur</p>
              <Button size="sm" variant="outline" onClick={() => setShowBulkImport(true)}>
                <Package className="mr-1 h-4 w-4" /> Bulk Import Panorama
              </Button>
            </div>
          )}
        </div>

        {currentScene ? (
          <div id="train-editor-inspector" className={`min-h-0 flex-none bg-[var(--work-subtle)] max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-20 ${inspectorOpen ? "flex" : "hidden lg:flex"}`}>
            <TrainTourEditorSidebar
              currentScene={currentScene}
              incomingSceneViews={<IncomingSceneViews key={currentScene.sceneId} destination={currentScene} scenes={scenes} outgoingHotspots={hotspots}
                endpoint={`/api/cms/virtual-train/${encodeURIComponent(trainId)}/arrival-views`} disabled={isPreview || saving}
                onSaved={(sourceId, savedHotspots, hasOverride) => {
                  setScenes(previous => previous.map(scene => scene.sceneId === sourceId ? { ...scene, hotspots: savedHotspots } : scene));
                  showToast("ok", hasOverride ? "Arah tiba disimpan." : "Koneksi kembali memakai arah bawaan.");
                }} />}
              levels={levels}
              scenes={scenes}
              hotspots={hotspots}
              privacyBlurs={privacyBlurs}
              rentalSpaces={rentalSpaces}
              selectedHotspot={selectedHotspot}
              selectedBlur={selectedBlur}
              selectedHotspotId={selectedHotspotId}
              selectedBlurId={selectedBlurId}
              selectedBlurRadiusMax={selectedBlurRadiusMax}
              blurSizeLinked={blurSizeLinked}
              uploading={uploading}
              uploadingCreative={uploadingCreative}
              bakingPrivacyBlur={bakingPrivacyBlur}
              bakePrivacyProgress={bakePrivacyProgress}
              privacyBlurGuideOnly={privacyBlurGuideOnly}
              editorPreviewMode={editorPreviewMode}
              onEditorPreviewModeChange={setEditorPreviewMode}
              hasHematTiles={Boolean(editorHematMultiRes)}
              hasHdTiles={Boolean(editorHdMultiRes)}
              hasHdOriginal={Boolean(currentScene.originalPanoramaUrl)}
              getLevelConfig={getLevelConfig}
              onSceneTitleChange={(title) => updateSelectedScene("title", title)}
              onSceneAreaChange={handleSceneAreaChange}
              onSceneOrderChange={(order) => updateSelectedScene("order", order)}
              onUploadPanorama={uploadPanorama}
              onDeleteScene={() => void deleteScene(currentScene)}
              fileInputRef={fileRef}
              creativeInputRef={creativeInputRef}
              onHotspotDelete={handleHotspotDelete}
              onBlurDelete={handleBlurDelete}
              onHotspotSelect={(id) => handleHotspotSelect(id)}
              onBlurSelect={(id) => handleBlurSelect(id)}
              updateHotspot={updateHotspot}
              assignHotspotSpace={assignHotspotSpace}
              uploadAdCreative={uploadAdCreative}
              updateBlur={updateBlur}
              updateBlurSize={updateBlurSize}
              setBlurSizeLinked={setBlurSizeLinked}
              bakePrivacyBlurs={requestBakePrivacyBlurs}
              jumpToHotspot={jumpToHotspot}
            />
          </div>
        ) : null}
      </div>

      <BakePrivacyBlurDialog
        open={bakeBlurConfirmOpen}
        onOpenChange={setBakeBlurConfirmOpen}
        rebake={privacyBlurGuideOnly}
        confirming={bakingPrivacyBlur}
        onConfirm={(target) => void bakePrivacyBlursToPanorama(target)}
      />

      {showConnectionMap && (
        <ConnectionMapDialog
          open={showConnectionMap}
          onClose={() => setShowConnectionMap(false)}
          scenes={scenes.map((s) => ({
            sceneId: s.sceneId,
            title: s.title,
            hotspots: s.sceneId === currentScene?.sceneId ? hotspotsToSave(hotspots) : s.hotspots,
          }))}
          currentHotspots={hotspots}
          currentSceneId={currentScene?.sceneId ?? null}
          activeSceneId={currentScene?.sceneId ?? null}
          onSelectScene={(sceneId) => {
            const idx = scenes.findIndex((s) => s.sceneId === sceneId);
            if (idx >= 0) void selectScene(idx);
          }}
        />
      )}

      {showAddScene && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <form
            onSubmit={addScene}
            className="w-full max-w-md rounded-xl border border-[var(--work-line)] bg-[var(--work-subtle)] p-5 shadow-2xl"
          >
            <h2 className="mb-4 font-bold text-[var(--work-text)]">Tambah Scene</h2>
            <div className="space-y-3">
              <div>
                <Label>Judul</Label>
                <Input
                  value={newSceneTitle}
                  onChange={(e) => {
                    setNewSceneTitle(e.target.value);
                    if (e.target.value && newSceneAreaId) {
                      setNewSceneId(
                        titleToId(e.target.value) || suggestSceneId(newSceneAreaId, newSceneLevel, levels, scenes)
                      );
                    }
                  }}
                  className="mt-1 border-[var(--work-line)] bg-[var(--work-subtle)]"
                  required
                />
              </div>
              <div>
                <Label>Scene ID</Label>
                <Input
                  value={newSceneId}
                  onChange={(e) => setNewSceneId(e.target.value)}
                  className="mt-1 border-[var(--work-line)] bg-[var(--work-subtle)] font-mono text-sm"
                  required
                />
              </div>
              <div>
                <Label>Zona (gerbong)</Label>
                <select
                  value={newSceneAreaId}
                  onChange={(e) => {
                    const areaId = e.target.value;
                    const found = findArea(levels, areaId);
                    setNewSceneAreaId(areaId);
                    if (found) {
                      setNewSceneLevel(found.level.slug);
                      setNewSceneId(suggestSceneId(areaId, found.level.slug, levels, scenes));
                    }
                  }}
                  className="mt-1 h-9 w-full rounded-md border border-[var(--work-line)] bg-[var(--work-subtle)] px-2 text-sm"
                  required
                >
                  {levels.map((level) => (
                    <optgroup key={level.id} label={level.label}>
                      {level.areas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <Button type="submit" className="flex-1 bg-[#E31E2D] hover:bg-[#c41926]">
                Tambah
              </Button>
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowAddScene(false)}>
                Batal
              </Button>
            </div>
          </form>
        </div>
      )}

      {showBulkImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-[var(--work-line)] bg-[var(--work-subtle)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--work-line)] p-5">
              <h2 className="flex items-center gap-2 font-bold text-[var(--work-text)]">
                <Package className="h-5 w-5 text-sky-400" /> Bulk Import Panorama
              </h2>
              <button type="button" onClick={() => setShowBulkImport(false)} className="text-[var(--work-muted)] hover:text-[var(--work-muted)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-[var(--work-line)] p-5 text-[var(--work-muted)] transition-colors hover:border-sky-600 hover:text-sky-400">
                <Upload className="h-6 w-6 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Pilih beberapa file panorama sekaligus</p>
                  <p className="mt-0.5 text-xs text-[var(--work-muted)]">JPEG/PNG equirectangular (rasio 2:1)</p>
                </div>
                <input
                  ref={bulkFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={handleBulkFilePick}
                />
              </label>
              {bulkRows.length > 0 && (
                <div className="space-y-2">
                  {bulkRows.map((row) => (
                    <div
                      key={row.key}
                      className={`grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2 rounded-lg border p-2 ${
                        row.status === "done"
                          ? "border-emerald-800/50 bg-emerald-900/10"
                          : row.status === "error"
                            ? "border-red-800/50 bg-red-900/10"
                            : "border-[var(--work-line)] bg-[var(--work-subtle)]/50"
                      }`}
                    >
                      <Input
                        value={row.title}
                        onChange={(e) => updateBulkRow(row.key, "title", e.target.value)}
                        disabled={row.status !== "pending"}
                        className="h-7 border-[var(--work-line)] bg-[var(--work-subtle)] text-xs"
                      />
                      <Input
                        value={row.sceneId}
                        onChange={(e) =>
                          updateBulkRow(row.key, "sceneId", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                        }
                        disabled={row.status !== "pending"}
                        className="h-7 border-[var(--work-line)] bg-[var(--work-subtle)] font-mono text-xs"
                      />
                      <select
                        value={row.areaId}
                        onChange={(e) => updateBulkRow(row.key, "areaId", e.target.value)}
                        disabled={row.status !== "pending"}
                        className="h-7 min-w-[110px] rounded border border-[var(--work-line)] bg-[var(--work-subtle)] px-1.5 text-xs"
                      >
                        {levels.map((level) => (
                          <optgroup key={level.id} label={level.label}>
                            {level.areas.map((area) => (
                              <option key={area.id} value={area.id}>
                                {area.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <span className="flex h-7 w-7 items-center justify-center">
                        {row.status === "done" ? (
                          <Check className="h-4 w-4 text-emerald-400" />
                        ) : row.status === "error" ? (
                          <AlertCircle className="h-4 w-4 text-[var(--work-danger)]" />
                        ) : row.status === "creating" || row.status === "uploading" ? (
                          <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-[var(--work-subtle)]" />
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[var(--work-line)] p-5">
              <p className="text-xs text-[var(--work-muted)]">
                {bulkRows.filter((r) => r.status === "done").length}/{bulkRows.length} selesai
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setShowBulkImport(false)} disabled={bulkRunning}>
                  Tutup
                </Button>
                <Button
                  className="bg-sky-600 hover:bg-sky-500"
                  disabled={bulkRows.length === 0 || bulkRunning}
                  onClick={() => void runBulkImport()}
                >
                  {bulkRunning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengimport…
                    </>
                  ) : (
                    "Mulai Import"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {confirmElement}
    </div>
  );
}
