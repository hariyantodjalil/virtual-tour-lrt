---
target: "Empat panel viewer mobile: Info, Rute, Unit, Fasilitas"
total_score: 21
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 2
timestamp: 2026-10-30T10-29-51Z
slug: app-station-slug-stationtourclient-tsx
---
Method: dual-agent (A: /root/mobile_panel_design; B: /root/mobile_panel_evidence). Browser inspection: root through MCP Responsively.

# Review panel viewer mobile — 30 Oktober 2026

Target: `app/station/[slug]/StationTourClient.tsx` dan komponen panel tur terkait. Review tidak mengubah empat panel. Perbaikan terpisah yang sudah dilakukan: header desktop/tablet memakai tinggi kontrol 44 px dan teks 14 px; breadcrumb bisa bertambah tinggi bila perlu membungkus teks.

Desain spesifik terhadap tur stasiun: lokasi scene, fasilitas, unit sewa, serta jalur manual/otomatis relevan. Namun empat panel memakai bentuk dan posisi berbeda sehingga pengguna harus mempelajari pola berulang. Di mobile, panorama seharusnya tetap menjadi konteks utama.

## Penilaian heuristik

Skala kualitas 0–4, semakin tinggi semakin baik. Skor sumber Assessment A yang semula berupa tingkat keparahan telah dikonversi menjadi kualitas. Ini penilaian desain, bukan sertifikasi aksesibilitas.

| Heuristik | Skor | Temuan |
| --- | --- | --- |
| Status sistem | 2 | Fasilitas tanpa hotspot tidak memberi umpan balik. |
| Kesesuaian dunia nyata | 3 | Nama stasiun dan fasilitas jelas; istilah campuran masih muncul. |
| Kontrol pengguna | 2 | Tombol tutup ada, fokus dan Escape belum konsisten. |
| Konsistensi | 2 | Floating card, popover, drawer, dan sheet berbeda. |
| Pencegahan kesalahan | 2 | Fasilitas tanpa lokasi tetap dapat dipilih. |
| Pengenalan | 2 | Label ikon rail tersembunyi pada mobile. |
| Efisiensi | 2 | Rute manual/otomatis membantu; drawer unit menghalangi panorama. |
| Minimalisme | 1 | Statistik kecil dan panel besar mengambil ruang orientasi. |
| Pemulihan kesalahan | 2 | Tombol ulangi dinonaktifkan ketika rute selesai. |
| Bantuan | 3 | Alur singkat tidak perlu tutorial; label tindakan perlu diperjelas. |
| Total | 21/40 | Prioritaskan konsistensi interaksi mobile. |

## Rekomendasi per panel

| Panel | Pola mobile yang disarankan |
| --- | --- |
| Info stasiun | Bottom sheet mengikuti konten, titik awal sekitar 35–45dvh; nama, alamat, ketersediaan dan kontak. |
| Pengaturan rute | Bottom sheet sedang sekitar 50–60dvh, bisa diperbesar untuk daftar scene; setelah mulai, tutup sheet. |
| Rute berjalan | Pertahankan bar kontrol ringkas di bawah, tidak perlu sheet besar. |
| Daftar unit | Bottom sheet sekitar 60dvh, bisa diperbesar ke sekitar 90dvh; pertahankan posisi daftar ketika kembali dari detail. |
| Fasilitas | Sheet pendek mengikuti lima pilihan, ikon dan label dengan target sentuh 44px; tutup sesudah kamera berhasil diarahkan. |

Persentase adalah titik awal desain, belum implementasi atau validasi gesture. Konsistensi berada pada header, pegangan, target sentuh, gerakan masuk/keluar, dan aturan dismiss; tinggi tetap menyesuaikan konten serta layar pendek. Desktop mempertahankan panel samping.

Usulan interaksi: satu panel tampil pada satu waktu, masuk dari bawah dan keluar turun; swipe atas memperbesar panel panjang, swipe bawah meringkas lalu menutup. Isi bergulir terpisah dari pegangan. Gunakan pola detail unit yang sudah ada dan hormati reduced motion. Hindari efek pantul/dekoratif serta blur yang terus dianimasikan. FPS belum diukur dalam review ini.

## Prioritas

1. P1 aksesibilitas: beri accessible name pada tombol tutup Info/Rute (`StationTourClient.tsx:668,739`) dan hubungkan label Dari/Ke ke select (`750,781`).
2. P2 layout: drawer Unit memakai seluruh lebar pada 320px dan sekitar 384/390px. Pada screenshot 320px, kontak WhatsApp/maskot menutupi footer; sembunyikan atau tata ulang kontrol mengambang saat panel terbuka.
3. P2 keterbacaan/sentuhan: tombol tutup sekitar 28px, pilihan fasilitas sekitar 32px; statistik dan status memakai teks 8–10px. Rail sendiri sudah 44px. Tambahkan label singkat Info, Rute, Unit, Fasilitas tanpa helper panjang.
4. P2 perilaku: `GuidedRouteBar.tsx:60` menonaktifkan Ulangi saat selesai, walau handler mendukung replay. Fasilitas tanpa placement diam tanpa pesan; tandai ketidaktersediaan atau tampilkan hasil yang jelas.
5. P2 konsistensi: gunakan satu fondasi sheet mobile dan aturan fokus/Escape yang jelas. Kandidat clipping Info pada landscape/zoom teks masih perlu uji tersendiri, bukan kegagalan yang sudah dibuktikan.

Tidak ditemukan P0 dalam cakupan ini. Prioritas P1 berkaitan dengan aksesibilitas, bukan bukti aplikasi gagal total.

## Kekuatan dan persona

Status unit memakai teks selain warna. Isi Unit/Rute sudah dapat digulir. Membuka alat lain menutup panel sebelumnya, dan memilih fasilitas yang ditemukan menutup panel setelah mengarahkan kamera. Reduced motion sudah ditangani di CSS.

Pengunjung baru harus menebak empat ikon tanpa label terlihat. Pengguna satu tangan menghadapi pilihan fasilitas kecil. Pengguna screen reader kehilangan nama tombol tutup serta konteks label select. Perbaikan ini lebih berguna daripada menambah kalimat petunjuk di setiap bagian.

## Bukti dan batas

Responsively: keempat panel dibuka/ditutup memakai aktivasi keyboard pada 390×844 dan 320×568; screenshot memperlihatkan bentuk panel, pembungkusan judul rute, dan overlap kontrol mengambang. Ini bukan pengujian sentuhan fisik, landscape, zoom teks, ataupun frame rate. Klik otomatis awal tidak andal, sehingga pemeriksaan dilanjutkan dengan fokus dan Enter.

Detector Assessment B: 25 advisory, seluruhnya `design-system-font-size`: StationTourClient 12, TourUnitsPanel 6, FacilityLegend 1, GuidedRouteBar 4, TourLeftPanel 2. Sebagian temuan adalah ukuran khusus desktop, sehingga bukan 25 kegagalan mobile. Satu temuan ukuran header TourLeftPanel sudah dihapus oleh perbaikan terpisah setelah scan; tidak dilakukan scan ulang agar hasil baseline tetap jelas.

Assessment A dan B dijalankan independen. Tidak ada overlay detector yang diinjeksi karena MCP Responsively tidak menyediakan evaluate/injeksi; visual diperiksa lewat screenshot. Tidak ada dev server tambahan yang dibuat. Belum ada perubahan panel, commit, push, atau data DB untuk review ini.
