# Release live.1.0.40

29 Oktober 2026. Pengguna meminta push DEV, merge ke branch PROD, tag live, dan pemantauan Jenkins setelah menerima hasil review lokal.

Ruang lingkup: editor Spatial Hotspot dan snapshot publik, pengaturan kamera tujuan, perapihan editor/CMS, penanganan error dashboard/leads, migrasi Prisma, konfigurasi Docker/CI, dokumentasi dan tes, serta penghapusan artefak Playwright dari Git.

## Temuan review yang masih terbuka

- P1: navigasi Preview antar-scene belum memindahkan state Spatial/history secara lengkap.
- P2: drag yang dimulai pada hit target polygon dapat terblokir sebelum mencapai Pannellum.
- P2: fokus unit yang melewati seam yaw ±180° masih memakai rata-rata sudut biasa.
- P2: detail ruang sewa kereta dapat mempertahankan gerbong sebelumnya setelah navigasi peta formasi.
- P2: skrip smoke-spatial lama belum membatasi database sementara; jangan menjalankannya pada database pengguna.

Tidak ada perbaikan tambahan untuk temuan tersebut yang disisipkan pada rilis ini. Validasi lokal terakhir: build dan lint lolos tanpa error, 24 tes lolos, konfigurasi Compose DEV/PROD valid. Target 60 FPS belum dijamin untuk semua perangkat.
