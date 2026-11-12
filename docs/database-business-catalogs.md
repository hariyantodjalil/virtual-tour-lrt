# Data bisnis dari DB

Perubahan lokal 2 November 2026 menghapus fallback data bisnis, tanpa menyalin data lokal ke PROD.

## Katalog dan foto

Katalog media kereta membaca record aktif dari DB. Daftar kosong, seluruh media nonaktif, atau kegagalan baca tidak menghasilkan media bawaan maupun status Tersedia buatan. GET publik/CMS tidak membuat ulang katalog yang telah dihapus. File `landing-data.ts` beserta data demo lama stasiun/harga/panorama dihapus. Tipe yang masih diperlukan dipindahkan ke komponen pemakainya, dengan tipe ruang mengikuti props komponen tur.

Foto stasiun, kartu ruang komersial, detail pengajuan dan media kereta hanya memakai URL DB. Ketika URL tidak ada, area foto kosong. Hero, logo dan ilustrasi pemasaran tetap merupakan aset tampilan aplikasi.

Klaim 500.000 penumpang/hari serta fallback jumlah stasiun 18 dihapus. Integrasi API penumpang ditunda sampai sumber API tersedia; perubahan ini tidak menciptakan angka pengganti.

## Kontak

Nomor WhatsApp berasal dari Profil Tim Komersial pada CMS. Halaman maintenance dan komponen tur lama mengikuti sumber yang sama. Jika nomor tidak tersedia, aplikasi tidak membuat tautan ke nomor bawaan. Nomor kontak khusus stasiun yang sudah tersedia di CMS tetap dapat mengoverride profil umum.

## Armada

Gerbong berasal dari `train_tour_cars`; train set berasal dari tabel `trainsets`. Kode TS baru dapat ditambahkan/nonaktifkan lewat Master Armada pada CMS Train Rental Space. Gerbong dikelola di CMS Train Virtual Tour. Kode train set tidak diubah setelah dibuat agar referensi ketersediaan lama tetap konsisten.

Pilihan CMS dan detail sewa membaca master DB, termasuk gerbong di luar enam gerbong lama dan kode di luar TS31. Pilihan di luar master ditolak sebelum media dibuat/disimpan. Ketersediaan per gerbong tetap pada `availableByCar`; master armada tidak otomatis menjadikan media tersedia. Jumlah lima train set buatan di detail dihapus. Sewa train set utuh memakai irisan ketersediaan seluruh gerbong aktif.

Halaman baca tidak lagi membuat kereta/gerbong/zona bawaan. Jika kereta belum ada, CMS menyediakan form tambah kereta. Gerbong dan train set selanjutnya diisi melalui CMS.

## Alur pengajuan

Timeline pengajuan memakai langkah dari versi yang terikat ke pengajuan. Ringkasan pada modal, form lama, dan halaman komersial memakai versi workflow aktif di DB; tidak memakai daftar langkah cadangan dalam kode.

Administrator mengelola judul, keterangan mitra dan penanda ringkasan melalui `/cms/inquiry-workflow`. Simpan membuat versi baru, mengarsipkan versi aktif sebelumnya, dan tidak mengubah versi pengajuan lama. Versi dasar kedaluwarsa atau daftar tahap yang tidak cocok ditolak. Enum status, pemeriksaan penawaran/BA dan aturan reservasi tetap menjadi kontrak backend; editor teks tidak mengubahnya.

## Migrasi

`20261102090000_database_business_catalogs` menambah master train set dan `showInSummary`. Migrasi mempertahankan pilihan TS01–TS31 yang sebelumnya ditawarkan kode sebagai master awal bagi kereta yang sudah ada, serta mengimpor kode tambahan yang sudah tersimpan pada ketersediaan. Ini dilakukan sekali, bukan fallback pada request. Gerbong/record media serta ketersediaan lama dipertahankan. Cadangan DB lokal dibuat sebelum migrasi dan disimpan di folder tooling yang di-ignore.

`20261102100000_remove_default_commercial_phone` menghilangkan asumsi nomor WhatsApp untuk profil baru. Nomor profil yang sudah tersimpan tidak diubah.

Jalankan migrasi sebelum aplikasi baru di lingkungan lain. Tidak menjalankan reset atau seed pada DB berisi data.

## Validasi

Build produksi dan TypeScript lolos; lint tidak memiliki error, dengan peringatan lama di luar perubahan ini. Empat tes katalog mencakup gerbong tambahan, master TS dinamis, katalog kosong dan keamanan key JSON; enam tes gesture tetap lolos.

Uji HTTP memakai database sementara terpisah: migrasi, katalog kosong/nonaktif/dihapus, GET tidak membuat data, kegagalan baca tabel tidak menghasilkan dummy, validasi master sebelum penyimpanan, izin CMS, versi workflow lama/baru, penolakan versi kedaluwarsa/tahap tidak cocok, serta kontak CMS tanpa nomor cadangan. Database uji dibersihkan setelah selesai.

MCP Responsively pada 320x568, 390x844 dan 1440x900 memeriksa editor alur, master armada, picker gerbong/TS, ringkasan unit dari workflow aktif, foto kosong, dan jumlah ketersediaan media. Browser preview hanya membaca data fixture; penyimpanan diuji lewat HTTP pada DB sementara. Pengujian tidak memakai perangkat fisik.
