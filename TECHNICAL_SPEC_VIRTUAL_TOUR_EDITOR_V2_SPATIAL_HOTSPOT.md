# Technical Specification & Cursor Agent Execution Plan
## Virtual Tour CMS LRT Jabodebek — Editor V2 + Spatial Hotspot (Pannellum)

> **Status:** Ready for codebase audit and phased implementation in **DEV only**  
> **Document version:** 1.0 — 27 Oktober 2026  
> **Owner:** Virtual Tour LRT Jabodebek / HIKARUZEN  
> **Source of requirements:** Tampilan CMS existing (screenshot editor stasiun Cawang, `check point 10 concourse unpaid`) dan pembahasan layout + spatial hotspot.  
> **Scope:** UX editor, polygon spatial area, future perspective surface media, backward compatibility, testing, draft/publish.  
> **Important:** Ini adalah **target specification**, bukan klaim bahwa arsitektur internal repository sudah diketahui. Agent **wajib audit dahulu** dan mengadaptasikan nama folder, framework, ORM, database, dan API terhadap implementasi existing.

---

# 0. INSTRUKSI UTAMA UNTUK CURSOR AGENT — BACA TERLEBIH DAHULU

Kamu adalah **senior frontend engineer + WebGL/360° visualization engineer + full-stack architect** yang diberi tugas meningkatkan Virtual Tour CMS tanpa merusak fungsionalitas yang sudah berjalan.

**Tujuan final:**

1. Redesign **layout editor Station Virtual Tour** agar bersih, responsif, canvas panorama menjadi fokus, Scene Explorer dan Inspector kontekstual.
2. Menambah **Spatial Area Hotspot**: admin menggambar polygon mengikuti bentuk ruang/ruko/etalase tenant pada panorama Pannellum, mengatur fill/outline/label/hover/click action, dan menyimpannya per scene.
3. Menyiapkan desain dan implementasi terpisah untuk **Perspective Surface**: memasang gambar/logo/poster dalam bentuk quadrilateral empat titik yang mengikuti perspektif ruangan, **hanya setelah Spatial Area stabil**.
4. Seluruh fitur existing (scene navigation, point hotspot, Unit, Info, Iklan, Blur, Coverage, Save, Preview, tenant relationship, dan lain-lain) harus tetap berfungsi.
5. Perubahan **berbasis audit repo nyata**, bertahap, mudah di-review dan rollback, dengan hasil test serta laporan perubahan.

## 0.1 Aturan operasional mutlak

- **DILARANG** langsung rewrite editor, mengganti viewer, menghapus model/API lama, atau memperkenalkan framework baru sebelum membaca codebase.
- **Pannellum tetap menjadi viewer utama**. Tidak migrasi ke Photo Sphere Viewer/Marzipano/Three.js kecuali ada keputusan eksplisit baru.
- **JANGAN** langsung mengadopsi fork Pannellum pihak ketiga ke production. Boleh hanya **dipelajari sebagai referensi**.
- **JANGAN** memodifikasi file build/vendor Pannellum pada MVP. Buat adapter/plugin di aplikasi sendiri.
- **JANGAN** menyentuh PROD, menjalankan destructive DB migrations, menghapus data, atau menampilkan secret `.env`.
- **JANGAN** membuat sistem pengelolaan tenant kedua; gunakan existing master Unit/Ruang Komersial/Penyewa.
- **JANGAN** mengubah behavior scene checkpoint/penamaan ID/route API lama tanpa pembuktian kompatibilitas.
- **JANGAN** menggunakan koordinat pixel layar sebagai canonical geometry. Simpan **yaw/pitch dalam derajat relatif scene**.
- **JANGAN** membuat polygon hanya dari SVG berposisi `left:...; top:...` statis tanpa real-time spherical projection.
- **JANGAN** menganggap HTML pin Pannellum native mampu menampilkan polygon/surface yang mengikuti bidang secara otomatis.
- **JANGAN** mengganggu operasi pan, zoom, klik hotspot lama, maupun fitur Blur existing.
- **WAJIB** gunakan bahasa Indonesia untuk teks UI baru, konsisten dengan terminology CMS existing; nama enum/API boleh bahasa Inggris.
- **WAJIB** memisahkan setiap pekerjaan ke perubahan yang bisa dites sendiri (small, reviewable commits bila workflow repo mendukung).
- **WAJIB** jalan pada environment DEV, lalu testing sebelum release melalui mekanisme approval existing; **tidak ada asumsi environment QA/BETA**.
- Bila ada ambiguitas teknis yang signifikan, **audit dulu lalu tulis temuan dan pilihan**; jangan mengambil asumsi berisiko sebagai fakta.

## 0.2 Urutan kerja wajib (gated execution)

```text
PHASE 0  Discovery & baseline               [READ ONLY]
   ↓ review codebase, bukti baseline, rencana file terdampak
PHASE 1  Layout/editor shell refactor       [CHANGE DEV]
   ↓ tests + regression check
PHASE 2  Spatial geometry engine + POC      [CHANGE DEV]
   ↓ alignment, clipping, zoom/pan tests
PHASE 3  Spatial Area authoring             [CHANGE DEV]
   ↓ full CRUD, unit binding, draft save, preview
PHASE 4  Public rendering + publish        [CHANGE DEV]
   ↓ publishing and legacy regression tests
PHASE 5  Perspective Surface POC           [OPTIONAL, AFTER GATE]
   ↓ if POC passes, productionize separately
PHASE 6  Hardening / security / perf       [CHANGE DEV]
   ↓ report and rollout proposal, no PROD deployment automatically
```

> **Completion rule:** Tidak boleh melanjutkan ke fase berikutnya jika acceptance criteria dan test fase sebelumnya gagal. Jangan menandai fitur "Done" hanya karena UI terlihat bagus.

---

# 1. PRODUK & MASALAH SAAT INI

## 1.1 Konteks layar existing

Dari screenshot:

- Aplikasi bernama **Virtual Tour CMS LRT Jabodebek**.
- Ada global CMS sidebar (Dashboard, Stasiun, Station Virtual Tour, Train Virtual Tour, Train Rental Space, Ruang Komersial, Penyewa Aktif, Pengajuan & Site Visit, dan seterusnya).
- Halaman editor berjudul **Editor Station Virtual Tour**.
- Breadcrumb: **Station Virtual Tour > Cawang > check point 10 concourse unpaid**.
- Ada **Struktur Tur (64)** yang menampilkan daftar checkpoint/scene.
- Toolbar menggabungkan Pilih, + Scene, + Unit, + Info, + Iklan, + Blur, undo/redo, preview, reset, simpan.
- Panorama menjadi area tengah tetapi terlihat sempit di antara sidebar CMS, scene explorer, dan panel kanan.
- Panel kanan mencampur unit/tenant, **Ukuran Hotspot**, yaw/pitch, **Coverage**, serta daftar hotspot.
- Screenshot menunjukkan **ruang tersedia CWG-CON-UNP-F-002** yang ditandai kotak kecil hijau. Target baru adalah area interaktif mengikuti seluruh bidang ruang tersedia, bukan pin kecil.
- Angka, scene count, status, kode unit, koordinat, dan identitas tenant pada screenshot adalah **contoh data existing**, bukan nilai yang boleh di-hardcode.

## 1.2 Problem statement

| Masalah | Dampak | Tindakan |
|---|---|---|
| CMS sidebar terlalu dominan | Canvas mengecil | Auto-collapse sidebar ketika edit; toggle tetap tersedia |
| Toolbar penuh & mencampur tool/action | Sulit menemukan workflow | Kelompokkan navigation, authoring, edit history, publish |
| Scene list padat/truncated | Sulit mencari scene | Search, hierarchy, thumbnails, context actions |
| Inspector menampilkan semua data sekaligus | Visual clutter | Inspector berbasis selected object |
| Point hotspot kecil untuk unit besar | Sulit memahami cakupan ruang | Spatial polygon area hotspot |
| Coverage bercampur properties | Fokus editing terganggu | Dedicated Coverage tab/drawer |
| Tidak ada authoring bidang | Admin tidak bisa trace batas ruko | Draw/edit polygon + optional surface media |

## 1.3 Goals

- Editor yang terlihat profesional dan mendukung workflow admin sesungguhnya.
- Panorama sebagai pusat pekerjaan dengan ruang viewport optimal.
- WYSIWYG spatial annotation yang **melekat pada arah panorama** walau kamera pan/zoom.
- Relasi data Unit existing, tanpa input ulang detail tenant.
- Penyimpanan/preview/publikasi yang aman dan reversible.
- Kompatibilitas scene & hotspot existing.

## 1.4 Non-goals untuk MVP

- Tidak membangun panorama engine sendiri.
- Tidak memetakan kedalaman 3D asli, LiDAR, ataupun mesh bangunan.
- Tidak menyediakan true physical occlusion (contoh poster otomatis tertutup tiang).
- Tidak mengganti asset foto panorama atau scene navigation existing.
- Tidak membuat VR headset editor, collaborative multiplayer editing, ataupun AI auto-segmentation.
- Tidak memaksa migrasi semua point hotspot existing menjadi polygon.
- Tidak menambah library besar (Konva/Fabric/Three) jika SVG + math + existing stack sudah cukup.

---

