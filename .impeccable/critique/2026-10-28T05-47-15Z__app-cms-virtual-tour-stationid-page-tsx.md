---
target: mockup Spatial Area CMS editor vs page.tsx
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-10-28T05-47-15Z
slug: app-cms-virtual-tour-stationid-page-tsx
---
# Critique — CMS Virtual Tour Editor / Spatial mockup

## Design Health Score
Total **21/40** — Needs work (strong Spatial POV, weak IA consistency & recovery).

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Status bar + Polygon valid baik; dirty/save masih tipis |
| 2 | Match System / Real World | 3 | Domain unit bagus; Layers/Surface Media kabur |
| 3 | User Control and Freedom | 2 | Undo/escape draft kurang di chrome mock |
| 4 | Consistency and Standards | 1 | Inspector Properti|Layers|Coverage ≠ Scene|Point|Spatial|Media|Coverage |
| 5 | Error Prevention | 2 | Valid reaktif; tidak cegah commit tanpa unit |
| 6 | Recognition Rather Than Recall | 3 | Badge+kode unit membantu |
| 7 | Flexibility and Efficiency | 2 | ~10 tool modes |
| 8 | Aesthetic and Minimalist Design | 2 | Chrome dens vs panorama |
| 9 | Error Recovery | 1 | Hampir tidak ada state invalid/unlinked |
| 10 | Help and Documentation | 2 | Helper unit bagus; onboarding Spatial lemah |

## Design Specificity Verdict
**LLM:** Mockup cukup Void Portal / LRT Operate (maroon, emerald spatial, kode unit CWG-…). Bukan SaaS generik. Drift: tab Inspector mock + toolbar padat + Surface Media.
**Detector:** 33 findings (exit 2) — terutama design-system-font-size 9–11px di CMS chrome + warna semantik kategori; banyak false-positive kandidat untuk Operate dense UI.
**Overlays:** Tidak ada — CMS auth wall (`fallback_signal: cms_auth_required_redirect_to_login`).

## Overall Impression
Arah Spatial (neon outline + badge status ruang) tepat. Jangan tiru IA tab mock; pertahankan kontrak 5 tab yang sudah di kode. Ambil polish HUD/status bar + badge availability dari mock.

## What's Working
1. Differensiasi Spatial vs pin hotspot jelas.
2. Section Identitas → Tampilan → Interaksi di mock Operate-friendly.
3. Empty/draft states di kode SpatialAreaInspector lebih baik dari mock selected-only.

## Priority Issues
### P0 — Inspector IA berbenturan product truth
Mock Properti|Layers|Coverage menimpa Scene|Point|Spatial|Media|Coverage.
**Fix:** Tetap 5 tab; di Spatial pakai sections, bukan sub-tab Layers.
**Command:** shape / distill Spatial Inspector

### P0 — Badge mock ≠ model kode
Mock: RUANG TERSEDIA - CODE. Kode: letter 1–2 huruf.
**Fix:** Putuskan signature availability+code pill; bind spaceCode + status.
**Command:** clarify Spatial badge

### P1 — Tool shelf overload + Surface Media
**Fix:** Group tools; Surface Media ke Lainnya / tab Media (Phase 5).
**Command:** distill EditorToolbar

### P1 — Brand action color
Simpan hijau di mock vs signal #E31E2D di kode — pertahankan signal.
**Command:** colorize CMS actions

### P2 — Chrome dens
Kurangi viewport pills; satu chip konteks + status bar.
**Command:** quieter editor chrome

## Persona Red Flags
- Power user: relearn tab; butuh undo/dirty akurat.
- First-timer ops: Spatial vs Surface Media vs Unit.
- Leasing reviewer: letter-badge gagal tanpa buka inspector.

## Minor Observations
Geser > Pan (ID); fill opacity slider vs outlineOnly; vertex handles selected; Chakra/Source Sans intentional.

## Questions to Consider
1. Layers tanpa model — redesign Coverage atau filler?
2. Badge publik: status+kode vs letter mark editor-only?
3. Surface Media di toolbar yang sama — cost training vs pisah brutal?

## Genjutsu cast lens
Snappy: mode switch / selection / auto-tab 120–180ms. Calm: panorama + status angka. Signature: seal flash emerald saat Polygon valid — bukan glow ungu.
