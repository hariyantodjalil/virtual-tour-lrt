"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import { cmsFetch } from "@/lib/cms-fetch";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Save,
  Plus,
  Trash2,
  Upload,
  MousePointer,
  ArrowRightLeft,
  Store,
  AlertCircle,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Package,
  Link2,
  Unlink,
  ImageIcon,
  Loader2,
  X,
  Check,
  Info,
} from "lucide-react";
import { hotspotColor, HOTSPOT_SCALE_MIN, HOTSPOT_SCALE_MAX, HOTSPOT_SCALE_DEFAULT } from "@/lib/hotspot-types";
import { findSpaceStatus, spaceStatusColor } from "@/lib/space-availability";
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
import { buildWalkPathHotspots } from "@/lib/walk-path";
import type { TourLevel, TourArea } from "@/lib/virtual-tour-structure";

import { PanoramaCanvas, type AddMode, type HotspotItem } from "./PanoramaCanvas";
import { PannellumPreview } from "./PannellumPreview";
import { PannellumEditor, type PannellumEditorHandle } from "./PannellumEditor";
import { TourStructureSidebar } from "./TourStructureSidebar";
import { ManageLevelsDialog } from "./ManageLevelsDialog";
import { ManageAreaDialog, type AreaDialogState } from "./ManageAreaDialog";
import { SceneTargetPicker } from "./SceneTargetPicker";

// ─── Types ──────────────────────────────────────────────────────────────────