# 2. DISCOVERY AUDIT SEBELUM CODING (PHASE 0)

> **Mode:** READ ONLY. Jangan melakukan mutasi source file, DB, dependency, infrastructure.

## 2.1 Inventaris repository

Agent wajib identifikasi dan laporkan (dengan bukti path serta simbol/fungsi sebenarnya):

1. Project structure: monorepo atau multi-repo; frontend CMS, public viewer, backend, dan storage.
2. Frontend runtime/framework/version; React/Next.js atau yang lain; package manager; styling system; icon set.
3. Lokasi route **Station Virtual Tour Editor**, parent layout, global sidebar, toolbar, inspector, scene explorer.
4. Komponen Pannellum wrapper dan import (script/CDN/package/iframe/custom build), versi pasti, lifecycle create/destroy.
5. State management existing; scene ID, selected hotspot ID, mode/tool, undo/redo, dirty state.
6. Model hotspot existing (`Scene`, `Unit`, `Info`, `Iklan`, `Blur`, dll.), serialization, cache, persistence.
7. Endpoint GET/POST/PUT/PATCH/DELETE scenes / hotspot / unit; validation, authorization, tenant ownership.
8. Model master **Ruang Komersial**, kode/unit ID, status tersedia/terisi, data tenant, coverage calculation.
9. Data draft vs published (jika ada), versioning, preview, reset, conflict handling.
10. Existing tests: type-check, lint, build, unit, integration, e2e, screenshot test.
11. CSS/layout khusus yang menyebabkan clipping, overflow, `z-index`, portal, dan responsive behavior.
12. Workflow Git, branch DEV, pipeline CI/CD, migrasi DB, hosting static media, object storage.

## 2.2 Baseline yang harus dicatat

- Commit HEAD/branch kerja.
- Screenshot layout kondisi awal pada desktop (disarankan 1920×1080 dan 1366×768).
- List fitur lama dan hasil smoke test.
- Existing routes dan contoh payload yang sudah **disanitasi** (tanpa secret & data sensitif).
- Format panorama yang dipakai (`equirectangular` / `cubemap` / `multires`) serta metadata relevan (`haov`, `vaov`, `vOffset`, `horizonPitch`, `horizonRoll`).
- Browser target serta apakah ada SSR/hydration di integrasi Pannellum.
- API feasibility: penggunaan `mouseEventToCoords`, viewer events, accessibility.

## 2.3 Deliverable Phase 0

Agent tulis ringkasan di `docs/virtual-tour-editor-audit.md` **hanya jika repo mempunyai pola dokumentasi demikian**, atau path dokumentasi setara:

```text
A. Current architecture and actual file paths
B. Existing feature inventory + smoke test results
C. Pannellum integration and geometry constraints
D. Data model and compatibility risks
E. Proposed actual files to add/change
F. Migration strategy (additive only)
G. Build/test commands discovered
H. Open questions / architectural decisions
```

Jika nama folder/proyek berbeda, adaptasi. **Jangan membuat struktur paralel baru secara membabi buta.**

**Gate Phase 0:** audit memadai; tidak ada aspek data/api penting yang masih ditebak.

---

# 3. TARGET UX — EDITOR V2

## 3.1 Information architecture

Editor terdiri dari 5 lapisan utama:

1. **App Rail** — global CMS navigation (collapsed by default in editor).
2. **Editor Header** — back, breadcrumb, scene title, status save, Preview, Simpan/Publish.
3. **Tool Shelf** — mode Select, Pan, Point, Spatial Area, Surface Media, Blur dan alat existing lainnya.
4. **Workspace** — Scene Explorer di kiri, panorama canvas di tengah, Inspector di kanan.
5. **Secondary Drawer / Bottom Sheet** — Coverage, scene-wide hotspot list, media browser, history jika perlu.

## 3.2 Wireframe desktop

```text
┌──────┬──────────────────────────────────────────────────────────────────────────┐
│ APP  │ ← Kembali  /  Station > Cawang > Scene 10       Saved • Preview • Simpan │
│ RAIL ├──────────────────────────────────────────────────────────────────────────┤
│ 64px │ [Select] [Pan] | [+Scene] [Point] [Spatial Area] [Surface] [Blur] ...   │
│      ├─────────────────┬────────────────────────────────────┬───────────────────┤
│      │ SCENE EXPLORER  │          PANNELLUM CANVAS          │ INSPECTOR         │
│      │ Search...       │                                    │ (contextual)      │
│      │ Level tree      │   selected polygon / unit region   │ Unit / style      │
│      │ Scene thumbnails│   + smart label / handles          │ Points / action   │
│      │ Scene 10 active │                                    │ Save state        │
│      │                 │ [View controls / HUD]              │                   │
│      ├─────────────────┴────────────────────────────────────┴───────────────────┤
│      │ Optional collapsible: Coverage / Hotspot Inventory / Validation       │
└──────┴──────────────────────────────────────────────────────────────────────────┘
```

Ukuran target (bukan hard-coded mutlak):

| Region | Desktop target | Ketentuan |
|---|---:|---|
| CMS collapsed app rail | 56–64 px | Expand toggle, keyboard accessible |
| Header | tinggi 52–60 px | Status save selalu tampak |
| Toolbar | tinggi 44–52 px | icon + tooltip; group divider |
| Scene Explorer | 240–280 px | bisa collapse / resize, viewport scroll independen |
| Inspector | 320–360 px | bisa collapse / resize, viewport scroll independen |
| Panorama | `flex: 1; min-width: 0` | tidak overflow, mempertahankan ruang sebesar mungkin |

Breakpoint yang disarankan:

- **>= 1366 px:** 3 kolom workspace, app rail collapsed.
- **1024–1365 px:** Explorer dapat collapse; Inspector dapat berupa dock sempit atau drawer.
- **< 1024 px:** panorama diprioritaskan; Explorer/Inspector via drawer/sheet, jangan biarkan canvas 200px.
- **Mobile:** minimal full preview dan view/edit sederhana, authoring polygon penuh boleh diarahkan ke desktop apabila UX touch belum lolos test.

Pastikan layout **tidak memiliki nested scroll yang membingungkan**. Header dan toolbar sticky; scroll independen hanya Explorer/Inspector. Saat ukuran sidebar berubah, panggil `viewer.resize()` setelah ukuran aktual container berubah (mis. dengan ResizeObserver yang memiliki cleanup).

## 3.3 Toolbar redesign

Grouping:

- **Navigation / selection**: Select (`V`), Pan (`H`), reset camera.
- **Content authoring**: + Scene, Point, Spatial Area (`G`), Perspective Surface (`M`, hanya bila feature flag ON), Unit/Info/Iklan sebagai tipe dan/atau action existing.
- **Existing visual tools**: Blur, dengan workflow dan ACL lama.
- **Edit history**: undo/redo, duplicate, delete.
- **Document actions**: Preview, status dirty, Save Draft, Publish (jika existing mendukung; jangan menciptakan publikasi baru tanpa audit).

Aturan:

- Hanya satu tool aktif pada satu waktu (tool-mode state machine).
- Tooltip berisi teks dan shortcut.
- Disable button jika belum ada scene loaded atau tidak ada objek valid.
- Tindakan destruktif harus konfirmasi (atau undo jika deletion soft).
- Jangan ubah istilah/fungsi existing tanpa mapping dokumentasi.
- Action Preview berbeda dari Save Draft/Publish.

## 3.4 Scene Explorer

- Tree berdasarkan hierarki existing: stasiun → level/area → scene/checkpoint (ikuti model nyata).
- Search by scene label, code, checkpoint name.
- Thumbnail, active highlight, jumlah hotspot jika datanya memang tersedia.
- Expanded state dapat dipertahankan saat scene change.
- Virtualize list hanya jika memang bottleneck nyata; jangan menambah dependency tanpa alasan.
- Right-click/kebab menu: rename, duplicate, reorder, delete (menurut RBAC/API existing).
- Saat scene switch dengan unsaved edit: tampilkan konfirmasi **Save / Discard / Cancel**; jangan silently drop.
- Scroll ke scene aktif jika perlu; hindari reflow besar.

## 3.5 Contextual Inspector (aturan inti)

**No selection**:
- Scene name, initial view, overview hotspot count, quick action.

**Point hotspot selected**:
- Type/icon/scale, yaw/pitch, linked unit/scene/action, visibility, label, delete.
- Pertahankan `Ukuran Hotspot` khusus **point mode**, bukan kontrol universal untuk polygon.

**Spatial Area selected**:
- Label/type, Unit association (search unit), geometry point count, fill + opacity, stroke + width, hover style, label, click action, visibility, delete.
- Geometry tools: add/remove vertex, reset geometry (confirm), fit view, copy style.

**Perspective Surface selected**:
- Asset upload/select, 4 corner controls, opacity, clickable, preview, remove media.

**Blur selected**:
- Panel blur existing (tidak regress).

**Coverage**:
- Bukan default inspector tab; pindah ke dedicated drawer/tab sehingga tidak mencampur data audit dengan editing objek.
- Preserve filters `Semua / Retail / Media / Belum saja` atau equivalent existing.
- Coverage dihitung dari sumber data existing, bukan hanya jumlah polygon.

## 3.6 Canvas behavior

