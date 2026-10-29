# Virtual Tour Editor — Phase 0 Audit

> **Status:** Complete (gate Phase 0)  
> **Date:** 2026-10-27  
> **Branch / HEAD:** `dev` @ `2ab8871`  
> **Spec:** `TECHNICAL_SPEC_VIRTUAL_TOUR_EDITOR_V2_SPATIAL_HOTSPOT.md` v1.0

## A. Current architecture and actual file paths

| Layer | Path |
|-------|------|
| CMS layout / rail | `app/cms/layout.tsx`, `app/cms/CmsShell.tsx` |
| Station VT index | `app/cms/virtual-tour/page.tsx` |
| Station editor (monolith) | `app/cms/virtual-tour/[stationId]/page.tsx` (~3k LOC) |
| Scene explorer | `app/cms/virtual-tour/[stationId]/TourStructureSidebar.tsx` |
| Pannellum edit / preview | `…/PannellumEditor.tsx`, `…/PannellumPreview.tsx` |
| Coverage | `…/CoveragePanel.tsx` |
| Shared Pannellum helpers | `lib/pannellum-hotspot.ts`, `lib/pannellum-tour-config.ts`, `lib/pannellum-privacy-blur.ts`, `lib/pannellum-viewer-defaults.ts` |
| Hotspot types | `lib/hotspot-types.ts`, `lib/hotspot-normalize.ts`, `lib/tour-types.ts` |
| Public tour | `app/station/[slug]/page.tsx` → `StationTourClient.tsx` → `components/tour/VirtualTourViewer.tsx` |
| Train editor (shared canvas) | `app/cms/virtual-train/TrainTourEditor.tsx` |

**Stack:** Next.js `^16.4.3`, React 19, Prisma `^7.9.0`, Tailwind v4, Pannellum **2.5.7 via CDN** (not npm).

## B. Existing feature inventory

- Scene CRUD + level/area structure; panorama upload + multiRes tiles.
- Point hotspots: `scene` | `space` | `info` | `ad` with yaw/pitch degrees.
- Privacy blur regions in `canvasData`; bake-to-panorama API.
- Undo/redo (hotspots + blurs + canvasData), dirty flag, preview mode, save PUT.
- Coverage panel: unit placement from space/ad pins; filters all/retail/media/uncovered.
- Public multi-scene tour with custom hotspots; blur baked into image.

**Smoke baseline (pre-V2):** editor loads via `/cms/virtual-tour/{stationId}`; save updates `virtual_tour_scenes.hotspots` + `canvasData`; public reads `isActive` scenes.

## C. Pannellum integration and geometry constraints

- Loaders duplicated in Editor / Preview / VirtualTourViewer (`cdn.jsdelivr.net/npm/pannellum@2.5.7`).
- Create: `window.pannellum.viewer(el, config)`; destroy on unmount.
- `mouseEventToCoords(e)` → `[pitch, yaw]` (editor add/drag).
- Camera: `getYaw()`, `getPitch()`, `getHfov()` via `PannellumEditorHandle.getView()`.
- Hotspots: native `addHotSpot` / `removeHotSpot` with `type: "custom"`.
- **No public world→screen API** for arbitrary polygons → Spatial Overlay Engine required (ADR-001).

## D. Data model and compatibility risks

| Store | Content |
|-------|---------|
| `VirtualTourScene.hotspots` Json | Point pin array |
| `VirtualTourScene.canvasData` Json? | initialView, privacyBlurs, multiRes, bake meta |
| No draft/publish | Save writes live row; public = DB |
| Zod save | `hotspots: z.array(z.unknown()).max(200)` — loose |

**Risks:** monolith regression; shared `PannellumEditor` affects train; loose validation; no automated tests; CDN offline.

**Locked V2 storage:** additive `spatialEntities Json @default("[]")` on `VirtualTourScene` (pins untouched).

## E. Proposed files to add/change

**Phase 1:** `CmsShell.tsx`; split editor into `EditorShell` / `EditorHeader` / `EditorToolbar` / inspector pieces under `app/cms/virtual-tour/[stationId]/`.  
**Phase 2–3:** `lib/spatial/**`, SVG overlay components, Prisma migration, API schema.  
**Phase 4:** `VirtualTourViewer.tsx` / `StationTourClient.tsx` / `stations-data.ts`.  
**Phase 6:** geometry unit tests, feature flag, docs.

## F. Migration strategy (additive only)

1. Add `spatialEntities Json @default("[]")` via Prisma migrate.  
2. Extend PUT body optionally; ignore when flag off.  
3. Readers normalize/skip corrupt entities.  
4. Rollback app image leaves JSON column harmless.

## G. Build / test commands

```text
npm run lint
npm run build
npm run db:generate
npm run db:migrate   # when migration added
```

Geometry tests: `npm run test:spatial` (`node:test` + tsx, no new deps). Laporan eksekusi: `docs/virtual-tour-editor-v2-phase-report.md`.

## H. Open questions / decisions (resolved for MVP)

| Topic | Decision |
|-------|----------|
| Draft/publish | Spatial draft/published snapshot + scene-level CAS ditambahkan 28 Oktober; pin/config existing tetap mengikuti Simpan. Lihat laporan verifikasi 2026-10-28. |
| Spatial storage | `spatialEntities` JSON column |
| Train spatial | Station-only until stable |
| Perspective Surface | Phase 5 deferred |
| Feature flag | `CMS_SPATIAL_HOTSPOT` / `NEXT_PUBLIC_CMS_SPATIAL_HOTSPOT` |

## Baseline screenshot

Capture at `/cms/virtual-tour/{stationId}` after CMS login (1920×1080 / 1366×768) during Phase 1 smoke; store under `docs/baselines/` when available.
