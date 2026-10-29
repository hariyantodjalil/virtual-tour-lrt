# Editor V2 + Spatial Hotspot — Phase Report

> **Spec:** `TECHNICAL_SPEC_VIRTUAL_TOUR_EDITOR_V2_SPATIAL_HOTSPOT.md`  
> **Date:** 2026-10-27  
> **Phase 5 (Perspective Surface):** ditunda sampai gate eksplisit.

> **Pembaruan 28 Oktober:** klaim PASS di bawah adalah laporan implementasi awal, bukan acceptance seluruh spesifikasi. Bug dan gap yang ditemukan saat review telah diperbaiki bertahap. Hasil serta batas verifikasi terbaru ada di [spatial-hotspot-verification-2026-10-28.md](spatial-hotspot-verification-2026-10-28.md).

## Phase 0 — Audit

- Deliverable: `docs/virtual-tour-editor-audit.md`
- Gate: arsitektur, inventori, risiko, migrasi strategy tercatat. **PASS**

## Phase 1 — Layout shell

- CmsShell auto-collapse rail pada editor full-width
- `EditorToolbar` (grouping Select/Pan | pins | Spatial | Blur | Undo | Preview/Save)
- Explorer search + collapse; inspector Properti | Coverage
- Gate smoke: typecheck bersih setelah refactor. **PASS**

## Phase 2 — Projection engine

- `lib/spatial/geometry/{spherical,projection,clipping,polygon-validation}.ts`
- `lib/spatial/pannellum-adapter.ts` + `SpatialOverlay` (SVG + rAF)
- POC polygon statis di CMS bila flag on & belum ada entity
- Tests: `npm run test:spatial` — round-trip ≤3 CSS px, validation. **PASS**

## Phase 3 — Authoring + persist

- Mode Spatial Area: draw vertex → commit → inspector (label, unit, style)
- Prisma additive: `VirtualTourScene.spatialEntities Json @default("[]")`
- Migration: `prisma/migrations/20261027120000_add_spatial_entities`
- API PUT: Zod `spatialEntitiesSchema` ketat + flag `CMS_SPATIAL_HOTSPOT`
- Undo/redo snapshot mencakup spatialEntities
- Gate: pin lama tidak disentuh. **PASS** (validasi lokal; migrate DB saat deploy DEV)

## Phase 4 — Public

- `stations-data` normalize spatial (enabled only, flag-gated)
- `VirtualTourViewer` overlay read-only + click → `onSpaceClick`
- Coverage dedupe pin ∪ spatial `spaceCode`
- `findSpaceHotspotPlacement` fallback centroid spatial
- Gate: regresi path pin tetap. **PASS** (flag off = no overlay)

## Phase 6 — Hardening

- Unit tests geometry via `node:test` (no new deps)
- Flag docs di `.env.example` / `.env.dev.example`
- Rollback aplikasi: nonaktifkan flag server, lalu gunakan image sebelumnya. Pertahankan kolom JSON dan snapshot publik; jangan DROP COLUMN. Backup database sebelum migration dan release.
- **Tidak auto-PROD**

## Aktifkan di DEV

```env
CMS_SPATIAL_HOTSPOT=1
NEXT_PUBLIC_CMS_SPATIAL_HOTSPOT=1
```

Lalu: `npx prisma migrate deploy` (atau `db:migrate`) + restart `next dev`.
