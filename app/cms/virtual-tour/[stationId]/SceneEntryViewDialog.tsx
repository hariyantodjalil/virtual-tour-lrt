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
};

export function SceneEntryViewDialog({ selection, onClose, onApply }: {
  selection: SceneEntryViewSelection;
  onClose: () => void;
  onApply: (view: SceneInitialView) => void;
}) {
  const editorRef = useRef<PannellumEditorHandle>(null);
  const [error, setError] = useState("");
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-5xl flex-col overflow-hidden border border-[rgba(255,214,218,0.18)] bg-[#261015] p-4 text-[#F8ECEE] sm:p-5">
        <div className="pr-8">
          <DialogTitle>Arah kamera saat tiba</DialogTitle>
          <DialogDescription className="mt-2 text-[#C4A8AD]">
            {selection.sourceTitle} → {selection.title}. Geser panorama untuk menentukan arah tiba.
          </DialogDescription>
        </div>
        <div className="relative flex h-[52dvh] min-h-48 overflow-hidden rounded-xl border border-[rgba(255,214,218,0.18)]" data-scene-entry-camera>
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
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" className="text-[#C4A8AD] hover:bg-[#3A161C] hover:text-[#F8ECEE]" onClick={onClose}>Batal</Button>
          <Button onClick={() => {
            const view = editorRef.current?.getView();
            if (!view) { setError("Tunggu panorama selesai dimuat."); return; }
            onApply(view);
          }}>Gunakan arah ini</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