type Scene = {
  id: string;
  sceneId: string;
  title: string;
  level: string;
  levelId?: string | null;
  areaId?: string | null;
  panoramaUrl: string;
  thumbnailUrl?: string | null;
  order: number;
  hotspots: Omit<HotspotItem, "_id">[];
  canvasData?: unknown;
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
  status: "TERSEDIA" | "TERISI" | "MAINTENANCE";
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
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [saving, setSaving] = useState(false);
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
  const pannellumEditorRef = useRef<PannellumEditorHandle>(null);

  // ─── Derived ─────────────────────────────────────────────────────────────
  const currentScene = scenes[selectedSceneIndex] ?? null;
  const selectedHotspot = hotspots.find((h) => h._id === selectedHotspotId) ?? null;
  const selectedBlur = privacyBlurs.find((b) => b._id === selectedBlurId) ?? null;
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
    const [stRes, structRes, spRes] = await Promise.all([
      cmsFetch(`/api/cms/stations/${stationId}`),
      cmsFetch(`/api/cms/virtual-tour/${stationId}/structure`),
      cmsFetch(`/api/cms/spaces/station/${stationId}`),
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
      setHotspots(sceneToHotspots(scData[idx]));
      setPrivacyBlurs(sceneToPrivacyBlurs(scData[idx]));
    } else {
      setHotspots([]);
      setPrivacyBlurs([]);
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
    if (hasUnsaved) {
      if (!confirm("Ada perubahan yang belum disimpan. Pindah scene?")) return;
    }
    setSelectedSceneIndex(index);
    setHotspots(sceneToHotspots(scenes[index]));
    setPrivacyBlurs(sceneToPrivacyBlurs(scenes[index]));
    setSelectedHotspotId(null);
    setSelectedBlurId(null);
    setAddMode("none");
    setHasUnsaved(false);
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
        setHotspots(sceneToHotspots(scData[finalIdx]));
        setPrivacyBlurs(sceneToPrivacyBlurs(scData[finalIdx]));
      }
    } catch {
      showToast("err", "Gagal mengubah urutan");
    }
  }

  // ─── Canvas handlers ─────────────────────────────────────────────────────
  const handleHotspotAdd = useCallback(
    (yaw: number, pitch: number) => {
      if (addMode === "blur") return;
      const type = addMode === "scene" ? "scene" : addMode === "space" ? "space" : "info";
      const newH: HotspotItem = {
        _id: tempId(),
        yaw,
        pitch,
        type,
        text:
          type === "scene" ? "Scene baru" : type === "space" ? "Unit baru" : "Info baru",
        scale: HOTSPOT_SCALE_DEFAULT,
        ...(type === "info" ? { description: "" } : {}),
      };
      setHotspots((prev) => [...prev, newH]);
      setSelectedHotspotId(newH._id);
      setSelectedBlurId(null);
      setAddMode("none");
      setHasUnsaved(true);
    },
    [addMode]
  );

  const handleBlurAdd = useCallback((yaw: number, pitch: number) => {
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
  }, []);

  function previewNavigateScene(sceneId: string) {
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
    setHotspots((prev) =>
      prev.map((h) => (h._id === id ? { ...h, yaw, pitch } : h))
    );
    setHasUnsaved(true);
  }, []);

  const handleHotspotSelect = useCallback((id: string | null) => {
    setSelectedHotspotId(id);
    if (id) setSelectedBlurId(null);
  }, []);

  const handleHotspotDelete = useCallback((id: string) => {
    setHotspots((prev) => prev.filter((h) => h._id !== id));
    setSelectedHotspotId((sel) => (sel === id ? null : sel));
    setHasUnsaved(true);
  }, []);

  const handleBlurMove = useCallback((id: string, yaw: number, pitch: number) => {
    setPrivacyBlurs((prev) =>
      prev.map((b) => (b._id === id ? { ...b, yaw, pitch } : b))
    );
    setHasUnsaved(true);
  }, []);

  const handleBlurSelect = useCallback((id: string | null) => {
    setSelectedBlurId(id);
    if (id) setSelectedHotspotId(null);
  }, []);

  const handleBlurDelete = useCallback((id: string) => {
    setPrivacyBlurs((prev) => prev.filter((b) => b._id !== id));
    setSelectedBlurId((sel) => (sel === id ? null : sel));
    setHasUnsaved(true);
  }, []);

  // ─── Save scene ──────────────────────────────────────────────────────────
  async function saveScene() {
    if (!currentScene) return;
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
          }),
        }
      );
      if (res.ok) {
        showToast("ok", "Scene disimpan");
        setHasUnsaved(false);
        load(selectedSceneIndex);
      } else {
        showToast("err", "Gagal menyimpan scene");
      }
    } catch {
      showToast("err", "Error jaringan");
    } finally {
      setSaving(false);
    }
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

    const viewerCtx = pannellumEditorRef.current?.getViewerBakeContext();
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
    const file = e.target.files?.[0];
    if (!file || !currentScene) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await cmsFetch(
        `/api/cms/virtual-tour/${stationId}/${currentScene.sceneId}`,
        { method: "POST", body: fd }
      );
      if (res.ok) {
        showToast("ok", "Panorama diupload ke S3");
        load(selectedSceneIndex);
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
  function updateHotspot(field: keyof HotspotItem, value: string | number) {
    if (!selectedHotspotId) return;
    setHotspots((prev) =>
      prev.map((h) =>
        h._id === selectedHotspotId ? { ...h, [field]: value } : h
      )
    );
    setHasUnsaved(true);
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

      const fd = new FormData();
      fd.append("file", row.file);
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
      {/* ── Top Toolbar ─────────────────────────────────────────────────── */}
      <div className="relative z-30 flex shrink-0 items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800">
        <Button asChild variant="ghost" size="sm" className="text-slate-400 hover:text-slate-200 shrink-0">
          <Link href="/cms/virtual-tour">
            <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
          </Link>
        </Button>

        <div className="h-5 w-px bg-slate-700" />

        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-slate-400 text-sm shrink-0">Virtual Tour</span>
          <span className="text-slate-600">›</span>
          <span className="text-slate-100 text-sm font-semibold truncate">
            {station?.name ?? "…"}
          </span>
          {currentScene && (
            <>
              <span className="text-slate-600">›</span>
              <span
                className="text-sm font-medium truncate"
                style={{ color: getLevelConfig(currentScene.level, levels).color }}
              >
                {currentScene.title}
              </span>
            </>
          )}
        </div>

        <div className="flex-1" />

        {/* Mode toolbar */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          <button
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              addMode === "none" ? "bg-slate-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => setAddMode("none")}
            title="Mode Seleksi"
          >
            <MousePointer className="h-3.5 w-3.5" /> Pilih
          </button>
          <button
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              addMode === "scene" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => setAddMode((m) => (m === "scene" ? "none" : "scene"))}
            title="Tambah hotspot scene"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" /> + Scene
          </button>
          <button
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              addMode === "space" ? "bg-amber-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => setAddMode((m) => (m === "space" ? "none" : "space"))}
            title="Tambah hotspot unit"
          >
            <Store className="h-3.5 w-3.5" /> + Unit
          </button>
          <button
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              addMode === "info" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => setAddMode((m) => (m === "info" ? "none" : "info"))}
            title="Tambah hotspot info"
          >
            <Info className="h-3.5 w-3.5" /> + Info
          </button>
          <button
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              addMode === "blur" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => setAddMode((m) => (m === "blur" ? "none" : "blur"))}
            title="Tambah blur privasi (wajah, dll.)"
          >
            <EyeOff className="h-3.5 w-3.5" /> + Blur
          </button>
        </div>

        <div className="h-5 w-px bg-slate-700" />

        {/* Preview toggle — Edit = Pannellum 3D editor, Preview = Pannellum full preview */}
        <button
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            isPreview
              ? "bg-purple-600 border-purple-500 text-white"
              : "bg-slate-800 border-slate-700 text-slate-300 hover:border-purple-500 hover:text-purple-300"
          }`}
          onClick={() => {
            setIsPreview((p) => !p);
            setAddMode("none");
          }}
        >
          {isPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {isPreview ? "Kembali Edit" : "Full Preview"}
        </button>

        {hasUnsaved && (
          <span className="text-xs text-amber-400 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" /> Belum disimpan
          </span>
        )}

        <Button
          size="sm"
          onClick={saveScene}
          disabled={saving || !currentScene}
          className="bg-emerald-600 hover:bg-emerald-500 shrink-0"
        >
          {saving ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Menyimpan…
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Save className="h-3.5 w-3.5" /> Simpan
            </span>
          )}
        </Button>
      </div>

      {/* ── Main Editor Area ─────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

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
          onAddArea={openAddArea}
          onEditArea={openEditArea}
          onDeleteArea={openDeleteArea}
          onAutoWalkPath={autoWalkPath}
        />

        {/* ── Center: Canvas / Preview ─────────────────────────────── */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {currentScene ? (
            isPreview ? (
              <PannellumPreview
                key={`preview-${currentScene.sceneId}-${hotspots.length}-${privacyBlurs.length}`}
                panoramaUrl={currentScene.panoramaUrl}
                hotspots={hotspots}
                privacyBlurs={privacyBlurs}
                sceneName={currentScene.title}
                scenes={scenes.map((s) => ({ sceneId: s.sceneId, title: s.title }))}
                spaces={stationSpaces}
                stationName={station?.name ?? ""}
                onSceneNavigate={previewNavigateScene}
              />
            ) : (
              /* Edit — Pannellum 3D statis (no auto-rotate), klik untuk pasang hotspot */
              <PannellumEditor
                ref={pannellumEditorRef}
                key={`editor-${currentScene.sceneId}`}
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
                privacyBlurGuideOnly={privacyBlurGuideOnly}
              />
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-500">
              <div className="text-5xl mb-3">📷</div>
              <p>Pilih atau tambah scene</p>
            </div>
          )}
        </div>

        {/* ── Right: Properties Panel ──────────────────────────────── */}
        <aside className="w-72 bg-slate-900 border-l border-slate-800 flex flex-col flex-none overflow-hidden">
          <div className="overflow-y-auto flex-1 px-3 py-3 space-y-5">

            {/* Scene Properties */}
            {currentScene && (
              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-2 border-b border-slate-800">
                  Scene
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-slate-500 mb-1.5 block">Judul</Label>
                    <Input
                      value={currentScene.title}
                      onChange={(e) => updateSelectedScene("title", e.target.value)}
                      className="bg-slate-800 border-slate-700 text-slate-100 text-sm h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1.5 block">Scene ID</Label>
                    <Input
                      value={currentScene.sceneId}
                      readOnly
                      className="bg-slate-800 border-slate-700 text-slate-400 text-xs h-8 font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1.5 block">Level</Label>
                    <p
                      className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm font-medium"
                      style={{ color: getLevelConfig(currentScene.level, levels).color }}
                    >
                      {getLevelConfig(currentScene.level, levels).label}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1.5 block">Area</Label>
                    <select
                      value={currentScene.areaId ?? ""}
                      onChange={(e) => handleSceneAreaChange(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-md h-8 px-2 text-sm text-slate-100"
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
                    <Label className="text-xs text-slate-500">Urutan</Label>
                    <Input
                      type="number"
                      value={currentScene.order}
                      onChange={(e) => updateSelectedScene("order", Number(e.target.value))}
                      className="bg-slate-800 border-slate-700 text-slate-100 text-sm h-8 w-20 text-right"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-slate-500">Aktif</Label>
                    <button
                      onClick={() => updateSelectedScene("isActive", !currentScene.isActive)}
                      className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
                        currentScene.isActive ? "bg-emerald-600" : "bg-slate-700"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          currentScene.isActive ? "translate-x-4" : ""
                        }`}
                      />
                    </button>
                  </div>

                  {/* Connection info */}
                  <div className="bg-slate-800/60 rounded-lg px-3 py-2 text-xs text-slate-500 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <ArrowRightLeft className="h-3 w-3" /> Mengarah ke
                      </span>
                      <span className="text-slate-300">
                        {hotspots.filter((h) => h.type === "scene").length} scene
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Link2 className="h-3 w-3" /> Ditautkan dari
                      </span>
                      <span className="text-slate-300">
                        {incomingMap.get(currentScene.sceneId) ?? 0} scene
                      </span>
                    </div>
                  </div>

                  {/* Panorama upload */}
                  <div>
                    <Label className="text-xs text-slate-500 mb-1.5 block">Panorama</Label>
                    {currentScene.panoramaUrl && (
                      <div className="relative h-20 rounded-lg overflow-hidden mb-2 bg-slate-800">
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
                      <div className="mb-2 space-y-0.5">
                        <p className="text-[10px] text-slate-600 font-mono break-all leading-relaxed">
                          {currentScene.panoramaUrl}
                        </p>
                        {currentScene.thumbnailUrl && (
                          <p className="text-[10px] text-emerald-700 font-mono">
                            ✓ thumbnail tersedia
                          </p>
                        )}
                      </div>
                    )}
                    <label
                      className={`flex items-center gap-2 cursor-pointer border border-dashed rounded-lg p-2.5 text-xs transition-colors ${
                        uploading
                          ? "border-slate-700 text-slate-600"
                          : "border-slate-600 text-slate-400 hover:border-emerald-500 hover:text-emerald-400"
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

            {/* Blur privasi */}
            {selectedBlur && (
              <section>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
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
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {privacyBlurGuideOnly
                      ? "Panorama sudah pernah dibake. Kotak ungu = area edit; blur asli ada di gambar. Setelah ubah posisi/ukuran/skala, simpan scene lalu klik «Bake ke panorama» lagi."
                      : "Preview overlay CSS di editor. Klik «Bake ke panorama» agar blur permanen di gambar (tetap bisa diedit & re-bake)."}
                  </p>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <Label className="text-xs text-slate-500">Ukuran (px)</Label>
                      <button
                        type="button"
                        onClick={() => setBlurSizeLinked((v) => !v)}
                        className={`p-1 rounded transition-colors ${
                          blurSizeLinked
                            ? "text-purple-400 hover:text-purple-300"
                            : "text-slate-500 hover:text-slate-400"
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
                        <Label className="text-xs text-slate-500 mb-1.5 block">Lebar</Label>
                        <Input
                          type="number"
                          min={24}
                          max={320}
                          value={selectedBlur.width ?? BLUR_WIDTH_DEFAULT}
                          onChange={(e) => updateBlurSize("width", Number(e.target.value))}
                          className="bg-slate-800 border-slate-700 text-slate-100 text-xs h-8 font-mono"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500 mb-1.5 block">Tinggi</Label>
                        <Input
                          type="number"
                          min={24}
                          max={320}
                          value={selectedBlur.height ?? BLUR_HEIGHT_DEFAULT}
                          onChange={(e) => updateBlurSize("height", Number(e.target.value))}
                          className="bg-slate-800 border-slate-700 text-slate-100 text-xs h-8 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <Label className="text-xs text-slate-500 shrink-0">Intensitas Blur</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={BLUR_INTENSITY_MIN}
                          max={BLUR_INTENSITY_MAX}
                          step={1}
                          value={selectedBlur.intensity ?? BLUR_INTENSITY_DEFAULT}
                          onChange={(e) => updateBlur("intensity", Number(e.target.value))}
                          className="bg-slate-800 border-slate-700 text-slate-100 text-xs h-7 w-14 font-mono px-2"
                        />
                        <span className="text-xs text-slate-500">px</span>
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
                      <Label className="text-xs text-slate-500 shrink-0">Radius Sudut</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={BLUR_RADIUS_MIN}
                          max={selectedBlurRadiusMax}
                          step={1}
                          value={selectedBlur.radius ?? BLUR_RADIUS_DEFAULT}
                          onChange={(e) => updateBlur("radius", Number(e.target.value))}
                          className="bg-slate-800 border-slate-700 text-slate-100 text-xs h-7 w-14 font-mono px-2"
                        />
                        <span className="text-xs text-slate-500">px</span>
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
                    <p className="text-[10px] text-slate-600 mt-1 leading-snug">
                      Membulatkan sudut area blur. Naikkan hingga maks (½ sisi terpendek) untuk bentuk
                      lingkaran atau kapsul.
                    </p>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <Label className="text-xs text-slate-500 shrink-0">Skala</Label>
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
                          className="bg-slate-800 border-slate-700 text-slate-100 text-xs h-7 w-14 font-mono px-2"
                        />
                        <span className="text-xs text-slate-500">%</span>
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
                      <Label className="text-xs text-slate-500 mb-1.5 block">Yaw (°)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="-180"
                        max="180"
                        value={selectedBlur.yaw}
                        onChange={(e) => updateBlur("yaw", Number(e.target.value))}
                        className="bg-slate-800 border-slate-700 text-slate-100 text-xs h-8 font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500 mb-1.5 block">Pitch (°)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="-90"
                        max="90"
                        value={selectedBlur.pitch}
                        onChange={(e) => updateBlur("pitch", Number(e.target.value))}
                        className="bg-slate-800 border-slate-700 text-slate-100 text-xs h-8 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Hotspot Properties */}
            {selectedHotspot && (
              <section>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Hotspot
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
                    <Label className="text-xs text-slate-500 mb-1.5 block">Tipe</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["scene", "space", "info"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => updateHotspot("type", t)}
                          className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            selectedHotspot.type === t
                              ? t === "scene"
                                ? "bg-emerald-600 border-emerald-500 text-white"
                                : t === "space"
                                  ? "bg-amber-600 border-amber-500 text-white"
                                  : "bg-blue-600 border-blue-500 text-white"
                              : "border-slate-700 text-slate-400 hover:bg-slate-800"
                          }`}
                        >
                          {t === "scene" ? "🔀 Scene" : t === "space" ? "🏪 Unit" : "ℹ️ Info"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-500 mb-1.5 block">Label</Label>
                    <Input
                      value={selectedHotspot.text}
                      onChange={(e) => updateHotspot("text", e.target.value)}
                      className="bg-slate-800 border-slate-700 text-slate-100 text-sm h-8"
                      placeholder="Nama hotspot"
                    />
                  </div>

                  {selectedHotspot.type === "scene" ? (
                    <div>
                      <Label className="text-xs text-slate-500 mb-1.5 block">Target Scene</Label>
                      {currentScene && (
                        <SceneTargetPicker
                          levels={levels}
                          scenes={scenes}
                          currentSceneId={currentScene.sceneId}
                          value={selectedHotspot.sceneId}
                          defaultLevelId={currentScene.levelId}
                          defaultAreaId={currentScene.areaId}
                          syncKey={selectedHotspot._id}
                          onChange={(sceneId) => updateHotspot("sceneId", sceneId)}
                        />
                      )}
                    </div>
                  ) : selectedHotspot.type === "space" ? (
                    <div>
                      <Label className="text-xs text-slate-500 mb-1.5 block">Kode Unit</Label>
                      <Input
                        value={selectedHotspot.spaceCode ?? ""}
                        onChange={(e) => updateHotspot("spaceCode", e.target.value)}
                        className="bg-slate-800 border-slate-700 text-slate-100 text-sm h-8 font-mono"
                        placeholder="mis. DUK-01"
                        list="space-codes-list"
                      />
                      <datalist id="space-codes-list">
                        {stationSpaces.map((s) => (
                          <option key={s.id} value={s.code}>
                            {s.name}
                          </option>
                        ))}
                      </datalist>
                    </div>
                  ) : (
                    <div>
                      <Label className="text-xs text-slate-500 mb-1.5 block">Deskripsi Info</Label>
                      <textarea
                        value={selectedHotspot.description ?? ""}
                        onChange={(e) => updateHotspot("description", e.target.value)}
                        rows={4}
                        className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 resize-none"
                        placeholder="Teks yang muncul di modal info saat diklik pengunjung"
                      />
                    </div>
                  )}

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <Label className="text-xs text-slate-500">Ukuran Hotspot</Label>
                      <span className="text-xs font-mono text-slate-400">
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
                      className="w-full accent-emerald-500"
                    />
                    <div className="mt-1 flex justify-between text-[10px] text-slate-600">
                      <span>Kecil (50%)</span>
                      <span>Normal</span>
                      <span>Besar (200%)</span>
                    </div>
                  </div>

                  {/* Coordinates */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-slate-500 mb-1.5 block">Yaw (°)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="-180"
                        max="180"
                        value={selectedHotspot.yaw}
                        onChange={(e) => updateHotspot("yaw", Number(e.target.value))}
                        className="bg-slate-800 border-slate-700 text-slate-100 text-xs h-8 font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500 mb-1.5 block">Pitch (°)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="-90"
                        max="90"
                        value={selectedHotspot.pitch}
                        onChange={(e) => updateHotspot("pitch", Number(e.target.value))}
                        className="bg-slate-800 border-slate-700 text-slate-100 text-xs h-8 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {currentScene && privacyBlurs.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800 gap-2">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
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
                          : "border-transparent hover:bg-slate-800"
                      }`}
                      onClick={() => handleBlurSelect(b._id)}
                    >
                      <span className="w-4 h-4 rounded-md flex-none bg-purple-600/40 border border-purple-500/60 backdrop-blur-sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-200 truncate">Blur #{index + 1}</p>
                        <p className="text-xs text-slate-500 font-mono">
                          {b.yaw.toFixed(1)}°, {b.pitch.toFixed(1)}°
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBlurDelete(b._id);
                        }}
                        className="text-slate-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Hotspot list */}
            {currentScene && hotspots.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 pb-2 border-b border-slate-800">
                  Semua Hotspot ({hotspots.length})
                </h3>
                <div className="space-y-1">
                  {hotspots.map((h) => (
                    <div
                      key={h._id}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors ${
                        h._id === selectedHotspotId
                          ? "bg-slate-700 border-slate-600"
                          : "border-transparent hover:bg-slate-800"
                      }`}
                      onClick={() => setSelectedHotspotId(h._id)}
                    >
                      <span
                        className="w-4 h-4 rounded-full flex-none flex items-center justify-center text-white text-xs"
                        style={{
                          background:
                            h.type === "space" && h.spaceCode
                              ? spaceStatusColor(findSpaceStatus(stationSpaces, h.spaceCode))
                              : hotspotColor(h.type),
                        }}
                      >
                        {h.type === "scene" ? "○" : h.type === "space" ? "●" : "i"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-200 truncate">{h.text}</p>
                        {h.type === "scene" && h.sceneId && (() => {
                          const tgt = scenes.find((s) => s.sceneId === h.sceneId);
                          const loc = tgt?.areaId ? findArea(levels, tgt.areaId) : null;
                          return (
                            <p className="text-[10px] text-slate-500 truncate">
                              → {tgt?.title ?? h.sceneId}
                              {loc && (
                                <span className="text-slate-600">
                                  {" "}
                                  · {loc.level.label} › {loc.area.label}
                                </span>
                              )}
                            </p>
                          );
                        })()}
                        <p className="text-xs text-slate-500 font-mono">
                          {h.yaw.toFixed(1)}°, {h.pitch.toFixed(1)}°
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHotspotDelete(h._id);
                        }}
                        className="text-slate-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Legend */}
            <section className="border-t border-slate-800 pt-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Panduan
              </h3>
              <ul className="space-y-1.5 text-xs text-slate-500">
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
                <li className="flex items-center gap-2"><span>▲▼</span> Reorder scene dalam satu area</li>
                <li className="flex items-center gap-2"><span>🛤️</span> Icon rute = tautkan jalur jalan otomatis</li>
                <li className="flex items-center gap-2"><span>📦</span> Icon kotak = bulk import</li>
              </ul>
            </section>
          </div>
        </aside>
      </div>

      {/* ── Add Scene Dialog ─────────────────────────────────────────────── */}
      {showAddScene && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="font-bold text-slate-100 mb-5 flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-400" /> Tambah Scene
            </h2>
            <form onSubmit={addScene} className="space-y-4">
              <div>
                <Label className="text-xs text-slate-400 mb-1.5 block">Area</Label>
                <select
                  value={newSceneAreaId}
                  onChange={(e) => handleNewSceneAreaChange(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md h-10 px-3 text-sm text-slate-100"
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
                <Label className="text-xs text-slate-400 mb-1.5 block">Judul Scene</Label>
                <Input
                  value={newSceneTitle}
                  onChange={(e) => handleNewSceneTitleChange(e.target.value)}
                  placeholder="contoh: Concourse Utama"
                  className="bg-slate-800 border-slate-700"
                  required
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1.5 block">Scene ID</Label>
                <Input
                  value={newSceneId}
                  onChange={(e) => setNewSceneId(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
                  placeholder="concourse-01"
                  className="bg-slate-800 border-slate-700 font-mono"
                  required
                />
                <p className="text-xs text-slate-600 mt-1">Huruf kecil, tanpa spasi — auto-generated, bisa diubah</p>
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
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="font-bold text-slate-100 flex items-center gap-2">
                <Package className="h-5 w-5 text-sky-400" /> Bulk Import Panorama
              </h2>
              <button
                onClick={() => setShowBulkImport(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* File picker */}
              <label className="flex items-center gap-3 cursor-pointer border-2 border-dashed border-slate-700 rounded-xl p-5 text-slate-400 hover:border-sky-600 hover:text-sky-400 transition-colors">
                <Upload className="h-6 w-6 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Pilih beberapa file panorama sekaligus</p>
                  <p className="text-xs text-slate-500 mt-0.5">JPEG/PNG equirectangular (2:1 ratio)</p>
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
                  <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 text-[10px] text-slate-500 uppercase tracking-wider px-1">
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
                          : "border-slate-800 bg-slate-800/50"
                      }`}
                    >
                      <Input
                        value={row.title}
                        onChange={(e) => updateBulkRow(row.key, "title", e.target.value)}
                        disabled={row.status !== "pending"}
                        className="bg-slate-900 border-slate-700 text-slate-100 text-xs h-7 px-2"
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
                        className="bg-slate-900 border-slate-700 text-slate-400 text-xs h-7 px-2 font-mono"
                        placeholder="scene-id"
                      />
                      <select
                        value={row.areaId}
                        onChange={(e) => updateBulkRow(row.key, "areaId", e.target.value)}
                        disabled={row.status !== "pending"}
                        className="bg-slate-900 border border-slate-700 rounded h-7 px-1.5 text-xs text-slate-100 min-w-[110px]"
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
                          <span className="w-2 h-2 rounded-full bg-slate-600" />
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {bulkRows.length === 0 && (
                <p className="text-center text-slate-600 text-sm py-4">
                  Pilih file di atas untuk mulai konfigurasi bulk import
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-800 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
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
        onDelete={deleteLevel}
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
