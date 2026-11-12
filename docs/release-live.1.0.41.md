# Release live.1.0.41

30 Oktober 2026. Rilis perubahan lokal yang diminta pengguna ke dev GitLab/GitHub, dilanjutkan merge prod GitLab dan tag live baru. Tidak melakukan force push atau memindahkan tag lama.

## Perubahan

- Detail unit putih dengan form empat langkah, konfirmasi pengajuan dan tautan langsung ke detail Portal Mitra. Modal sebelumnya tetap dapat dibandingkan melalui `?spaceModal=legacy`.
- Dashboard, daftar dan detail pengajuan Portal Mitra diadaptasi dari GitHub PopUp-Mitra dengan 11 tahap GitDev. Kode pengajuan, versi workflow, histori dan dokumen menggunakan DB.
- CMS menyediakan tautan HTTPS dokumen per tahap, visibilitas dokumen dan alasan penolakan publik. Catatan internal serta dokumen tersembunyi tidak dikirim ke mitra; detail pengajuan memeriksa pemilik userId.
- Favorit modal tersambung kembali ke penyimpanan browser yang dipakai portal. Lihat Unit membuka unit yang dipilih. Favorit belum tersinkron ke akun/antar-perangkat.
- Info, Rute dan Unit pada viewer mobile memakai bottom sheet; Fasilitas memakai popover. Animasi buka/tutup, swipe, ukuran kontrol, breadcrumb, pencarian stasiun dan label panah scene dirapikan.
- Favicon mengikuti aset GitHub. Seed line stasiun diperbarui; perubahan data line yang sebelumnya disetujui hanya diterapkan di DB lokal. Rilis ini tidak menjalankan seed pada PROD.

## Database dan deployment

Migrasi aditif `20261030110000_partner_inquiry_portal` menambah kode, versi workflow, alasan penolakan, histori dan metadata dokumen. Pengajuan lama mendapat versi 1 dan baseline histori dengan waktu migrasi yang jelas; status lama dipertahankan. Backup lokal tersedia di folder tooling yang di-ignore.

Pipeline PROD menjalankan `prisma migrate deploy` dan `prisma migrate status` dari image baru sebelum memperbarui aplikasi. Verifikasi log keberhasilan migrasi dan health setelah deployment. Jangan mengganti langkah ini dengan reset/seed/db push. Port host PROD tetap 80.

## Validasi sebelum rilis

- Build produksi, TypeScript dan lint area yang diubah lolos; lint umum memiliki peringatan lama di luar area ini.
- 6 tes gesture dan 21 tes spatial lolos. Pemeriksaan mutation pada arah collapse/dismiss tertangkap tes, lalu sumber dipulihkan.
- Uji HTTP lokal: pemilik pengajuan, privasi catatan/dokumen, izin CMS, validasi tautan/tahap, histori, penolakan dan pembukaan kembali.
- Uji pengunjung pada unit sementara melewati seluruh 11 tahap, reservasi, penutupan pengajuan pesaing, hingga occupancy/penyewa aktif. Fixture dibersihkan.
- MCP Responsively pada 320x568, 390x844 dan 1440x900: portal, detail, dokumen, favorit dan tautan unit. Panel mobile dan modal juga diperiksa pada ukuran tablet yang dicatat di dokumen fitur.
- Konfigurasi Compose DEV/PROD valid. Review tambahan tidak menemukan penghambat rilis.

Login Google blank di Responsively masih merupakan temuan terpisah; rilis ini tidak mengklaim memperbaiki OAuth. Temuan lama di luar perubahan ini dicatat di `release-live.1.0.40.md`.

Baseline Jenkins sebelum push: PROD #46 SUCCESS; DEV #77 SUCCESS. Hasil build baru harus dikorelasikan dengan commit/tag rilis, bukan memakai baseline tersebut.
