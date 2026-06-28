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
  ImageIcon,
  Loader2,
  X,
  Check,
  Info,
} from "lucide-react";
import { hotspotColor } from "@/lib/hotspot-types";

import { PanoramaCanvas, type AddMode, type HotspotItem } from "./PanoramaCanvas";
import { PannellumPreview } from "./PannellumPreview";
import { PannellumEditor } from "./PannellumEditor";

// ─── Types ──────────────────────────────────────────────────────────────────

type Scene = {
  id: string;
  sceneId: string;
  title: string;
  level: string;
  panoramaUrl: string;
  thumbnailUrl?: string | null;
  order: number;
  hotspots: Omit<HotspotItem, "_id">[];
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

const SCENE_LEVELS = [
  { value: "CONCOURSE", label: "Concourse", color: "#10b981", hint: "Area unpaid/paid concourse, gate, hall" },
  { value: "PLATFORM", label: "Peron", color: "#3b82f6", hint: "Area platform dan boarding" },
  { value: "OUTDOOR", label: "Outdoor", color: "#f59e0b", hint: "Akses luar, drop-off, entrance" },
  { value: "TRANSFER", label: "Transfer", color: "#8b5cf6", hint: "Koridor koneksi dan interchange" },
  { value: "COMMERCIAL", label: "Komersial", color: "#ef4444", hint: "Area tenant, retail, media" },
];

function getLevelConfig(level?: string) {
  return SCENE_LEVELS.find((l) => l.value === level) ?? SCENE_LEVELS[0];
}

let _tempId = 0;
function tempId() {
  return `hs-${Date.now()}-${++_tempId}`;
}

function sceneToHotspots(scene: Scene): HotspotItem[] {
  return (scene.hotspots || []).map((h, i) => ({
    ...h,
    type: h.type ?? "scene",
    _id: `hs-${scene.sceneId}-${i}`,
  }));
}

function hotspotsToSave(hs: HotspotItem[]): Omit<HotspotItem, "_id">[] {
  return hs.map((hotspot) => {
    const rest: Partial<HotspotItem> = { ...hotspot };
    delete rest._id;
    return rest as Omit<HotspotItem, "_id">;
  });
}

/** Saran sceneId otomatis berdasarkan level + jumlah scene yang sudah ada di level itu */
function suggestSceneId(level: string, existingScenes: Scene[]): string {
  const prefix = level.toLowerCase();
  const count = existingScenes.filter((s) => (s.level ?? "CONCOURSE") === level).length + 1;
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
  level: string;
  status: "pending" | "creating" | "uploading" | "done" | "error";
  error?: string;
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function VirtualTourEditorPage() {
  const { stationId } = useParams<{ stationId: string }>();

  const [station, setStation] = useState<Station | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [stationSpaces, setStationSpaces] = useState<CommercialSpace[]>([]);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [hotspots, setHotspots] = useState<HotspotItem[]>([]);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<AddMode>("none");
  const [isPreview, setIsPreview] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  // ─── Add Scene dialog ───
  const [showAddScene, setShowAddScene] = useState(false);
  const [newSceneId, setNewSceneId] = useState("");
  const [newSceneTitle, setNewSceneTitle] = useState("");
  const [newSceneLevel, setNewSceneLevel] = useState("CONCOURSE");

  // ─── Bulk Import dialog ───
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Derived ─────────────────────────────────────────────────────────────
  const currentScene = scenes[selectedSceneIndex] ?? null;
  const selectedHotspot = hotspots.find((h) => h._id === selectedHotspotId) ?? null;
  const otherScenes = scenes.filter((_, i) => i !== selectedSceneIndex);

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
    const [stRes, scRes, spRes] = await Promise.all([
      cmsFetch(`/api/cms/stations/${stationId}`),
      cmsFetch(`/api/cms/virtual-tour/${stationId}`),
      cmsFetch(`/api/cms/spaces/station/${stationId}`),
    ]);
    const stData = await stRes.json();
    const scData: Scene[] = await scRes.json();
    const spData: CommercialSpace[] = spRes.ok ? await spRes.json() : [];
    setStation({ id: stData.id, name: stData.name, slug: stData.slug });
    setScenes(scData);
    setStationSpaces(spData);
    if (scData.length > 0) {
      const idx = keepIndex !== undefined && keepIndex < scData.length ? keepIndex : 0;
      setSelectedSceneIndex(idx);
      setHotspots(sceneToHotspots(scData[idx]));
    } else {
      setHotspots([]);
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
    setSelectedHotspotId(null);
    setAddMode("none");
    setHasUnsaved(false);
  }

  // ─── Scene reorder ────────────────────────────────────────────────────────
  async function moveScene(index: number, dir: "up" | "down") {
    const swapIdx = dir === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= scenes.length) return;

    const a = scenes[index];
    const b = scenes[swapIdx];
    const activeSceneId = scenes[selectedSceneIndex]?.sceneId;

    // Swap order values
    const orders = [
      { sceneId: a.sceneId, order: b.order },
      { sceneId: b.sceneId, order: a.order },
    ];

    try {
      const res = await cmsFetch(`/api/cms/virtual-tour/${stationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders }),
      });
      if (!res.ok) return;

      // Reload dan restore index scene yang sedang aktif
      const [stRes, scRes] = await Promise.all([
        cmsFetch(`/api/cms/stations/${stationId}`),
        cmsFetch(`/api/cms/virtual-tour/${stationId}`),
      ]);
      const stData = await stRes.json();
      const scData: Scene[] = await scRes.json();
      setStation({ id: stData.id, name: stData.name, slug: stData.slug });
      setScenes(scData);
      setHasUnsaved(false);

      const newIdx = scData.findIndex((s) => s.sceneId === activeSceneId);
      const finalIdx = Math.max(0, newIdx);
      setSelectedSceneIndex(finalIdx);
      if (scData[finalIdx]) setHotspots(sceneToHotspots(scData[finalIdx]));
    } catch {
      showToast("err", "Gagal mengubah urutan");
    }
  }

  // ─── Canvas handlers ─────────────────────────────────────────────────────
  const handleHotspotAdd = useCallback(
    (yaw: number, pitch: number) => {
      const type = addMode === "scene" ? "scene" : addMode === "space" ? "space" : "info";
      const newH: HotspotItem = {
        _id: tempId(),
        yaw,
        pitch,
        type,
        text:
          type === "scene" ? "Scene baru" : type === "space" ? "Unit baru" : "Info baru",
        ...(type === "info" ? { description: "" } : {}),
      };
      setHotspots((prev) => [...prev, newH]);
      setSelectedHotspotId(newH._id);
      setAddMode("none");
      setHasUnsaved(true);
    },
    [addMode]
  );

  function previewNavigateScene(sceneId: string) {
    const updatedScenes = scenes.map((s, i) =>
      i === selectedSceneIndex ? { ...s, hotspots: hotspotsToSave(hotspots) } : s
    );
    const idx = updatedScenes.findIndex((s) => s.sceneId === sceneId);
    if (idx < 0) return;
    setScenes(updatedScenes);
    setSelectedSceneIndex(idx);
    setHotspots(sceneToHotspots(updatedScenes[idx]));
    setSelectedHotspotId(null);
  }

  const handleHotspotMove = useCallback((id: string, yaw: number, pitch: number) => {
    setHotspots((prev) =>
      prev.map((h) => (h._id === id ? { ...h, yaw, pitch } : h))
    );
    setHasUnsaved(true);
  }, []);

  const handleHotspotSelect = useCallback((id: string | null) => {
    setSelectedHotspotId(id);
  }, []);

  const handleHotspotDelete = useCallback((id: string) => {
    setHotspots((prev) => prev.filter((h) => h._id !== id));
    setSelectedHotspotId((sel) => (sel === id ? null : sel));
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
            order: currentScene.order,
            isActive: currentScene.isActive,
            hotspots: hotspotsToSave(hotspots),
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
  async function addScene(e: React.FormEvent) {
    e.preventDefault();
    if (!newSceneId.trim() || !newSceneTitle.trim()) return;

    // Pastikan sceneId tidak duplikat
    if (scenes.some((s) => s.sceneId === newSceneId.trim())) {
      showToast("err", `Scene ID "${newSceneId}" sudah ada`);
      return;
    }

    const res = await cmsFetch(`/api/cms/virtual-tour/${stationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sceneId: newSceneId.trim(),
        title: newSceneTitle.trim(),
        level: newSceneLevel,
        order: scenes.length,
      }),
    });
    if (res.ok) {
      setShowAddScene(false);
      setNewSceneId("");
      setNewSceneTitle("");
      setNewSceneLevel("CONCOURSE");
      showToast("ok", "Scene ditambahkan");
      load();
    } else {
      showToast("err", "Gagal tambah scene");
    }
  }

  // ─── Add scene dialog: auto-generate sceneId ─────────────────────────────
  function handleNewSceneLevelChange(level: string) {
    setNewSceneLevel(level);
    // Hanya auto-generate jika belum diisi manual atau masih hasil auto
    const suggestedId = suggestSceneId(level, scenes);
    setNewSceneId(suggestedId);
  }

  function handleNewSceneTitleChange(title: string) {
    setNewSceneTitle(title);
    // Auto-generate sceneId dari judul jika belum pernah diisi
    if (title) {
      const base = titleToId(title) || suggestSceneId(newSceneLevel, scenes);
      setNewSceneId(base.substring(0, 40));
    }
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

    const rows: BulkRow[] = files.map((file, i) => {
      const level = "CONCOURSE";
      const baseCount = scenes.length + i + 1;
      const sceneId = `${level.toLowerCase()}-${String(baseCount).padStart(2, "0")}`;
      const title = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ");
      return {
        key: `${file.name}-${i}`,
        file,
        sceneId,
        title,
        level,
        status: "pending",
      };
    });
    setBulkRows(rows);
  }

  function updateBulkRow(key: string, field: keyof BulkRow, value: string) {
    setBulkRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
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
          level: row.level,
          order: scenes.length + bulkRows.indexOf(row),
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

  // ─── Group scenes by level ─────────────────────────────────────────────────
  const scenesByLevel = SCENE_LEVELS.map((level) => ({
    ...level,
    scenes: scenes
      .map((scene, index) => ({ scene, index }))
      .filter(({ scene }) => (scene.level ?? "CONCOURSE") === level.value),
  })).filter((group) => group.scenes.length > 0);

  // ─── Scene list sorted within level by order ───────────────────────────────
  const scenesByLevelSorted = scenesByLevel.map((group) => ({
    ...group,
    scenes: [...group.scenes].sort((a, b) => a.scene.order - b.scene.order),
  }));

  // ─── Other scenes grouped by level for hotspot picker ─────────────────────
  const otherScenesByLevel = SCENE_LEVELS.map((level) => ({
    ...level,
    scenes: otherScenes.filter((s) => (s.level ?? "CONCOURSE") === level.value),
  })).filter((group) => group.scenes.length > 0);

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
                style={{ color: getLevelConfig(currentScene.level).color }}
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

        {/* ── Left: Scene List ─────────────────────────────────── */}
        <aside className="w-60 bg-slate-900 border-r border-slate-800 flex flex-col flex-none overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800 gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Scenes</span>
              <span className="text-xs text-slate-600">({scenes.length})</span>
            </div>
            <div className="flex items-center gap-1">
              {/* Bulk import */}
              <button
                onClick={() => {
                  setBulkRows([]);
                  setShowBulkImport(true);
                }}
                className="text-slate-500 hover:text-sky-400 transition-colors p-0.5"
                title="Bulk import panorama"
              >
                <Package className="h-3.5 w-3.5" />
              </button>
              {/* Add single scene */}
              <button
                onClick={() => {
                  setNewSceneLevel("CONCOURSE");
                  setNewSceneId(suggestSceneId("CONCOURSE", scenes));
                  setNewSceneTitle("");
                  setShowAddScene(true);
                }}
                className="text-emerald-400 hover:text-emerald-300 transition-colors p-0.5"
                title="Tambah scene"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {scenesByLevelSorted.map((group) => (
              <section key={group.value}>
                <div className="mb-1.5 flex items-center gap-2 px-1">
                  <span
                    className="w-2 h-2 rounded-full flex-none"
                    style={{ background: group.color }}
                  />
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: group.color }}>
                      {group.label}
                    </p>
                    <p className="text-[10px] text-slate-500">{group.scenes.length} scene</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {group.scenes.map(({ scene, index }, posInGroup) => {
                    const isSelected = index === selectedSceneIndex;
                    const incomingCount = incomingMap.get(scene.sceneId) ?? 0;
                    const outgoingCount = (scene.hotspots ?? []).filter((h) => h.type === "scene").length;
                    const firstInLevel = posInGroup === 0;
                    const lastInLevel = posInGroup === group.scenes.length - 1;

                    return (
                      <div
                        key={scene.id}
                        className={`group relative rounded-lg cursor-pointer border transition-all ${
                          isSelected
                            ? "border-emerald-500/50 bg-emerald-600/10 text-white"
                            : "border-slate-700/50 hover:bg-slate-800 text-slate-300"
                        }`}
                        onClick={() => selectScene(index)}
                      >
                        {/* Thumbnail — pakai thumbnailUrl (ringan) jika ada, fallback panoramaUrl */}
                        {(scene.thumbnailUrl || scene.panoramaUrl) ? (
                          <div className="relative h-14 rounded-t-lg overflow-hidden bg-slate-800">
                            <Image
                              src={getS3ProxyUrl(scene.thumbnailUrl || scene.panoramaUrl)}
                              alt={scene.title}
                              fill
                              className="object-cover opacity-70"
                              unoptimized
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                          </div>
                        ) : (
                          <div className="h-9 rounded-t-lg bg-slate-800/60 flex items-center justify-center">
                            <ImageIcon className="h-3.5 w-3.5 text-slate-600" />
                          </div>
                        )}

                        <div className="px-2.5 py-2">
                          <p className="font-medium text-xs leading-tight">{scene.title}</p>
                          <p className="text-slate-500 text-[10px] font-mono mt-0.5">{scene.sceneId}</p>

                          {/* Connection stats */}
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
                            <span className="flex items-center gap-0.5" title="Hotspot keluar (outgoing)">
                              <ArrowRightLeft className="h-2.5 w-2.5" />
                              {outgoingCount}
                            </span>
                            <span className="flex items-center gap-0.5" title="Ditautkan dari scene lain (incoming)">
                              <Link2 className="h-2.5 w-2.5" />
                              {incomingCount}
                            </span>
                            {!scene.isActive && (
                              <span className="ml-auto text-orange-400 font-medium">Off</span>
                            )}
                          </div>
                        </div>

                        {/* Reorder & delete buttons */}
                        <div className="absolute right-1 top-1 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveScene(index, "up");
                            }}
                            disabled={firstInLevel}
                            className="p-0.5 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                            title="Pindah ke atas"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveScene(index, "down");
                            }}
                            disabled={lastInLevel}
                            className="p-0.5 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                            title="Pindah ke bawah"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteScene(scene);
                            }}
                            className="p-0.5 rounded bg-red-900/80 hover:bg-red-600 text-red-300 mt-0.5"
                            title="Hapus scene"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Quick add button per level */}
                  <button
                    onClick={() => {
                      setNewSceneLevel(group.value);
                      setNewSceneId(suggestSceneId(group.value, scenes));
                      setNewSceneTitle("");
                      setShowAddScene(true);
                    }}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] text-slate-600 hover:text-emerald-400 hover:bg-slate-800/50 transition-colors border border-dashed border-slate-800 hover:border-emerald-800"
                  >
                    <Plus className="h-3 w-3" />
                    Tambah scene {group.label}
                  </button>
                </div>
              </section>
            ))}

            {scenes.length === 0 && (
              <div className="py-8 text-center text-slate-600 text-xs">
                <p>Belum ada scene.</p>
                <button
                  onClick={() => {
                    setNewSceneLevel("CONCOURSE");
                    setNewSceneId(suggestSceneId("CONCOURSE", scenes));
                    setNewSceneTitle("");
                    setShowAddScene(true);
                  }}
                  className="mt-2 text-emerald-400 hover:underline"
                >
                  + Tambah scene
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ── Center: Canvas / Preview ─────────────────────────────── */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {currentScene ? (
            isPreview ? (
              <PannellumPreview
                key={`preview-${currentScene.sceneId}-${hotspots.length}`}
                panoramaUrl={currentScene.panoramaUrl}
                hotspots={hotspots}
                sceneName={currentScene.title}
                scenes={scenes.map((s) => ({ sceneId: s.sceneId, title: s.title }))}
                spaces={stationSpaces}
                stationName={station?.name ?? ""}
                onSceneNavigate={previewNavigateScene}
              />
            ) : (
              /* Edit — Pannellum 3D statis (no auto-rotate), klik untuk pasang hotspot */
              <PannellumEditor
                key={`editor-${currentScene.sceneId}`}
                panoramaUrl={currentScene.panoramaUrl}
                hotspots={hotspots}
                selectedId={selectedHotspotId}
                addMode={addMode}
                onHotspotAdd={handleHotspotAdd}
                onHotspotMove={handleHotspotMove}
                onHotspotSelect={handleHotspotSelect}
                onHotspotDelete={handleHotspotDelete}
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
                    <Label className="text-xs text-slate-500 mb-1.5 block">Level Area</Label>
                    <select
                      value={currentScene.level ?? "CONCOURSE"}
                      onChange={(e) => updateSelectedScene("level", e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-md h-8 px-2 text-sm text-slate-100"
                    >
                      {SCENE_LEVELS.map((level) => (
                        <option key={level.value} value={level.value}>
                          {level.label}
                        </option>
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
                      <select
                        value={selectedHotspot.sceneId ?? ""}
                        onChange={(e) => updateHotspot("sceneId", e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-md h-8 px-2 text-sm text-slate-100"
                      >
                        <option value="">— pilih scene —</option>
                        {otherScenesByLevel.map((group) => (
                          <optgroup key={group.value} label={`── ${group.label} ──`}>
                            {group.scenes.map((s) => (
                              <option key={s.sceneId} value={s.sceneId}>
                                {s.title}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      {selectedHotspot.sceneId && (
                        <p className="text-[10px] text-slate-600 font-mono mt-1">
                          → {selectedHotspot.sceneId}
                        </p>
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
                        style={{ background: hotspotColor(h.type) }}
                      >
                        {h.type === "scene" ? "→" : h.type === "space" ? "●" : "i"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-200 truncate">{h.text}</p>
                        {h.type === "scene" && h.sceneId && (
                          <p className="text-[10px] text-slate-500 font-mono truncate">→ {h.sceneId}</p>
                        )}
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
                  <span className="w-4 h-4 rounded-full bg-amber-500 flex-none" />
                  Hotspot unit — buka detail unit
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-blue-500 flex-none" />
                  Hotspot info — modal deskripsi spot
                </li>
                <li className="flex items-center gap-2"><span>🖱️</span> Klik tanpa drag = pasang hotspot</li>
                <li className="flex items-center gap-2"><span>🖱️</span> Drag pin = pindah posisi</li>
                <li className="flex items-center gap-2"><span>⚙️</span> Klik kanan pin = edit/hapus</li>
                <li className="flex items-center gap-2"><span>▲▼</span> Hover scene = reorder</li>
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
                <Label className="text-xs text-slate-400 mb-1.5 block">Level Area</Label>
                <select
                  value={newSceneLevel}
                  onChange={(e) => handleNewSceneLevelChange(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md h-10 px-3 text-sm text-slate-100"
                >
                  {SCENE_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label} — {level.hint}
                    </option>
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
                    <span>Level</span>
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
                        value={row.level}
                        onChange={(e) => updateBulkRow(row.key, "level", e.target.value)}
                        disabled={row.status !== "pending"}
                        className="bg-slate-900 border border-slate-700 rounded h-7 px-1.5 text-xs text-slate-100 min-w-[90px]"
                      >
                        {SCENE_LEVELS.map((l) => (
                          <option key={l.value} value={l.value}>{l.label}</option>
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