- Panorama mendominasi area tengah.
- Mode `Select`: klik polygon memilih objek, klik kosong deselect; pan tetap tersedia dengan drag area kosong sesuai UX teruji.
- Mode `Pan`: semua interactions editor nonaktif; drag viewer normal.
- Mode `Draw Polygon`: klik menambah vertex, close via klik vertex pertama atau Enter; Esc cancel; Backspace undo vertex terakhir (saat drawing saja).
- Mode `Edit Polygon`: drag handle vertex, add vertex di tengah edge, delete vertex sesuai guard minimal 3.
- Handle terlihat hanya pada selected polygon di CMS, tidak di public viewer.
- Label tidak menutupi bagian penting panorama; dapat disembunyikan/diatur berdasarkan zoom/hover.
- Sediakan hint toolbar ringkas; jangan modal onboarding panjang setiap kali edit.
- Gunakan pointer cursor dan selected states yang jelas, fokus keyboard, alt text/button labels.
- Multi-selection, snap-to-edge, magnet, dan auto-segmentation **bukan MVP**.

## 3.7 Visual system

Pertahankan identitas merah/maroon CMS existing, tetapi perbaiki kontras dan hierarchy:

- Background header/side dark surface; canvas neutral overlay; teks primer kontras tinggi.
- Warna status unit dipetakan dari field existing, **jangan mengasumsikan hijau = tersedia dan merah = terisi tanpa audit model/legend**.
- Warna selection editor berbeda dari status bisnis (mis. cyan outline) agar tidak membingungkan.
- Control sizes konsisten (minimal 32–40 px desktop, lebih besar untuk touch).
- Spacing berbasis tokens: 4/8/12/16/24.
- Font minimum UI readability ~12–14px; tooltip dan helper dapat 12px, form values ~13–14px.
- Scrollbar dan focus ring terlihat; contrast WCAG AA bila feasible.

---

# 4. SPATIAL HOTSPOT: DEFINISI FITUR

## 4.1 Jenis elemen

```text
Existing:
POINT_SCENE        -> navigasi antar scene
POINT_UNIT         -> pin detail unit/tenant
POINT_INFO         -> informational pin
POINT_AD           -> iklan/promo hotspot existing
BLUR_REGION        -> fitur blur existing, jangan ubah behavior

New:
SPATIAL_AREA       -> filled/stroked polygon yang mengikuti sudut panorama
PERSPECTIVE_SURFACE-> gambar/video/branding 4-corner (phase optional)
```

**Tidak semua legacy type perlu langsung disatukan.** Agent dapat membuat adapter unified *view model*, tetapi storage/API legacy tetap kompatibel sampai ada migration plan yang teruji.

## 4.2 Use cases utama

**UC-01 — Menandai unit tersedia**  
Admin memilih scene, mengklik Spatial Area, trace batas opening ruko/etalase, menautkan unit `CWG-CON-UNP-F-002`, mengatur fill transparan, label "Ruang Tersedia", save. Pengunjung hover melihat highlight dan klik membuka detail unit existing.

**UC-02 — Menandai unit aktif**  
Admin menautkan polygon ke master unit/tenant aktif. UI menampilkan status berdasarkan data authoritative, bukan string manual di polygon.

**UC-03 — Area non-unit**  
Admin membuat polygon untuk fasilitas/area informasi, bila model izin mendukung. Tidak dipaksa mempunyai unit ID; click action `info` atau `none`.

**UC-04 — Branding on wall (phase optional)**  
Admin memilih 4 titik bidang dinding/etalase (TL→TR→BR→BL), memilih image, mengatur opacity, dan menghubungkan ke tenant. Poster tampak mengikuti bidang saat rotate/zoom pada scene.

## 4.3 Interaction states

```text
IDLE
  ├─ SELECT_POINT / SELECT_AREA / SELECT_SURFACE
  ├─ DRAWING_AREA (0..N vertices)
  │    ├─ add → draw provisional edge
  │    ├─ Enter/close first vertex → VALIDATING
  │    └─ Esc → IDLE without side effect
  ├─ EDITING_AREA
  │    ├─ dragging vertex → local draft geometry
  │    ├─ commit drag → single undo entry
  │    └─ cancel drag → revert
  ├─ DRAWING_SURFACE (4 ordered corners, gated)
  ├─ PAN
  └─ PREVIEW (read only)
```

Mode changes harus membersihkan pending pointer capture/draft bila perlu; transisi dengan edit tak tersimpan mengikuti kebijakan dirty state.

## 4.4 Fitur MVP Spatial Area

- Polygon minimal 3 vertex, maksimal **64 vertex per polygon** (configurable, diputuskan setelah POC).
- Setiap vertex canonical `[yaw, pitch]` dalam **derajat**, bukan pixel.
- `yaw` normalized ke range yang disepakati oleh aplikasi, mis. `[-180, 180)`; perhatikan seam dan unwrap sementara saat rendering.
- Pitch domain `[-90, 90]`, namun editing dekat pole perlu safeguard dan test.
- Reject geometri degenerate/zero area, self-intersecting polygon, duplikasi titik hampir identik, geometry yang terlalu lebar untuk MVP.
- Polygon bisa memiliki transparan fill, stroke, dashed/solid, hover/selected styles.
- Label anchor derived dari polygon (projected visual centroid atau configured anchor), bukan screen pixel tetap.
- Action: `unit_detail`, `info_detail`, `open_scene`, `url` hanya jika sudah diperbolehkan kebijakan produk, `none`.
- Enable/disable, visible in CMS, visible in published tour (sesuai draft/publish state).
- Create/update/delete + undo/redo + save persistence.
- Selection/hover priority jelas apabila polygon overlap existing point hotspot.

---

# 5. ARSITEKTUR IMPLEMENTASI — PANNELLUM + CUSTOM OVERLAY

## 5.1 Architectural decision record (ADR-001)

**Pilihan:** tetap memakai Pannellum existing sebagai panorama renderer; buat **Spatial Overlay Engine** sebagai composited layer terpisah di atas viewport, diimplementasikan dengan SVG dan React (atau frontend framework aktual).

**Alasan:** API Pannellum public menyediakan pengambilan koordinat panorama dari mouse click (`mouseEventToCoords`), getter kamera (`getPitch`, `getYaw`, `getHfov`), lifecycle scene events, dan `resize()`. Namun **API public tidak menyediakan world-to-screen projection yang dapat diandalkan langsung untuk polygon arbitrer**; aplikasi harus membuat & menguji projection math/adaptor sendiri.

**Dilarang:** memaksa setiap vertex dijadikan native Pannellum point hotspot lalu menggambar polygon dari DOM hotspot positions; itu rapuh saat clipping, camera moves, horizon rotation dan lifecycle scene.

```text
┌──────────────────────────────────────────────────────┐
│                     CMS Editor                       │
│  SceneExplorer   Toolbar    ContextualInspector      │
│                         │                            │
│  ┌──────────────────────▼──────────────────────────┐ │
│  │        PanoramaViewport (relative container)    │ │
│  │                                                 │ │
│  │  Pannellum Canvas  ── camera/view state         │ │
│  │         +                                       │ │
│  │  SVG SpatialOverlay ─ projected polygon paths   │ │
│  │         +                                       │ │
│  │  EditorHandleLayer ─ draggable handles          │ │
│  │         +                                       │ │
│  │  Tooltip/Popup   ─ existing detail flows        │ │
│  └─────────────────────────────────────────────────┘ │
│                         │                            │
│  Scene State / History / Adapter / Draft Persistence │
└─────────────────────────┼────────────────────────────┘
                          ▼
           Existing API + additive spatial records
                          │
            Existing Units/Lease/Tenant master
```

## 5.2 Layer separation

- **Pannellum layer**: panorama rendering, scene navigation, existing point hotspots.
- **Spatial overlay layer**: polygon rendering, hit-testing, hover, labels; click area can map to existing tenant detail action.
- **Editor handles layer**: CMS-only selection controls, drag vertex. Not in public viewer.
- **State controller**: mode, selection, scene ID, dirty state, undo/redo.
- **Repository adapter**: list/create/update/delete; aligns with current API/data.
- **Public renderer**: same spatial geometry/render primitives in read-only mode; do not duplicate math.

DOM sketch (illustration only):

```tsx
<div ref={viewportRef} className="relative h-full min-h-0 w-full overflow-hidden">
  <div ref={pannellumContainerRef} className="absolute inset-0" />
  <SpatialOverlay
    viewer={viewerRef.current}
    sceneId={activeSceneId}
    mode={editorMode}
    areas={activeSceneAreas}
    selectedId={selectedId}
  />
  {isEditor && <SpatialEditorHandles /* controlled props */ />}
</div>
```

**Note:** Sketch di atas adalah konsep, **bukan kode tempel tanpa audit**. Stabilitas viewer ref pada React state, SSR guard, pointer events, unmount clean-up, dan layout diputuskan berdasarkan repo.

## 5.3 Viewer adapter interface (contoh)

```ts
interface CameraState {
  yawDeg: number;
  pitchDeg: number;
  hfovDeg: number;
  horizonPitchDeg?: number;
  horizonRollDeg?: number;
  widthCssPx: number;
  heightCssPx: number;
  sceneId: string;
}

interface PanoramaAdapter {
  getCameraState(): CameraState | null;
  eventToSpherical(e: MouseEvent): SphericalPoint | null;
  getCurrentSceneId(): string | null;
  onSceneLoaded(fn: () => void): () => void;
  onSceneChange(fn: (sceneId: string) => void): () => void;
  onZoomChange(fn: () => void): () => void;
  resize(): void;
  destroy(): void; // hanya jika adapter owns viewer lifecycle
}
```

