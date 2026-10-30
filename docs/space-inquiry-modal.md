# Modal detail dan pengajuan unit

Modal default memakai latar putih. Pada desktop, kiri menampilkan judul unit, lokasi, dan langkah setelah pengajuan seperti modal lama. Kanan dimulai dari spesifikasi GitDev, kemudian tombol Ajukan membuka form dengan field berbaris, ikon, dan label seperti modal lama. Daftar field serta langkah review diadaptasi dari GitHub `PopUp-Mitra`. Integrasi portal dan versi workflow dijelaskan di `docs/github-popup-mitra-review.md`.

- Preview: `/station/cawang`, lalu pilih unit dari Daftar Unit.
- Modal sebelumnya: `/station/cawang?spaceModal=legacy`, lalu pilih unit yang sama.
- Implementasi sebelumnya tetap utuh di `components/tour/InTourSpacePopupLegacy.tsx`, termasuk `TenantInterestForm` yang digunakan halaman lain.
- WhatsApp mengambil kontak komersial yang sudah ada. Unduh PDF membuka dialog cetak browser untuk menyimpan ringkasan detail unit.
- Tombol hati pada header detail menyimpan atau menghapus unit melalui penyimpanan favorit browser yang sudah dipakai Portal Mitra. State mengikuti pembukaan ulang dan perubahan dari tab lain pada origin yang sama. Ini bukan favorit yang tersinkron ke akun/DB. Tautan Lihat Unit dari daftar favorit portal menyertakan ID unit agar membuka modal yang sesuai.
- Di bawah lebar 1024 piksel, modal menjadi bottom sheet dengan panorama terlihat di atasnya. Header menampilkan nama dan kode unit dari CMS serta status ketersediaan; kartu informasi memakai stasiun, area, luas, dan status sebenarnya. Spesifikasi lengkap, langkah setelah pengajuan, WhatsApp, dan PDF tetap tersedia pada bagian isi.
- Sheet detail memakai tinggi 70% viewport, dengan batas minimum untuk layar pendek. Ketuk pegangan untuk memperbesar atau meringkas sheet; saat masuk form, tinggi menjadi 90% viewport. Header dan tombol bawah tetap berada di luar area isi yang bergulir, termasuk ruang aman perangkat di bawah tombol.
- Swipe pada pegangan atau bagian header noninteraktif mengikuti jari. Geser atas memperbesar sheet; geser bawah meringkas sheet penuh, lalu geser bawah dari posisi ringkas menutupnya. Form dapat diringkas dan diperbesar tanpa menghapus isian. Isi yang bisa digulir dan field tidak memulai swipe sheet.
- Gerakan kecil kembali ke posisi semula. Gerakan mendatar tidak mengubah ukuran atau memicu ketukan pegangan; pembatalan pointer mengembalikan tampilan. Transisi menghormati preferensi reduced motion.
- Sheet masuk dari bawah selama 320 ms dan keluar ke bawah selama 240 ms, dengan backdrop yang memudar. Tombol X, kembali ke daftar, Lanjut Jelajahi, Escape, klik luar, dan swipe memakai alur penutupan yang sama: modal dilepas setelah animasi selesai. Swipe menutup dari posisi terakhir jari agar tidak meloncat kembali sebelum keluar.
- Tombol Ajukan Sewa / Site Visit membuka form yang sama dengan kolom jadwal survei opsional. Lanjut Jelajahi kembali ke panorama; membuka dari daftar unit tidak membuat tombol ini membuka ulang daftar tersebut. Tampilan desktop tetap dua kolom.
- Progres empat tahap mengikuti state sebenarnya: Spesifikasi, Data pengajuan, Review, Selesai. Kembali ke spesifikasi atau edit form mempertahankan data yang sudah diisi.
- Setelah submit berhasil, tahap Selesai menampilkan kode pengajuan dan timeline versi workflow dari respons API. Footer Selesai/Portal Mitra tetap terlihat saat timeline digulir. Tautan portal langsung membuka `/partner/inquiries/[id]` milik pengajuan tersebut.
- Form menyediakan pilihan Daftar akun atau Masuk, dengan email/password dan integrasi Google yang sudah ada. Login berhasil melanjutkan form pada unit yang sama; data perusahaan yang sudah diisi dipertahankan.

## Pemetaan form

| Input | Penyimpanan |
| --- | --- |
| Unit | `TenantLead.spaceId` |
| Nama penanggung jawab | `TenantLead.contactName` |
| Perusahaan / brand | `TenantLead.companyName` |
| WhatsApp | `TenantLead.phone` |
| Email | `TenantLead.email`; akun terkait melalui `userId` |
| Password pengunjung | `User.password`, di-hash oleh endpoint yang sudah ada |
| Peruntukan usaha / pilihan Lainnya | `TenantLead.businessType` |
| Preferensi survei | `TenantLead.surveyPreference` |
| Catatan kebutuhan | `TenantLead.message` |
| Luas unit pengajuan pengunjung | `TenantLead.spaceRequirement` |

Semua kolom form tersedia pada skema GitDev dan telah diperiksa di DB lokal. Integrasi kode/versi workflow portal membutuhkan migrasi `20261030110000_partner_inquiry_portal`, yang sudah diterapkan di lokal. Pengunjung memakai `POST /api/leads`; mitra yang sudah login memakai `POST /api/partner/leads`. Email mitra mengikuti sesi server; password tidak dikirim ulang. Pemrosesan akun, status pipeline, dan validasi unit tetap melalui endpoint GitDev.

## Validasi lokal

- Lint dan build produksi.
- Browser desktop 1440×960 dan mobile 390×844: layout, validasi, review, edit kembali, dan fokus keyboard.
- Unit terisi tidak menampilkan form pengajuan.
- Modal lama dapat dibuka melalui parameter `spaceModal=legacy`.
- Ringkasan cetak menampilkan enam spesifikasi GitDev; data dimasukkan sebagai teks, bukan HTML.
- Payload pengunjung dan mitra diperiksa dengan request pengajuan dicegat di browser. Tidak ada lead percobaan yang disimpan; ini belum merupakan uji penyimpanan end-to-end.
- Perpindahan login email dan callback Google diuji dengan respons autentikasi simulasi. OAuth Google sesungguhnya menolak origin `http://localhost:3000` pada konfigurasi saat ini; origin tersebut perlu diizinkan pada konfigurasi OAuth untuk uji akun Google sungguhan.
- MCP Responsively diuji pada 320×568, 375×667, 390×844, 768×1024, 1024×1366, dan 1440×900: spesifikasi, tombol Ajukan, field form, pengisian nama kontak, pilihan masuk, dan tombol Google. Pengujian tidak mengirim login atau pengajuan sungguhan.
- Integrasi favorit diuji dengan MCP Responsively pada 320x568, 390x844 dan 1440x900: simpan dari modal, tampil di favorit portal, buka unit melalui ID, dan hapus. State favorit awal pada origin preview dipulihkan setelah uji; preview autentikasi memakai fixture tanpa membuat akun DB.
- Temuan scroll mobile diperbaiki: perpindahan tahap menggulir area field ke awal; bingkai modal memakai `overflow-clip` agar header dan tombol tutup tidak ikut tergeser oleh scroll programatis.
- Logika swipe diuji dengan `node --import tsx --test lib/sheet-gesture.test.ts`. Responsively MCP belum menyediakan tool swipe: pengujian drag memakai pesan mouse native yang ditujukan hanya ke renderer Responsively, lalu state dan hasil dibaca melalui MCP Responsively. Ini merupakan uji pointer pada preview Chromium, bukan uji sentuhan pada perangkat fisik.
