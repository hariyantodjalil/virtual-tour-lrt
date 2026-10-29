"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import type { HotspotItem } from "@/lib/hotspot-types";
import {
  HOTSPOT_SCALE_DEFAULT,
  HOTSPOT_SCALE_MIN,
  HOTSPOT_SCALE_MAX,
  hotspotColor,
  hotspotLabel,
  DIRECTION_COMPASS,
  DIRECTION_LABELS,
  DIRECTION_ROTATE_DEG,
  type HotspotDirection,
} from "@/lib/hotspot-types";
import {
  findSpaceStatus,
  spaceStatusColor,
  type SpaceAvailabilityStatus,
} from "@/lib/space-availability";
import {
  FACILITY_ICONS,
  type FacilityIconId,
} from "@/lib/facility-icons";
import {
  BLUR_HEIGHT_DEFAULT,
  BLUR_INTENSITY_DEFAULT,
  BLUR_INTENSITY_MAX,
  BLUR_INTENSITY_MIN,
  BLUR_RADIUS_DEFAULT,
  BLUR_RADIUS_MIN,
  BLUR_SCALE_DEFAULT,
  BLUR_SCALE_MAX,
  BLUR_SCALE_MIN,
  BLUR_WIDTH_DEFAULT,
  type PrivacyBlurItem,
} from "@/lib/privacy-blur-types";
import type { TourLevel } from "@/lib/virtual-tour-structure";
import {
  ImageIcon,
  Link2,
  Loader2,
  Trash2,
  Unlink,
  Upload,
} from "lucide-react";
import { SceneTargetPicker } from "../virtual-tour/[stationId]/SceneTargetPicker";
import { TrainRentalPicker, type TrainRentalPickerItem } from "./TrainRentalPicker";
import { CoveragePanel } from "../virtual-tour/[stationId]/CoveragePanel";

type Scene = {
  sceneId: string;
  title: string;
  level: string;
  levelId?: string | null;
  areaId?: string | null;
  order: number;
  panoramaUrl: string;
  hotspots: Omit<HotspotItem, "_id">[];
};

type TrainEditorSpace = TrainRentalPickerItem & {
  type: "TRAIN_RENTAL";
};

type Props = {
  currentScene: Scene;
  levels: TourLevel[];
  scenes: Scene[];
  hotspots: HotspotItem[];
  privacyBlurs: PrivacyBlurItem[];
  rentalSpaces: TrainEditorSpace[];
  selectedHotspot: HotspotItem | null;
  selectedBlur: PrivacyBlurItem | null;
  selectedHotspotId: string | null;
  selectedBlurId: string | null;
  selectedBlurRadiusMax: number;
  blurSizeLinked: boolean;
  uploading: boolean;
  uploadingCreative: boolean;
  bakingPrivacyBlur: boolean;
  privacyBlurGuideOnly: boolean;
  getLevelConfig: (slug: string | undefined, levels: TourLevel[]) => { label: string; color: string };
  onSceneTitleChange: (title: string) => void;
  onSceneAreaChange: (areaId: string) => void;
  onSceneOrderChange: (order: number) => void;
  onUploadPanorama: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteScene: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  creativeInputRef: React.RefObject<HTMLInputElement | null>;
  onHotspotDelete: (id: string) => void;
  onBlurDelete: (id: string) => void;
  onHotspotSelect: (id: string) => void;
  onBlurSelect: (id: string) => void;
  updateHotspot: (field: keyof HotspotItem, value: string | number | undefined) => void;
  assignHotspotSpace: (code: string, name: string) => void;
  uploadAdCreative: (e: React.ChangeEvent<HTMLInputElement>) => void;
  updateBlur: (field: keyof PrivacyBlurItem, value: number) => void;
  updateBlurSize: (field: "width" | "height", value: number) => void;
  setBlurSizeLinked: (linked: boolean) => void;
  bakePrivacyBlurs: () => void;
  jumpToHotspot: (sceneId: string, hotspotIndex: number) => void;
};

