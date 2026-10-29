# Spatial Hotspot — perbaikan dan verifikasi lokal, 28 Oktober 2026

Pilihan **Unit → Pin / Spatial** dipertahankan. Keduanya menggunakan master CommercialSpace dan detail unit existing. Jumlah unit Coverage tidak digandakan; daftar placement tetap dapat memuat pin dan beberapa area pada scene berbeda.

## Perubahan kontrak

- Semua jalur pemuatan scene memulihkan state Spatial bersama hotspot/blur. Simpan setelah refresh tidak lagi mengirim array kosong akibat state yang belum diinisialisasi.
- `spatialEntities` adalah draft area. `publishedSpatialEntities` adalah snapshot untuk pengunjung. Simpan tetap menyimpan konfigurasi/pin existing, tetapi area baru hanya tampil publik setelah **Publikasikan Area**. Penjelasan ini ditampilkan pada toolbar.
- PUT yang membawa area harus menyertakan `spatialRevision` dari response CMS. Server memakai compare-and-swap atomik; revisi stale menghasilkan 409 tanpa menimpa data. Pesan error mempertahankan perubahan lokal.
- Server memeriksa unit/stasiun, kesesuaian kode dan ID, scene pemilik, ID entity unik, serta target scene. Target navigasi yang tidak aktif ditolak saat publikasi. Unit yang sudah dihapus perlu dilepas atau ditautkan ulang melalui inspector sebelum draft bisa disimpan; geometrinya tetap dapat dimuat.
- Action none/unit_detail/info_detail/open_scene dijalankan oleh dispatcher yang sama di preview dan public.
- Authoring mendukung drag vertex lokal lalu satu commit/undo, cancel Escape, midpoint insertion, minimum tiga vertex, keyboard arrow/Delete, Enter/Backspace saat menggambar, serta daftar area termasuk yang nonaktif.
- Mode Geser menonaktifkan hit target Spatial. Renderer memakai clipping arah terhadap near-plane/frustum sebelum perspective divide, bukan menghapus vertex di belakang kamera. Error boundary mempertahankan panorama jika overlay gagal.
- Yaw API dibatasi; normalisasi modulo tidak dapat menggantung pada angka finite sangat besar. Normalizer melewati schemaVersion yang tidak dikenal.

## Database dan rollout

Migration additive: `20261028140000_spatial_draft_publish`, setelah `20261027120000_add_spatial_entities`.

Migration baru menambahkan snapshot publik dan revisi. Area lama yang sebelumnya sudah live disalin sekali menjadi snapshot awal. Setelah migration, save draft tidak otomatis mengubah snapshot publik.

Flag client `NEXT_PUBLIC_CMS_SPATIAL_HOTSPOT` harus disetel **saat build image**, melalui Docker build ARG / GitLab BUILD_ARGS / pipeline Jenkins produksi. Flag runtime `CMS_SPATIAL_HOTSPOT=0` dapat menonaktifkan data public dan penulisan Spatial meskipun client sebelumnya dibangun aktif. Compose meneruskan kedua flag. Default produksi tetap off.

Rollback normal: nonaktifkan flag server dan gunakan image sebelumnya. **Pertahankan kolom dan data Spatial**, jangan DROP COLUMN. Backup database sebelum migration/release. Tidak ada migration atau deploy pada database aplikasi/production dalam sesi perbaikan ini.

## Verifikasi

- `npm run test:spatial`: 18 test lulus, mencakup clipping sepanjang siklus yaw, seam, koordinat ekstrem, action dispatch, schemaVersion, link unit, dan validasi polygon.
- `scripts/verify-spatial-api.mts`: 17 pemeriksaan integrasi lulus menggunakan Route Handler aktual, Prisma dan PostgreSQL 17 sementara di `127.0.0.1:6147/lrt_spatial_test`. Termasuk auth, draft/public, publikasi, race dua editor (200/409), cross-station rejection, target scene nonaktif, response revisi API list, dan legacy save.
- Seluruh 22 migration berhasil dijalankan pada PostgreSQL sementara. Skrip fixture menolak URL di luar database lokal khusus tersebut.
- Build produksi dan TypeScript lulus; lint tidak memiliki error (warning existing tetap dilaporkan).
- Docker Compose DEV dan PROD: config validation lulus; port produksi 80 dan DEV 5011/Postgres 6010 dipertahankan.
- Browser Chromium dengan Pannellum 2.5.7 aktual: 75 sampel mouseEventToCoords pada tiga kombinasi yaw/pitch/HFOV; maksimum error inverse-projection 0,944 CSS px (<3 CSS px).
- Browser fixture lokal: drag → satu undo, tambah/hapus vertex, link unit, save, refresh → save mempertahankan polygon dan pin, serta mode Geser passive sudah lulus.
- Browser: menggambar empat titik, Backspace/Escape, dialog dirty Cancel/Save-and-switch, pindah ke scene kosong tanpa membawa geometry, serta preview draft tanpa handle sudah diverifikasi. Setelah publikasi eksplisit, area muncul di viewer publik dan keyboard Enter membuka detail unit existing. Tinggi popup diperbaiki agar tombol tutup tetap berada dalam canvas preview.
- Responsive: viewport 1366/768/390 px menghasilkan canvas masing-masing 702×705 / 632×601 / 254×463 px. Tombol Preview tetap berada dalam viewport. Screenshot: `output/playwright/spatial-fixed-{1366,768,390}.png`.
- Workload Chromium lokal: 50 area, pan 90 frame, rerata 40–41 FPS / p95 frame 33 ms, tanpa exception JavaScript atau koordinat nonfinite. Cache tessellation sudah ditambahkan dan diuji ulang; pengukuran belum membuktikan target 60 FPS pada perangkat produksi. Validasi performa pada desktop target DEV tetap diperlukan.

Artifact browser berada di `output/playwright/` yang di-ignore. Fixture adalah data sintetis terisolasi, bukan geometry tenant asli.

## Batas acceptance

Perspective Surface tetap deferred (opsional). Alignment pada panorama asli Cawang/checkpoint 10 dan unit asli tetap memerlukan acceptance DEV setelah migration dan image terpasang. Kalibrasi saat ini untuk panorama equirectangular tanpa horizonPitch/Roll khusus; metadata kamera khusus dan browser/touch lain belum menjadi bukti PASS. Jangan menyebut seluruh spesifikasi selesai hanya berdasarkan build dan fixture lokal.
