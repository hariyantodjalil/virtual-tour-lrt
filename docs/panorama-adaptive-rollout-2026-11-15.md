# Rollout profil tile adaptif - 15 November 2026

Dokumen ini menutup pekerjaan yang terpotong malam 14-15 November (limit pemakaian
tercapai saat penerapan sedang berjalan). Keputusan profil mengikuti
[panorama-tile-preload-trial-2026-11-15.md](panorama-tile-preload-trial-2026-11-15.md):
**sumber aman privasi + JPEG 85, tile 1024px desktop / 512px mobile, preload terarah.**

## Yang diterapkan ke aplikasi

| Bagian | Perilaku |
|---|---|
| `uploadAdaptivePanoramaTiles` | Dua pyramid (mobile 512, desktop 1024) dari satu sumber, prefix UUID baru per scene sehingga cache lama tidak tertimpa, metadata `multiResProfiles` hanya dipublikasi setelah kedua upload selesai. |
| Route upload scene (station + train) | Profil adaptif dibuat dari **panorama display**, bukan sumber asli yang belum diblur. `canvasData.multiRes` diarahkan ke profil mobile agar image rollback tetap ringan. |
| Route bake blur (station + train) | Profil adaptif dibuat dari **master hasil bake** (resolusi penuh). Pyramid 4096 hanya muncul dari sumber yang sudah aman privasi. |
| Public viewer | `selectSceneMultiRes` memilih desktop pada viewport >= 1024px dan mobile di bawahnya; tanpa profil, fallback ke `multiRes` lama. |
| Preload terarah | Hover/fokus hotspot scene men-`schedule` preload maksimal 2 tile ke arah pandang tujuan (debounce 120 ms, skip saveData/2g). Preload 6 tile level rendah pada transisi tetap seperti hasil uji. |
| Eksperimen arrival preload | Helper `panoramaArrivalUrls` dihapus pada 15 November 2026 setelah dipastikan tidak dipanggil aplikasi. |

## Backfill data lama

```
npm run panorama:backfill-adaptive [slug] [--dry-run] [--limit=N]
```

Aturan mainnya:

- Sumber **selalu `panoramaUrl` publik saat ini** — master yang sudah aman privasi.
  `originalPanoramaUrl` tidak pernah dipakai karena bisa belum diblur.
- `canvasData.multiRes` lama **tidak diubah**; hanya `multiResProfiles` yang ditambah.
  Image rollback kembali ke tile lama tanpa perubahan perilaku.
- Bisa dihentikan dan diteruskan: scene yang sudah punya profil dilewati otomatis.
- `--dry-run` membangun kedua pyramid di memori tanpa upload S3 dan tanpa tulis DB.

Urutan yang disarankan: jalankan backfill lama
(`scripts/backfill-panorama-tiles.ts`) lebih dulu untuk scene yang belum punya tile,
lalu backfill adaptif ini.

## Rollback

Aplikasi: image lama membaca `canvasData.multiRes` (profil mobile atau tile lama),
viewer tetap jalan. DB: hapus kunci `multiResProfiles` dari `canvasData` scene —
tile lama masih ada di S3 karena tidak pernah ditimpa (prefix UUID berbeda).
Objek pyramid baru boleh dibiarkan; tidak dirujuk siapa pun setelah kunci dihapus.

## Pilot Jatimulya penuh (52 scene, DB lokal)

Dijalankan dari salinan Linux; `node_modules` Windows tidak disentuh.

| Pemeriksaan | Hasil |
|---|---|
| Dry-run 4 scene | 6000×3000 → cube 2048; mobile 126 tile / ~2-3 MB; desktop 30 tile / ~1,7-2,7 MB; ~11 dtk/scene di memori. |
| Backfill nyata | 52/52 scene Jatimulya sukses, 0 gagal; ±13 dtk/scene termasuk upload S3; prefix UUID baru per scene. |
| DB | `multiResProfiles` valid di seluruh 52 scene (semua scene aktif tercakup); **`multiRes` lama utuh di 52/52** (rollback aman). |
| Pemilihan profil | viewport >= 1024 px → desktop 1024; < 1024 px → mobile 512. |
| Tile di S3 | desktop lvl2 = JPEG 1024×1024 valid; mobile lvl1 = JPEG 512×512 valid. |
| Aplikasi | `/station/jatimulya` HTTP 200 dengan profil di payload; tile terunduh lewat `/api/s3-proxy/...` (desktop 93 KB, mobile 44 KB). |
| Validasi kode | `tsc --noEmit`, `eslint` (0 error, 8 warning lama), `test:spatial` 21/21, `next build` lolos. |

Cadangan `canvasData` Jatimulya sebelum pilot disimpan di luar repo
(`jatimulya-canvas-before.json`); rollback juga bisa cukup dengan menghapus
kunci `multiResProfiles` per scene.

## Backfill penuh (selesai 15 November 2026, 12:15 WIB)

1.078 scene stasiun diproses dalam dua sesi (job terputus saat sesi berhenti
05:49, dilanjutkan 11:38 setelah VPN host nyala kembali). Hasil verifikasi
akhir lewat jalur kode aplikasi (`extractMultiResProfilesFromCanvasData`):

| Pemeriksaan | Hasil |
|---|---|
| Profil adaptif valid | **1.130/1.130 scene** yang punya tile |
| `multiRes` lama utuh | **1.130/1.130** — setiap scene berprofil tetap menyimpan tile lama (rollback aman) |
| Profil tanpa legacy | 0 |
| Spot-check tile | tmii desktop lvl2 = JPEG 1024×1024 valid |
| Scene tanpa tile | 2 scene memang tanpa panorama sama sekali: `cawang/sence-1` (masih aktif, perlu dibersihkan terpisah) dan `bekasi-barat/outdoor-umum-03` (sudah dinonaktifkan 14 Nov) |
| Scene kereta | 12 scene, memang tanpa multiRes (equirect penuh) — tidak termasuk backfill |

## Yang belum dilakukan

- Verifikasi visual di browser (Responsively/HP fisik) untuk profil adaptif aktif
  belum diulang; angka uji sebelumnya berasal dari harness simulasi.
- Cache CDN production belum diverifikasi; angka 1 tahun hanya berlaku cache browser.
- `cawang/sence-1` (aktif, tanpa panorama) belum dibersihkan — kandidat
  dinonaktifkan seperti `outdoor-umum-03`.
- Belum ada commit/push; seluruh perubahan masih di working tree bersama
  pekerjaan 14-15 November yang lain.
