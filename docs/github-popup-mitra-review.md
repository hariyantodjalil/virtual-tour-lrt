# Review GitHub PopUp-Mitra dan adopsi tahap 4

Diperiksa 30 Oktober 2026 dengan `git fetch origin` pada checkout GitHub terpisah. HEAD remote `PopUp-Mitra` tetap [`542b052`](https://github.com/hariyantodjalil/virtual-tour-lrt/commit/542b052de0ca9c4a1022d181045a3900a5fc3923); remote `dev` tetap `9e3c989`. Tidak ada commit remote baru setelah checkout sebelumnya. Pembandingan fitur memakai `9e3c989..542b052`, bukan menganggap GitDev lokal identik dengan basis GitHub.

## Tahap 4 yang diadopsi ke GitDev lokal

- Konfirmasi pengajuan setelah respons submit berhasil, referensi pengajuan, timeline tahapan, penanda tahap saat ini, serta footer tetap berisi Selesai dan Pantau di Portal Mitra.
- Tetap menggunakan modal putih GitDev, layout desktop dua kolom, bottom sheet mobile, dan progress empat tahap yang sudah ada.
- `InquiryConfirmation.tsx` membaca ID dan status dari respons API GitDev. `SpaceInquiryForm.tsx` memvalidasi keduanya; status tidak dipaksakan menjadi langkah pertama oleh UI.
- Referensi memakai ID lead yang benar-benar dikembalikan API. GitDev belum mempunyai `inquiryCode` GitHub; tidak membuat kode pengajuan palsu.
- Timeline mengikuti 11 status proses GitDev dari `LEAD_PIPELINE_STATUSES` dan label `LEAD_STATUS_LABELS`, sama dengan CMS/Portal Mitra GitDev. Deskripsi singkat publik ditambahkan di `lib/commercial-pipeline.ts`. Ini konfigurasi aplikasi yang sudah ada, bukan workflow dinamis dari tabel DB.
- GitHub memakai `/api/workflow/active` dan tabel versi workflow; kontrak itu tidak ada di GitDev. Model tersebut tidak disalin. Tidak ada migrasi atau perubahan data.
- Tombol portal tetap menuju `/partner`, karena halaman `/partner/inquiries/[id]` GitHub belum tersedia di GitDev. Tidak membuat tautan ke halaman yang tidak ada.

## Perubahan portal GitHub, apa adanya

| Bagian | Perubahan di commit GitHub |
| --- | --- |
| Dashboard `/partner` | Pengajuan terbaru dari lima menjadi tiga; kartu putih menggantikan timeline kartu berwarna; kode pengajuan, tahap aktif, metadata unit dan tombol ke detail proses. |
| Daftar Pengajuan Sewa | Kartu tiga bagian pada desktop: foto, ringkasan pengajuan, dan stepper vertikal. Menampilkan kode pengajuan, tahap aktif dan jumlah lampiran. |
| Status | Menambahkan lifecycle `ACTIVE`, `COMPLETED`, `REJECTED`; tahap proses dipisahkan ke `currentStepOrder` dan versi workflow. Sebagian status legacy masih dikenali. |
| Halaman baru `/partner/inquiries/[id]` | Ringkasan unit/kontak di kiri dan timeline proses/dokumentasi di kanan; tahap lampau, aktif, berikutnya; informasi penolakan, catatan aktivitas dan berkas per tahap. |
| Lampiran | Menampilkan lampiran yang ditandai `isVisibleToMitra`; preview gambar/dokumen, nomor dokumen serta tautan buka/unduh. UI ini bukan form upload dokumen oleh mitra. |
| Endpoint detail | `GET /api/partner/inquiries/[id]` memerlukan role MITRA dan mencari lead berdasarkan pemilik `userId` atau email akun. Menyertakan unit/stasiun, versi workflow, step log dan lampiran yang boleh dilihat mitra. |
| Workflow | Memakai versi workflow aktif dan step berurutan dari DB. UI portal juga mempunyai fallback tujuh tahap ketika langkah workflow tidak tersedia. |

Bagian portal hanya ditinjau, belum diadopsi. File utama yang berbeda: `app/partner/page.tsx`, `components/partner/ApplicationsSection.tsx`, halaman serta endpoint `partner/inquiries/[id]`, endpoint workflow aktif, skema Prisma, seed master workflow, dan endpoint pengajuan yang menambahkan data workflow pada respons.

## Batas integrasi

GitDev sekarang menyimpan proses pada status lead seperti `NEW`, `RDS_OFFER`, `SITE_CHECK`, `BA_SIGNED`, `DESIGN_REVIEW`, `BILLING`, sampai `COMMERCIAL_OPERATION`. GitHub memisahkan lifecycle, urutan tahap, dan versi workflow. Menyalin portal GitHub secara utuh memerlukan pemetaan data, API, CMS pengelola tahap/dokumen, dan migrasi yang terpisah. Membawa JSX portal saja akan menghasilkan field kosong atau endpoint yang tidak tersedia.

## Validasi adopsi tahap 4

Build produksi, lint dan TypeScript diperiksa. MCP Responsively memakai preview sementara pada port 3002 yang meneruskan halaman aplikasi tetapi mencegat POST pengajuan; respons fixture `id`/`status` dipakai untuk mencapai tahap sukses. Tidak membuat lead atau akun percobaan di DB. Browsing halaman stasiun masih dapat mencatat analytics kunjungan server yang memang sudah ada pada halaman tersebut.

Uji pada 390×844, 320×568 dan 1440×900: isi form → review → submit fixture → tahap 4, referensi, penanda tahap aktif, tahap akhir Operasional Komersial, tautan `/partner`, serta Selesai kembali ke panorama. Ini bukan uji penyimpanan pengajuan end-to-end. Preview sementara dihentikan setelah pengujian.

Login Google di Responsively merupakan temuan terpisah yang belum selesai diverifikasi. Tidak ada perubahan autentikasi Google pada adopsi ini.
