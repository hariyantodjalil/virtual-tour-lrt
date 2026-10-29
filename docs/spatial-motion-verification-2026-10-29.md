# Verifikasi polygon Spatial saat panorama bergerak

## Penyebab dan perbaikan

Polygon sebelumnya membaca getter kamera melalui requestAnimationFrame tersendiri, lalu memperbarui SVG melalui React. Pannellum merender panorama sebelum memajukan sudut kamera untuk frame berikutnya. Akibatnya, pembacaan getter dapat memakai sudut yang berbeda dari panorama yang sedang ditampilkan; pembaruan React juga dapat terlambat sebelum paint. Ketika berhenti, posisi kembali sejajar.

Adapter sekarang mengambil pitch, yaw, dan hfov yang benar-benar diteruskan ke renderer Pannellum. Pembaruan overlay digabung dalam microtask dan dikomit sebelum paint melalui flushSync. Ukuran proyeksi memakai clientWidth/clientHeight agar sesuai dengan koordinat layout renderer. Adapter tanpa getRenderer tetap memakai fallback requestAnimationFrame.

Hook renderer dibagi antar pelanggan, mempertahankan this dan nilai kembalian renderer asli, lalu dilepas ketika overlay tidak lagi diperlukan. Pengujian perpindahan scene memeriksa pelepasan dan pemasangan ulang hook. Integrasi bergantung pada renderer Pannellum 2.5.7; ulangi tes gerak ketika mengganti versi. Urutan render dapat diperiksa di [sumber resmi Pannellum 2.5.7](https://github.com/mpetroff/pannellum/blob/2.5.7/src/js/pannellum.js).

## Bukti sebelum dan sesudah

Tes browser melakukan empat drag vertikal dengan mouse pada viewport 1366 × 900. Satu vertex polygon dibandingkan terhadap hotspot native Pannellum pada koordinat bola yang sama, menggunakan posisi DOM setelah transform marker berubah. Sampel hanya dihitung ketika marker bergerak lebih dari 0,25 CSS px.

| Pengukuran | Sebelum | Sesudah |
| --- | ---: | ---: |
| Sampel bergerak | 95 | 95 |
| Selisih maksimum (CSS px) | 5,9100 | 0,0067 |
| Selisih persentil 95 (CSS px) | 5,8946 | 0,0060 |
| Selisih rata-rata (CSS px) | 5,6935 | 0,0037 |
| Selisih setelah berhenti (CSS px) | 0,0033 | 0,0033 |

Ini mengukur keselarasan DOM pada fixture lokal sintetis, bukan pembandingan piksel hasil GPU atau jaminan untuk semua perangkat. Tes gagal pada versi lama dan lolos sesudah perubahan, dengan batas maksimum 3 CSS px. Tes final juga lolos dua siklus scene dengan Spatial → tanpa Spatial → dengan Spatial, tanpa peringatan lifecycle flushSync React.

## Pemeriksaan regresi

- `npm run build`: lolos, termasuk TypeScript.
- `npm run test:spatial`: 21 tes lolos.
- `npm run lint`: tanpa error; 7 warning yang sudah ada.
- ESLint terarah untuk adapter, overlay, dan skrip gerak: lolos.
- `check-spatial-camera-browser.js`: alignment, resize, culling, keyboard, drag vertex, undo, tambah/hapus vertex, mode edit/pan, dan pilihan Pin/Spatial lolos.
- `check-spatial-authoring-browser.js`: Selesaikan mempertahankan empat titik untuk polygon baru dan sisi tambahan unit existing; drag/undo, Pin, dan Blur lolos.
- `check-spatial-unit-groups-browser.js`: satu label per unit, highlight bersama, pemilihan sisi terpisah, drag/undo/redo, dan label saat sisi pertama tidak terlihat lolos.
- `check-spatial-motion-browser.js`: drag vertikal, pelepasan/pemasangan ulang hook saat pindah scene, dan pemeriksaan peringatan React lolos.

Semua fixture dan akun pengujian memakai database lokal sementara di 127.0.0.1:6147/lrt_spatial_test. Tidak ada perubahan data pengguna atau publikasi area sebenarnya. Perubahan belum di-commit atau di-deploy.

Probe FPS tambahan tidak dipakai untuk klaim peningkatan performa: fixture berbeda dari benchmark terdahulu dan satu pengulangan 50 area masih mengalami jeda. Perbaikan ini menyelesaikan ketidaksamaan frame kamera; tidak membuktikan 60 FPS stabil.
