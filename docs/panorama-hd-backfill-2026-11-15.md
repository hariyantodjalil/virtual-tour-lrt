# Backfill profil panorama HD — 15 November 2026

Kontrak field: **`canvasData.multiResProfilesHd`** (pembaca: `lib/panorama-hd-profile.ts`,
Codex). `multiResProfiles` tetap menjadi profil **Hemat** dan tidak pernah diubah
oleh pekerjaan ini. Aset HD hanya ditambahkan; tile Hemat, `multiRes` legacy,
`panoramaUrl`, `thumbnailUrl`, hotspot, spatial, kamera awal, dan metadata CMS
lain tidak tersentuh.

## Struktur metadata (contoh nyata dari pilot)

```jsonc
"multiResProfilesHd": {
  "version": "jpeg85-v1",            // reader memvalidasi lewat validator Hemat
  "desktop": {                        // PannellumMultiRes — tile 1024, cube 4096
    "basePath": "/virtual-tour/panorama-tiles/jatimulya/check-point-1-concourse-paid/hd-<uuid>/desktop",
    "path": "/%l/%s%y_%x", "extension": "jpg",
    "tileResolution": 1024, "maxLevel": 3, "cubeResolution": 4096
  },
  "mobile": { "tileResolution": 512, "maxLevel": 4, "cubeResolution": 4096 },
  "privacyVerified": true,            // wajib true — tanpa ini reader menyembunyikan HD
  "sourcePanoramaUrl": "/virtual-tour/panoramas/…",  // anchor kesegaran
  "privacyBlurLastBakedAt": "…",      // mirror status blur; berubah → HD disembunyikan
  "provenance": {
    "source": "original" | "original-reblur",
    "sourceKey": "/virtual-tour/originals/…",
    "sourceDimensions": "11904x5952",
    "generator": { "jpegQuality": 85, "cubeResolution": 4096,
                    "tileResolutions": { "mobile": 512, "desktop": 1024 } },
    "privacy": {
      "blurRegions": 1, "reBakedAtNative": true, "extentDerivedFromDisplay": true,
      "regionsVerified": 1,
      "viewerContext": { "viewerWidth": 1200, "viewerHeight": 675, "hfov": 100 },
      "verifiedAgainstKey": "/virtual-tour/panoramas/…"
    },
    "createdAt": "2026-11-15T06:19:10.000Z"
  }
}
```

Untuk pengatur kualitas otomatis: pilih profil dengan aturan yang sama seperti
Hemat — `viewportWidth >= 1024 ? desktop : mobile`. Reader
`extractHdMultiResProfilesFromCanvasData(canvasData, panoramaUrl)` sudah
menyembunyikan HD basi secara otomatis (panorama/blur/patch berubah → undefined).

## Keselamatan sumber HD

`originalPanoramaUrl` tidak otomatis aman — blur baked hanya ada di display
(6000px). Alur per scene (`lib/panorama-hd-source.ts`):

1. **AI patch aktif → skip** — master native tidak membawa patch.
2. **Blur baked + region kosong → skip** — blur existing tak bisa direproduksi.
3. **Blur baked → turunkan extent dari piksel display**: sel 16px di sekitar
   pusat region dengan aturan Voronoi (region terdekat), seam ±180° dinormalisasi,
   konten datar diabaikan. Konteks per-region diselesaikan analitik/bisection
   sehingga **width/scale region tidak diubah** (rumus sigma tetap setara).
   Bake dirantai per region di resolusi native; cap sigma diskalakan
   `nativeW/displayW` supaya angular setara (perbaikan di
   `panorama-privacy-blur-bake.ts`, default = perilaku lama).
4. **Bukti sebelum publikasi** — semua wajib lolos:
   - paritas global display vs original-downscaled ≥ 0.95 (sumber harus gambar sama);
   - superset sel: setiap sel 16px yang diblur display juga diblur di HD
     (sel tepi diampuni bila bertetangga sel HD; sel terisolasi = lubang → gagal);
   - korelasi konten pusat region ≥ 0.6;
   - scan kasar 128px: blur besar di luar semua region → tak terjelaskan → gagal.
5. Gagal salah satu → scene **di-skip dengan alasan**, tidak ditebak.

## Penggunaan

```
npm run panorama:backfill-hd [slug] [--scene=ID] [--kind=station|train] \
  [--dry-run] [--limit=N] [--concurrency=1..3] [--backup-dir=DIR]
```

- Resume/idempotent: scene yang sudah punya `multiResProfilesHd` dilewati.
- Dry-run menjalankan seluruh verifikasi sumber tanpa upload/tulis DB.
- `canvasData` lama dicadangkan per scene ke `<backup-dir>/canvas-before-hd.jsonl`
  (default `/tmp/vt-hd-backup`, di luar repo).