export function TrainTourEditorSidebar({
  currentScene,
  levels,
  scenes,
  hotspots,
  privacyBlurs,
  rentalSpaces,
  selectedHotspot,
  selectedBlur,
  selectedHotspotId,
  selectedBlurId,
  selectedBlurRadiusMax,
  blurSizeLinked,
  uploading,
  uploadingCreative,
  bakingPrivacyBlur,
  privacyBlurGuideOnly,
  getLevelConfig,
  onSceneTitleChange,
  onSceneAreaChange,
  onSceneOrderChange,
  onUploadPanorama,
  onDeleteScene,
  fileInputRef,
  creativeInputRef,
  onHotspotDelete,
  onBlurDelete,
  onHotspotSelect,
  onBlurSelect,
  updateHotspot,
  assignHotspotSpace,
  uploadAdCreative,
  updateBlur,
  updateBlurSize,
  setBlurSizeLinked,
  bakePrivacyBlurs,
  jumpToHotspot,
}: Props) {
  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-l border-[rgba(255,214,218,0.14)] bg-[#261015] text-[#F8ECEE]">
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
        <section>
          <h3 className="mb-3 border-b border-[rgba(255,214,218,0.14)] pb-2 text-xs font-semibold uppercase tracking-wider text-[#C4A8AD]">
            Scene
          </h3>
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 block text-xs text-[#A88990]">Judul</Label>
              <Input
                value={currentScene.title}
                onChange={(e) => onSceneTitleChange(e.target.value)}
                className="h-8 border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] text-sm text-[#F8ECEE]"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-[#A88990]">Scene ID</Label>
              <Input
                value={currentScene.sceneId}
                readOnly
                className="h-8 border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] font-mono text-xs text-[#C4A8AD]"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-[#A88990]">Gerbong</Label>
              <p
                className="rounded-md border border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] px-2 py-1.5 text-sm font-medium"
                style={{ color: getLevelConfig(currentScene.level, levels).color }}
              >
                {getLevelConfig(currentScene.level, levels).label}
              </p>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-[#A88990]">Zona</Label>
              <select
                value={currentScene.areaId ?? ""}
                onChange={(e) => onSceneAreaChange(e.target.value)}
                className="h-8 w-full rounded-md border border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] px-2 text-sm text-[#F8ECEE]"
              >
                <option value="">— pilih zona —</option>
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
              <Label className="text-xs text-[#A88990]">Urutan</Label>
              <Input
                type="number"
                min={0}
                value={currentScene.order}
                onChange={(e) => onSceneOrderChange(Number(e.target.value))}
                className="h-8 w-20 border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] text-xs"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-[#A88990]">Panorama 360°</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onUploadPanorama}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full border-[rgba(255,214,218,0.18)]"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-1 h-4 w-4" />
                )}
                {currentScene.panoramaUrl ? "Ganti Panorama" : "Upload Panorama"}
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="w-full text-red-400 hover:text-red-300"
              onClick={onDeleteScene}
            >
              <Trash2 className="mr-1 h-4 w-4" /> Hapus Scene
            </Button>
          </div>
        </section>

        {selectedBlur && (
          <section>
            <div className="mb-3 flex items-center justify-between border-b border-[rgba(255,214,218,0.14)] pb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#C4A8AD]">Blur Privasi</h3>
              <button
                type="button"
                onClick={() => onBlurDelete(selectedBlur._id)}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label className="text-xs text-[#A88990]">Ukuran</Label>
                  <button
                    type="button"
                    onClick={() => setBlurSizeLinked(!blurSizeLinked)}
                    className="text-[#A88990] hover:text-[#F0DDE1]"
                    title={blurSizeLinked ? "Proporsi terkunci" : "Proporsi bebas"}
                  >
                    {blurSizeLinked ? <Link2 className="h-3.5 w-3.5" /> : <Unlink className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min={24}
                    max={320}
                    value={selectedBlur.width ?? BLUR_WIDTH_DEFAULT}
                    onChange={(e) => updateBlurSize("width", Number(e.target.value))}
                    className="h-8 border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] font-mono text-xs text-[#F8ECEE]"
                  />
                  <Input
                    type="number"
                    min={24}
                    max={320}
                    value={selectedBlur.height ?? BLUR_HEIGHT_DEFAULT}
                    onChange={(e) => updateBlurSize("height", Number(e.target.value))}
                    className="h-8 border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] font-mono text-xs text-[#F8ECEE]"
                  />
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-[#A88990]">Intensitas Blur</Label>
                <input
                  type="range"
                  min={BLUR_INTENSITY_MIN}
                  max={BLUR_INTENSITY_MAX}
                  value={selectedBlur.intensity ?? BLUR_INTENSITY_DEFAULT}
                  onChange={(e) => updateBlur("intensity", Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-[#A88990]">Radius Sudut</Label>
                <input
                  type="range"
                  min={BLUR_RADIUS_MIN}
                  max={selectedBlurRadiusMax}
                  value={Math.min(selectedBlur.radius ?? BLUR_RADIUS_DEFAULT, selectedBlurRadiusMax)}
                  onChange={(e) => updateBlur("radius", Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-[#A88990]">Skala</Label>
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
            </div>
          </section>
        )}

        {selectedHotspot && (
          <section>
            <div className="mb-3 flex items-center justify-between border-b border-[rgba(255,214,218,0.14)] pb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#C4A8AD]">Hotspot</h3>
              <button
                type="button"
                onClick={() => onHotspotDelete(selectedHotspot._id)}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="mb-1.5 block text-xs text-[#A88990]">Tipe</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["scene", "space", "info", "ad"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => updateHotspot("type", t)}
                      className={`rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                        selectedHotspot.type === t
                          ? t === "scene"
                            ? "border-emerald-500 bg-emerald-600 text-white"
                            : t === "space"
                              ? "border-amber-500 bg-amber-600 text-white"
                              : t === "ad"
                                ? "border-purple-500 bg-purple-600 text-white"
                                : "border-blue-500 bg-blue-600 text-white"
                          : "border-[rgba(255,214,218,0.14)] text-[#C4A8AD] hover:bg-[#261015]"
                      }`}
                    >
                      {t === "scene" ? "Scene" : t === "space" ? "Unit" : t === "ad" ? "Iklan" : "Info"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-[#A88990]">Label</Label>
                <Input
                  value={selectedHotspot.text}
                  onChange={(e) => updateHotspot("text", e.target.value)}
                  className="h-8 border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] text-sm text-[#F8ECEE]"
                  placeholder="Contoh: Handgrip Gerbong 2"
                />
              </div>
              {selectedHotspot.type === "scene" ? (
                <>
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
                  <div>
                    <Label className="mb-1.5 block text-xs text-[#A88990]">Arah Panah</Label>
                    <div className="inline-grid grid-cols-3 gap-1 rounded-xl border border-[rgba(255,214,218,0.14)] bg-[#1C0A0E]/60 p-1.5">
                      {DIRECTION_COMPASS.map((d, i) => {
                        if (!d) {
                          return (
                            <div
                              key={`center-${i}`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#261015]/80"
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
                                : "border-transparent text-[#A88990] hover:border-[rgba(255,214,218,0.28)] hover:bg-[#261015]"
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
                  <Label className="mb-1.5 block text-xs text-[#A88990]">Ruang sewa kereta</Label>
                  <TrainRentalPicker
                    spaces={rentalSpaces}
                    value={selectedHotspot.spaceCode}
                    placeholder="Cari handgrip, wall panel, layar…"
                    onChange={(code, space) => assignHotspotSpace(code, space.name)}
                  />
                </div>
              ) : selectedHotspot.type === "ad" ? (
                <>
                  <div>
                    <Label className="mb-1.5 block text-xs text-[#A88990]">Ruang sewa kereta</Label>
                    <TrainRentalPicker
                      spaces={rentalSpaces}
                      value={selectedHotspot.spaceCode}
                      placeholder="Cari handgrip, wall panel, layar…"
                      onChange={(code, space) => assignHotspotSpace(code, space.name)}
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs text-[#A88990]">Judul Kreatif</Label>
                    <Input
                      value={selectedHotspot.creativeTitle ?? ""}
                      onChange={(e) => updateHotspot("creativeTitle", e.target.value)}
                      className="h-8 border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] text-sm text-[#F8ECEE]"
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs text-[#A88990]">Aset Kreatif</Label>
                    {selectedHotspot.creativeUrl && (
                      <div className="relative mb-2 h-24 overflow-hidden rounded-lg bg-[#261015]">
                        <Image
                          src={getS3ProxyUrl(selectedHotspot.creativeUrl)}
                          alt="Kreatif iklan"
                          fill
                          className="object-contain"
                          sizes="240px"
                        />
                      </div>
                    )}
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[rgba(255,214,218,0.18)] p-2 text-xs text-[#C4A8AD] hover:border-purple-500">
                      {uploadingCreative ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      Upload kreatif
                      <input
                        ref={creativeInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={uploadAdCreative}
                        disabled={uploadingCreative}
                      />
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label className="mb-1.5 block text-xs text-[#A88990]">Ikon Hotspot</Label>
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                      <button
                        type="button"
                        title="Informasi"
                        onClick={() => updateHotspot("facilityIcon", undefined)}
                        className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 transition ${
                          !selectedHotspot.facilityIcon
                            ? "border-blue-500 bg-blue-500/15"
                            : "border-[rgba(255,214,218,0.14)] hover:bg-[#261015]"
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
                      </button>
                      {FACILITY_ICONS.map((icon) => {
                        const active = selectedHotspot.facilityIcon === icon.id;
                        return (
                          <button
                            key={icon.id}
                            type="button"
                            title={icon.label}
                            onClick={() => updateHotspot("facilityIcon", icon.id as FacilityIconId)}
                            className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 transition ${
                              active ? "border-blue-500 bg-blue-500/15" : "border-[rgba(255,214,218,0.14)] hover:bg-[#261015]"
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={icon.src} alt={icon.label} width={36} height={39} className="h-[39px] w-9 object-contain" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs text-[#A88990]">Deskripsi Info</Label>
                    <textarea
                      value={selectedHotspot.description ?? ""}
                      onChange={(e) => updateHotspot("description", e.target.value)}
                      rows={4}
                      className="w-full resize-none rounded-md border border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] px-3 py-2 text-sm text-[#F8ECEE]"
                      placeholder="Contoh: Handgrip disewa Le Minerale"
                    />
                  </div>
                </>
              )}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label className="text-xs text-[#A88990]">Ukuran Hotspot</Label>
                  <span className="font-mono text-xs text-[#C4A8AD]">
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
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="mb-1.5 block text-xs text-[#A88990]">Yaw (°)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={selectedHotspot.yaw}
                    onChange={(e) => updateHotspot("yaw", Number(e.target.value))}
                    className="h-8 border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] font-mono text-xs text-[#F8ECEE]"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs text-[#A88990]">Pitch (°)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={selectedHotspot.pitch}
                    onChange={(e) => updateHotspot("pitch", Number(e.target.value))}
                    className="h-8 border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] font-mono text-xs text-[#F8ECEE]"
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {privacyBlurs.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-[rgba(255,214,218,0.14)] pb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#C4A8AD]">
                Blur Privasi ({privacyBlurs.length})
              </h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 border-purple-600/60 px-2 text-[10px] text-purple-300"
                disabled={bakingPrivacyBlur}
                onClick={bakePrivacyBlurs}
              >
                {bakingPrivacyBlur ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <ImageIcon className="mr-1 h-3 w-3" />
                )}
                {privacyBlurGuideOnly ? "Re-bake" : "Bake ke panorama"}
              </Button>
            </div>
            <div className="space-y-1">
              {privacyBlurs.map((b, index) => (
                <div
                  key={b._id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 transition-colors ${
                    b._id === selectedBlurId
                      ? "border-purple-700 bg-purple-950/50"
                      : "border-transparent hover:bg-[#261015]"
                  }`}
                  onClick={() => onBlurSelect(b._id)}
                >
                  <span className="h-4 w-4 flex-none rounded-md border border-purple-500/60 bg-purple-600/40" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-[#F8ECEE]">Blur #{index + 1}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBlurDelete(b._id);
                    }}
                    className="text-[#A88990] hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <CoveragePanel
          spaces={rentalSpaces}
          hideKindFilters
          scenes={scenes.map((s) => ({
            sceneId: s.sceneId,
            title: s.title,
            hotspots: s.sceneId === currentScene.sceneId ? hotspots.map(({ _id: _omit, ...rest }) => rest) : s.hotspots,
          }))}
          currentHotspots={hotspots}
          currentSceneId={currentScene.sceneId}
          onJumpTo={jumpToHotspot}
        />

        {hotspots.length > 0 && (
          <section className="space-y-4">
            <h3 className="border-b border-[rgba(255,214,218,0.14)] pb-2 text-xs font-semibold uppercase tracking-wider text-[#C4A8AD]">
              Hotspot ({hotspots.length})
            </h3>
            {(["scene", "space", "ad", "info"] as const).map((type) => {
              const items = hotspots.filter((h) => h.type === type);
              if (items.length === 0) return null;
              return (
                <div key={type}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#A88990]">
                    {hotspotLabel(type)} ({items.length})
                  </p>
                  <div className="space-y-1">
                    {items.map((h) => (
                      <div
                        key={h._id}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 transition-colors ${
                          h._id === selectedHotspotId
                            ? "border-[rgba(255,214,218,0.18)] bg-[#3A161C]"
                            : "border-transparent hover:bg-[#261015]"
                        }`}
                        onClick={() => onHotspotSelect(h._id)}
                      >
                        <span
                          className="flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] text-white"
                          style={{
                            background:
                              h.type === "space" && h.spaceCode
                                ? spaceStatusColor(findSpaceStatus(rentalSpaces, h.spaceCode))
                                : hotspotColor(h.type),
                          }}
                        >
                          {h.type === "scene" ? "›" : h.type === "space" ? "●" : h.type === "ad" ? "📢" : "i"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs text-[#F8ECEE]">{h.text}</p>
                          {h.type === "scene" && h.sceneId && (
                            <p className="truncate text-[10px] text-[#A88990]">
                              → {scenes.find((s) => s.sceneId === h.sceneId)?.title ?? h.sceneId}
                            </p>
                          )}
                          {h.type === "space" && h.spaceCode && (
                            <p className="truncate font-mono text-[10px] text-[#A88990]">{h.spaceCode}</p>
                          )}
                          {h.type === "ad" && h.spaceCode && (
                            <p className="truncate text-[10px] font-mono text-[#A88990]">
                              {h.spaceCode}
                              {h.creativeTitle ? ` · ${h.creativeTitle}` : ""}
                            </p>
                          )}
                          <p className="font-mono text-[10px] text-[#A88990]">
                            {h.yaw.toFixed(1)}°, {h.pitch.toFixed(1)}°
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onHotspotDelete(h._id);
                          }}
                          className="text-[#A88990] transition-colors hover:text-red-400"
                          title="Hapus hotspot"
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
      </div>
    </aside>
  );
}