Gunakan official `viewer.on(event, listener)` / `viewer.off(event, listener)` dengan cleanup. Listener event `load`, `scenechange`, `zoomchange`, `animatefinished`, `mousedown`, `mouseup` terdaftar di dokumentasi upstream. **Tidak ada janji public event `viewchange`/`render` per frame**, jadi jangan mengandalkannya tanpa memeriksa build lokal.

## 5.4 Sync dengan camera per frame

Masalah: saat user menahan drag untuk pan, getter kamera berubah frame-by-frame; `animatefinished` saja terlambat. Karena Pannellum tidak mendokumentasikan callback camera-change per frame, buat loop render overlay **terkontrol** menggunakan `requestAnimationFrame`:

- Jalankan hanya saat viewer mounted + scene loaded + tab aktif (gunakan mekanisme lifecycle/browser yang tersedia).
- Baca yaw/pitch/hfov/viewport size, bandingkan dengan state terakhir (epsilon) dan rerender SVG bila berubah.
- Stop/reduce loop saat unmount/hidden/scene switching; tidak memaksa React `setState` 60 kali/detik jika camera tak berubah.
- Gunakan `requestAnimationFrame` untuk geometry calculation dan imperative transform bila performance memerlukan; state React hanya untuk changes bermakna.
- `ResizeObserver` untuk viewport; lakukan `viewer.resize()` sesuai perubahan dimensi.
- Patuhi Strict Mode mount/unmount dan hindari multiple viewers, multiple RAF loops, duplicated listeners.

---

# 6. MATEMATIKA & GEOMETRI SPATIAL OVERLAY

> **Bagian berisiko tinggi.** Implementasi tidak boleh diasumsikan benar hanya karena polygon tampil pada 1 arah. Agent wajib membuat tests dengan inverse projection terhadap Pannellum aktual.

## 6.1 Canonical coordinate

```ts
interface SphericalPoint {
  yaw: number;   // degrees, Pannellum-compatible
  pitch: number; // degrees, Pannellum-compatible
}

interface ScreenPoint {
  x: number;     // CSS px relatif viewport Pannellum
  y: number;     // CSS px relatif viewport Pannellum
}
```

**Persist** yaw/pitch saja. ScreenPoint bersifat hasil render viewport, bukan data DB.

Saat drawing:

```ts
const coords = viewer.mouseEventToCoords(mouseEvent);
// Official Pannellum returns [pitch, yaw] — NOT [yaw, pitch].
const [pitch, yaw] = coords;
const point = { yaw, pitch };
```

Event harus dalam coordinate space viewer yang benar; jika SVG overlay menangkap klik, gunakan MouseEvent dengan client coords yang valid dan verifikasi hasilnya. Jangan membuat synthetic event yang bergantung pada undocumented implementation. Bila perlu transform event pada viewport, audit actual method behavior.

## 6.2 World-to-screen projection (mathematical reference)

Pendekatan awal: gnomonic/perspective projection dari arah pada unit sphere ke image plane kamera. Formula berikut **reference implementation**, harus dicocokkan dengan orientasi Pannellum (sign yaw, pitch, horizon roll, partial panorama metadata):

```ts
const rad = (deg: number) => deg * Math.PI / 180;

// Convention reference: yaw=0 -> +Z, positive yaw -> +X, positive pitch -> +Y
function sphericalToDir({ yaw, pitch }: SphericalPoint): Vec3 {
  const y = rad(yaw);
  const p = rad(pitch);
  return {
    x: Math.cos(p) * Math.sin(y),
    y: Math.sin(p),
    z: Math.cos(p) * Math.cos(y),
  };
}

function project(point: SphericalPoint, camera: CameraState): ScreenPoint | null {
  const v = sphericalToDir(point);
  const a = rad(camera.yawDeg);
  const b = rad(camera.pitchDeg);
  const forward = { x: Math.cos(b)*Math.sin(a), y: Math.sin(b), z: Math.cos(b)*Math.cos(a) };
  const right   = { x: Math.cos(a), y: 0, z: -Math.sin(a) };
  const up      = cross(forward, right);
  const depth = dot(v, forward);
  if (depth <= NEAR_EPSILON) return null;

  const focal = (camera.widthCssPx / 2) / Math.tan(rad(camera.hfovDeg) / 2);
  const x = camera.widthCssPx / 2 + focal * dot(v, right) / depth;
  const y = camera.heightCssPx / 2 - focal * dot(v, up) / depth;
  return { x, y };
}
```

**Wajib adaptasi**:

1. `cross`, `dot`, `Vec3` terdefinisi dengan benar.
2. Cocokkan hasil terhadap `mouseEventToCoords()` dari klik terukur di Pannellum.
3. Perhitungkan `horizonPitch`, `horizonRoll`, image `haov`, `vaov`, `vOffset`, horizon camera roll, transform CSS dan actual viewport (bila digunakan scene).
4. Pastikan aspect ratio & actual HFOV sesuai output Pannellum, termasuk zoom clamps.
5. Pastikan pitch signs, yaw wrap, north offset dan limits sesuai actual build.
6. Render overlay dengan **CSS px**, bukan `canvas.width` DPR-scaled pixels.
7. Cegah NaN/Infinity dan extreme projected points.

**Acceptance geometric**: Untuk 20+ sample click posisi layar yang tersebar (tengah, tiap kuadran, dekat tepi), ambil `[pitch, yaw] = mouseEventToCoords(e)` lalu project balik ke layar; toleransi posisi **≤ 3 CSS px** dalam kondisi normal, **≤ 5 px** saat transform khusus yang teruji. Jika meleset, perbaiki proyeksi sebelum lanjut authoring.

## 6.3 Yaw seam / unwrap

- Yaw `+179°` dan `-179°` adalah titik berdekatan secara geodesik, jangan menarik garis memutar 358°.
- Simpan normalized yaw; saat rendering hitung delta wrapped dengan fungsi `atan2(sin Δ, cos Δ)` atau normalized smallest angular difference.
- Untuk segment spanning ±180°, lakukan interpolate pada unit sphere (short arc) lalu project, bukan interpolasi yaw naif.
- Jika polygon hampir seluas hemisfer atau multi-wrap, tolak MVP dengan pesan yang jelas; jangan render rusak.

## 6.4 Polygon boundary & clipping

**Jangan sekadar `project(vertices).filter(Boolean)` lalu SVG `polygon`**: menghapus vertex di belakang kamera bisa menghasilkan garis panjang liar, fill salah, atau polygon melompati viewport.

Algorithm target:

1. Convert tiap vertex ke direction vector.
2. Tentukan boundary edges pada sphere (great-circle short arc / pendekatan yang konsisten dengan geometry foto).
3. Adaptive subdivide edge menjadi titik-titik per beberapa derajat (awal mis. 1–3°, adjustable) untuk mempertahankan kurva visual di zoom lebar.
4. **Clip segments against near plane** di camera space sebelum perspective divide; jangan projected infinity.
5. Clip polygon screen path ke viewport (atau SVG `clipPath`) setelah near-plane handling.
6. Handle multiple visible fragments; jangan menghubungkan fragment yang terpisah melewati layar.
7. Generate path and hit area hanya untuk visible fragments.
8. Validate polygon simple/finite, winding, min projected area, no self intersection.
9. Cap adaptive tessellation agar tidak memicu O(N²) berlebihan ketika banyak polygon.
10. Jika kasus edge/pole/seam belum reliabel dalam MVP, tampilkan **unsupported geometry warning** di CMS daripada menyimpan geometry rusak.

MVP optimization boleh memakai subdivide + safe clipped visible polygons jika terbukti benar pada 360° pan cycle. Arah kamera tepat membelakangi area tidak boleh menyebabkan overlay “meledak”.

## 6.5 SVG and hit testing

- SVG root absolute `inset: 0; width: 100%; height: 100%`, `viewBox` disinkronkan actual viewport.
- Root `pointer-events: none`, tetapi selected/draw handles dan interactive polygon `pointer-events: visiblePainted` atau target equivalent saat mode memerlukan.
- Mode Pan: overlay seluruhnya passive, jangan memblokir pointer Pannellum.
- Mode Draw: transparent capture layer event hanya saat drawing aktif, hit existing handles prioritas lebih tinggi.
- Hindari click-through ganda ke existing point hotspot, stop propagation secara selektif.
- Pada preview/public, interaction ke detail unit mengikuti trigger existing dan keyboard access (DOM/focusable path fallback bila SVG path tidak cukup).
- Tooltip/label DOM tidak boleh memakai untrusted `innerHTML`.

## 6.6 Performance budgets (target, diuji)

- Interaksi pan/zoom tetap responsif, target **~60 FPS** pada desktop target, fallback acceptable ~30 FPS pada perangkat lemah.
- Jangan hitung geometri jika state kamera/viewport/polygon tidak berubah.
- Cache unit sphere vertices/tessellation kecuali geometry dimodifikasi.
- View frustum culling dan cheap bounds test sebelum expensive clip/draw.
- Uji 1, 20, 50 polygon dengan 4–20 vertices untuk satu scene; angkanya workload POC, bukan data nyata.
- Menghapus/hide scene harus menghentikan semua effect listener/RAF dari scene lama.

