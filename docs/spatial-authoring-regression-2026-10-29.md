# Perbaikan polygon berubah saat diselesaikan

## Gejala dan reproduksi

Empat klik membentuk kotak yang valid. Saat pengguna mengklik tombol **Selesaikan area** pada inspector, outline tiba-tiba memanjang ke kanan dan ditolak sebagai self-intersecting. Polygon tetap berstatus draft, sehingga handle edit polygon tersimpan belum tersedia. Kasus ini juga berlaku pada sisi tambahan unit existing.

Penyebabnya listener `pointerdown` penambahan vertex terpasang pada `window`. Klik tombol inspector ikut memulai gesture penambahan titik. Listener `pointerup` kemudian mengonversi koordinat tombol di luar panorama menjadi yaw/pitch dan menambahkan titik kelima sebelum klik tombol selesai diproses.

Reproduksi pada production build sebelum perbaikan, memakai fixture lokal sementara:

```text
node output/playwright/run-spatial-local.cjs scripts/check-spatial-authoring-browser.js
Error: new area: finish changed geometry; draft=5, committed=0
```

Screenshot pada reproduksi memperlihatkan kotak empat titik ditambah satu titik di luar viewport, dengan pesan `Polygon self-intersecting ditolak`. Pengujian sebelumnya banyak menyelesaikan draft lewat Enter; pengujian ini secara khusus mengklik tombol inspector.

## Perubahan

Pada `PannellumEditor.tsx`, gesture penambahan kini hanya dimulai dari container panorama. Tombol, form, kontrol Pannellum, serta hit target hotspot tidak memulai penambahan vertex. Posisi dan target pelepasan pointer juga harus berada di panorama untuk menambahkan titik.

Gesture dilacak berdasarkan pointer ID. Pointer lain tidak dapat menyelesaikan gesture yang sedang berjalan, dan `pointercancel` membersihkan gesture agar tidak menyisakan klik tertunda. Perubahan ini juga menjaga authoring Pin dan Blur yang memakai jalur input sama.

Validasi self-intersection tetap aktif. Polygon yang benar-benar memiliki sisi berpotongan tetap ditolak; validasi tidak dilonggarkan untuk menyembunyikan masalah input.

## Hasil verifikasi

Production build lolos. `npm run test:spatial` lolos 18 tes. Lint seluruh repo selesai tanpa error, dengan 7 warning yang sudah ada.

`scripts/check-spatial-authoring-browser.js` lolos untuk:

- Empat titik polygon baru tetap sama setelah mengklik judul di luar panorama, kontrol zoom, membatalkan gesture pointer, dan tombol Selesaikan area.
- Polygon selesai dengan tepat empat vertex dan hanya satu entity baru.
- Drag satu vertex diikuti satu undo mengembalikan koordinat semula.
- Sisi tambahan unit existing mempertahankan unit ID, kode unit, dan aksi unit_detail, serta dapat diedit dan di-undo.
- Authoring Pin dan Blur tetap berfungsi.

`scripts/check-spatial-camera-browser.js` juga lolos untuk pan/culling, alignment dalam 3 CSS px, resize, seleksi keyboard, tambah/hapus vertex, perpindahan edit/pan, pilihan Pin/Spatial, dan menggambar area pertama pada scene kosong.

Semua pemeriksaan memakai PostgreSQL sementara pada `127.0.0.1:6147/lrt_spatial_test` dan fixture sintetis. Skrip authoring memblokir serta menghitung setiap percobaan API write CMS; tidak ada percobaan write selama pemeriksaan. Tidak ada area pengguna yang disimpan atau dipublikasikan.

Untuk draft yang sudah terlanjur mendapatkan titik kelima dari bug lama, gunakan **Hapus titik terakhir** sampai kembali ke empat sudut yang dimaksud, kemudian klik Selesaikan area. Tidak perlu menghapus data unit atau mengubah pilihan Pin/Spatial.

Perubahan belum di-commit, di-push, atau di-deploy.
