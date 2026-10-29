# Perapihan kepadatan editor

Review berfokus pada editor virtual tour stasiun, dalam mode Operate. Masalah utamanya adalah instruksi berulang, informasi unit yang tampil beberapa kali, dan pengaturan sekunder yang selalu terbuka.

| Bagian | Perubahan |
| --- | --- |
| Toolbar | Petunjuk Simpan/Publikasi dan pintasan dikumpulkan di Bantuan; penjelasan tidak lagi mengambil satu baris tetap. Tooltip pada Simpan dan Publikasikan menjelaskan dampaknya. |
| Spatial | Menghapus klaim valid dan petunjuk edit yang berulang, badge revisi, serta kotak berlapis. Jumlah titik, tautan unit, label, aksi, dan status aktif tetap terlihat. |
| Pemilih unit | Unit terpilih menjadi satu baris Ganti unit. Pencarian, filter, dan hasil terbuka saat diminta; pemilihan menutup daftar dan mengembalikan fokus. Unit yang belum dipilih tetap langsung menampilkan pencarian. |
| Tampilan area | Warna, opasitas, ketebalan garis, dan catatan batas berada dalam bagian lipat. Label dan status aktif tetap langsung tersedia. |
| Kamera | Menghapus paragraf petunjuk di inspector dan footer dialog. Arah tiba menampilkan status bawaan atau nilai kamera dalam satu baris. Konteks asal → tujuan tetap ada di dialog. |
| Aset dan target scene | URL aset berada di Detail aset. Baris yang mengulang scene/level/area di bawah pemilih target dihapus. |
| Kanvas dan form | Mode geser tidak lagi menampilkan petunjuk tetap. Instruksi menggambar dipersingkat; pesan error, kebutuhan minimal titik, dan konsekuensi penerapan blur tetap ditampilkan. |

Tidak ada perubahan pada pilihan Unit Pin/Spatial, geometri polygon, hubungan unit, penyimpanan/publikasi, atau aturan kamera tujuan. Perapihan mempertahankan identitas maroon dan susunan kerja editor.

## Pemeriksaan

- Screenshot sebelum/sesudah memakai fixture sintetis yang sama pada 1366 × 900. Inspector diperiksa juga pada 390 × 844.
- Disclosure Bantuan, pemilih unit, dan Tampilan area bisa dibuka lewat keyboard. Escape menutup Bantuan. Pemilihan unit menutup daftar dan mengembalikan fokus ke pemicunya.
- Pencarian, filter, kontrol tampilan, serta arah kamera tetap dapat diakses.
- Tes browser arah tiba lolos kembali, termasuk simpan/reload pada fixture, preview, arah pergi/pulang, undo/redo, dan fallback bawaan. Tes authoring Spatial juga lolos untuk empat titik saat Selesaikan, sisi tambahan, drag/undo, Pin, dan Blur.
- Build dan TypeScript lolos. Lint tidak memiliki error; 7 warning sebelumnya tetap ada.
- Detektor Impeccable dijalankan pada tujuh file UI. Masih ada advisory ukuran font lama di luar ramp DESIGN.md dan warning warna ungu pada alat blur yang sudah ada. Keduanya dicatat sebagai warisan editor; tema global dan palet identitas alat tidak diganti dalam perapihan ini.

Pengujian memakai database lokal sementara dan akun palsu. Screenshot berada di direktori output yang diabaikan Git. Data pengguna tidak diubah. Tidak ada commit atau deploy.