---

# 7. PERSPECTIVE SURFACE — EMPAT TITIK (PHASE 5 / OPTIONAL)

## 7.1 Goal

Menempel gambar/logo/poster tenant pada bidang planar yang dipilih admin dengan 4 titik sudut di panorama.

- Admin klik **4 sudut berurutan**: `topLeft`, `topRight`, `bottomRight`, `bottomLeft`.
- Editor preview asset di quadrilateral setelah projection ke layar.
- Zoom/pan mengubah projected quad secara kontinu.
- Asset tetap link ke unit/tenant bila relevan.
- Opacity, visible, click behavior, asset replacement, remove.

## 7.2 Implementation options

**Candidate A (preferred POC):** Compute screen-space quad setiap frame + CSS `matrix3d` homography mapping rectangular image to projected quad.

**Candidate B:** WebGL plane / specialized projector bila A gagal pada perspektif ekstrem, clipping, atau rendering media kompleks. **Butuh keputusan arsitektur terpisah**; jangan menyisipkan Three.js otomatis.

**Reference (NOT dependency acceptance):** Pannellum GitHub issue `#1276`, fork `contreforme/pannellum` branch `feature/renderHotspot-adjustment`. Implementasi komunitas mendeskripsikan four-corner homography / matrix3d, tetapi belum terbukti sebagai API official stable. Pelajari maths & UX, tidak copy massal tanpa review lisensi dan regresi.

## 7.3 Hard constraints

- Asset 4 corners harus membentuk **convex non-self-intersecting quadrilateral** dengan winding konsisten.
- Jika salah satu titik di belakang kamera / quad cross near plane, **hide whole surface secara aman dalam MVP**; partial clipping surface merupakan fase advanced tersendiri.
- Saat quad terlampau miring/kecil/degenerate, jangan solve singular homography; tampilkan editor warning.
- Four-corner screen homography adalah **visual approximation pada sphere**; tidak otomatis menjamin bidang geometrik 3D sebenarnya atau true occlusion.
- Jangan inject iframe, remote HTML, atau arbitrary JavaScript dari CMS tenant. MVP hanya **approved image assets**; media lain security review.
- Batas ukuran/dimensi/MIME upload, safe URL dan CORS; mengikuti storage existing.
- CSS transforms wajib diberi `transform-origin` yang benar; compare projection visual at 5 camera angles.

## 7.4 Gate untuk lanjut implementasi Surface

POC dapat: menempel poster 1 gambar pada 1 etalase, pan kiri-kanan, zoom in/out, resize, kembali ke scene, selalu align; tidak flicker/NaN/escape viewport; performance acceptable. Jika gagal, **jangan** memaksakan Phase 5 ke release Spatial Area.

---

# 8. MODEL DATA — ADDITIVE, BACKWARD COMPATIBLE

## 8.1 TypeScript domain model (REFERENCE)

```ts
type SpatialEntityKind = 'SPATIAL_AREA' | 'PERSPECTIVE_SURFACE';
type SpatialActionKind = 'none' | 'unit_detail' | 'info_detail' | 'open_scene';

type StyleConfig = {
  fillColor?: string;       // validated hex/rgb token; no arbitrary CSS injection
  fillOpacity?: number;     // 0..1
  strokeColor?: string;
  strokeOpacity?: number;   // 0..1
  strokeWidthPx?: number;   // positive bounded
  hoverFillOpacity?: number;
  showLabel?: boolean;
  labelText?: string;
};

interface SpatialAreaGeometry {
  type: 'spherical_polygon';
  vertices: SphericalPoint[]; // 3..64, canonical yaw/pitch degrees
}

interface PerspectiveSurfaceGeometry {
  type: 'spherical_quad';
  corners: [SphericalPoint, SphericalPoint, SphericalPoint, SphericalPoint];
  cornerOrder: 'TL_TR_BR_BL';
}

interface SpatialEntity {
  id: string;                        // uuid or existing ID standard
  kind: SpatialEntityKind;
  stationId?: string;                // if relevant in existing data model
  tourId?: string;
  sceneId: string;                    // mandatory: existing stable scene id
  unitId?: string | null;             // FK to existing master unit
  label?: string;
  geometry: SpatialAreaGeometry | PerspectiveSurfaceGeometry;
  style: StyleConfig;
  action: { type: SpatialActionKind; targetId?: string | null };
  mediaAssetId?: string | null;       // perspective surface only
  enabled: boolean;
  zIndex?: number;                    // bounded within overlay layer
  schemaVersion: 1;
  revision: number;                   // optimistic locking
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}
```

Discriminated union sebaiknya ditingkatkan sesuai typing stack agar `SPATIAL_AREA` hanya menerima polygon dan `PERSPECTIVE_SURFACE` hanya quad. **Jangan menambahkan field yang sudah tersedia di parent entity tanpa alasan.**

## 8.2 Sample saved JSON (NON-PRODUCTION EXAMPLE)

```json
{
  "id": "spatial-example-001",
  "kind": "SPATIAL_AREA",
  "sceneId": "scene-example-10",
  "unitId": "unit-example-002",
  "label": "Ruang Tersedia",
  "geometry": {
    "type": "spherical_polygon",
    "vertices": [
      { "yaw": -145.0, "pitch": -3.0 },
      { "yaw": -134.0, "pitch": -2.5 },
      { "yaw": -133.6, "pitch": -13.0 },
      { "yaw": -145.4, "pitch": -13.4 }
    ]
  },
  "style": {
    "fillColor": "#10B981",
    "fillOpacity": 0.18,
    "strokeColor": "#34D399",
    "strokeOpacity": 0.95,
    "strokeWidthPx": 2,
    "hoverFillOpacity": 0.3,
    "showLabel": true
  },
  "action": { "type": "unit_detail" },
  "enabled": true,
  "schemaVersion": 1,
  "revision": 1
}
```

**Example IDs and coordinates are invented placeholders, NOT the actual Cawang unit geometry.** Agent wajib mengambil koordinat dari click di panorama real dan memastikan linked unitId benar.

## 8.3 Storage options

Agent pilih berdasarkan existing DB/ORM:

**Option A — New spatial entity table** (ideal jika hotspot old table fragile):

```sql
-- Contoh konseptual; sesuaikan tipe ID/schema naming dan migration tool existing.
CREATE TABLE spatial_entities (
    id              UUID PRIMARY KEY,
    scene_id        TEXT NOT NULL,
    unit_id         TEXT NULL,
    kind            TEXT NOT NULL,
    geometry_json   JSONB NOT NULL,
    style_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
    action_json     JSONB NOT NULL DEFAULT '{"type":"none"}'::jsonb,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    schema_version  INTEGER NOT NULL DEFAULT 1,
    revision        INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_spatial_entities_scene_id ON spatial_entities(scene_id);
CREATE INDEX idx_spatial_entities_unit_id ON spatial_entities(unit_id);
```

**Peringatan:** definisi ini **bukan migration siap pakai**; tipe FK/UUID/schema/timestamps harus sesuai real DB. Tambahkan FK sesuai relasi & lifecycle ketika diketahui. Hindari `ON DELETE CASCADE` tanpa persetujuan semantics existing.

**Option B — Extension existing hotspot table**, jika storage existing mendukung polymorphic type + JSONB & aman. Wajib tanpa merusak serialization legacy; tambah nullable geometry/style/kind baru secara additive.

**Option C — Existing scene JSON** jika benar-benar tidak ada DB model hotspot dan project hanya menyimpan scene config; gunakan versioned extensions tanpa mengubah key existing Pannellum.

Decision factors: API versioning, auditability, revision conflict, unit FK, backup, size, index/query patterns.

## 8.4 Migration compatibility

- Existing point hotspot tetap tersimpan dan tetap render **tanpa perlu migrasi data massal**.
- Spatial entities di-load hanya jika scene terkait aktif; optional empty list bila endpoint versi lama belum mendukung.
- Unknown `schemaVersion` tidak merusak seluruh viewer; skip invalid entity + log sanitized error.
- API response legacy tetap backward-compatible (additive fields/endpoints).
- Data unit authoritative tidak disalin dan disinkron manual ke polygon.
- Unit dihapus/diarsipkan: spatial area tetap dapat dimuat tetapi action detail ditandai unavailable; pilih policy orphan link sesuai business rules.
- Draft/publish state sesuai existing model; jika belum ada versi, design minimal snapshot/versioning sebelum expose publik.
- Migration rollback perlu menjaga **data baru tetap ada** atau backup/export sehingga deploy rollback tidak kehilangan spatial entity.

---

# 9. API CONTRACT & PERSISTENCE

## 9.1 Adapter methods (frontend)

```ts
interface SpatialRepository {
  listByScene(sceneId: string, version?: 'draft' | 'published'): Promise<SpatialEntity[]>;
  create(sceneId: string, input: CreateSpatialEntityInput): Promise<SpatialEntity>;
  update(id: string, patch: UpdateSpatialEntityInput, revision: number): Promise<SpatialEntity>;
  remove(id: string, revision: number): Promise<void>;
}
```

