"use client";

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import { cmsFetch } from "@/lib/cms-fetch";
import {
  Plus,
  Trash2,
  Upload,
  ArrowRightLeft,
  Store,
  AlertCircle,
  CheckCircle2,
  Package,
  Link2,
  Unlink,
  ImageIcon,
  Loader2,
  X,
  Check,
} from "lucide-react";
import { hotspotColor, hotspotLabel, HOTSPOT_SCALE_MIN, HOTSPOT_SCALE_MAX, HOTSPOT_SCALE_DEFAULT, DIRECTION_COMPASS, DIRECTION_LABELS, DIRECTION_ROTATE_DEG, type HotspotDirection } from "@/lib/hotspot-types";
import {
  findSpaceStatus,
  spaceStatusColor,
  type SpaceAvailabilityStatus,
} from "@/lib/space-availability";
import { normalizeHotspots } from "@/lib/hotspot-normalize";
import {
  BLUR_HEIGHT_DEFAULT,
  BLUR_INTENSITY_DEFAULT,
  BLUR_INTENSITY_MAX,
  BLUR_INTENSITY_MIN,
  BLUR_RADIUS_DEFAULT,
  BLUR_RADIUS_MAX,
  BLUR_RADIUS_MIN,
  BLUR_SCALE_DEFAULT,
  BLUR_SCALE_MAX,
  BLUR_SCALE_MIN,
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
import { buildWalkPathHotspots } from "@/lib/walk-path";
import type { TourLevel, TourArea } from "@/lib/virtual-tour-structure";
import type { SceneInitialView, TourLevelPublic } from "@/lib/tour-types";
import { resolveSceneEntryView } from "@/lib/scene-entry-view";

import type { AddMode, HotspotItem } from "@/lib/hotspot-types";
import {
  FACILITY_ICONS,
  type FacilityIconId,
} from "@/lib/facility-icons";
import { PannellumPreview } from "./PannellumPreview";
import { PannellumEditor, type PannellumEditorHandle } from "./PannellumEditor";
import { UnitPicker } from "./UnitPicker";
import { CoveragePanel } from "./CoveragePanel";
import { ConnectionMapDialog } from "./ConnectionMapDialog";
import { TourStructureSidebar } from "./TourStructureSidebar";
import { ManageLevelsDialog } from "./ManageLevelsDialog";
import { ManageAreaDialog, type AreaDialogState } from "./ManageAreaDialog";
import { SceneTargetPicker } from "./SceneTargetPicker";
import { SceneEntryViewDialog, type SceneEntryViewSelection } from "./SceneEntryViewDialog";
import { EditorToolbar } from "./EditorToolbar";
import { SpatialAreaInspector } from "./SpatialAreaInspector";
import { isSpatialHotspotEnabled } from "@/lib/spatial-feature";
import { normalizeSpatialEntities, spatialEntitiesToSave } from "@/lib/spatial/normalize";
import { validateSphericalPolygonAuthoring } from "@/lib/spatial/geometry/polygon-validation";
import type { SpatialEntity, SphericalPoint } from "@/lib/spatial/types";
import { DEFAULT_SPATIAL_STYLE } from "@/lib/spatial/types";
import {
  compressPanoramaClient,
  compressImageClient,
} from "@/lib/client-image-compression";

// ─── Types ──────────────────────────────────────────────────────────────────

type Scene = {
  id: string;
  sceneId: string;
  title: string;
  level: string;
  levelId?: string | null;
  areaId?: string | null;
  panoramaUrl: string;
  originalPanoramaUrl?: string | null;
  thumbnailUrl?: string | null;
  order: number;
  hotspots: Omit<HotspotItem, "_id">[];
  canvasData?: unknown;
  spatialEntities?: unknown;
  spatialRevision?: number;
  isActive: boolean;
};

type Station = {
  id: string;
  name: string;
  slug: string;
};

type CommercialSpace = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: SpaceAvailabilityStatus;
  area: number;
  monthlyRent: number;
  deposit: number;
  floor: string;
  location: string;
  nearestExit: string | null;
  exposure: number;
  powerSupply: string | null;
  waterAccess: boolean;
  airConditioning: boolean;
  description: string | null;
  panoramaUrl?: string | null;
  tenantBrand?: string | null;
};

function getLevelConfig(levelSlug: string | undefined, levels: TourLevel[]) {
  const slug = (levelSlug ?? "concourse").toLowerCase();
  const found = levels.find((l) => l.slug === slug || l.slug === levelSlug);
  if (found) return { label: found.label, color: found.color, hint: found.hint ?? "", slug: found.slug };
  return { label: levelSlug ?? "Level", color: "#10b981", hint: "", slug };
}

function findArea(levels: TourLevel[], areaId: string): { area: TourArea; level: TourLevel } | null {
  for (const level of levels) {
    const area = level.areas.find((a) => a.id === areaId);
    if (area) return { area, level };
  }
  return null;
}

let _tempId = 0;
function tempId() {
  return `hs-${Date.now()}-${++_tempId}`;
}

function tempBlurId() {
  return `blur-${Date.now()}-${++_tempId}`;
}