- Publikasi atomik lewat `panoramaHdProfileUpdateQuery` (jsonb_set + guard
  panoramaUrl/status blur/AI/HD-sebelumnya); rowCount 0 → conflict, tile terunggah
  tapi metadata tidak dipublikasi.
- Refuse bila ada proses backfill panorama lain yang berjalan.
- Exit 1 hanya bila ada kegagalan nyata; skip/unavailable/conflict bukan failure.
- Tidak mencetak secret atau DATABASE_URL.

## Hasil pilot (3 scene nyata, 15 Nov 2026)

| Scene | Sumber | Waktu | Verifikasi |
|---|---|---|---|
| jatimulya/check-point-1-concourse-paid | original-reblur 11904×5952, 1 region | 78 dtk | reader OK, Hemat utuh, tile 1024×1024 valid |
| jatimulya/check-point-1-koridoe-transfer | original 11904×5952 | 61 dtk | reader OK, Hemat utuh, tile valid |
| cawang/check-point-1-peron-1 | original-reblur 8000×4000, 3 region (drift pasca-bake) | 82 dtk | lolos semua bukti superset |

Sampel dry-run 20 scene (kuningan/cawang/jatimulya): 12 lolos, 2 unavailable
(sumber ≤6400px), 6 skip konservatif (cluster region ambigu / sel terisolasi).
636 tile per scene (mobile 510 + desktop 126), ±60-100 KB per tile level-2.

## Resume dan rollback

- **Resume**: jalankan ulang perintah yang sama — scene berprofil dilewati otomatis.
- **Rollback HD saja** (Hemat tak tersentuh):
  `UPDATE virtual_tour_scenes SET "canvasData" = "canvasData" - 'multiResProfilesHd' WHERE …;`
  atau pulihkan dari `canvas-before-hd.jsonl`. Tile HD di S3 menjadi yatim dan
  tidak dirujuk siapa pun — boleh dibiarkan atau dibersihkan terpisah.
- **Invalidasi otomatis**: route upload/bake-blur/bake-AI-patch memanggil
  `withoutHdPanoramaProfiles()` saat panorama fisik berganti, dan reader
  menyembunyikan HD basi — dua lapis pengaman.

## Hasil akhir backfill penuh (selesai 17 November 2026 15:45 WIB)

Dikerjakan paralel dua mesin (container Linux + agent Windows/Codex), dengan
tiga insiden jaringan (DNS putus, koneksi penuh, transisi TLS) yang semuanya
ditangani circuit-breaker/penjaga auto-restart tanpa kehilangan progres.

| Kategori | Jumlah | Keterangan |
|---|---:|---|
| **HD berhasil (stasiun)** | **788** | Dari 1.113 scene ber-sumber native |
| **HD berhasil (kereta)** | **12/12** | Semua scene kereta |
| **HD total (reader kontrak Codex)** | **800** | `extractHdMultiResProfilesFromCanvasData` valid semua |
| Hemat (multiResProfiles) utuh | **1.130/1.130** | Profil Hemat tak tersentuh sama sekali |
| Legacy multiRes utuh | **1.130/1.130** | Tile lama tetap dirujuk — rollback penuh tersedia |
| Skipped (blur tak terverifikasi) | 291 | Scene ber-blur ambigu/diubah pasca-bake — alasan per baris di log |
| Unavailable (tanpa sumber native) | 19 | Panorama lama pra-fitur original |
| Unavailable (sumber ≤6400px) | 34 | Tak lebih tajam dari Hemat — tanpa upscale |
| Cadangan canvasData | 571 scene | `/tmp/vt-hd-backup/canvas-before-hd.jsonl` |

Perbaikan bug yang ditemukan selama batch (semua sudah di working tree):
- cap sigma diskalakan resolusi (crop minDim, bukan gambar penuh);
- composite alfa manual menggantikan dest-in (tanpa pojok hitam);
- snap grid 16px pada scan derive (sel tepi tidak lolos deteksi);
- aturan Voronoi antar region berdekatan;
- clamp crop cek konten di tepi gambar (region seam ±180° — bug yang
  membuat 1 scene gagal berulang, kini lolos).

## Yang belum selesai

- 291 scene skip + 34 unavailable sumber kecil bisa ditinjau ulang manual:
  re-bake blur di CMS menyegarkan display, lalu jalankan
  `npm run panorama:backfill-hd` — scene ber-HD dilewati otomatis.
- Commit/push menunggu instruksi (working tree berisi seluruh pekerjaan
  12–17 November: pemulihan, spatial, AI patch, dan HD).