Jika aplikasi existing memakai bulk save via scene payload, gunakan contract existing dan terapkan compatibility adapter. Tidak perlu membuat endpoint paralel jika tidak sesuai architecture.

## 9.2 REST endpoints (contoh jika sesuai stack)

```http
GET    /api/scenes/:sceneId/spatial-entities?version=draft
POST   /api/scenes/:sceneId/spatial-entities
PATCH  /api/spatial-entities/:id
DELETE /api/spatial-entities/:id
GET    /api/scenes/:sceneId/spatial-entities?version=published
```

Bukan mandat hardcode. Sesuaikan base URL/auth/versioning existing. Jangan membuka `GET draft` untuk public anonymous viewer.

## 9.3 Server-side validation wajib

- Authentication + authorization; role editor/publisher berdasarkan ACL existing.
- Server verify `sceneId` benar-benar ada dan dapat diakses; `unitId` valid, tenant/site match.
- Validasi `kind` vs `geometry.type` dan number finite bounded.
- Vertices count, self intersection, area, no duplicates, quad convexity, valid URL/action target.
- Sanitize label, asset metadata; jangan render arbitrary HTML/XSS.
- Whitelist CSS colors/opacities/strokeWidth; exclude raw `style` string.
- Revision/version conflict (HTTP 409 atau equivalent) dan user-facing resolution.
- Rate limit/media upload size dan audit log operasi admin sesuai convention existing.
- Publish transaction atomic; spatial + existing scene config harus konsisten.

## 9.4 Draft / Preview / Publish

Recommended state machine, **disesuaikan existing implementation**:

```text
CMS local edits
  -> Dirty (unsaved)
  -> Save Draft (persist revision N)
  -> Full Preview (reads draft, read-only interaction)
  -> Publish (authorized, create published snapshot)
  -> Public Tour (reads published only)
```

- Save Draft tidak otomatis live ke publik.
- Publish hanya dari snapshot valid; jika existing CMS menggunakan single "Simpan" yang langsung publish, **jangan diam-diam mengubah semantics**. Laporkan dan desain kompatibilitas dahulu.
- Preview harus bisa membuka detail tenant dan scene nav tanpa menyunting geometry.
- Scene switch/navigation with dirty edits must prompt.
- Tidak ada silent auto-overwrite jika revision server berubah.
- Bila autosave existing, adaptasi debouncing dan conflict mechanism agar tidak race drag polygon.

---

# 10. INTEGRATION DENGAN MASTER DATA UNIT / TENANT / COVERAGE

## 10.1 Single source of truth

- `unitId` menunjuk record master ruang komersial existing.
- Nama tenant, kode unit, luas, fasilitas, status tersedia/terisi, tarif/detail sewa diambil dari API existing ketika panel terbuka.
- Area spatial menyimpan geometry & link, bukan snapshot seluruh master unit.
- Jika satu unit terlihat dari banyak checkpoint, unit boleh memiliki **lebih dari satu geometry berbeda**, masing-masing terikat ke scene.
- Unit dari scene lain tidak boleh sembarang dipilih bila bisnis membatasi station/level; filter selection.

## 10.2 Unit inspector interaction

1. Admin klik polygon.
2. Inspector menampilkan `Unit linked: ...` atau "Belum ditautkan".
3. Klik **Hubungkan Unit** → searchable selector memuat unit sesuai station/level existing.
4. Pilih unit → label/status diambil dari master; preview link tanpa menyimpan data duplikat.
5. Save Draft → relasi unitId persisted.
6. Public click → modal/detail tenant existing, bukan halaman duplikat baru.

## 10.3 Coverage calculation

- Jangan hardcode coverage `1/9` atau angka screenshot.
- Coverage harus berdasarkan definition bisnis existing (mis. jumlah unit eligible yang sudah ditandai, bukan jumlah hotspot mentah).
- Avoid double counting: satu unit memiliki banyak marker di banyak scene tetap dihitung sesuai scope dedup yang disepakati.
- Point Unit + Spatial Area untuk unit sama tidak menggandakan coverage.
- Status "Belum ditandai di tour" harus berubah hanya setelah geometry/hotspot tersimpan sesuai policy yang benar (draft vs published perlu keputusan).
- Filter `Retail`, `Media`, `Belum saja` tetap menggunakan taxonomy existing.

---

# 11. UNDO / REDO & EDITING TRANSACTIONS

Use existing undo/redo manager bila ada. Jika belum ada, implement command pattern minimal:

```ts
type EditorCommand =
  | { type: 'ADD_SPATIAL'; before: null; after: SpatialEntity }
  | { type: 'UPDATE_SPATIAL'; id: string; before: SpatialEntity; after: SpatialEntity }
  | { type: 'DELETE_SPATIAL'; before: SpatialEntity; after: null };
```

- Satu drag dari pointerDown→move→pointerUp menjadi **satu** undo entry, bukan puluhan setiap frame.
- `Escape` saat drag restore titik awal (cancel).
- Editing scene A history tidak bocor ke scene B; bisa global per session jika scoping tepat.
- Save successful memperbarui revision dirty baseline; undo dapat membuat perubahan baru yang butuh save.
- `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` saat fokus canvas, tetapi **jangan menangkap shortcut saat user mengetik di input/text editor**.
- Reset button existing semantics harus dipertahankan (reset view vs discard edits)—audit lalu beri label jelas.

---

# 12. FILE / COMPONENT ARCHITECTURE (ADAPT KE REPO)

**Contoh decomposition** — cari lokasi existing dulu; jangan create semuanya bila sudah ada analog:

```text
features/virtual-tour-editor/
  components/
    EditorShell.tsx
    EditorHeader.tsx
    EditorToolbar.tsx
    SceneExplorer.tsx
    ContextualInspector.tsx
    CoverageDrawer.tsx
    PanoramaViewport.tsx
    spatial/
      SpatialOverlay.tsx
      SpatialPolygonLayer.tsx
      SpatialHandleLayer.tsx
      SpatialAreaInspector.tsx
      PerspectiveSurfaceLayer.tsx        # optional
  hooks/
    usePanoramaAdapter.ts
    useCameraProjection.ts
    useSpatialEditorMachine.ts
    useEditorHistory.ts
    useSpatialEntities.ts
  lib/
    pannellum-adapter.ts
    geometry/
      spherical.ts
      projection.ts
      clipping.ts
      polygon-validation.ts
      homography.ts                    # optional, isolated
    spatial-schema.ts
    spatial-repository.ts
  tests/
    projection.test.ts
    clipping.test.ts
    polygon-validation.test.ts
    editor-state.test.ts
    spatial-persistence.test.ts
```

Do not introduce copy-pasted duplicated viewer initialization in CMS vs public. Reuse geometry/render domain primitives; separate editing-only handles.

---

# 13. IMPLEMENTATION TASKS & ACCEPTANCE CRITERIA PER PHASE

## PHASE 0 — AUDIT (READ ONLY)

**Tasks**

- [ ] Locate actual editor/page/wrapper/API/model files.
- [ ] Record tech versions and existing CI commands.
- [ ] Screenshot baseline desktop.
- [ ] Validate list of existing tools/flows.
- [ ] Inspect Pannellum scene and camera metadata.
- [ ] Map data model Unit, hotspot, Coverage, draft/publish.
- [ ] Produce audit doc and implementation file list.

**Acceptance**: No code change, no database change; report actual repo evidence and risks.

## PHASE 1 — EDITOR LAYOUT REFACTOR

**Tasks**

- [ ] Collapse CMS sidebar by default only in editor (preserve app navigation outside editor).
- [ ] Header with breadcrumb/current scene/save state/Preview/Save.
- [ ] Group tools and preserve action mapping.
- [ ] Scene Explorer search, scroll containment, hierarchy if existing data allows.
- [ ] Canvas flex adaptive; `min-width: 0`; viewer resize reliable.
- [ ] Contextual Inspector based on selection type.
- [ ] Move Coverage into drawer/tab, preserve all filters.
- [ ] Responsive collapsible side panels and focus controls.
- [ ] Preserve point hotspot editor, unit/Info/Iklan/Blur, duplicate/delete, undo, preview/save.

**Acceptance**

- No data loss, no blank panorama after panel toggle/scene switch.
- At 1366px, canvas usable and side panels do not overlap.
- Old hotspot selected → correct existing inspector values.
- Scene search and selection functional.
- All legacy action smoke tests pass.

## PHASE 2 — SPATIAL PROJECTION ENGINE POC

**Tasks**

- [ ] Abstract viewer camera state via adapter.
- [ ] Implement spherical_to_direction & calibrated project_to_screen.
- [ ] Create `mouseEventToCoords` round-trip automated/manual test harness.
- [ ] Implement SVG overlay sync while pan/zoom; cleanup RAF/event listeners.
- [ ] Implement seam-aware edge subdivision and viewport/near-plane clipping.
- [ ] Test horizon roll/pitch & partial panoramas if present.
- [ ] Prototype **1 static polygon** from click samples without persistence.
- [ ] Test Pannellum rotate entire 360°, zoom, resize, fullscreen, scene switch.

**Acceptance**

- Round-trip delta in viewport normal ≤ 3 CSS px.
- Polygon aligns visually through camera movement; no drifting.
- No exploding geometry behind camera; hidden/clipped safely.
- No console errors, listener/RAF leaks, drag interference.
- If geometry cases fail, phase stays blocked; don't fake a static SVG.

