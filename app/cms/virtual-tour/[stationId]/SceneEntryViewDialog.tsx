"use client";

import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SceneInitialView } from "@/lib/tour-types";
import { PANNELLUM_HFOV } from "@/lib/pannellum-viewer-defaults";
import { PannellumEditor, type PannellumEditorHandle } from "./PannellumEditor";

const noop = () => {};

export type SceneEntryViewSelection = {
  hotspotId: string;
  sourceTitle: string;
  sceneId: string;
  title: string;
  panoramaUrl: string;
  initialView: SceneInitialView;
  incoming?: { sourceId: string; index: number; yaw: number; pitch: number; previousView: SceneInitialView | null };
};

export function SceneEntryViewDialog({ selection, onClose, onApply, onReset }: {
  selection: SceneEntryViewSelection;
  onClose: () => void;
  onApply: (view: SceneInitialView) => void | Promise<void>;
  onReset?: () => Promise<void>;
}) {
  const editorRef = useRef<PannellumEditorHandle>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(action: () => void | Promise<void>) {
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Gagal menyimpan arah tiba.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-5xl flex-col overflow-hidden border border-[var(--work-line)] bg-[var(--work-subtle)] p-4 text-[var(--work-text)] sm:p-5">
        <div className="pr-8">
          <DialogTitle>Arah kamera saat tiba</DialogTitle>
          <DialogDescription className="mt-2 text-[var(--work-muted)]">
            {selection.sourceTitle} → {selection.title}. Geser panorama untuk menentukan arah tiba.
          </DialogDescription>
        </div>
        <div className="relative flex h-[52dvh] min-h-48 overflow-hidden rounded-xl border border-[var(--work-line)]" data-scene-entry-camera>
          <PannellumEditor
            ref={editorRef}
            panoramaUrl={selection.panoramaUrl}
            initialView={selection.initialView}
            minHfov={PANNELLUM_HFOV.minHfov}
            hotspots={[]}
            privacyBlurs={[]}
            selectedId={null}
            selectedBlurId={null}
            addMode="pan"
            onHotspotAdd={noop}
            onBlurAdd={noop}
            onHotspotMove={noop}
            onBlurMove={noop}
            onHotspotSelect={noop}
            onBlurSelect={noop}
            onHotspotDelete={noop}
            onBlurDelete={noop}
          />
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="h-5 w-5 rounded-full border-2 border-white/90 shadow-[0_0_0_1px_#0008]" />
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-[var(--work-danger)]">{error}</p>}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {onReset && (
            <Button type="button" variant="outline" disabled={saving} onClick={() => void submit(onReset)}>
              Pakai arah bawaan
            </Button>
          )}
          <Button disabled={saving} variant="ghost" className="text-[var(--work-muted)] hover:bg-[var(--work-surface)] hover:text-[var(--work-text)]" onClick={onClose}>Batal</Button>
          <Button disabled={saving} onClick={() => {
            const view = editorRef.current?.getView();
            if (!view) { setError("Tunggu panorama selesai dimuat."); return; }
            void submit(() => onApply(view));
          }}>{saving ? "Menyimpan…" : selection.incoming ? "Simpan arah tiba" : "Gunakan arah ini"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