function sceneToHotspots(scene: Scene): HotspotItem[] {
  return normalizeHotspots(scene.hotspots).map((h, i) => ({
    ...h,
    _id: `hs-${scene.sceneId}-${i}`,
  }));
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

type EditorSnapshot = {
  hotspots: HotspotItem[];
  privacyBlurs: PrivacyBlurItem[];
  canvasData: unknown;
  spatialEntities: SpatialEntity[];
};

function tempSpatialId() {
  return `sp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Saran sceneId otomatis berdasarkan area */
function suggestSceneId(areaId: string, levelSlug: string, levels: TourLevel[], existingScenes: Scene[]): string {
  const found = findArea(levels, areaId);
  const prefix = found?.area.slug ?? levelSlug;
  const count = existingScenes.filter((s) => s.areaId === areaId).length + 1;
  return `${prefix}-${String(count).padStart(2, "0")}`;
}

/** Slug aman dari judul */
function titleToId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Bulk import row ─────────────────────────────────────────────────────────
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

// ─── Main Component ──────────────────────────────────────────────────────────

function subscribeCompactViewport(listener: () => void) {
  const query = window.matchMedia("(max-width: 1023px)");
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

export default function VirtualTourEditorPage() {
  const { stationId } = useParams<{ stationId: string }>();

  const [station, setStation] = useState<Station | null>(null);
  const [levels, setLevels] = useState<TourLevel[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [stationSpaces, setStationSpaces] = useState<CommercialSpace[]>([]);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [hotspots, setHotspots] = useState<HotspotItem[]>([]);
  const [privacyBlurs, setPrivacyBlurs] = useState<PrivacyBlurItem[]>([]);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [selectedBlurId, setSelectedBlurId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<AddMode>("none");
  const [isPreview, setIsPreview] = useState(false);
  const [entryViewSelection, setEntryViewSelection] = useState<SceneEntryViewSelection | null>(null);
  const [previewEntryView, setPreviewEntryView] = useState<{ sceneId: string; view: SceneInitialView } | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const compactViewport = useSyncExternalStore(subscribeCompactViewport,
    () => window.matchMedia("(max-width: 1023px)").matches, () => false);
  const [explorerPreference, setExplorerCollapsed] = useState<boolean | null>(null);
  const [inspectorPreference, setInspectorCollapsed] = useState<boolean | null>(null);
  const explorerCollapsed = explorerPreference ?? compactViewport;
  const inspectorCollapsed = inspectorPreference ?? compactViewport;
  const [pendingSceneIndex, setPendingSceneIndex] = useState<number | null>(null);
  /** Scene | Point | Spatial | Media | Coverage — konteks mengikuti selection. */
  type InspectorTab = "scene" | "point" | "spatial" | "media" | "coverage";
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("scene");
  const spatialEnabled = isSpatialHotspotEnabled();
  const [spatialEntities, setSpatialEntities] = useState<SpatialEntity[]>([]);
  /** Saat “Tambah sisi lain”: draft berikutnya auto-taut ke unit yang sama. */
  const [pendingSpatialUnitLink, setPendingSpatialUnitLink] = useState<{
    unitId: string | null;
    spaceCode: string;
    faceIndex: number;
  } | null>(null);
  const [draftSpatialVertices, setDraftSpatialVertices] = useState<SphericalPoint[]>([]);
  const [selectedSpatialId, setSelectedSpatialId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bakingPrivacyBlur, setBakingPrivacyBlur] = useState(false);
  /** Proporsi lebar:tinggi blur — seperti link di Figma */
  const [blurSizeLinked, setBlurSizeLinked] = useState(true);

  // ─── Add Scene dialog ───
  const [showAddScene, setShowAddScene] = useState(false);
  const [newSceneId, setNewSceneId] = useState("");
  const [newSceneTitle, setNewSceneTitle] = useState("");
  const [newSceneLevel, setNewSceneLevel] = useState("concourse");
  const [newSceneAreaId, setNewSceneAreaId] = useState("");

  const [showManageLevels, setShowManageLevels] = useState(false);
  const [areaDialog, setAreaDialog] = useState<AreaDialogState>(null);
  const [bulkDefaultAreaId, setBulkDefaultAreaId] = useState("");

  // ─── Bulk Import dialog ───
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const creativeInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<PannellumEditorHandle>(null);
  /** Snapshot scene terakhir tersimpan — untuk reset perubahan lokal. */
  const savedSceneRef = useRef<Scene | null>(null);
  const historyPast = useRef<EditorSnapshot[]>([]);
  const historyFuture = useRef<EditorSnapshot[]>([]);
  const moveHistoryPushed = useRef(false);
  const hotspotsRef = useRef(hotspots);
  const privacyBlursRef = useRef(privacyBlurs);
  const currentSceneRef = useRef<Scene | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [showConnectionMap, setShowConnectionMap] = useState(false);
  const [uploadingCreative, setUploadingCreative] = useState(false);

  // ─── Derived ─────────────────────────────────────────────────────────────
  const currentScene = scenes[selectedSceneIndex] ?? null;
  const currentAreaPlacement = currentScene?.areaId ? findArea(levels, currentScene.areaId) : null;
  const currentLevel = currentScene
    ? levels.find((level) => level.id === currentScene.levelId)
      ?? currentAreaPlacement?.level
      ?? levels.find((level) => level.slug === currentScene.level)
    : undefined;
  const selectedHotspot = hotspots.find((h) => h._id === selectedHotspotId) ?? null;
  const selectedBlur = privacyBlurs.find((b) => b._id === selectedBlurId) ?? null;

  // Auto-switch inspector konteks saat selection / mode authoring berubah
  useEffect(() => {
    if (
      spatialEnabled &&
      (selectedSpatialId || addMode === "spatial" || draftSpatialVertices.length > 0)
    ) {
      setInspectorTab("spatial");
      return;
    }
    if (selectedHotspot?.type === "ad" || addMode === "ad") {
      setInspectorTab("media");
      return;
    }
    if (
      selectedHotspotId ||
      selectedBlurId ||
      addMode === "scene" ||
      addMode === "space" ||
      addMode === "info" ||
      addMode === "blur"
    ) {
      setInspectorTab("point");
    }
  }, [
    spatialEnabled,
    selectedSpatialId,
    draftSpatialVertices.length,
    addMode,
    selectedHotspot?.type,
    selectedHotspotId,
    selectedBlurId,
  ]);
  const previewLevels: TourLevelPublic[] = levels
    .filter((level) => level.isActive)
    .map((level) => ({
      id: level.id,
      slug: level.slug,
      label: level.label,
      color: level.color,
      order: level.order,
      areas: level.areas
        .filter((area) => area.isActive)
        .map((area) => ({
          id: area.id,
          slug: area.slug,
          label: area.label,
          order: area.order,
          sceneIds: scenes
            .filter((scene) => scene.isActive && scene.areaId === area.id)
            .map((scene) => scene.sceneId),
        }))
        .filter((area) => area.sceneIds.length > 0),
      sceneIds: scenes
        .filter((scene) => scene.isActive && scene.levelId === level.id && !scene.areaId)
        .map((scene) => scene.sceneId),
    }))
    .filter((level) => level.areas.length > 0 || level.sceneIds.length > 0);

  function rememberSavedScene(scene: Scene | null) {
    savedSceneRef.current = scene
      ? (JSON.parse(JSON.stringify(scene)) as Scene)
      : null;
  }

  const spatialEntitiesRef = useRef(spatialEntities);
  useEffect(() => {
    hotspotsRef.current = hotspots;
  }, [hotspots]);

  useEffect(() => {
    privacyBlursRef.current = privacyBlurs;
  }, [privacyBlurs]);

  useEffect(() => {
    spatialEntitiesRef.current = spatialEntities;
  }, [spatialEntities]);

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
      spatialEntities: JSON.parse(
        JSON.stringify(spatialEntitiesRef.current)
      ) as SpatialEntity[],
    };
  }

  function applySnapshot(snap: EditorSnapshot) {
    setHotspots(snap.hotspots);
    setPrivacyBlurs(snap.privacyBlurs);
    setSpatialEntities(snap.spatialEntities ?? []);
    setDraftSpatialVertices([]);
    setScenes((prev) =>
      prev.map((s, i) =>
        i === selectedSceneIndex ? { ...s, canvasData: snap.canvasData } : s
      )
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
    setSpatialEntities(normalizeSpatialEntities(scene.spatialEntities, scene.sceneId));
    setDraftSpatialVertices([]);
    setSelectedHotspotId(null);
    setSelectedBlurId(null);
    setSelectedSpatialId(null);
    setAddMode("none");
    setHasUnsaved(false);
    clearHistory();
  }

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

  // Incoming connections: berapa banyak scene lain yang menautkan ke tiap sceneId
  const incomingMap = new Map<string, number>();
  for (const s of scenes) {
    for (const h of s.hotspots ?? []) {
      if (h.type === "scene" && h.sceneId) {
        incomingMap.set(h.sceneId, (incomingMap.get(h.sceneId) ?? 0) + 1);
      }
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function showToast(type: "ok" | "err", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  // ─── Load data ───────────────────────────────────────────────────────────
  async function load(keepIndex?: number) {
    const timestamp = Date.now();
    const [stRes, structRes, spRes] = await Promise.all([
      cmsFetch(`/api/cms/stations/${stationId}?_t=${timestamp}`),
      cmsFetch(`/api/cms/virtual-tour/${stationId}/structure?_t=${timestamp}`),
      cmsFetch(`/api/cms/spaces/station/${stationId}?_t=${timestamp}`),
    ]);

    if (!structRes.ok) {
      const err = await structRes.json().catch(() => ({}));
      showToast("err", err.error ?? "Gagal memuat struktur tur");
      return;
    }

    const stData = stRes.ok ? await stRes.json() : null;
    const structData = await structRes.json();
    const scData: Scene[] = structData.scenes ?? [];
    const lvData: TourLevel[] = structData.levels ?? [];
    const spData: CommercialSpace[] = spRes.ok ? await spRes.json() : [];

    if (stData) {
      setStation({ id: stData.id, name: stData.name, slug: stData.slug });
    }
    setLevels(lvData);
    setScenes(scData);
    setStationSpaces(spData);
    if (!bulkDefaultAreaId && lvData[0]?.areas[0]?.id) {
      setBulkDefaultAreaId(lvData[0].areas[0].id);
    }
    if (scData.length > 0) {
      const idx = keepIndex !== undefined && keepIndex < scData.length ? keepIndex : 0;
      setSelectedSceneIndex(idx);
      rememberSavedScene(scData[idx]);
      restoreSceneState(scData[idx]);
    } else {
      rememberSavedScene(null);
      setHotspots([]);
      setPrivacyBlurs([]);
      setSpatialEntities([]);
      setDraftSpatialVertices([]);
      setSelectedSpatialId(null);
      clearHistory();
    }
    setHasUnsaved(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId]);

  // ─── Scene selection ─────────────────────────────────────────────────────
  function selectScene(index: number) {
    if (index === selectedSceneIndex) return;
    if (hasUnsaved) {
      setPendingSceneIndex(index);
      return;
    }
    switchScene(index);
  }

  function switchScene(index: number) {
    const next = scenes[index];
    if (!next) return;
    setSelectedSceneIndex(index);
    rememberSavedScene(next);
    restoreSceneState(next);
  }

  /** Buang perubahan lokal scene aktif → kembalikan ke versi terakhir tersimpan. */
  function resetChanges() {
    if (!hasUnsaved || !currentScene) return;
    if (!confirm("Buang semua perubahan yang belum disimpan pada scene ini?")) return;

    const saved = savedSceneRef.current;
    if (saved && saved.sceneId === currentScene.sceneId) {
      setScenes((prev) =>
        prev.map((s, i) => (i === selectedSceneIndex ? { ...saved } : s))
      );
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

  // ─── Scene reorder ────────────────────────────────────────────────────────
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
    const activeSceneId = scenes[selectedSceneIndex]?.sceneId;

    const orders = [
      { sceneId: a.s.sceneId, order: b.s.order },
      { sceneId: b.s.sceneId, order: a.s.order },
    ];

    try {
      const res = await cmsFetch(`/api/cms/virtual-tour/${stationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders }),
      });
      if (!res.ok) return;

      const structRes = await cmsFetch(`/api/cms/virtual-tour/${stationId}/structure`);
      const structData = await structRes.json();
      const scData: Scene[] = structData.scenes ?? [];
      setLevels(structData.levels ?? []);
      setScenes(scData);
      setHasUnsaved(false);

      const newIdx = scData.findIndex((s) => s.sceneId === activeSceneId);
      const finalIdx = Math.max(0, newIdx);
      setSelectedSceneIndex(finalIdx);
      if (scData[finalIdx]) {
        rememberSavedScene(scData[finalIdx]);
        restoreSceneState(scData[finalIdx]);
      }
    } catch {
      showToast("err", "Gagal mengubah urutan");
    }
  }

  // ─── Canvas handlers ─────────────────────────────────────────────────────
  const handleHotspotAdd = useCallback(
    (yaw: number, pitch: number) => {
      if (addMode === "blur" || addMode === "pan" || addMode === "spatial" || addMode === "none") return;
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
        ...(type === "info"
          ? { description: "" }
          : {}),
      };
      setHotspots((prev) => [...prev, newH]);
      setSelectedHotspotId(newH._id);
      setSelectedBlurId(null);
      setAddMode("none");
      setHasUnsaved(true);
    },
    [addMode, pushHistory]
  );

  const handleBlurAdd = useCallback((yaw: number, pitch: number) => {
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
  }, [pushHistory]);

  function previewNavigateScene(sceneId: string, entryView?: SceneInitialView) {
    setPreviewEntryView(entryView ? { sceneId, view: entryView } : null);
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
    setScenes(updatedScenes);
    setSelectedSceneIndex(idx);
    setHotspots(sceneToHotspots(updatedScenes[idx]));
    setPrivacyBlurs(sceneToPrivacyBlurs(updatedScenes[idx]));
    setSelectedHotspotId(null);
    setSelectedBlurId(null);
  }

  const handleHotspotMove = useCallback((id: string, yaw: number, pitch: number) => {
    if (!moveHistoryPushed.current) {
      pushHistory();
      moveHistoryPushed.current = true;
    }
    setHotspots((prev) =>
      prev.map((h) => (h._id === id ? { ...h, yaw, pitch } : h))
    );
    setHasUnsaved(true);
  }, [pushHistory]);

  const handleHotspotSelect = useCallback((id: string | null) => {
    setSelectedHotspotId(id);
    if (id) { setSelectedBlurId(null); setSelectedSpatialId(null); }
  }, []);

  const handleHotspotDelete = useCallback((id: string) => {
    pushHistory();
    setHotspots((prev) => prev.filter((h) => h._id !== id));
    setSelectedHotspotId((sel) => (sel === id ? null : sel));
    setHasUnsaved(true);
  }, [pushHistory]);

  const handleBlurMove = useCallback((id: string, yaw: number, pitch: number) => {
    if (!moveHistoryPushed.current) {
      pushHistory();
      moveHistoryPushed.current = true;
    }
    setPrivacyBlurs((prev) =>
      prev.map((b) => (b._id === id ? { ...b, yaw, pitch } : b))
    );
    setHasUnsaved(true);
  }, [pushHistory]);

  const handleBlurSelect = useCallback((id: string | null) => {
    setSelectedBlurId(id);
    if (id) { setSelectedHotspotId(null); setSelectedSpatialId(null); }
  }, []);

  const handleBlurDelete = useCallback((id: string) => {
    pushHistory();
    setPrivacyBlurs((prev) => prev.filter((b) => b._id !== id));
    setSelectedBlurId((sel) => (sel === id ? null : sel));
    setHasUnsaved(true);
  }, [pushHistory]);

  const handleSpatialSelect = useCallback((id: string | null) => {
    setSelectedSpatialId(id);
    if (id) {
      setSelectedHotspotId(null);
      setSelectedBlurId(null);
      setAddMode("none");
    }
  }, []);

  const handleSpatialVertexAdd = useCallback(
    (yaw: number, pitch: number) => {
      if (!spatialEnabled) return;
      setDraftSpatialVertices((prev) => {
        if (prev.length >= 64) return prev;
        return [...prev, { yaw, pitch }];
      });
      setSelectedSpatialId(null);
      setHasUnsaved(true);
    },
    [spatialEnabled]
  );

  const commitSpatialDraft = useCallback(() => {
    if (!currentScene) return;
    const validated = validateSphericalPolygonAuthoring(draftSpatialVertices);
    if (!validated.ok) {
      showToast("err", validated.reason);
      return;
    }
    pushHistory();
    const link = pendingSpatialUnitLink;
    const faceLabel = link
      ? `Sisi ${link.faceIndex} · ${link.spaceCode}`
      : "Spatial Area";
    const linkedSpace = link
      ? stationSpaces.find((s) => s.code === link.spaceCode)
      : undefined;
    const statusColor = linkedSpace ? spaceStatusColor(linkedSpace.status) : null;
    const entity: SpatialEntity = {
      id: tempSpatialId(),
      kind: "SPATIAL_AREA",
      sceneId: currentScene.sceneId,
      label: faceLabel,
      unitId: link?.unitId ?? null,
      spaceCode: link?.spaceCode ?? null,
      geometry: { type: "spherical_polygon", vertices: validated.vertices },
      style: {
        ...DEFAULT_SPATIAL_STYLE,
        ...(statusColor
          ? { fillColor: statusColor, strokeColor: statusColor }
          : {}),
      },
      action: link
        ? { type: "unit_detail", targetId: link.unitId }
        : { type: "none" },
      enabled: true,
      schemaVersion: 1,
      revision: 1,
    };
    setSpatialEntities((prev) => [...prev, entity]);
    setDraftSpatialVertices([]);
    setPendingSpatialUnitLink(null);
    setSelectedSpatialId(entity.id);
    setAddMode("none");
    setHasUnsaved(true);
  }, [
    currentScene,
    draftSpatialVertices,
    pendingSpatialUnitLink,
    pushHistory,
    stationSpaces,
  ]);

  const cancelSpatialDraft = useCallback(() => {
    setDraftSpatialVertices([]);
    setPendingSpatialUnitLink(null);
    setAddMode("none");
  }, []);

  const startSiblingSpatialFace = useCallback(
    (from: SpatialEntity) => {
      const code = from.spaceCode?.trim();
      if (!code) {
        showToast("err", "Tautkan unit dulu sebelum menambah sisi lain.");
        return;
      }
      const siblings = spatialEntities.filter((e) => e.spaceCode === code);
      setPendingSpatialUnitLink({
        unitId: from.unitId ?? null,
        spaceCode: code,
        faceIndex: siblings.length + 1,
      });
      setDraftSpatialVertices([]);
      setSelectedSpatialId(null);
      setSelectedHotspotId(null);
      setSelectedBlurId(null);
      setAddMode("spatial");
      setHasUnsaved(true);
      showToast(
        "ok",
        `Gambar sisi ${siblings.length + 1} untuk ${code} — klik sudut, lalu Selesaikan area`
      );
    },
    [spatialEntities]
  );

  const updateSelectedSpatial = useCallback(
    (patch: Partial<SpatialEntity>) => {
      if (!selectedSpatialId) return;
      pushHistory();
      setSpatialEntities((prev) =>
        prev.map((e) =>
          e.id === selectedSpatialId
            ? {
                ...e,
                ...patch,
                style: patch.style ? { ...e.style, ...patch.style } : e.style,
                action: patch.action ?? e.action,
                revision: e.revision + 1,
              }
            : e
        )
      );
      setHasUnsaved(true);
    },
    [pushHistory, selectedSpatialId]
  );

  const deleteSelectedSpatial = useCallback(() => {
    if (!selectedSpatialId) return;
    pushHistory();
    setSpatialEntities((prev) => prev.filter((e) => e.id !== selectedSpatialId));
    setSelectedSpatialId(null);
    setHasUnsaved(true);
  }, [pushHistory, selectedSpatialId]);

  const selectedSpatial =
    spatialEntities.find((e) => e.id === selectedSpatialId) ?? null;

  const draftSpatialCheck =
    draftSpatialVertices.length >= 3
      ? validateSphericalPolygonAuthoring(draftSpatialVertices)
      : null;
  const draftSpatialWarning =
    draftSpatialCheck && !draftSpatialCheck.ok ? draftSpatialCheck.reason : null;

  function commitSpatialGeometry(id: string, vertices: SphericalPoint[]) {
    const result = validateSphericalPolygonAuthoring(vertices);
    if (!result.ok) { showToast("err", result.reason); return; }
    pushHistory();
    setSpatialEntities((current) => current.map((entity) => entity.id === id ? {
      ...entity,
      geometry: { type: "spherical_polygon", vertices: result.vertices },
      revision: entity.revision + 1,
    } : entity));
    setHasUnsaved(true);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      if (isPreview) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault(); redo();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (addMode === "spatial" && e.key === "Enter") {
          // Let focused buttons / SVG vertex controls handle their own Enter.
          if (target instanceof Element && target.closest("button, [role=button]")) return;
          e.preventDefault(); commitSpatialDraft();
        } else if (e.key === "Escape") {
          e.preventDefault(); cancelSpatialDraft(); setSelectedSpatialId(null);
        } else if (addMode === "spatial" && e.key === "Backspace") {
          e.preventDefault(); setDraftSpatialVertices((current) => current.slice(0, -1));
        } else if (e.key.toLowerCase() === "g" && spatialEnabled) setAddMode("spatial");
        else if (e.key.toLowerCase() === "h") setAddMode("pan");
        else if (e.key.toLowerCase() === "v") setAddMode("none");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // History reads the current scene through refs; rebuild shortcuts for draw state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addMode, isPreview, selectedSceneIndex, spatialEnabled, commitSpatialDraft, cancelSpatialDraft]);

  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved]);

  // ─── Save scene ──────────────────────────────────────────────────────────
  async function saveScene(spatialOperation: "draft" | "publish" = "draft") {
    if (!currentScene || saving) return false;
    if (draftSpatialVertices.length > 0) {
      showToast("err", "Selesaikan atau batalkan gambar area sebelum menyimpan.");
      return false;
    }
    setSaving(true);
    try {
      const res = await cmsFetch(
        `/api/cms/virtual-tour/${stationId}/${currentScene.sceneId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: currentScene.title,
            level: currentScene.level,
            levelId: currentScene.levelId,
            areaId: currentScene.areaId,
            order: currentScene.order,
            isActive: currentScene.isActive,
            hotspots: hotspotsToSave(hotspots),
            canvasData: sceneCanvasWithBlurs(currentScene, privacyBlurs),
            ...(spatialEnabled
              ? {
                  spatialEntities: spatialEntitiesToSave(spatialEntities),
                  spatialRevision: currentScene.spatialRevision ?? 0,
                  spatialOperation,
                }
              : {}),
          }),
        }
      );
      if (res.ok) {
        const saved: Scene = await res.json();
        showToast("ok", spatialEnabled
          ? spatialOperation === "publish" ? "Area dipublikasikan. Perubahan scene disimpan." : "Draft area disimpan. Perubahan pin/scene tetap mengikuti Simpan."
          : "Scene disimpan");
        setHasUnsaved(false);
        rememberSavedScene(saved);
        setScenes((current) => current.map((scene) => scene.sceneId === saved.sceneId ? saved : scene));
        setSpatialEntities(normalizeSpatialEntities(saved.spatialEntities, saved.sceneId));
        return true;
      } else {
        const error = await res.json().catch(() => null);
        showToast("err", error?.error ?? "Gagal menyimpan scene. Perubahan lokal tetap ada.");
      }
    } catch {
      showToast("err", "Error jaringan");
    } finally {
      setSaving(false);
    }
    return false;
  }

  // ─── Bake blur ke piksel panorama lalu upload ─────────────────────────────
  async function bakePrivacyBlursToPanorama() {
    if (!currentScene?.panoramaUrl || privacyBlurs.length === 0) return;
    if (
      !window.confirm(
        privacyBlurGuideOnly
          ? "Perubahan blur akan dibake ulang ke panorama dari file master (tanpa blur). Metadata blur tetap bisa diedit setelahnya. Lanjutkan?"
          : "Blur akan dibake permanen ke file panorama lalu diupload. Anda tetap bisa mengedit posisi/ukuran blur setelah ini; klik bake lagi setelah mengubah. Lanjutkan?"
      )
    ) {
      return;
    }

    const viewerCtx = editorRef.current?.getViewerBakeContext();
    setBakingPrivacyBlur(true);
    try {
      const res = await cmsFetch(
        `/api/cms/virtual-tour/${stationId}/${currentScene.sceneId}/bake-privacy-blur`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            privacyBlurs: blursToSave(privacyBlurs),
            viewerWidth: viewerCtx?.viewerWidth,
            viewerHeight: viewerCtx?.viewerHeight,
            hfov: viewerCtx?.hfov,
          }),
        }
      );
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const opt = data.optimization as { panorama?: string; dimensions?: string } | undefined;
        showToast(
          "ok",
          opt?.panorama
            ? `Blur dibake ke panorama (${opt.panorama}, ${opt.dimensions ?? ""})`
            : "Blur dibake ke panorama"
        );
        setHasUnsaved(false);
        load(selectedSceneIndex);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast("err", data.error ?? "Gagal bake blur ke panorama");
      }
    } catch {
      showToast("err", "Error jaringan saat bake blur");
    } finally {
      setBakingPrivacyBlur(false);
    }
  }

  // ─── Upload panorama ─────────────────────────────────────────────────────
  async function uploadPanorama(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFile = e.target.files?.[0];
    if (!rawFile || !currentScene) return;
    setUploading(true);
    try {
      const file = await compressPanoramaClient(rawFile);
      const fd = new FormData();
      fd.append("file", file);
      const res = await cmsFetch(
        `/api/cms/virtual-tour/${stationId}/${currentScene.sceneId}`,
        { method: "POST", body: fd }
      );
      if (res.ok) {
        const payload = await res.json().catch(() => null);
        if (payload?.scene) {
          setScenes((prev) =>
            prev.map((s) =>
              s.sceneId === currentScene.sceneId
                ? {
                    ...s,
                    panoramaUrl: payload.scene.panoramaUrl,
                    originalPanoramaUrl: payload.scene.originalPanoramaUrl,
                    thumbnailUrl: payload.scene.thumbnailUrl,
                    canvasData: payload.scene.canvasData ?? s.canvasData,
                  }
                : s
            )
          );
          rememberSavedScene({
            ...currentScene,
            panoramaUrl: payload.scene.panoramaUrl,
            originalPanoramaUrl: payload.scene.originalPanoramaUrl,
            thumbnailUrl: payload.scene.thumbnailUrl,
            canvasData: payload.scene.canvasData ?? currentScene.canvasData,
          });
        }
        showToast("ok", "Panorama diupload ke S3");
        await load(selectedSceneIndex);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast("err", data.error ?? "Upload gagal");
      }
    } catch {
      showToast("err", "Error upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ─── Add scene ───────────────────────────────────────────────────────────
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

    const areaScenes = scenes.filter((s) => s.areaId === newSceneAreaId);
    const res = await cmsFetch(`/api/cms/virtual-tour/${stationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sceneId: newSceneId.trim(),
        title: newSceneTitle.trim(),
        level: newSceneLevel,
        areaId: newSceneAreaId,
        order: areaScenes.length,
      }),
    });
    if (res.ok) {
      setShowAddScene(false);
      setNewSceneId("");
      setNewSceneTitle("");
      showToast("ok", "Scene ditambahkan");
      load();
    } else {
      showToast("err", "Gagal tambah scene");
    }
  }

  function handleNewSceneAreaChange(areaId: string) {
    const found = findArea(levels, areaId);
    if (!found) return;
    setNewSceneAreaId(areaId);
    setNewSceneLevel(found.level.slug);
    setNewSceneId(suggestSceneId(areaId, found.level.slug, levels, scenes));
  }

  function handleNewSceneTitleChange(title: string) {
    setNewSceneTitle(title);
    if (title && newSceneAreaId) {
      const base = titleToId(title) || suggestSceneId(newSceneAreaId, newSceneLevel, levels, scenes);
      setNewSceneId(base.substring(0, 40));
    }
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

  function openAddArea(levelId: string, levelLabel: string) {
    setAreaDialog({ mode: "add", levelId, levelLabel });
  }

  function openEditArea(area: TourArea, levelLabel: string) {
    setAreaDialog({ mode: "edit", area, levelLabel });
  }

  function openDeleteArea(area: TourArea, levelLabel: string) {
    setAreaDialog({ mode: "delete", area, levelLabel });
  }

  async function submitAreaAdd(levelId: string, label: string) {
    const res = await cmsFetch(`/api/cms/virtual-tour/${stationId}/areas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ levelId, label }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Gagal tambah area");
    }
    showToast("ok", "Area ditambahkan");
    load(selectedSceneIndex);
  }

  async function submitAreaEdit(areaId: string, label: string) {
    const res = await cmsFetch(`/api/cms/virtual-tour/${stationId}/areas/${areaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Gagal memperbarui area");
    }
    showToast("ok", "Area diperbarui");
    load(selectedSceneIndex);
  }

  async function submitAreaDelete(areaId: string) {
    const res = await cmsFetch(`/api/cms/virtual-tour/${stationId}/areas/${areaId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Gagal hapus area");
    }
    showToast("ok", "Area dihapus");
    load(selectedSceneIndex);
  }

  async function autoWalkPath(areaId: string) {
    const areaScenes = scenes
      .filter((s) => s.areaId === areaId)
      .sort((a, b) => a.order - b.order);
    if (areaScenes.length < 2) return;

    const found = findArea(levels, areaId);
    if (!confirm(`Tautkan ${areaScenes.length} scene di "${found?.area.label ?? "area"}" dengan hotspot →/← otomatis? Hotspot jalan lama di area ini akan diganti.`)) {
      return;
    }

    const pathMap = buildWalkPathHotspots(
      areaScenes.map((s) => ({
        sceneId: s.sceneId,
        title: s.title,
        order: s.order,
        hotspots: s.hotspots,
      }))
    );

    try {
      for (const scene of areaScenes) {
        const newHotspots = pathMap.get(scene.sceneId);
        if (!newHotspots) continue;
        await cmsFetch(`/api/cms/virtual-tour/${stationId}/${scene.sceneId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: scene.title,
            level: scene.level,
            levelId: scene.levelId,
            areaId: scene.areaId,
            order: scene.order,
            isActive: scene.isActive,
            hotspots: newHotspots,
          }),
        });
      }
      showToast("ok", "Jalur jalan otomatis ditautkan");
      load(selectedSceneIndex);
    } catch {
      showToast("err", "Gagal menautkan jalur jalan");
    }
  }

  async function reorderLevels(orderedLevelIds: string[]) {
    if (orderedLevelIds.length !== levels.length) return;
    const prev = levels;
    const reordered = orderedLevelIds
      .map((id, order) => {
        const level = levels.find((l) => l.id === id);
        return level ? { ...level, order } : null;
      })
      .filter((l): l is TourLevel => l != null);

    if (reordered.length !== levels.length) return;

    setLevels(reordered);

    try {
      const res = await cmsFetch(`/api/cms/virtual-tour/${stationId}/levels`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orders: reordered.map((l) => ({ levelId: l.id, order: l.order })),
        }),
      });
      if (!res.ok) {
        setLevels(prev);
        const err = await res.json().catch(() => ({}));
        showToast("err", err.error ?? "Gagal mengubah urutan level");
        return;
      }
      showToast("ok", "Urutan level diperbarui");
      load(selectedSceneIndex);
    } catch {
      setLevels(prev);
      showToast("err", "Gagal mengubah urutan level");
    }
  }

  async function createLevel(data: { label: string; color: string; hint?: string }) {
    const res = await cmsFetch(`/api/cms/virtual-tour/${stationId}/levels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      showToast("ok", "Level ditambahkan");
      load(selectedSceneIndex);
    } else {
      const err = await res.json().catch(() => ({}));
      showToast("err", err.error ?? "Gagal tambah level");
    }
  }

  async function updateLevel(levelId: string, data: { label?: string; color?: string; hint?: string; order?: number }) {
    const res = await cmsFetch(`/api/cms/virtual-tour/${stationId}/levels/${levelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) load(selectedSceneIndex);
  }

  async function deleteLevel(levelId: string): Promise<{ ok: boolean; error?: string }> {
    const res = await cmsFetch(`/api/cms/virtual-tour/${stationId}/levels/${levelId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      showToast("ok", "Level dihapus");
      load(selectedSceneIndex);
      return { ok: true };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error ?? "Gagal hapus level" };
  }

  // ─── Delete scene ─────────────────────────────────────────────────────────
  async function deleteScene(scene: Scene) {
    if (!confirm(`Hapus scene "${scene.title}"? Semua hotspot yang menautkan ke scene ini juga perlu diperbarui.`)) return;
    const res = await cmsFetch(`/api/cms/virtual-tour/${stationId}/${scene.sceneId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      showToast("ok", "Scene dihapus");
      const deletedIdx = scenes.findIndex((s) => s.sceneId === scene.sceneId);
      const nextIdx = deletedIdx <= selectedSceneIndex ? Math.max(0, selectedSceneIndex - 1) : selectedSceneIndex;
      load(nextIdx);
    }
  }

  // ─── Hotspot property update ─────────────────────────────────────────────
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
            // Tanpa facilityIcon → pin informasi (info.png)
          } else if (newType === "ad") {
            delete next.sceneId;
            delete next.direction;
            delete next.description;
            delete next.facilityIcon;
          }
          return next;
        })
      );
    } else if (field === "facilityIcon" && value === undefined) {
      pushHistory();
      setHotspots((prev) =>
        prev.map((h) => {
          if (h._id !== selectedHotspotId) return h;
          const next = { ...h };
          delete next.facilityIcon;
          return next;
        })
      );
    } else {
      if (field === "sceneId") pushHistory();
      setHotspots((prev) =>
        prev.map((h) =>
          h._id === selectedHotspotId ? { ...h, [field]: value, ...(field === "sceneId" ? { targetView: undefined } : {}) } : h
        )
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
    setScenes((prev) =>
      prev.map((s, i) => (i === selectedSceneIndex ? { ...s, canvasData } : s))
    );
    setHasUnsaved(true);
    showToast("ok", "View awal diset dari posisi kamera saat ini");
  }

  function setHotspotEntryView(hotspotId: string, sceneId: string, view?: SceneInitialView) {
    if (!hotspots.some((h) => h._id === hotspotId && h.type === "scene" && h.sceneId === sceneId)) return;
    pushHistory();
    setHotspots((previous) => previous.map((h) => h._id === hotspotId ? { ...h, targetView: view } : h));
    setHasUnsaved(true);
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

  function jumpToHotspot(sceneId: string, hotspotIndex: number, spatialId?: string) {
    const idx = scenes.findIndex((s) => s.sceneId === sceneId);
    if (idx < 0) return;
    const scene = scenes[idx];
    const hs = sceneToHotspots(scene);
    const target = hs[hotspotIndex];
    if (!target && !spatialId) return;

    if (idx !== selectedSceneIndex) {
      if (hasUnsaved) {
        if (!confirm("Ada perubahan yang belum disimpan. Pindah scene?")) return;
        const saved = savedSceneRef.current;
        if (saved) {
          setScenes((prev) =>
            prev.map((s) => (s.sceneId === saved.sceneId ? { ...saved } : s))
          );
        }
      }
      setSelectedSceneIndex(idx);
      rememberSavedScene(scene);
      restoreSceneState(scene);
    }
    setSelectedHotspotId(spatialId ? null : target?._id ?? null);
    setSelectedSpatialId(spatialId ?? null);
    setSelectedBlurId(null);
    setAddMode("none");
  }

  async function uploadAdCreative(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFile = e.target.files?.[0];
    if (!rawFile || !selectedHotspotId) return;
    setUploadingCreative(true);
    try {
      const file = await compressImageClient(rawFile, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.85,
      });
      const fd = new FormData();
      fd.append("file", file);
      const res = await cmsFetch(`/api/cms/virtual-tour/${stationId}/ad-creative`, {
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
    setPrivacyBlurs((prev) =>
      prev.map((b) => (b._id === selectedBlurId ? { ...b, [field]: next } : b))
    );
    setHasUnsaved(true);
  }

  function updateBlurSize(field: "width" | "height", rawValue: number) {
    if (!selectedBlurId || !selectedBlur) return;
    const w0 = selectedBlur.width ?? BLUR_WIDTH_DEFAULT;
    const h0 = selectedBlur.height ?? BLUR_HEIGHT_DEFAULT;
    const v = clampBlurSize(
      rawValue,
      field === "width" ? BLUR_WIDTH_DEFAULT : BLUR_HEIGHT_DEFAULT
    );

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
    setScenes((prev) =>
      prev.map((s, i) => (i === selectedSceneIndex ? { ...s, [field]: value } : s))
    );
    setHasUnsaved(true);
  }

  // ─── Bulk Import ──────────────────────────────────────────────────────────
  function handleBulkFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const defaultArea = bulkDefaultAreaId || levels[0]?.areas[0]?.id || "";
    const defaultLevel = findArea(levels, defaultArea)?.level.slug ?? levels[0]?.slug ?? "concourse";

    const rows: BulkRow[] = files.map((file, i) => {
      const areaId = defaultArea;
      const levelSlug = defaultLevel;
      const baseCount = scenes.filter((s) => s.areaId === areaId).length + i + 1;
      const areaSlug = findArea(levels, areaId)?.area.slug ?? levelSlug;
      const sceneId = `${areaSlug}-${String(baseCount).padStart(2, "0")}`;
      const title = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ");
      return {
        key: `${file.name}-${i}`,
        file,
        sceneId,
        title,
        areaId,
        levelSlug,
        status: "pending",
      };
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
      if (row.status === "done") { anySucceeded = true; continue; }

      // Step 1: create scene
      setBulkRows((prev) =>
        prev.map((r) => (r.key === row.key ? { ...r, status: "creating" } : r))
      );

      const createRes = await cmsFetch(`/api/cms/virtual-tour/${stationId}`, {
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
            r.key === row.key
              ? { ...r, status: "error", error: data.error ?? "Gagal membuat scene" }
              : r
          )
        );
        continue;
      }

      // Step 2: upload panorama
      setBulkRows((prev) =>
        prev.map((r) => (r.key === row.key ? { ...r, status: "uploading" } : r))
      );

      try {
        const compressedFile = await compressPanoramaClient(row.file);
        const fd = new FormData();
        fd.append("file", compressedFile);
        const uploadRes = await cmsFetch(
          `/api/cms/virtual-tour/${stationId}/${row.sceneId}`,
          { method: "POST", body: fd }
        );

        if (uploadRes.ok) {
          anySucceeded = true;
          setBulkRows((prev) =>
            prev.map((r) => (r.key === row.key ? { ...r, status: "done" } : r))
          );
        } else {
          const data = await uploadRes.json().catch(() => ({}));
          setBulkRows((prev) =>
            prev.map((r) =>
              r.key === row.key
                ? { ...r, status: "error", error: data.error ?? "Gagal upload panorama" }
                : r
            )
          );
        }
      } catch (err) {
        setBulkRows((prev) =>
          prev.map((r) =>
            r.key === row.key
              ? {
                  ...r,
                  status: "error",
                  error: err instanceof Error ? err.message : "Error upload panorama",
                }
              : r
          )
        );
      }
    }

    setBulkRunning(false);
    if (anySucceeded) {
      showToast("ok", "Bulk import selesai — scene telah ditambahkan");
      load();
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="cms-vt-editor flex h-full min-h-0 w-full flex-col overflow-hidden">
      <EditorToolbar
        stationName={station?.name}
        sceneTitle={currentScene?.title}
        sceneLevelLabel={currentLevel?.label ?? (currentScene ? getLevelConfig(currentScene.level, levels).label : undefined)}
        sceneAreaLabel={currentAreaPlacement?.area.label}
        sceneLevelColor={
          currentLevel?.color ?? (currentScene ? getLevelConfig(currentScene.level, levels).color : undefined)
        }
        addMode={addMode}
        setAddMode={(next) => {
          if (saving) return;
          const mode = typeof next === "function" ? next(addMode) : next;
          if (mode !== "spatial") setDraftSpatialVertices([]);
          if (mode !== "none" && mode !== "pan") setSelectedSpatialId(null);
          setAddMode(mode);
        }}
        spatialEnabled={spatialEnabled}
        canUndo={canUndo}
        canRedo={canRedo}
        canDuplicate={Boolean(selectedHotspot || selectedBlur)}
        hasUnsaved={hasUnsaved}
        saving={saving}
        isPreview={isPreview}
        hasScene={Boolean(currentScene)}
        onUndo={undo}
        onRedo={redo}
        onDuplicate={duplicateSelected}
        onSetInitialView={handleSetInitialView}
        onOpenConnectionMap={() => setShowConnectionMap(true)}
        onTogglePreview={() => {
          setPreviewEntryView(null);
          setIsPreview((p) => !p);
          setAddMode("none");
        }}
        onReset={resetChanges}
        onSave={() => { void saveScene(); }}
        onPublishSpatial={() => {
          if (confirm("Publikasikan area pada scene ini? Pengunjung akan melihat versi area ini setelah publikasi.")) void saveScene("publish");
        }}
      />

      {/* ── Main Editor Area ─────────────────────────────────────────────── */}
      <Dialog open={pendingSceneIndex !== null} onOpenChange={(open) => { if (!open) setPendingSceneIndex(null); }}>
        <DialogContent className="border-white/15 bg-[#261015] text-[#F8ECEE]">
          <DialogTitle>Perubahan belum disimpan</DialogTitle>
          <DialogDescription className="text-[#C4A8AD]">
            Simpan perubahan sebelum pindah scene, buang perubahan, atau lanjutkan mengedit scene ini.
          </DialogDescription>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setPendingSceneIndex(null)} disabled={saving}>Batal</Button>
            <Button variant="outline" disabled={saving} onClick={() => {
              const index = pendingSceneIndex;
              const saved = savedSceneRef.current;
              if (saved) setScenes((current) => current.map((scene) => scene.sceneId === saved.sceneId ? saved : scene));
              setPendingSceneIndex(null);
              if (index !== null) switchScene(index);
            }}>Buang dan pindah</Button>
            <Button disabled={saving} onClick={async () => {
              const index = pendingSceneIndex;
              if (await saveScene()) {
                setPendingSceneIndex(null);
                if (index !== null) switchScene(index);
              }
            }}>{saving ? "Menyimpan…" : "Simpan dan pindah"}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <div className="relative flex flex-1 min-h-0 overflow-hidden" inert={saving}>

        <TourStructureSidebar
          levels={levels}
          scenes={scenes}
          selectedSceneIndex={selectedSceneIndex}
          incomingMap={incomingMap}
          onSelectScene={selectScene}
          onMoveScene={moveScene}
          onDeleteScene={deleteScene}
          onAddScene={openAddScene}
          onBulkImport={() => {
            setBulkRows([]);
            setShowBulkImport(true);
          }}
          onManageLevels={() => setShowManageLevels(true)}
          onReorderLevels={reorderLevels}
          onAddArea={openAddArea}
          onEditArea={openEditArea}
          onDeleteArea={openDeleteArea}
          onAutoWalkPath={autoWalkPath}
          collapsed={explorerCollapsed}
          onToggleCollapse={() => setExplorerCollapsed(!explorerCollapsed)}
        />

        {/* ── Center: Canvas / Preview ─────────────────────────────── */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {currentScene ? (
            isPreview ? (
              <PannellumPreview
                key={`preview-${currentScene.sceneId}-${hotspots.length}-${privacyBlurs.length}-${spatialEntities.length}`}
                panoramaUrl={currentScene.panoramaUrl}
                hotspots={hotspots}
                privacyBlurs={privacyBlurs}
                sceneId={currentScene.sceneId}
                sceneName={currentScene.title}
                scenes={scenes.map((s) => ({ sceneId: s.sceneId, title: s.title, initialView: extractInitialViewFromCanvasData(s.canvasData) }))}
                levels={previewLevels}
                spaces={stationSpaces}
                spatialEntities={spatialEnabled ? spatialEntities : []}
                stationName={station?.name ?? ""}
                onSceneNavigate={previewNavigateScene}
                initialView={previewEntryView?.sceneId === currentScene.sceneId ? previewEntryView.view : extractInitialViewFromCanvasData(currentScene.canvasData)}
              />
            ) : (
              /* Edit — Pannellum 3D statis (no auto-rotate), klik untuk pasang hotspot */
              <PannellumEditor
                ref={editorRef}
                key={`editor-${currentScene.sceneId}-${currentScene.panoramaUrl || "none"}`}
                panoramaUrl={currentScene.panoramaUrl}
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
                spaces={stationSpaces.map((s) => ({ code: s.code, status: s.status }))}
                scenes={scenes.map((s) => ({ sceneId: s.sceneId, title: s.title }))}
                initialView={extractInitialViewFromCanvasData(currentScene.canvasData) ?? null}
                privacyBlurGuideOnly={privacyBlurGuideOnly}
                spatialEntities={spatialEnabled ? spatialEntities : []}
                draftSpatialVertices={spatialEnabled ? draftSpatialVertices : []}
                selectedSpatialId={selectedSpatialId}
                onSpatialSelect={handleSpatialSelect}
                onSpatialVertexAdd={handleSpatialVertexAdd}
                onSpatialGeometryCommit={commitSpatialGeometry}
                onSpatialEditError={(message) => showToast("err", message)}
                onSpatialCloseDraft={commitSpatialDraft}
              />
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#1C0A0E] text-[#C4A8AD]">
              <div className="text-5xl mb-3">📷</div>
              <p>Pilih atau tambah scene</p>
            </div>
          )}
        </div>

        {/* ── Right: Properties / Coverage ──────────────────────────────── */}
        {inspectorCollapsed ? (
          <aside className="flex w-10 flex-none flex-col items-center border-l border-[rgba(255,214,218,0.14)] bg-[#261015] py-2">
            <button
              type="button"
              onClick={() => setInspectorCollapsed(false)}
              className="rounded-md p-1.5 text-[#C4A8AD] hover:bg-[#3A161C] hover:text-[#F8ECEE]"
              title="Tampilkan Inspector"
              aria-label="Tampilkan Inspector"
            >
              <Store className="h-4 w-4" />
            </button>
          </aside>
        ) : (
        <aside className="flex w-[300px] flex-none flex-col overflow-hidden border-l border-[rgba(255,214,218,0.14)] bg-[#261015] max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-30 lg:w-80">
          <div className="flex shrink-0 flex-col gap-1 border-b border-[rgba(255,214,218,0.14)] p-1.5">
            <div className="flex items-center gap-0.5">
              {(
                [
                  { id: "scene" as const, label: "Scene" },
                  { id: "point" as const, label: "Point" },
                  ...(spatialEnabled ? [{ id: "spatial" as const, label: "Spatial" }] : []),
                  { id: "media" as const, label: "Media" },
                  { id: "coverage" as const, label: "Coverage" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`min-w-0 flex-1 truncate rounded-full px-1.5 py-1.5 text-[10px] font-semibold transition-colors ${
                    inspectorTab === tab.id
                      ? "bg-[#E31E2D] text-white"
                      : "text-[#C4A8AD] hover:bg-[#3A161C] hover:text-[#F8ECEE]"
                  }`}
                  onClick={() => setInspectorTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setInspectorCollapsed(true)}
                className="shrink-0 rounded p-1.5 text-[#C4A8AD] hover:text-[#F8ECEE]"
                title="Sembunyikan Inspector"
                aria-label="Sembunyikan Inspector"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-3">

            {inspectorTab === "coverage" ? (
              currentScene ? (
              <CoveragePanel
                spaces={stationSpaces}
                scenes={scenes.map((s) => ({
                  sceneId: s.sceneId,
                  title: s.title,
                  hotspots: s.sceneId === currentScene.sceneId ? hotspotsToSave(hotspots) : s.hotspots,
                  spatialEntities:
                    s.sceneId === currentScene.sceneId
                      ? spatialEntities
                      : normalizeSpatialEntities(s.spatialEntities, s.sceneId),
                }))}
                currentHotspots={hotspots}
                currentSceneId={currentScene.sceneId}
                onJumpTo={jumpToHotspot}
              />
              ) : (
                <p className="text-xs text-[#C4A8AD]">Pilih scene untuk melihat coverage.</p>
              )
            ) : inspectorTab === "spatial" ? (
              spatialEnabled ? (
                <>
                <div className="mb-3 space-y-1" role="group" aria-label="Daftar Spatial Area">
                  {spatialEntities.map((entity) => {
                    const code = entity.spaceCode?.trim();
                    const siblings = code
                      ? spatialEntities.filter((e) => e.spaceCode === code)
                      : [entity];
                    const faceNo =
                      code && siblings.length > 1
                        ? siblings.findIndex((e) => e.id === entity.id) + 1
                        : 0;
                    return (
                      <button
                        type="button"
                        key={entity.id}
                        className={`block w-full rounded border px-2 py-1.5 text-left text-xs hover:bg-white/10 ${
                          selectedSpatialId === entity.id
                            ? "border-emerald-500/50 bg-emerald-950/40 text-[#F8ECEE]"
                            : "border-white/15 text-[#F8ECEE]"
                        }`}
                        aria-pressed={selectedSpatialId === entity.id}
                        onClick={() => handleSpatialSelect(entity.id)}
                      >
                        {faceNo > 0 ? (
                          <span className="font-mono text-emerald-300">
                            {code} · sisi {faceNo}/{siblings.length}
                          </span>
                        ) : (
                          entity.label || entity.spaceCode || "Area"
                        )}
                        <span className="text-[#A88990]">
                          {" "}
                          · {entity.enabled ? "aktif" : "nonaktif"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <SpatialAreaInspector
                  entity={selectedSpatial}
                  draftVertexCount={draftSpatialVertices.length}
                  draftWarning={draftSpatialWarning}
                  pendingSiblingUnitCode={pendingSpatialUnitLink?.spaceCode ?? null}
                  siblingFaceCount={
                    selectedSpatial?.spaceCode
                      ? spatialEntities.filter(
                          (e) => e.spaceCode === selectedSpatial.spaceCode
                        ).length
                      : 0
                  }
                  spaces={stationSpaces}
                  onUpdate={updateSelectedSpatial}
                  onDelete={deleteSelectedSpatial}
                  onCommitDraft={commitSpatialDraft}
                  onCancelDraft={cancelSpatialDraft}
                  onAddSiblingFace={
                    selectedSpatial?.spaceCode
                      ? () => startSiblingSpatialFace(selectedSpatial)
                      : undefined
                  }
                  scenes={scenes}
                  onPopLastDraftVertex={() =>
                    setDraftSpatialVertices((current) => current.slice(0, -1))
                  }
                />
                </>
              ) : (
                <p className="text-xs text-[#C4A8AD]">Spatial Area belum diaktifkan.</p>
              )
            ) : (
            <>
            {/* Scene Properties */}
            {inspectorTab === "scene" && currentScene && (
              <section>
                <h3 className="text-xs font-semibold text-[#C4A8AD] uppercase tracking-wider mb-3 pb-2 border-b border-[rgba(255,214,218,0.14)]">
                  Scene Properties
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-[#C4A8AD] mb-1.5 block">Judul</Label>
                    <Input
                      value={currentScene.title}
                      onChange={(e) => updateSelectedScene("title", e.target.value)}
                      className="bg-[#3A161C] border-[rgba(255,214,218,0.18)] text-[#F8ECEE] text-sm h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-[#C4A8AD] mb-1.5 block">Scene ID</Label>
                    <Input
                      value={currentScene.sceneId}
                      readOnly
                      className="bg-[#3A161C] border-[rgba(255,214,218,0.18)] text-[#C4A8AD] text-xs h-8 font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-[#C4A8AD] mb-1.5 block">Level</Label>
                    <p
                      className="rounded-md border border-[rgba(255,214,218,0.18)] bg-[#3A161C] px-2 py-1.5 text-sm font-medium"
                      style={{ color: getLevelConfig(currentScene.level, levels).color }}
                    >
                      {getLevelConfig(currentScene.level, levels).label}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-[#C4A8AD] mb-1.5 block">Area</Label>
                    <select
                      value={currentScene.areaId ?? ""}
                      onChange={(e) => handleSceneAreaChange(e.target.value)}
                      className="w-full bg-[#3A161C] border border-[rgba(255,214,218,0.18)] rounded-md h-8 px-2 text-sm text-[#F8ECEE]"
                    >
                      <option value="">— pilih area —</option>
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
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-[#C4A8AD]">Urutan</Label>
                    <Input
                      type="number"
                      value={currentScene.order}
                      onChange={(e) => updateSelectedScene("order", Number(e.target.value))}
                      className="bg-[#3A161C] border-[rgba(255,214,218,0.18)] text-[#F8ECEE] text-sm h-8 w-20 text-right"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-[#C4A8AD]">Aktif</Label>
                    <button
                      onClick={() => updateSelectedScene("isActive", !currentScene.isActive)}
                      className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
                        currentScene.isActive ? "bg-emerald-600" : "bg-[#4A1F28]"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          currentScene.isActive ? "translate-x-4" : ""
                        }`}
                      />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-[#F8ECEE]">Arah kamera awal scene</Label>
                    <Button type="button" variant="outline" size="sm" disabled={isPreview} onClick={handleSetInitialView} className="w-full text-xs">
                      Gunakan arah kamera saat ini
                    </Button>
                  </div>

                  {/* Connection info */}
                  <div className="bg-[#3A161C]/60 rounded-lg px-3 py-2 text-xs text-[#C4A8AD] space-y-1">
                    {(() => {
                      const iv = extractInitialViewFromCanvasData(currentScene.canvasData);
                      if (!iv) return null;
                      return (
                        <div className="mb-1 border-b border-[rgba(255,214,218,0.18)]/60 pb-1 text-[11px] text-[#C4A8AD]">
                          View awal: yaw {iv.yaw.toFixed(1)}°, pitch {iv.pitch.toFixed(1)}°, hfov{" "}
                          {(iv.hfov ?? 0).toFixed(0)}°
                        </div>
                      );
                    })()}
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <ArrowRightLeft className="h-3 w-3" /> Mengarah ke
                      </span>
                      <span className="text-[#F0DDE1]">
                        {hotspots.filter((h) => h.type === "scene").length} scene
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Link2 className="h-3 w-3" /> Ditautkan dari
                      </span>
                      <span className="text-[#F0DDE1]">
                        {incomingMap.get(currentScene.sceneId) ?? 0} scene
                      </span>
                    </div>
                  </div>

                  {/* Panorama upload */}
                  <div>
                    <Label className="text-xs text-[#C4A8AD] mb-1.5 block">Panorama</Label>
                    {currentScene.panoramaUrl && (
                      <div className="relative h-20 rounded-lg overflow-hidden mb-2 bg-[#3A161C]">
                        <Image
                          src={getS3ProxyUrl(currentScene.panoramaUrl)}
                          alt="panorama"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    )}
                    {currentScene.panoramaUrl && (
                      <details className="mb-2 text-xs text-[#C4A8AD]">
                        <summary className="cursor-pointer py-1 focus-visible:outline-2 focus-visible:outline-white">Detail aset</summary>
                        <p className="text-[10px] text-[#A88990] font-mono break-all leading-relaxed">
                          {currentScene.panoramaUrl}
                        </p>
                        {currentScene.thumbnailUrl && (
                          <p className="text-[10px] text-emerald-700 font-mono">
                            ✓ thumbnail tersedia
                          </p>
                        )}
                      </details>
                    )}
                    <label
                      className={`flex items-center gap-2 cursor-pointer border border-dashed rounded-lg p-2.5 text-xs transition-colors ${
                        uploading
                          ? "border-[rgba(255,214,218,0.18)] text-[#A88990]"
                          : "border-[rgba(255,214,218,0.22)] text-[#C4A8AD] hover:border-emerald-500 hover:text-emerald-400"
                      }`}
                    >
                      {uploading ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5 shrink-0" />
                      )}
                      {uploading ? "Mengupload ke S3…" : currentScene.panoramaUrl ? "Ganti panorama" : "Upload panorama equirectangular"}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png"
                        className="hidden"
                        onChange={uploadPanorama}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                </div>
              </section>
            )}

            {inspectorTab === "scene" && currentScene && (
              <section className="rounded-lg border border-[rgba(255,214,218,0.14)] bg-[#1C0A0E]/40 px-3 py-2.5">
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#A88990]">
                  Elemen di scene
                </h3>
                <ul className="space-y-1 text-xs text-[#C4A8AD]">
                  <li className="flex justify-between gap-2">
                    <span>Point (scene/unit/info)</span>
                    <span className="font-mono text-[#F8ECEE]">
                      {hotspots.filter((h) => h.type !== "ad").length}
                    </span>
                  </li>
                  <li className="flex justify-between gap-2">
                    <span>Media / iklan</span>
                    <span className="font-mono text-[#F8ECEE]">
                      {hotspots.filter((h) => h.type === "ad").length}
                    </span>
                  </li>
                  {spatialEnabled && (
                    <li className="flex justify-between gap-2">
                      <span>Spatial Area</span>
                      <span className="font-mono text-[#F8ECEE]">{spatialEntities.length}</span>
                    </li>
                  )}
                  <li className="flex justify-between gap-2">
                    <span>Blur privasi</span>
                    <span className="font-mono text-[#F8ECEE]">{privacyBlurs.length}</span>
                  </li>
                </ul>
              </section>
            )}

            {inspectorTab === "point" && !selectedHotspot && !selectedBlur && (
              <p className="rounded-lg border border-dashed border-[rgba(255,214,218,0.2)] px-3 py-4 text-center text-xs text-[#C4A8AD]">
                Pilih pin di kanvas untuk mengedit.
              </p>
            )}

            {inspectorTab === "media" && !(selectedHotspot && selectedHotspot.type === "ad") && (
              <p className="rounded-lg border border-dashed border-[rgba(255,214,218,0.2)] px-3 py-4 text-center text-xs text-[#C4A8AD]">
                Pilih hotspot iklan untuk mengedit.
              </p>
            )}

            {/* Blur privasi */}
            {inspectorTab === "point" && selectedBlur && (
              <section>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[rgba(255,214,218,0.14)]">
                  <h3 className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                    Blur Privasi
                  </h3>
                  <button
                    onClick={() => handleBlurDelete(selectedBlur._id)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                    title="Hapus blur"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-3">
                  <p className="text-xs text-[#C4A8AD] leading-relaxed">
                    {privacyBlurGuideOnly
                      ? "Posisi blur berubah? Simpan, lalu Bake ke panorama lagi."
                      : "Klik Bake ke panorama untuk menerapkan blur pada foto."}
                  </p>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <Label className="text-xs text-[#C4A8AD]">Ukuran (px)</Label>
                      <button
                        type="button"
                        onClick={() => setBlurSizeLinked((v) => !v)}
                        className={`p-1 rounded transition-colors ${
                          blurSizeLinked
                            ? "text-purple-400 hover:text-purple-300"
                            : "text-[#C4A8AD] hover:text-[#C4A8AD]"
                        }`}
                        title={
                          blurSizeLinked
                            ? "Proporsi terkunci — lebar & tinggi ikut berubah"
                            : "Proporsi bebas — lebar & tinggi independen"
                        }
                      >
                        {blurSizeLinked ? (
                          <Link2 className="h-3.5 w-3.5" />
                        ) : (
                          <Unlink className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-[#C4A8AD] mb-1.5 block">Lebar</Label>
                        <Input
                          type="number"
                          min={24}
                          max={320}
                          value={selectedBlur.width ?? BLUR_WIDTH_DEFAULT}
                          onChange={(e) => updateBlurSize("width", Number(e.target.value))}
                          className="bg-[#3A161C] border-[rgba(255,214,218,0.18)] text-[#F8ECEE] text-xs h-8 font-mono"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-[#C4A8AD] mb-1.5 block">Tinggi</Label>
                        <Input
                          type="number"
                          min={24}
                          max={320}
                          value={selectedBlur.height ?? BLUR_HEIGHT_DEFAULT}
                          onChange={(e) => updateBlurSize("height", Number(e.target.value))}
                          className="bg-[#3A161C] border-[rgba(255,214,218,0.18)] text-[#F8ECEE] text-xs h-8 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <Label className="text-xs text-[#C4A8AD] shrink-0">Intensitas Blur</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={BLUR_INTENSITY_MIN}
                          max={BLUR_INTENSITY_MAX}
                          step={1}
                          value={selectedBlur.intensity ?? BLUR_INTENSITY_DEFAULT}
                          onChange={(e) => updateBlur("intensity", Number(e.target.value))}
                          className="bg-[#3A161C] border-[rgba(255,214,218,0.18)] text-[#F8ECEE] text-xs h-7 w-14 font-mono px-2"
                        />
                        <span className="text-xs text-[#C4A8AD]">px</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={BLUR_INTENSITY_MIN}
                      max={BLUR_INTENSITY_MAX}
                      step={1}
                      value={selectedBlur.intensity ?? BLUR_INTENSITY_DEFAULT}
                      onChange={(e) => updateBlur("intensity", Number(e.target.value))}
                      className="w-full accent-purple-500"
                    />
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <Label className="text-xs text-[#C4A8AD] shrink-0">Radius Sudut</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={BLUR_RADIUS_MIN}
                          max={selectedBlurRadiusMax}
                          step={1}
                          value={selectedBlur.radius ?? BLUR_RADIUS_DEFAULT}
                          onChange={(e) => updateBlur("radius", Number(e.target.value))}
                          className="bg-[#3A161C] border-[rgba(255,214,218,0.18)] text-[#F8ECEE] text-xs h-7 w-14 font-mono px-2"
                        />
                        <span className="text-xs text-[#C4A8AD]">px</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={BLUR_RADIUS_MIN}
                      max={selectedBlurRadiusMax}
                      step={1}
                      value={Math.min(
                        selectedBlur.radius ?? BLUR_RADIUS_DEFAULT,
                        selectedBlurRadiusMax
                      )}
                      onChange={(e) => updateBlur("radius", Number(e.target.value))}
                      className="w-full accent-purple-500"
                    />
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <Label className="text-xs text-[#C4A8AD] shrink-0">Skala</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={Math.round(BLUR_SCALE_MIN * 100)}
                          max={Math.round(BLUR_SCALE_MAX * 100)}
                          step={1}
                          value={Math.round((selectedBlur.scale ?? BLUR_SCALE_DEFAULT) * 100)}
                          onChange={(e) =>
                            updateBlur("scale", Number(e.target.value) / 100)
                          }
                          className="bg-[#3A161C] border-[rgba(255,214,218,0.18)] text-[#F8ECEE] text-xs h-7 w-14 font-mono px-2"
                        />
                        <span className="text-xs text-[#C4A8AD]">%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={BLUR_SCALE_MIN}
                      max={BLUR_SCALE_MAX}
                      step={0.05}
                      value={selectedBlur.scale ?? BLUR_SCALE_DEFAULT}
                      onChange={(e) => updateBlur("scale", Number(e.target.value))}
                      className="w-full accent-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-[#C4A8AD] mb-1.5 block">Yaw (°)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="-180"
                        max="180"
                        value={selectedBlur.yaw}
                        onChange={(e) => updateBlur("yaw", Number(e.target.value))}
                        className="bg-[#3A161C] border-[rgba(255,214,218,0.18)] text-[#F8ECEE] text-xs h-8 font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-[#C4A8AD] mb-1.5 block">Pitch (°)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="-90"
                        max="90"
                        value={selectedBlur.pitch}
                        onChange={(e) => updateBlur("pitch", Number(e.target.value))}
                        className="bg-[#3A161C] border-[rgba(255,214,218,0.18)] text-[#F8ECEE] text-xs h-8 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Hotspot Properties — Point (non-ad) atau Media (ad) */}
            {selectedHotspot &&
              ((inspectorTab === "point" && selectedHotspot.type !== "ad") ||
                (inspectorTab === "media" && selectedHotspot.type === "ad")) && (
              <section>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[rgba(255,214,218,0.14)]">
                  <h3 className="text-xs font-semibold text-[#C4A8AD] uppercase tracking-wider">
                    {selectedHotspot.type === "ad" ? "Media / Iklan" : "Point Hotspot"}
                  </h3>
                  <button
                    onClick={() => handleHotspotDelete(selectedHotspot._id)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                    title="Hapus hotspot"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-[#C4A8AD] mb-1.5 block">Tipe</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(["scene", "space", "info", "ad"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => updateHotspot("type", t)}
                          className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            selectedHotspot.type === t
                              ? t === "scene"
                                ? "bg-emerald-600 border-emerald-500 text-white"
                                : t === "space"
                                  ? "bg-amber-600 border-amber-500 text-white"
                                  : t === "ad"
                                    ? "bg-purple-600 border-purple-500 text-white"
                                    : "bg-blue-600 border-blue-500 text-white"
                              : "border-[rgba(255,214,218,0.18)] text-[#C4A8AD] hover:bg-[#3A161C]"
                          }`}
                        >
                          {t === "scene"
                            ? "🔀 Scene"
                            : t === "space"
                              ? "🏪 Unit"
                              : t === "ad"
                                ? "📢 Iklan"
                                : "ℹ️ Info"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-[#C4A8AD] mb-1.5 block">Label</Label>
                    <Input
                      value={selectedHotspot.text}
                      onChange={(e) => updateHotspot("text", e.target.value)}
                      className="bg-[#3A161C] border-[rgba(255,214,218,0.18)] text-[#F8ECEE] text-sm h-8"
                      placeholder="Nama hotspot"
                    />
                  </div>

                  {selectedHotspot.type === "scene" ? (
                    <>
                      <div>
                        <Label className="text-xs text-[#C4A8AD] mb-1.5 block">Target Scene</Label>
                        {currentScene && (
                          <SceneTargetPicker
                            levels={levels}
                            scenes={scenes}
                            currentSceneId={currentScene.sceneId}
                            value={selectedHotspot.sceneId}
                            defaultLevelId={currentScene.levelId}
                            defaultAreaId={currentScene.areaId}
                            syncKey={selectedHotspot._id}
                            onChange={(sceneId) => { if (sceneId !== selectedHotspot.sceneId) updateHotspot("sceneId", sceneId); }}
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-[#F8ECEE]">Arah kamera saat tiba</Label>
                        <p className="text-xs text-[#C4A8AD]" data-scene-entry-status>
                          {selectedHotspot.targetView
                            ? `Yaw ${selectedHotspot.targetView.yaw.toFixed(1)}° · Pitch ${selectedHotspot.targetView.pitch.toFixed(1)}° · Zoom ${(selectedHotspot.targetView.hfov ?? 120).toFixed(0)}°`
                            : "Bawaan scene tujuan"}
                        </p>
                        <Button type="button" variant="outline" size="sm" className="w-full text-xs" disabled={!scenes.some((s) => s.sceneId === selectedHotspot.sceneId && s.panoramaUrl)} onClick={() => {
                          const destination = scenes.find((s) => s.sceneId === selectedHotspot.sceneId);
                          if (!destination || !currentScene) return;
                          setEntryViewSelection({
                            hotspotId: selectedHotspot._id, sourceTitle: currentScene.title,
                            sceneId: destination.sceneId, title: destination.title, panoramaUrl: destination.panoramaUrl,
                            initialView: resolveSceneEntryView(selectedHotspot, extractInitialViewFromCanvasData(destination.canvasData)),
                          });
                        }}>Atur arah di scene tujuan</Button>
                        {selectedHotspot.targetView && selectedHotspot.sceneId && (
                          <button type="button" className="text-xs text-[#C4A8AD] underline hover:text-white" onClick={() => { if (selectedHotspot.sceneId) setHotspotEntryView(selectedHotspot._id, selectedHotspot.sceneId); }}>Ikuti arah bawaan scene</button>
                        )}
                      </div>
                      <div>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <Label className="text-xs text-[#C4A8AD]">Arah Panah</Label>
                          <span className="text-[10px] text-[#C4A8AD]">
                            {DIRECTION_LABELS[(selectedHotspot.direction ?? "right") as HotspotDirection]}
                          </span>
                        </div>
                        <div className="inline-grid grid-cols-3 gap-1 rounded-xl border border-[rgba(255,214,218,0.18)] bg-[#261015]/60 p-1.5">
                          {DIRECTION_COMPASS.map((d, i) => {
                            if (!d) {
                              return (
                                <div
                                  key={`center-${i}`}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3A161C]/80"
                                  aria-hidden
                                >
                                  <span
                                    className="block h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-red-500/80"
                                    style={{
                                      transform: `rotate(${DIRECTION_ROTATE_DEG[(selectedHotspot.direction ?? "right") as HotspotDirection]}deg)`,
                                    }}
                                  />
                                </div>
                              );
                            }
                            const active = (selectedHotspot.direction ?? "right") === d;
                            return (
                              <button
                                key={d}
                                type="button"
                                title={DIRECTION_LABELS[d]}
                                onClick={() => updateHotspot("direction", d)}
                                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                                  active
                                    ? "border-red-700 bg-red-950 text-white"
                                    : "border-transparent text-[#C4A8AD] hover:border-[rgba(255,214,218,0.22)] hover:bg-[#3A161C] hover:text-[#F8ECEE]"
                                }`}
                              >
                                <span
                                  className="block h-0 w-0 border-y-[4px] border-l-[7px] border-y-transparent border-l-current"
                                  style={{ transform: `rotate(${DIRECTION_ROTATE_DEG[d]}deg)` }}
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : selectedHotspot.type === "space" ? (
                    <div>
                      <Label className="text-xs text-[#C4A8AD] mb-1.5 block">Kode Unit</Label>
                      <UnitPicker
                        spaces={stationSpaces}
                        value={selectedHotspot.spaceCode}
                        mode="retail"
                        placeholder="Cari unit retail…"
                        onChange={(code, space) => assignHotspotSpace(code, space.name)}
                      />
                      {selectedHotspot.spaceCode &&
                        !stationSpaces.some((s) => s.code === selectedHotspot.spaceCode) && (
                          <p className="mt-2 flex items-center gap-1 text-xs text-amber-400">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            Kode unit tidak ditemukan di stasiun ini
                          </p>
                        )}
                    </div>
                  ) : selectedHotspot.type === "ad" ? (
                    <>
                      <div>
                        <Label className="text-xs text-[#C4A8AD] mb-1.5 block">Unit Media</Label>
                        <UnitPicker
                          spaces={stationSpaces}
                          value={selectedHotspot.spaceCode}
                          mode="media"
                          placeholder="Cari slot media iklan…"
                          onChange={(code, space) => assignHotspotSpace(code, space.name)}
                        />
                        {selectedHotspot.spaceCode &&
                          !stationSpaces.some((s) => s.code === selectedHotspot.spaceCode) && (
                            <p className="mt-2 flex items-center gap-1 text-xs text-amber-400">
                              <AlertCircle className="h-3 w-3 shrink-0" />
                              Kode unit tidak ditemukan di stasiun ini
                            </p>
                          )}
                      </div>
                      <div>
                        <Label className="text-xs text-[#C4A8AD] mb-1.5 block">Judul Kreatif</Label>
                        <Input
                          value={selectedHotspot.creativeTitle ?? ""}
                          onChange={(e) => updateHotspot("creativeTitle", e.target.value)}
                          className="bg-[#3A161C] border-[rgba(255,214,218,0.18)] text-[#F8ECEE] text-sm h-8"
                          placeholder="Judul iklan / kampanye"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-[#C4A8AD] mb-1.5 block">Aset Kreatif</Label>
                        {selectedHotspot.creativeUrl && (
                          <div className="relative mb-2 h-24 overflow-hidden rounded-lg bg-[#3A161C]">
                            <Image
                              src={getS3ProxyUrl(selectedHotspot.creativeUrl)}
                              alt="Kreatif iklan"
                              fill
                              className="object-contain"
                              sizes="240px"
                            />
                          </div>
                        )}
                        <div className="flex gap-2">
                          <label
                            className={`flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-dashed p-2 text-xs transition-colors ${
                              uploadingCreative
                                ? "border-[rgba(255,214,218,0.18)] text-[#A88990]"
                                : "border-[rgba(255,214,218,0.22)] text-[#C4A8AD] hover:border-purple-500 hover:text-purple-400"
                            }`}
                          >
                            {uploadingCreative ? (
                              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                            ) : (
                              <Upload className="h-3.5 w-3.5 shrink-0" />
                            )}
                            {uploadingCreative ? "Mengupload…" : selectedHotspot.creativeUrl ? "Ganti kreatif" : "Upload kreatif"}
                            <input
                              ref={creativeInputRef}
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={uploadAdCreative}
                              disabled={uploadingCreative}
                            />
                          </label>
                          {selectedHotspot.creativeUrl && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-auto border-[rgba(255,214,218,0.22)] px-2 text-xs text-[#C4A8AD]"
                              onClick={() => {
                                pushHistory();
                                updateHotspot("creativeUrl", undefined);
                              }}
                            >
                              Hapus
                            </Button>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <Label className="text-xs text-[#C4A8AD] mb-1.5 block">
                          Ikon Hotspot
                        </Label>
                        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                          <button
                            type="button"
                            title="Informasi"
                            onClick={() => updateHotspot("facilityIcon", undefined)}
                            className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 transition ${
                              !selectedHotspot.facilityIcon
                                ? "border-blue-500 bg-blue-500/15"
                                : "border-[rgba(255,214,218,0.18)] hover:bg-[#3A161C]"
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="/brand/tour-pins/info.png"
                              alt="Informasi"
                              width={36}
                              height={39}
                              className="h-[39px] w-9 object-contain"
                            />
                            <span className="text-[9px] font-medium text-[#C4A8AD]">
                              Info
                            </span>
                          </button>
                          {FACILITY_ICONS.map((icon) => {
                            const active =
                              selectedHotspot.facilityIcon === icon.id;
                            return (
                              <button
                                key={icon.id}
                                type="button"
                                title={icon.label}
                                onClick={() =>
                                  updateHotspot("facilityIcon", icon.id as FacilityIconId)
                                }
                                className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 transition ${
                                  active
                                    ? "border-blue-500 bg-blue-500/15"
                                    : "border-[rgba(255,214,218,0.18)] hover:bg-[#3A161C]"
                                }`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={icon.src}
                                  alt={icon.label}
                                  width={36}
                                  height={39}
                                  className="h-[39px] w-9 object-contain"
                                />
                                <span className="text-[9px] font-medium text-[#C4A8AD]">
                                  {icon.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-[#C4A8AD] mb-1.5 block">
                          Deskripsi Info
                        </Label>
                        <textarea
                          value={selectedHotspot.description ?? ""}
                          onChange={(e) => updateHotspot("description", e.target.value)}
                          rows={4}
                          className="w-full resize-none rounded-md border border-[rgba(255,214,218,0.18)] bg-[#3A161C] px-3 py-2 text-sm text-[#F8ECEE]"
                          placeholder="Isi informasi"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <Label className="text-xs text-[#C4A8AD]">Ukuran Hotspot</Label>
                      <span className="text-xs font-mono text-[#F8ECEE]">
                        {Math.round((selectedHotspot.scale ?? HOTSPOT_SCALE_DEFAULT) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={HOTSPOT_SCALE_MIN}
                      max={HOTSPOT_SCALE_MAX}
                      step={0.05}
                      value={selectedHotspot.scale ?? HOTSPOT_SCALE_DEFAULT}
                      onChange={(e) => updateHotspot("scale", Number(e.target.value))}
                      className="w-full accent-[#E31E2D]"
                    />
                    <div className="mt-1 flex justify-between text-[10px] text-[#C4A8AD]/80">
                      <span>Kecil (50%)</span>
                      <span>Normal</span>
                      <span>Besar (200%)</span>
                    </div>
                  </div>

                  {/* Coordinates */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="mb-1.5 block text-xs text-[#C4A8AD]">Yaw (°)</Label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="flex h-8 w-7 items-center justify-center rounded-md border border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] text-[#F8ECEE] hover:bg-[#E31E2D]"
                          onClick={() => updateHotspot("yaw", wrapYaw(selectedHotspot.yaw - 1))}
                          title="Yaw −1°"
                        >
                          −
                        </button>
                        <Input
                          type="number"
                          step="0.1"
                          min="-180"
                          max="180"
                          value={selectedHotspot.yaw}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isFinite(n)) updateHotspot("yaw", wrapYaw(n));
                          }}
                          className="h-8 border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] font-mono text-xs text-[#F8ECEE]"
                        />
                        <button
                          type="button"
                          className="flex h-8 w-7 items-center justify-center rounded-md border border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] text-[#F8ECEE] hover:bg-[#E31E2D]"
                          onClick={() => updateHotspot("yaw", wrapYaw(selectedHotspot.yaw + 1))}
                          title="Yaw +1°"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs text-[#C4A8AD]">Pitch (°)</Label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="flex h-8 w-7 items-center justify-center rounded-md border border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] text-[#F8ECEE] hover:bg-[#E31E2D]"
                          onClick={() =>
                            updateHotspot(
                              "pitch",
                              Math.max(-90, Math.min(90, Math.round((selectedHotspot.pitch - 1) * 10) / 10))
                            )
                          }
                          title="Pitch −1°"
                        >
                          −
                        </button>
                        <Input
                          type="number"
                          step="0.1"
                          min="-90"
                          max="90"
                          value={selectedHotspot.pitch}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isFinite(n)) {
                              updateHotspot("pitch", Math.max(-90, Math.min(90, n)));
                            }
                          }}
                          className="h-8 border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] font-mono text-xs text-[#F8ECEE]"
                        />
                        <button
                          type="button"
                          className="flex h-8 w-7 items-center justify-center rounded-md border border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] text-[#F8ECEE] hover:bg-[#E31E2D]"
                          onClick={() =>
                            updateHotspot(
                              "pitch",
                              Math.max(-90, Math.min(90, Math.round((selectedHotspot.pitch + 1) * 10) / 10))
                            )
                          }
                          title="Pitch +1°"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {inspectorTab === "point" && currentScene && privacyBlurs.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-[rgba(255,214,218,0.14)] gap-2">
                  <h3 className="text-xs font-semibold text-[#C4A8AD] uppercase tracking-wider">
                    Blur Privasi ({privacyBlurs.length})
                  </h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] px-2 border-purple-600/60 text-purple-300 hover:bg-purple-950/50"
                    disabled={bakingPrivacyBlur || !currentScene.panoramaUrl}
                    onClick={() => void bakePrivacyBlursToPanorama()}
                  >
                    {bakingPrivacyBlur ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        Baking…
                      </>
                    ) : (
                      <>
                        <ImageIcon className="h-3 w-3 mr-1" />
                        {privacyBlurGuideOnly ? "Re-bake panorama" : "Bake ke panorama"}
                      </>
                    )}
                  </Button>
                </div>
                <div className="space-y-1">
                  {privacyBlurs.map((b, index) => (
                    <div
                      key={b._id}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors ${
                        b._id === selectedBlurId
                          ? "bg-purple-950/50 border-purple-700"
                          : "border-transparent hover:bg-[#3A161C]"
                      }`}
                      onClick={() => handleBlurSelect(b._id)}
                    >
                      <span className="w-4 h-4 rounded-md flex-none bg-purple-600/40 border border-purple-500/60 backdrop-blur-sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[#F8ECEE] truncate">Blur #{index + 1}</p>
                        <p className="text-xs text-[#C4A8AD] font-mono">
                          {b.yaw.toFixed(1)}°, {b.pitch.toFixed(1)}°
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBlurDelete(b._id);
                        }}
                        className="text-[#A88990] hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Hotspot list — Point: scene/space/info · Media: ad */}
            {currentScene &&
              hotspots.length > 0 &&
              (inspectorTab === "point" || inspectorTab === "media") && (
              <section className="space-y-4">
                <h3 className="text-xs font-semibold text-[#C4A8AD] uppercase tracking-wider pb-2 border-b border-[rgba(255,214,218,0.14)]">
                  {inspectorTab === "media" ? "Daftar Media" : "Daftar Point"}
                </h3>

                {(
                  [
                    { type: "scene" as const, color: "#E31E2D", accent: "text-red-400", badge: "bg-red-950 text-red-300" },
                    { type: "space" as const, color: "#f59e0b", accent: "text-amber-400", badge: "bg-amber-950 text-amber-300" },
                    { type: "ad" as const, color: "#a855f7", accent: "text-purple-400", badge: "bg-purple-950 text-purple-300" },
                    { type: "info" as const, color: "#3b82f6", accent: "text-blue-400", badge: "bg-blue-950 text-blue-300" },
                  ] as const
                )
                  .filter((group) =>
                    inspectorTab === "media" ? group.type === "ad" : group.type !== "ad"
                  )
                  .map((group) => {
                  const items = hotspots.filter((h) => h.type === group.type);
                  if (items.length === 0) return null;

                  return (
                    <div key={group.type}>
                      <div className={`mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider ${group.accent}`}>
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: group.color }}
                        />
                        {hotspotLabel(group.type)}
                        <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-mono ${group.badge}`}>
                          {items.length}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {items.map((h) => (
                          <div
                            key={h._id}
                            className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer transition-colors ${
                              h._id === selectedHotspotId
                                ? "border-[rgba(255,214,218,0.22)] bg-[#4A1F28]"
                                : "border-transparent hover:bg-[#3A161C]"
                            }`}
                            onClick={() => {
                              setSelectedHotspotId(h._id);
                              setSelectedBlurId(null);
                            }}
                          >
                            <span
                              className="flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] text-white"
                              style={{
                                background:
                                  h.type === "space" && h.spaceCode
                                    ? spaceStatusColor(findSpaceStatus(stationSpaces, h.spaceCode))
                                    : hotspotColor(h.type),
                              }}
                            >
                              {h.type === "scene" ? "›" : h.type === "space" ? "●" : h.type === "ad" ? "📢" : "i"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs text-[#F8ECEE]">{h.text}</p>
                              {h.type === "scene" && h.sceneId && (() => {
                                const tgt = scenes.find((s) => s.sceneId === h.sceneId);
                                const loc = tgt?.areaId ? findArea(levels, tgt.areaId) : null;
                                return (
                                  <p className="truncate text-[10px] text-[#C4A8AD]">
                                    → {tgt?.title ?? h.sceneId}
                                    {loc && (
                                      <span className="text-[#A88990]">
                                        {" "}
                                        · {loc.level.label} › {loc.area.label}
                                      </span>
                                    )}
                                  </p>
                                );
                              })()}
                              {h.type === "space" && h.spaceCode && (
                                (() => {
                                  const linkedSpace = stationSpaces.find(
                                    (space) => space.code === h.spaceCode
                                  );
                                  return (
                                    <>
                                      {linkedSpace?.status === "TERISI" &&
                                        linkedSpace.tenantBrand && (
                                          <p className="truncate text-[10px] font-semibold text-emerald-400">
                                            {linkedSpace.tenantBrand}
                                          </p>
                                        )}
                                      <p className="truncate font-mono text-[10px] text-[#C4A8AD]">
                                        {h.spaceCode}
                                      </p>
                                    </>
                                  );
                                })()
                              )}
                              {h.type === "ad" && h.spaceCode && (
                                <p className="truncate text-[10px] text-[#C4A8AD] font-mono">
                                  {h.spaceCode}
                                  {h.creativeTitle ? ` · ${h.creativeTitle}` : ""}
                                </p>
                              )}
                              <p className="font-mono text-[10px] text-[#C4A8AD]">
                                {h.yaw.toFixed(1)}°, {h.pitch.toFixed(1)}°
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleHotspotDelete(h._id);
                              }}
                              className="text-[#A88990] transition-colors hover:text-red-400"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </section>
            )}

            {/* Legend (tersembunyi; cadangan panduan) */}
            {inspectorTab === "scene" && (
            <section className="hidden border-t border-[rgba(255,214,218,0.14)] pt-4">
              <h3 className="text-xs font-semibold text-[#C4A8AD] uppercase tracking-wider mb-2">
                Panduan
              </h3>
              <ul className="space-y-1.5 text-xs text-[#C4A8AD]">
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-600 flex-none" />
                  Hotspot scene — pindah ke scene lain
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-green-500 flex-none" />
                  Unit tersedia — hijau
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-red-500 flex-none" />
                  Unit terisi — merah
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-gray-400 flex-none" />
                  Unit maintenance — abu-abu
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-blue-500 flex-none" />
                  Hotspot info — modal deskripsi spot
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-md bg-purple-600/50 border border-purple-500/60 flex-none" />
                  Blur privasi — atur area, bake ke panorama; edit & re-bake kapan saja
                </li>
                <li className="flex items-center gap-2"><span>🖱️</span> Klik tanpa drag = pasang hotspot/blur</li>
                <li className="flex items-center gap-2"><span>🖱️</span> Drag = pindah posisi</li>
                <li className="flex items-center gap-2"><span>⚙️</span> Klik kanan = hapus blur/hotspot</li>
                <li className="flex items-center gap-2"><span>⋮⋮</span> Drag level untuk ubah urutan tab publik</li>
                <li className="flex items-center gap-2"><span>▲▼</span> Reorder scene dalam satu area</li>
                <li className="flex items-center gap-2"><span>🛤️</span> Icon rute = tautkan jalur jalan otomatis</li>
                <li className="flex items-center gap-2"><span>📦</span> Icon kotak = bulk import</li>
              </ul>
            </section>
            )}
            </>
            )}
          </div>
        </aside>
        )}
      </div>

      {/* ── Add Scene Dialog ─────────────────────────────────────────────── */}
      {showAddScene && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#261015] border border-[rgba(255,214,218,0.18)] rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="font-bold text-[#F8ECEE] mb-5 flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-400" /> Tambah Scene
            </h2>
            <form onSubmit={addScene} className="space-y-4">
              <div>
                <Label className="text-xs text-[#C4A8AD] mb-1.5 block">Area</Label>
                <select
                  value={newSceneAreaId}
                  onChange={(e) => handleNewSceneAreaChange(e.target.value)}
                  className="w-full bg-[#3A161C] border border-[rgba(255,214,218,0.18)] rounded-md h-10 px-3 text-sm text-[#F8ECEE]"
                  required
                >
                  <option value="">— pilih area —</option>
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
              <div>
                <Label className="text-xs text-[#C4A8AD] mb-1.5 block">Judul Scene</Label>
                <Input
                  value={newSceneTitle}
                  onChange={(e) => handleNewSceneTitleChange(e.target.value)}
                  placeholder="contoh: Concourse Utama"
                  className="bg-[#3A161C] border-[rgba(255,214,218,0.18)]"
                  required
                />
              </div>
              <div>
                <Label className="text-xs text-[#C4A8AD] mb-1.5 block">Scene ID</Label>
                <Input
                  value={newSceneId}
                  onChange={(e) => setNewSceneId(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
                  placeholder="concourse-01"
                  className="bg-[#3A161C] border-[rgba(255,214,218,0.18)] font-mono"
                  required
                />
                {scenes.some((s) => s.sceneId === newSceneId) && (
                  <p className="text-xs text-red-400 mt-1">Scene ID ini sudah digunakan</p>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                  disabled={scenes.some((s) => s.sceneId === newSceneId)}
                >
                  Tambah
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setShowAddScene(false)}
                >
                  Batal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Bulk Import Dialog ───────────────────────────────────────────── */}
      {showBulkImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#261015] border border-[rgba(255,214,218,0.18)] rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[rgba(255,214,218,0.14)]">
              <h2 className="font-bold text-[#F8ECEE] flex items-center gap-2">
                <Package className="h-5 w-5 text-sky-400" /> Bulk Import Panorama
              </h2>
              <button
                onClick={() => setShowBulkImport(false)}
                className="text-[#C4A8AD] hover:text-[#F0DDE1] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* File picker */}
              <label className="flex items-center gap-3 cursor-pointer border-2 border-dashed border-[rgba(255,214,218,0.18)] rounded-xl p-5 text-[#C4A8AD] hover:border-sky-600 hover:text-sky-400 transition-colors">
                <Upload className="h-6 w-6 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Pilih beberapa file panorama sekaligus</p>
                  <p className="text-xs text-[#C4A8AD] mt-0.5">JPEG/PNG equirectangular (2:1 ratio)</p>
                </div>
                <input
                  ref={bulkFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  multiple
                  className="hidden"
                  onChange={handleBulkFilePick}
                />
              </label>

              {/* Rows */}
              {bulkRows.length > 0 && (
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 text-[10px] text-[#C4A8AD] uppercase tracking-wider px-1">
                    <span>Judul Scene</span>
                    <span>Scene ID</span>
                    <span>Area</span>
                    <span>Status</span>
                  </div>
                  {bulkRows.map((row) => (
                    <div
                      key={row.key}
                      className={`grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center p-2 rounded-lg border transition-colors ${
                        row.status === "done"
                          ? "border-emerald-800/50 bg-emerald-900/10"
                          : row.status === "error"
                          ? "border-red-800/50 bg-red-900/10"
                          : "border-[rgba(255,214,218,0.14)] bg-[#3A161C]/50"
                      }`}
                    >
                      <Input
                        value={row.title}
                        onChange={(e) => updateBulkRow(row.key, "title", e.target.value)}
                        disabled={row.status !== "pending"}
                        className="bg-[#261015] border-[rgba(255,214,218,0.18)] text-[#F8ECEE] text-xs h-7 px-2"
                        placeholder="Judul scene"
                      />
                      <Input
                        value={row.sceneId}
                        onChange={(e) =>
                          updateBulkRow(
                            row.key,
                            "sceneId",
                            e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                          )
                        }
                        disabled={row.status !== "pending"}
                        className="bg-[#261015] border-[rgba(255,214,218,0.18)] text-[#C4A8AD] text-xs h-7 px-2 font-mono"
                        placeholder="scene-id"
                      />
                      <select
                        value={row.areaId}
                        onChange={(e) => updateBulkRow(row.key, "areaId", e.target.value)}
                        disabled={row.status !== "pending"}
                        className="bg-[#261015] border border-[rgba(255,214,218,0.18)] rounded h-7 px-1.5 text-xs text-[#F8ECEE] min-w-[110px]"
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
                      <span className="flex items-center justify-center w-7 h-7" title={row.error}>
                        {row.status === "done" ? (
                          <Check className="h-4 w-4 text-emerald-400" />
                        ) : row.status === "error" ? (
                          <AlertCircle className="h-4 w-4 text-red-400" />
                        ) : row.status === "creating" || row.status === "uploading" ? (
                          <Loader2 className="h-4 w-4 text-sky-400 animate-spin" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-[#E31E2D]" />
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {bulkRows.length === 0 && (
                <p className="text-center text-[#A88990] text-sm py-4">
                  Pilih file di atas untuk mulai konfigurasi bulk import
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-[rgba(255,214,218,0.14)] flex items-center justify-between gap-3">
              <p className="text-xs text-[#C4A8AD]">
                {bulkRows.filter((r) => r.status === "done").length}/{bulkRows.length} selesai
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowBulkImport(false)}
                  disabled={bulkRunning}
                >
                  Tutup
                </Button>
                <Button
                  className="bg-sky-600 hover:bg-sky-500"
                  disabled={bulkRows.length === 0 || bulkRunning}
                  onClick={runBulkImport}
                >
                  {bulkRunning ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Mengimport…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Upload className="h-4 w-4" /> Import {bulkRows.length > 0 ? `${bulkRows.length} scene` : ""}
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ManageAreaDialog
        state={areaDialog}
        onClose={() => setAreaDialog(null)}
        onSubmitAdd={submitAreaAdd}
        onSubmitEdit={submitAreaEdit}
        onConfirmDelete={submitAreaDelete}
      />

      <ManageLevelsDialog
        open={showManageLevels}
        levels={levels}
        onClose={() => setShowManageLevels(false)}
        onCreate={createLevel}
        onUpdate={updateLevel}
        onReorder={reorderLevels}
        onDelete={deleteLevel}
      />

      {entryViewSelection && <SceneEntryViewDialog selection={entryViewSelection} onClose={() => setEntryViewSelection(null)} onApply={(view) => {
        setHotspotEntryView(entryViewSelection.hotspotId, entryViewSelection.sceneId, view);
        setEntryViewSelection(null);
        showToast("ok", "Arah tiba diterapkan. Klik Simpan untuk menyimpan koneksi.");
      }} />}
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
          if (idx >= 0) selectScene(idx);
        }}
      />

      {/* ── Toast ───────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl border text-sm font-medium z-[100] transition-all ${
            toast.type === "ok"
              ? "bg-emerald-900 border-emerald-700 text-emerald-200"
              : "bg-red-900 border-red-700 text-red-200"
          }`}
        >
          {toast.type === "ok" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
