# Pengaturan arah kamera saat tiba

## Cara memakai

1. Di scene asal, pilih hotspot Scene dan tentukan Target Scene.
2. Pada bagian `Arah kamera saat tiba`, klik `Atur arah di scene tujuan`.
3. Geser dan zoom foto tujuan sampai menghadap arah berjalan yang diinginkan.
4. Klik `Gunakan arah ini`, lalu `Simpan` di editor.

Pengaturan berlaku untuk koneksi yang dipilih. A → B dan B → A dapat memakai arah berbeda. `Batal` menutup pemilih tanpa menerapkan perubahan. `Ikuti arah bawaan scene` menghapus pengaturan khusus koneksi. Perubahan arah tiba mendukung undo/redo.

Untuk arah bawaan, buka tab Scene, geser panorama, lalu klik `Gunakan arah kamera saat ini` pada bagian `Arah kamera awal scene`. Simpan scene setelah mengaturnya.

## Perilaku kamera

Sebelumnya transisi hotspot menyalin yaw marker pada foto asal ke foto tujuan. Angka yang sama tidak berarti arah fisik yang sama pada dua panorama dengan orientasi berbeda.

Prioritas arah tiba sekarang adalah `hotspot.targetView` → `destination.initialView` → sudut transisi lama bila keduanya tidak tersedia. Pengaturan per koneksi memakai yaw, pitch, dan hfov dalam koordinat foto tujuan. Preview CMS dan viewer publik memakai aturan yang sama. Memilih target scene lain menghapus arah khusus target lama. Mengubah tipe hotspot dari Scene juga menghapus arah tujuan.

Data disimpan sebagai field opsional pada JSON hotspot, tanpa migrasi database. Normalisasi mempertahankan nilai valid dan mengabaikan nilai kamera lama yang tidak valid. API menolak arah baru di luar batas kamera. Pembuatan ulang jalur jalan mempertahankan arah tiba koneksi yang sudah dikonfigurasi.

Pengaturan ini membantu orientasi pandangan saat perpindahan; administrator tetap perlu menentukan arah yang sesuai untuk panorama yang orientasinya berbeda. Tidak ada kalibrasi otomatis arah dunia antar-foto.

## Verifikasi

- `npm run build`: lolos kompilasi dan TypeScript.
- `npm run lint`: 0 error, 7 warning yang sudah ada.
- `node --import tsx --test lib/scene-entry-view.test.ts`: 3 tes lolos untuk prioritas kamera, validasi/normalisasi, dan regenerasi jalur pergi/pulang.
- `npm run test:spatial`: 21 tes lolos.
- `scripts/check-scene-entry-browser.js`: membuka arah bawaan tujuan, Batal, Terapkan, undo/redo, reset, simpan melalui API fixture, reload, preview CMS, arah pergi/pulang berbeda, dan fallback ke arah awal tujuan lolos.
- Fixture A → B diuji pada yaw 65°, pitch 4°, hfov 88°; B → A pada yaw -85°, pitch 1°, hfov 105°. Menghapus override mengembalikan arah B ke yaw 160°, pitch 2°, hfov 95°.
- Dialog diperiksa pada viewport 1366 × 900 dan 390 × 844, termasuk batas viewport dan tombol terapkan.
- Pemeriksaan browser kamera Spatial dan authoring diulang: resize, alignment, vertex editing, empat titik saat Selesaikan, tambahan sisi unit, undo, Pin/Spatial, serta Blur tetap lolos.

Semua penulisan pengujian dibatasi pada akun dan fixture palsu di database lokal sementara `127.0.0.1:6147/lrt_spatial_test`. Tidak ada pengaturan panorama atau hotspot pengguna yang diubah. Belum commit atau deploy.