## PHASE 3 — SPATIAL AREA WYSIWYG AUTHORING

**Tasks**

- [ ] Toolbar Spatial Area mode.
- [ ] Click-to-add vertices; close, cancel, backspace last vertex.
- [ ] Edit vertex (drag), add/remove vertex (>=3), select polygon.
- [ ] Validation for degenerate/crossing geometry.
- [ ] Polygon styling, selection/hover, label controls.
- [ ] Associate with existing unit/tenant; `none`/info action when appropriate.
- [ ] Contextual Spatial Area Inspector.
- [ ] Undo/redo transactional support.
- [ ] CRUD using existing or additive storage architecture.
- [ ] Dirty state / Save Draft / unsaved scene switch prompt.

**Acceptance**

- Admin draws correctly over example vacant storefront.
- Refresh page → saved polygon geometry & linked unit intact.
- Undo/redo create/edit/delete works.
- Editing unit polygon doesn't change legacy pin, Scene/Info/Iklan/Blur flows.
- Invalid polygons cannot be saved; clear error message.

## PHASE 4 — PUBLIC RENDER + PUBLISH

**Tasks**

- [ ] Read spatial entities in public tour per current scene.
- [ ] Reuse same projection engine in read-only mode.
- [ ] Hover/click polygon opens existing unit detail using unitId/action.
- [ ] Hide draft/unpublished; fallback gracefully if spatial data missing.
- [ ] Coverage dedup / visibility / permission checks.
- [ ] Integration + e2e tests against legacy and new scenes.

**Acceptance**

- Published polygon visible and aligned in public viewer.
- Draft changes not leaked to public.
- Clicking returns correct existing unit detail.
- Existing scene navigation, point hotspots, ad/info/blur unchanged.

## PHASE 5 — PERSPECTIVE SURFACE (SEPARATE POC & OPTIONAL)

**Tasks**

- [ ] Four-corner picker, convexity/winding check.
- [ ] Safe asset/image resolver integrated with existing storage.
- [ ] Project quad corners and compute bounded homography.
- [ ] Correct scaling and transform origin.
- [ ] Hide invalid/behind-camera quad; correct cleanup.
- [ ] Public rendering + CMS editor handles & properties.
- [ ] Regression/performance/security review.

**Acceptance**

- Image follows wall across multiple angles/zoom with no instability.
- No iframe/script injection.
- Feature controlled by flag, can disable independently of Spatial Area.
- Only release after explicit successful POC review.

## PHASE 6 — HARDENING & DEV RELEASE VALIDATION

**Tasks**

- [ ] Build/typecheck/lint/unit/integration/e2e test.
- [ ] Security & authorization tests, error handling, asset validation.
- [ ] Performance/memory/browser tests.
- [ ] Accessibility keyboard/focus review.
- [ ] DB migration backup/rollback design, API compatibility verification.
- [ ] Update README/docs, feature flags, operational notes.
- [ ] Prepare DEV demo + screenshot/recording + release checklist.

**Acceptance**: report with tests passed/fail, risks, known limitations, files changed, reversible rollout path. No direct PROD release.

---

# 14. TEST MATRIX — WAJIB

## 14.1 Geometry and viewer

| Case | Expected |
|---|---|
| Click viewport center → yaw/pitch → inverse project | ≤ 3px error |
| Click four quadrants | correct orientation/no mirror |
| Rotate camera ±180° and full 360° | same polygon stays on same space |
| Zoom min/max HFOV | polygon scales correctly |
| Resize browser / collapse inspector | polygon realigns automatically |
| Fullscreen ↔ window | no offset drift |
| Panorama partially loads / scene change | no stale polygon |
| Polygon crossing yaw ±180° | no 358° wrap artifact |
| Polygon partly out of frame | clipping, no cross-screen fill |
| Polygon behind camera | not visible, no giant triangle |
| Polygon near top/bottom pitch | no NaN, defined behavior |
| Very thin polygon | validation error if degenerate |
| Self-intersecting polygon | save blocked |
| horizonPitch/Roll or cropped panorama used | projection calibrated or unsupported flagged |
| 50 polygons in one scene | acceptable FPS and memory |

## 14.2 Editor workflow

| Case | Expected |
|---|---|
| Draw 4-point unit polygon | polygon saved and rendered |
| Press Esc before closing | cancels draft, DB untouched |
| Backspace during drawing | removes last vertex |
| Drag vertex → undo | restores previous geometry in one step |
| Remove vertex of triangle | blocked (minimum 3) |
| Select point vs spatial vs scene | correct inspector |
| Pan mode with pointer over polygon | viewer remains draggable |
| Link existing Unit | correct unit detail and station scope |
| Save, refresh, re-open scene | geometry persisted |
| Scene switch while dirty | Save/Discard/Cancel |
| Network save failure | error + changes retained locally |
| Conflict revision | never silently overwrites server |
| Preview draft | editor handles removed, no editing |
| Publish spatial area | public sees only published revision |
| Existing Blur/Ad/Info/Scene/Unit | unchanged behavior |
| 2 panoramas for same unit | independent scene geometry, same unit link |
| Unit has legacy point + spatial area | coverage not double counted |

## 14.3 Security / quality

- Verify RBAC editor cannot access other station entities unless allowed.
- XSS attempts in `labelText`, `unit label`, user-provided URLs cannot execute.
- Asset image validation rejects unsafe MIME/oversized files.
- Server rejects nonfinite coordinates, enormous arrays, invalid actions.
- Public API cannot expose draft geometry/admin-only records.
- Test fallback no spatial data, corrupted optional entity, API timeout.
- Verify keyboard focus and touch interactions do not break viewer.
- Tests run without embedding API keys or `.env` in logs.

## 14.4 Required automated tests

- Unit tests: `normalizeYaw`, `sphericalToDir`, `project`, near-plane clip, seam, polygon validity, action/schema validation.
- Property/fuzz tests (where feasible): coordinates finite; drawing/round-trip stability; no SVG path NaN/Infinity.
- Component tests: active tool state, inspector mode, handle drag commands, dirty state.
- API integration: CRUD, invalid payload, revision conflict, auth, unit ID constraints.
- Browser e2e: editor route, loading existing scene, polygon creation, persistence, preview, legacy smoke.
- Visual regression screenshots for baseline vs redesigned editor if tooling exists.

**Use repository's existing test runner.** Do not inject Jest/Vitest/Playwright blindly if an equivalent exists; propose if absent.

---

# 15. RELIABILITY, SECURITY, ACCESSIBILITY, OPERATIONS

## 15.1 Reliability

- Never create more than one live Pannellum viewer per canvas.
- React Strict Mode initialization/cleanup must be idempotent.
- Handle 404 panorama, no WebGL, slow asset load, API missing, scene deleted, invalid geometry.
- Saving shouldn't be blocked indefinitely by spatial overlay rendering errors.
- Error boundary for new renderer; legacy panorama can still load if spatial overlay fails.
- Telemetry/error log should record scene ID, entity ID, non-sensitive exception code only.
- Memory cleanup for RAF, ResizeObserver, Pannellum listeners, DOM/media layers.

## 15.2 Security

- Input sanitization on client + server, strict schema, RBAC.
- No unsanitized `innerHTML`/`dangerouslySetInnerHTML` for tenant content.
- No external embed/iframe for Perspective Surface MVP.
- Secure object storage URLs consistent with current app.
- Use least-privilege API endpoints; rate limits if endpoints publicly writable (they should not be).
- CSRF/CORS following existing auth, trusted asset origins, CSP consideration.
- Do not log full tenant sensitive records/secrets.

## 15.3 Accessibility and UX

- Toolbars accessible buttons/aria-label and visible selected state.
- Escape exits draw mode; Enter confirms geometry; clear cursor hint.
- Panels have focus management when opening drawer or inspector.
- Selected area also represented in accessible element list (name, type, action), not only SVG color.
- Color never sole signal of availability.
- Always show accessible alternative for public visitor on keyboard/touch when polygon itself hard to target.

## 15.4 Feature flags

Recommended if existing flag framework available:

```text
virtualTour.editorV2.enabled
virtualTour.spatialArea.enabled
virtualTour.perspectiveSurface.enabled
```

- Editor V2 can roll back to current shell if tests fail.
- Spatial Area can be hidden without deleting persisted data.
- Perspective Surface is off until POC sign-off.
- Avoid ambiguous behavior where flag off causes API to delete data.

---

# 16. RELEASE STRATEGY — DEV → APPROVAL → PROD

> Ini implementation spec, **bukan perintah deployment langsung**.

1. Work in feature branch based on correct DEV branch, verify working tree clean before edits.
2. Land Phase 1 (layout) independently where possible.
3. Land Phase 2/3 behind flag; data migration additive & reversible.
4. Validate on DEV using snapshot/test records, never arbitrarily overwriting real tenant geometry.
5. Integrate public renderer only after CRUD/draft working.
6. Execute Golden Template CI/CD **jika repository menggunakan standar itu**: install/build, typecheck, lint, unit/integration, dependency/security scanning, SonarQube, artifact publish.
7. Manual functional acceptance of **Cawang / concourse unpaid / checkpoint 10** and other scenes as sample, including an existing point hotspot.
8. Provide rollback plan (app feature flags + code previous image + compatible additive schema; avoid destructive rollback).
9. Human approval before any PROD. Production pipeline should follow existing release controls; do not invent QA/BETA environment.

