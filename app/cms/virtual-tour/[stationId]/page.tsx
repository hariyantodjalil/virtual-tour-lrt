"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getS3ProxyUrl } from "@/lib/s3-utils";
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
} from "lucide-react";

import { PanoramaCanvas, type AddMode, type HotspotItem } from "./PanoramaCanvas";
import { PannellumPreview } from "./PannellumPreview";

// ─── Types ──────────────────────────────────────────────────────────────────

type Scene = {
  id: string;
  sceneId: string;
  title: string;
  panoramaUrl: string;
  order: number;
  hotspots: Omit<HotspotItem, "_id">[];
  isActive: boolean;
};

type Station = {
  id: string;
  name: string;
};

let _tempId = 0;
function tempId() {
  return `hs-${Date.now()}-${++_tempId}`;
}

function sceneToHotspots(scene: Scene): HotspotItem[] {
  return (scene.hotspots || []).map((h, i) => ({
    ...h,
    _id: `hs-${i}-${Date.now()}`,
  }));
}

function hotspotsToSave(hs: HotspotItem[]): Omit<HotspotItem, "_id">[] {
  return hs.map(({ _id: _, ...rest }) => rest);
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function VirtualTourEditorPage() {
  const { stationId } = useParams<{ stationId: string }>();

  const [station, setStation] = useState<Station | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [hotspots, setHotspots] = useState<HotspotItem[]>([]);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<AddMode>("none");
  const [isPreview, setIsPreview] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  // ─── Add Scene dialog state ───
  const [showAddScene, setShowAddScene] = useState(false);
  const [newSceneId, setNewSceneId] = useState("");
  const [newSceneTitle, setNewSceneTitle] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Derived ─────────────────────────────────────────────────────────────
  const currentScene = scenes[selectedSceneIndex] ?? null;
  const selectedHotspot = hotspots.find((h) => h._id === selectedHotspotId) ?? null;

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function showToast(type: "ok" | "err", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  // ─── Load data ───────────────────────────────────────────────────────────

  async function load() {
    const [stRes, scRes] = await Promise.all([
      fetch(`/api/cms/stations/${stationId}`),
      fetch(`/api/cms/virtual-tour/${stationId}`),
    ]);
    const stData = await stRes.json();
    const scData: Scene[] = await scRes.json();
    setStation({ id: stData.id, name: stData.name });
    setScenes(scData);
    if (scData.length > 0) {
      setSelectedSceneIndex(0);
      setHotspots(sceneToHotspots(scData[0]));
    }
    setHasUnsaved(false);
  }

  useEffect(() => {
    load();
  }, [stationId]); // eslint-disable-line

  // ─── Scene selection ─────────────────────────────────────────────────────

  function selectScene(index: number) {
    if (hasUnsaved) {
      if (!confirm("Ada perubahan yang belum disimpan. Pindah scene tanpa menyimpan?")) return;
    }
    setSelectedSceneIndex(index);
    setHotspots(sceneToHotspots(scenes[index]));
    setSelectedHotspotId(null);
    setAddMode("none");
    setHasUnsaved(false);
  }

  // ─── Canvas handlers ─────────────────────────────────────────────────────

  const handleHotspotAdd = useCallback(
    (yaw: number, pitch: number) => {
      const newH: HotspotItem = {
        _id: tempId(),
        yaw,
        pitch,
        type: addMode === "scene" ? "scene" : "space",
        text: addMode === "scene" ? "Scene baru" : "Unit baru",
      };
      setHotspots((prev) => [...prev, newH]);
      setSelectedHotspotId(newH._id);
      setAddMode("none");
      setHasUnsaved(true);
    },
    [addMode]
  );

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
      const res = await fetch(
        `/api/cms/virtual-tour/${stationId}/${currentScene.sceneId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: currentScene.title,
            order: currentScene.order,
            isActive: currentScene.isActive,
            hotspots: hotspotsToSave(hotspots),
          }),
        }
      );
      if (res.ok) {
        showToast("ok", "Scene disimpan");
        setHasUnsaved(false);
        load();
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
      const res = await fetch(
        `/api/cms/virtual-tour/${stationId}/${currentScene.sceneId}`,
        { method: "POST", body: fd }
      );
      if (res.ok) {
        showToast("ok", "Panorama diupload");
        load();
      } else {
        showToast("err", "Upload gagal");
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
    const res = await fetch(`/api/cms/virtual-tour/${stationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sceneId: newSceneId.trim(),
        title: newSceneTitle.trim(),
        order: scenes.length,
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

  // ─── Delete scene ─────────────────────────────────────────────────────────

  async function deleteScene(scene: Scene) {
    if (!confirm(`Hapus scene "${scene.title}"?`)) return;
    const res = await fetch(`/api/cms/virtual-tour/${stationId}/${scene.sceneId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      showToast("ok", "Scene dihapus");
      load();
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

  // ─── Render ──────────────────────────────────────────────────────────────

  const otherScenes = scenes.filter((_, i) => i !== selectedSceneIndex);

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] -mx-6 -mb-6 mt-0 overflow-hidden">
      {/* ── Top Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 flex-none">
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
              <span className="text-emerald-400 text-sm font-medium truncate">
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
              addMode === "none"
                ? "bg-slate-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => setAddMode("none")}
            title="Mode Seleksi"
          >
            <MousePointer className="h-3.5 w-3.5" />
            Pilih
          </button>
          <button
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              addMode === "scene"
                ? "bg-emerald-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => setAddMode((m) => (m === "scene" ? "none" : "scene"))}
            title="Tambah hotspot scene"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            + Scene
          </button>
          <button
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              addMode === "space"
                ? "bg-amber-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => setAddMode((m) => (m === "space" ? "none" : "space"))}
            title="Tambah hotspot unit"
          >
            <Store className="h-3.5 w-3.5" />
            + Unit
          </button>
        </div>

        <div className="h-5 w-px bg-slate-700" />

        {/* Preview toggle */}
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
          {isPreview ? "Edit" : "Preview"}
        </button>

        {/* Unsaved indicator */}
        {hasUnsaved && (
          <span className="text-xs text-amber-400 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" /> Belum disimpan
          </span>
        )}

        {/* Save button */}
        <Button
          size="sm"
          onClick={saveScene}
          disabled={saving || !currentScene}
          className="bg-emerald-600 hover:bg-emerald-500 shrink-0"
        >
          {saving ? (
            <span className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
              Menyimpan…
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

        {/* ── Left: Scene List ─────────────────────────────────────── */}
        <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col flex-none overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Scenes</span>
            <button
              onClick={() => setShowAddScene(true)}
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
              title="Tambah scene"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {scenes.map((scene, index) => (
              <div
                key={scene.id}
                className={`group relative rounded-lg cursor-pointer border transition-all ${
                  index === selectedSceneIndex
                    ? "border-emerald-500/50 bg-emerald-600/10 text-white"
                    : "border-slate-700/50 hover:bg-slate-800 text-slate-300"
                }`}
                onClick={() => selectScene(index)}
              >
                {/* Thumbnail */}
                {scene.panoramaUrl && (
                  <div className="relative h-16 rounded-t-lg overflow-hidden bg-slate-800">
                    <Image
                      src={getS3ProxyUrl(scene.panoramaUrl)}
                      alt={scene.title}
                      fill
                      className="object-cover opacity-70"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  </div>
                )}
                <div className="p-2.5">
                  <p className="font-medium text-xs leading-tight">{scene.title}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{scene.sceneId}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-slate-500 text-xs">
                      {(scene.hotspots ?? []).length} hs
                    </span>
                    {!scene.isActive && (
                      <span className="text-xs text-orange-400">Off</span>
                    )}
                  </div>
                </div>
                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteScene(scene);
                  }}
                  className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 rounded bg-red-900/80 hover:bg-red-600 text-red-300 transition-all"
                  title="Hapus scene"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}

            {scenes.length === 0 && (
              <div className="py-8 text-center text-slate-600 text-xs">
                <p>Belum ada scene.</p>
                <button
                  onClick={() => setShowAddScene(true)}
                  className="mt-2 text-emerald-400 hover:underline"
                >
                  + Tambah scene
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ── Center: Canvas / Preview ─────────────────────────────── */}
        <div className="flex-1 min-w-0 relative flex flex-col overflow-hidden">
          {currentScene ? (
            isPreview ? (
              <PannellumPreview
                key={`preview-${currentScene.sceneId}-${hotspots.length}`}
                panoramaUrl={currentScene.panoramaUrl}
                hotspots={hotspots}
                sceneName={currentScene.title}
              />
            ) : (
              <PanoramaCanvas
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
                    <label
                      className={`flex items-center gap-2 cursor-pointer border border-dashed rounded-lg p-2.5 text-xs transition-colors ${
                        uploading
                          ? "border-slate-700 text-slate-600"
                          : "border-slate-600 text-slate-400 hover:border-emerald-500 hover:text-emerald-400"
                      }`}
                    >
                      <Upload className="h-3.5 w-3.5 shrink-0" />
                      {uploading ? "Mengupload…" : "Upload panorama (JPEG/PNG equirectangular)"}
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
                  {/* Type toggle */}
                  <div>
                    <Label className="text-xs text-slate-500 mb-1.5 block">Tipe</Label>
                    <div className="flex gap-1.5">
                      {(["scene", "space"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => updateHotspot("type", t)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            selectedHotspot.type === t
                              ? t === "scene"
                                ? "bg-emerald-600 border-emerald-500 text-white"
                                : "bg-amber-600 border-amber-500 text-white"
                              : "border-slate-700 text-slate-400 hover:bg-slate-800"
                          }`}
                        >
                          {t === "scene" ? "🔀 Scene" : "🏪 Unit"}
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
                      <Label className="text-xs text-slate-500 mb-1.5 block">Target Scene ID</Label>
                      <select
                        value={selectedHotspot.sceneId ?? ""}
                        onChange={(e) => updateHotspot("sceneId", e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-md h-8 px-2 text-sm text-slate-100"
                      >
                        <option value="">— pilih scene —</option>
                        {otherScenes.map((s) => (
                          <option key={s.sceneId} value={s.sceneId}>
                            {s.title} ({s.sceneId})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <Label className="text-xs text-slate-500 mb-1.5 block">Kode Unit</Label>
                      <Input
                        value={selectedHotspot.spaceCode ?? ""}
                        onChange={(e) => updateHotspot("spaceCode", e.target.value)}
                        className="bg-slate-800 border-slate-700 text-slate-100 text-sm h-8 font-mono"
                        placeholder="mis. DUK-01"
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
                        style={{ background: h.type === "scene" ? "#10b981" : "#f59e0b" }}
                      >
                        {h.type === "scene" ? "→" : "●"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-200 truncate">{h.text}</p>
                        <p className="text-xs text-slate-500 font-mono">
                          {h.yaw.toFixed(1)}°, {h.pitch.toFixed(1)}°
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHotspotDelete(h._id);
                        }}
                        className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
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
                  Hotspot unit — buka detail unit komersial
                </li>
                <li className="flex items-center gap-2">
                  <span>🖱️</span>
                  Drag pin = pindah posisi
                </li>
                <li className="flex items-center gap-2">
                  <span>⚙️</span>
                  Klik kanan pin = hapus / edit
                </li>
                <li className="flex items-center gap-2">
                  <span>🔍</span>
                  Scroll = zoom, drag kosong = pan
                </li>
              </ul>
            </section>
          </div>
        </aside>
      </div>

      {/* ── Add Scene Dialog ─────────────────────────────────────────────── */}
      {showAddScene && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="font-bold text-slate-100 mb-5">Tambah Scene Baru</h2>
            <form onSubmit={addScene} className="space-y-4">
              <div>
                <Label className="text-xs text-slate-400 mb-1.5 block">Scene ID</Label>
                <Input
                  value={newSceneId}
                  onChange={(e) => setNewSceneId(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                  placeholder="contoh: concourse"
                  className="bg-slate-800 border-slate-700 font-mono"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">Huruf kecil, tanpa spasi, boleh pakai tanda -</p>
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1.5 block">Judul Scene</Label>
                <Input
                  value={newSceneTitle}
                  onChange={(e) => setNewSceneTitle(e.target.value)}
                  placeholder="contoh: Concourse Utama"
                  className="bg-slate-800 border-slate-700"
                  required
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-500">
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
