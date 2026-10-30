# Adopsi portal PopUp-Mitra ke GitDev

Sumber: branch GitHub `PopUp-Mitra`, commit [`542b052`](https://github.com/hariyantodjalil/virtual-tour-lrt/commit/542b052de0ca9c4a1022d181045a3900a5fc3923). Diperiksa dengan fetch pada 30 Oktober 2026; remote `dev` berada di `9e3c989`. Checkout GitHub tetap terpisah. Adopsi dilakukan selektif ke branch dev GitDev lokal.

## Perilaku yang diadopsi

- Dashboard menampilkan tiga pengajuan terbaru dengan kode, unit, tahap aktif, dan tautan detail.
- Daftar Pengajuan Sewa memakai foto, ringkasan, stepper, filter status, jumlah dokumen yang boleh dibaca, dan tautan detail proses.
- `/partner/inquiries/[id]` menampilkan unit/kontak, versi alur, tahap proses, catatan publik, alasan penolakan, serta dokumen per tahap.
- Tahap Selesai pada modal minat sewa membaca kode dan langkah workflow dari respons submit, lalu menautkan langsung ke detail pengajuan tersebut.
- Dokumen gambar dapat dibuka dalam dialog. Dokumen lain menyediakan tautan buka/unduh; dialog mendukung Escape, fokus keyboard, dan tombol tutup.
- CMS Pengajuan menyediakan penambahan tautan HTTPS dokumen per tahap dan pengaturan visibilitas ke mitra. Ini penyimpanan metadata tautan, bukan upload file baru atau pengaturan ACL penyedia dokumen.

## Integrasi GitDev

GitDev tetap memakai 11 status proses yang sudah ada, dari `NEW` sampai `COMMERCIAL_OPERATION`. `CLOSED_LOST` menandai penolakan dan `CLOSED_WON` tetap dikenali sebagai status lama. Lifecycle ACTIVE/COMPLETED/REJECTED dan fallback tujuh tahap GitHub tidak menggantikan aturan GitDev.

Workflow versi 1 menyimpan urutan, judul, pesan publik, dan pemetaan status di DB. Setiap pengajuan terikat ke versinya. `currentStepOrder` dihitung server dari status dan langkah versi tersebut; penolakan memakai tahap terakhir yang tercatat. Belum ada editor versi workflow dalam CMS. `requiresMedia` merupakan metadata, bukan syarat transisi tambahan.

Perubahan status dan pembuatan log berlangsung dalam transaksi yang sama. Aturan nomor penawaran, verifikasi lokasi, BA Negosiasi, reservasi unit, penutupan pengajuan pesaing, dan konversi penyewa aktif tetap berlaku. Penutupan otomatis pengajuan pesaing juga mendapat alasan publik dan log.

## Batas akses

- API daftar/detail memerlukan role MITRA dan cocok tepat pada `userId` pemilik. Tidak mengadopsi pencarian alternatif berdasarkan email dari GitHub.
- Respons portal dibentuk dengan proyeksi field publik. Catatan internal CMS, jadwal follow-up internal, identitas admin, serta dokumen tersembunyi tidak dikirim.
- Catatan publik aktivitas terpisah dari `TenantLead.notes`. Alasan penolakan yang diisi CMS dapat dibaca mitra; field CMS menandainya sebagai informasi publik.
- Pengelolaan dokumen hanya untuk ADMIN/EDITOR. Dokumen baru tersembunyi secara default. URL harus HTTPS tanpa kredensial; tahap harus sesuai versi pengajuan. Toggle dokumen juga memeriksa ID pengajuannya.
- Menyembunyikan tautan di portal tidak mencabut akses langsung pada penyedia file. Gunakan pembatasan akses penyedia file untuk dokumen rahasia.

## Migrasi dan data lama

Migrasi aditif: `prisma/migrations/20261030110000_partner_inquiry_portal/migration.sql`.

Menambah kode pengajuan berbasis sequence DB, relasi versi alur, alasan penolakan, tabel versi/step, log aktivitas, dan metadata dokumen. Status dan identitas pengajuan lama dipertahankan. Pengajuan lama ditautkan ke versi 1. Log awal diberi aksi IMPORTED dan waktu pembaruan portal dengan keterangan yang jelas, bukan riwayat aktivitas lama yang direka. Tahap historis pengajuan yang sudah ditolak sebelum migrasi tidak dapat diketahui; baseline memakai tahap pertama.

Migrasi sudah diterapkan ke DB lokal `virtual_tour_lrt`, dengan cadangan penuh di folder tooling yang di-ignore. Tidak ada migrasi atau perubahan DB PROD pada pekerjaan ini.

Sebelum menjalankan versi aplikasi ini di lingkungan lain, jalankan `npm run db:generate` dan `npm run db:deploy` melalui proses deployment yang berlaku. Jangan menjalankan `db push` sebagai pengganti migrasi. Migrasi tidak membawa perubahan drift lokal pada tabel `commercial_profiles`.

## Verifikasi

Uji HTTP dengan akun dan pengajuan sementara di DB lokal mencakup submit, kode/version dari DB, pemisahan pemilik, larangan akses CMS oleh mitra, catatan privat, dokumen tersembunyi/terlihat, toggle lintas pengajuan, URL/tahap invalid, prasyarat penawaran, histori status, penolakan dan pembukaan kembali. Data percobaan dibersihkan setelah pengujian.

Uji pengajuan pengunjung pada unit percobaan terpisah mencakup seluruh 11 tahap, reservasi setelah BA, penutupan pengajuan pesaing beserta log/alasan publik, sampai Operasional Komersial dan occupancy. Unit, pengajuan, akun dan penyewa percobaan tersebut dibersihkan.

MCP Responsively diuji pada 320x568, 390x844 dan 1440x900: dashboard, daftar, tautan detail, kode DB, tahap 2 dari 11, berkas publik, buka/tutup dialog, serta halaman tidak ditemukan. Preview memakai akun sementara dan membaca API aplikasi yang sebenarnya; mutasi melalui browser preview dinonaktifkan. Kartu ringkasan mobile dibuat dua kolom, header detail diringkas, dan tautan/tombol filter diperbesar untuk sentuhan. Banner tujuh tahap dari GitHub dihapus.

TypeScript, lint area portal/API/CMS terkait, build produksi, `git diff --check` dan status migrasi lokal diperiksa. Peringatan lint lama di luar area ini tetap ada.

Login Google di Responsively tetap merupakan temuan terpisah. Adopsi portal ini tidak mengubah autentikasi Google.
