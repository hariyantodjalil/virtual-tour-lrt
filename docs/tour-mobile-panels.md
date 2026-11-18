# Panel viewer mobile

Pada lebar di bawah 768 px, Info Stasiun, pengaturan Rute Tur, dan Unit Komersial memakai bottom sheet putih. Header, pegangan, target sentuh, penutupan, dan animasinya sama. Info mengikuti isi; rute/unit mulai sekitar 60dvh dengan batas minimum untuk layar pendek. Semua sheet dibatasi 90dvh dan isi bergulir terpisah dari header/footer. Fasilitas memakai popover putih dekat ikon rail, dengan baris pilihan minimal 44px dan teks 14px.

Implementasi: `MobileTourPanels.tsx` menyediakan konten, `MobileTourSheet.tsx` menangani dialog serta gesture, dan `use-mobile-tour.ts` memilih layout. Panel desktop tetap memakai implementasi sebelumnya. Data stasiun, unit, scene dan hotspot tetap berasal dari data publik DB; tidak ada perubahan schema atau data.

- Sheet masuk dari bawah 320 ms, keluar turun 240 ms. Parent baru ditutup setelah animasi selesai, termasuk ketika memilih unit, scene, peta, atau memulai rute. Reduced motion meniadakan animasi.
- Ketuk pegangan atau swipe atas pada header untuk memperbesar. Swipe bawah meringkas sheet penuh; swipe bawah berikutnya menutup. Gerakan kecil/mendatar dibatalkan. Scroll isi tidak memulai drag sheet.
- Tombol X, klik backdrop dan Escape menutup dialog. Fokus masuk ke tombol tutup dan kembali ke pemicu yang masih terpasang. Shortcut panorama tidak menerima keydown dari isi sheet.
- Daftar unit memakai nama, kode lengkap, jenis, luas, dan status. Posisi scroll serta kondisi diperbesar disimpan ketika membuka detail dan kembali lewat X. Lanjut Jelajahi pada detail tetap kembali ke panorama.
- Popover fasilitas ditutup lewat X, klik luar, Escape, atau menekan ulang ikonnya. Fokus masuk ke tombol tutup dan kembali ke pemicu ketika ditutup. Pilihan hanya berasal dari kategori yang benar-benar mempunyai hotspot pada scene stasiun. Setelah dipilih, kamera diarahkan dan popover ditutup. Jika belum ada, tampil “Belum ada titik fasilitas.” Tidak menambahkan titik atau mengarang ketersediaan fasilitas.
- Rute memakai pilihan asal/tujuan berlabel dan tombol mulai tetap di footer. Setelah mulai, sheet menutup dan kontrol rute tetap ringkas di bawah. Tombol Ulangi tidak lagi dinonaktifkan pada akhir rute.
- Autoplay dijeda saat sheet atau popover mobile dibuka. Kontak WhatsApp/maskot disembunyikan supaya tidak menimpa panel. Tombol UI mengambang disembunyikan ketika sheet terbuka.

## Validasi

MCP Responsively pada 320×568 dan 390×844: sheet dibuka/ditutup, rute manual menutup sheet, unit dapat diperbesar, detail dapat dibuka, dan kembali ke daftar mempertahankan kondisi diperbesar. Setelah revisi Fasilitas menjadi popover, pemeriksaan memverifikasi bentuk popover, tombol X, klik luar, serta Info tetap berupa sheet. Screenshot memperlihatkan footer tidak ditimpa kontak dan panorama tetap terlihat. Desktop 1440×900 memeriksa Info masih berupa panel samping.

Pengujian Responsively memakai fokus dan Enter; ini belum merupakan uji sentuhan pada perangkat fisik. Logika arah/ambang swipe memakai helper bersama yang diuji oleh enam kasus `lib/sheet-gesture.test.ts`. Lint, TypeScript dan build produksi diperiksa. Tidak ada pengajuan, login, perubahan DB, commit, push, atau deploy yang dilakukan untuk fitur ini.