---

# 17. SPECIFIC DETAILED ACCEPTANCE SCENARIO — CAWANG

**Scenario:** Stasiun Cawang > check point 10 concourse unpaid, contoh unit yang terlihat dalam screenshot `CWG-CON-UNP-F-002`.

> Gunakan actual entity ID/scene ID dari DB, bukan string screenshot sebagai primary key.

1. Admin membuka scene tersebut; layout baru: app rail collapsed, scene explorer terlihat, panorama dominan, inspector kosong/default scene.
2. Admin klik tool **Spatial Area**.
3. Admin klik sudut-sudut batas bagian depan unit kosong (mis. 4–8 vertex, mengikuti perspektif yang terlihat di scene nyata).
4. Editor menampilkan preview fill transparan saat menambah vertex; Enter menutup polygon.
5. Admin memilih Spatial Area → inspector menunjukkan geometry/style/action.
6. Admin klik **Hubungkan Unit** dan mencari unit yang sesuai pada master unit Cawang.
7. Admin mengatur fill hijau transparan atau warna dari status mapping actual; stroke jelas, label "Ruang Tersedia".
8. Admin pan 360°, zoom in/out, lalu kembali ke unit: polygon harus tetap menempel pada batas unit.
9. Admin save draft, refresh, kembali ke scene: polygon tetap ada.
10. Admin klik **Full Preview**: vertex handles hilang; hover fill tetap tampil; klik polygon membuka detail unit master yang sama.
11. Jika publish authorized, public viewer menampilkan spatial area dengan metadata yang diperbolehkan.
12. Legacy hotspot di scene yang sama, navigasi scene, informasi iklan, blur, coverage dan daftar unit tetap berjalan.
13. Jika admin menonaktifkan spatial feature flag, panorama & legacy hotspots tetap berfungsi tanpa error.

**Pass criteria**: semua 13 langkah di atas berjalan, ditambah unit and browser test suite hijau.

---

# 18. CURSOR REPORT FORMAT (WAJIB SETIAP PHASE)

Setelah tiap fase, laporkan dalam bahasa Indonesia ringkas tetapi terukur:

```markdown
## Phase [N] — [Nama] 
Status: DONE / BLOCKED / PARTIAL
Progress keseluruhan: [0–100]% (berdasarkan milestone, bukan tebakan runtime)

### Yang dikerjakan
- ...

### File yang ditambah / diubah
- path/file: penjelasan

### Validasi
- [command] : PASS / FAIL
- manual smoke : PASS / FAIL

### Bukti
- screenshots/recording paths atau langkah reproduksi

### Risiko / keterbatasan
- ...

### Next single action
- Satu langkah paling aman berikutnya
```

**Progress weighting (boleh adapt jika repo mengubah scope):**

| Phase | Weight | Cumulative |
|---|---:|---:|
| P0 Audit | 10% | 10% |
| P1 Layout | 20% | 30% |
| P2 Projection POC | 20% | 50% |
| P3 Spatial Authoring | 20% | 70% |
| P4 Public Publish Integration | 15% | 85% |
| P5 Surface POC (optional) | 5% | 90% |
| P6 Hardening & handoff | 10% | 100% |

If Phase 5 intentionally deferred (valid MVP), recalculate MVP progress against phases 0,1,2,3,4,6 and report separately "Perspective Surface deferred" (do not claim it complete).

---

# 19. RISKS & DECISION LOG

| ID | Risiko | Severity | Mitigasi / Gate |
|---|---|---|---|
| R1 | Projection math berbeda dari Pannellum aktual | Critical | inverse projection test ≤3 px before editor |
| R2 | Polygon behind camera menghasilkan giant triangle | Critical | clipping near plane + seam tests |
| R3 | Draw overlay memblok pan/legacy hotspot | High | pointer-events state + interaction e2e |
| R4 | Data model hotspot lama rusak | Critical | additive schema + old route regression |
| R5 | Unit ID tidak cocok / double coverage | High | FK/validation + dedup per eligible unit |
| R6 | Draft bocor ke public | Critical | separate publish snapshot + auth |
| R7 | Pannellum resize/Strict Mode memory leak | High | lifecycle owner, event/RAF cleanup |
| R8 | Homography unstable/singular | High | optional POC, convexity, hide invalid surface |
| R9 | CSS `z-index`/drawers clipping | Medium | layout regression at multiple viewports |
| R10 | Storing pixel geometry | Critical | canonical yaw/pitch enforced |
| R11 | Touch/mobile pointer gestures conflict | Medium | desktop-first editing, touch testing |
| R12 | Surface media supports unsafe embed | High | image-only MVP and sanitized origin |

Open decisions determined after audit:

- Where/how existing CMS persists hotspots.
- Whether existing Save = Save Draft or Publish; what is current preview path.
- Existing scene camera metadata including horizon pitch/roll.
- Existing business definition of "coverage".
- Existing ACL roles and route permissions.
- Existing media upload/storage workflow.
- Whether app uses CDN or package Pannellum and whether its exact version diverges from upstream docs.

---

# 20. REFERENCES & RESEARCH (VERIFIED 27 OKTOBER 2026)

**Official Pannellum:**

1. API: https://pannellum.org/documentation/api/  
   `mouseEventToCoords()`, `getYaw()`, `getPitch()`, `getHfov()`, `loadScene()`, `getScene()`, `resize()`, `on()` / `off()`.
2. Configuration reference: https://pannellum.org/documentation/reference/  
   `hotSpots`, `createTooltipFunc`, `clickHandlerFunc`, `scale`, `hotSpotDebug`, image formats and partial panorama parameters.
3. Official hotspot demo: https://pannellum.org/documentation/examples/custom-hot-spots/
4. Official events list: https://github.com/mpetroff/pannellum/blob/master/doc/events.md
5. Upstream repository: https://github.com/mpetroff/pannellum

**Experimental reference only:**

6. BigFrames / Homography issue #1276: https://github.com/mpetroff/pannellum/issues/1276  
   Submitted Aug 20, 2026; describes 4-corner (TL/TR/BR/BL) perspective mapping, CSS matrix3d, debug handles. **Open issue / not guaranteed merged upstream**.
7. Community branch: https://github.com/contreforme/pannellum/tree/feature/renderHotspot-adjustment
8. Community demo: https://exp360.contreforme.ch/

**Guidance:** Verify actual installed version/API in repo instead of assuming examples exactly match the bundle.

---

# 21. DEFINITION OF DONE — END TO END

A release candidate is only **DONE** when:

- [ ] UX shell is materially cleaner and functional at common desktop sizes.
- [ ] Editor keeps Pannellum, existing scenes and all point/Unit/Info/Iklan/Blur features.
- [ ] Spatial polygon is authorable with mouse, selectable, editable, validated, deletable, undoable.
- [ ] Geometry uses canonical spherical coords and projects reliably across pan/zoom/resizes.
- [ ] Polygon partially/fully outside view behaves safely (no drifting, giant path, Infinity).
- [ ] Spatial data persists and is appropriately linked to existing unit and scene.
- [ ] Preview/publish/public behavior is correct and no draft leak.
- [ ] Coverage correctly deduplicates units and preserves existing filters.
- [ ] Security, RBAC, data validation and error handling are tested.
- [ ] Tests/build/lint/security checks are green or deviations clearly reported.
- [ ] Documentation explains architecture, known limitations, rollback and flags.
- [ ] A DEV demo with a unit area in Cawang is available for review.
- [ ] No direct PROD changes have been made by the agent.

**MVP acceptance:** All items except Perspective Surface are mandatory. Perspective Surface may remain behind feature flag as a clearly identified Phase 5 follow-up until proven stable.

---

# 22. COPY/PASTE PROMPT TO CURSOR AGENT

```text
Read and follow TECHNICAL_SPEC_VIRTUAL_TOUR_EDITOR_V2_SPATIAL_HOTSPOT.md completely.

Context:
- This is an existing LRT Jabodebek Virtual Tour CMS with Pannellum.
- Goal: redesign editor layout and add Spatial Area Polygon Hotspots tied to existing tenant/unit master data.
- Keep current point hotspots, scene management, Unit, Info, Iklan, Blur, Coverage, Preview, Save, and public tour compatible.
- Do NOT migrate away from Pannellum or adopt third-party fork without permission.
- Do NOT access or modify PROD. Work in DEV, preserve data and secrets.

Start with PHASE 0 only (READ ONLY):
1. Inspect repository and map actual files/components/APIs/data model/Pannellum integration.
2. Check current behavior, draft/publish semantics, geometry constraints and CI/test tooling.
3. Produce a detailed audit with exact file paths and proposed small change batches.
4. Explain any architectural blockers and risk of breaking current features.
5. Report progress % and exactly one recommended next step.

Do not start Phase 1 modifications until Phase 0 findings have been reviewed.
When later authorized, implement phases sequentially with tests and phase gates from the MD.
```

> **Final principle:** **audit first → small safe changes → test actual geometry → persist → publish → harden**. A stable spatial editor matters more than a visually impressive but inaccurate overlay.
