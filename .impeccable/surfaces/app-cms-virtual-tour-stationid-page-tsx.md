---
version: 1
slug: "app-cms-virtual-tour-stationid-page-tsx"
primary_target: "app/cms/virtual-tour/[stationId]/page.tsx"
related_targets: ["app/cms/virtual-tour/[stationId]/SpatialAreaInspector.tsx","app/cms/virtual-tour/[stationId]/EditorToolbar.tsx","app/cms/virtual-tour/[stationId]/UnitPicker.tsx","app/cms/virtual-tour/[stationId]/SceneEntryViewDialog.tsx","app/cms/virtual-tour/[stationId]/PannellumEditor.tsx"]
---

# Virtual tour editor

Mode: Operate.

Internal CMS operators place and edit scene links, unit pins, Spatial polygons, and privacy blur on a panorama. The canvas is the working area; inspector controls should stay scannable during repeated edits.

Keep the incumbent maroon identity and existing editor interactions. Keep Unit Pin/Spatial, per-face editing, shared unit labels, camera arrival settings, undo/redo, Save, and Publish Area.

Prefer short action labels and actual state over instructional paragraphs. Show errors and incomplete drawing requirements immediately. Place keyboard guidance and Save/Publish semantics in one discoverable Help disclosure. Collapse appearance settings, asset details, and the search/filter list for an already selected unit until requested. Keep empty states brief and useful.

Do not hide errors, essential selection state, or publish consequences behind decorative labels. No new claims, data changes, commits, or deployment are part of this UI refinement.
