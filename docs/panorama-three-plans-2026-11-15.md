# Perbandingan tiga plan panorama - 15 November 2026

Uji ini membandingkan alur kamera dan pemuatan detail dengan fungsi transisi aplikasi yang sama. Data scene, hotspot, DB, dan objek S3 aktif tidak diubah. Aplikasi tetap memakai current.

Kesimpulan: Plan B mempertahankan respons awal kamera mendekati current, tetapi pada desktop penyelesaian detailnya sekitar 2,5 kali lebih lama dan unduhan lintas scene sekitar 3,5 kali current. Plan C sangat berat pada kunjungan pertama. Belum ada penerapan massal; target menyamai waktu detail current belum dipenuhi oleh profil asli 4K ini.

## 1440 x 900, 20 Mbps / 40 ms

42 kasus; 0 error/timeout. Angka adalah median lintas pasangan scene yang diuji, bukan p95 atau SLA.

| Alur | Plan | Sampel cold/warm | Kamera sampai, cold | Detail siap, cold | Unduh cold | Kamera sampai, warm | Detail siap, warm | Unduh warm |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Pindah scene | A - Current multires | 3/3 | 0.416 s | 1.395 s | 0.520 MiB | 0.317 s | 1.168 s | 0.000 MiB |
| Pindah scene | B - Asli 11904px, multires 4096, JPEG 85 | 3/3 | 0.493 s | 3.504 s | 1.795 MiB | 0.364 s | 3.258 s | 0.000 MiB |
| Pindah scene | C - Asli 11904px utuh | 3/3 | 8.615 s | 8.615 s | 16.209 MiB | 1.535 s | 1.535 s | 0.000 MiB |
| Klik tenant, pindah scene | A - Current multires | 2/2 | 0.229 s | 1.456 s | 0.545 MiB | 0.143 s | 1.239 s | 0.000 MiB |
| Klik tenant, pindah scene | B - Asli 11904px, multires 4096, JPEG 85 | 2/2 | 0.345 s | 3.582 s | 1.898 MiB | 0.183 s | 3.368 s | 0.000 MiB |
| Klik tenant, pindah scene | C - Asli 11904px utuh | 2/2 | 7.684 s | 8.211 s | 15.312 MiB | 1.395 s | 1.925 s | 0.000 MiB |
| Klik tenant, scene sama | A - Current multires | 2/2 | 0.327 s | 0.970 s | 0.396 MiB | 0.323 s | 0.323 s | 0.041 MiB |
| Klik tenant, scene sama | B - Asli 11904px, multires 4096, JPEG 85 | 2/2 | 0.347 s | 3.140 s | 1.632 MiB | 0.330 s | 3.034 s | 0.009 MiB |
| Klik tenant, scene sama | C - Asli 11904px utuh | 2/2 | 0.325 s | 0.325 s | 0.000 MiB | 0.183 s | 0.183 s | 0.000 MiB |

## 390 x 844, 5 Mbps / 100 ms

42 kasus; 0 error/timeout. Angka adalah median lintas pasangan scene yang diuji, bukan p95 atau SLA.

| Alur | Plan | Sampel cold/warm | Kamera sampai, cold | Detail siap, cold | Unduh cold | Kamera sampai, warm | Detail siap, warm | Unduh warm |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Pindah scene | A - Current multires | 3/3 | 0.517 s | 1.163 s | 0.198 MiB | 0.261 s | 0.495 s | 0.000 MiB |
| Pindah scene | B - Asli 11904px, multires 4096, JPEG 85 | 3/3 | 0.623 s | 1.391 s | 0.306 MiB | 0.262 s | 0.496 s | 0.000 MiB |
| Pindah scene | C - Asli 11904px utuh | 3/3 | 30.175 s | 30.175 s | 16.209 MiB | 2.602 s | 2.602 s | 0.000 MiB |
| Klik tenant, pindah scene | A - Current multires | 2/2 | 0.361 s | 1.153 s | 0.233 MiB | 0.097 s | 0.621 s | 0.000 MiB |
| Klik tenant, pindah scene | B - Asli 11904px, multires 4096, JPEG 85 | 2/2 | 0.413 s | 1.254 s | 0.366 MiB | 0.121 s | 0.638 s | 0.000 MiB |
| Klik tenant, pindah scene | C - Asli 11904px utuh | 2/2 | 28.347 s | 28.880 s | 15.312 MiB | 2.300 s | 2.833 s | 0.000 MiB |
| Klik tenant, scene sama | A - Current multires | 2/2 | 0.339 s | 0.579 s | 0.109 MiB | 0.376 s | 0.376 s | 0.000 MiB |
| Klik tenant, scene sama | B - Asli 11904px, multires 4096, JPEG 85 | 2/2 | 0.363 s | 0.731 s | 0.172 MiB | 0.360 s | 0.360 s | 0.000 MiB |
| Klik tenant, scene sama | C - Asli 11904px utuh | 2/2 | 0.353 s | 0.353 s | 0.000 MiB | 0.354 s | 0.354 s | 0.000 MiB |

## Sampel dan metode

- jatimulya: check-point-1-concourse-unpaid -> check-point-2-concourse-unpaid; tenant Loko 2 Go (JTM-LOKO-CAFE).
- cawang: check-point-2-concourse-unpaid -> check-point-1-concourse-unpaid; tenant Alfamart (CWG-ALFAMART).
- bekasi-barat: check-point-2-peron-1 -> check-point-1-peron-1; scene saja, tidak tersedia original pada scene tenant.

- Semua enam file upload asli berukuran 11904 x 5952. Plan B memakai sumber ini tanpa resize awal, cubemap 4096 per sisi, tile 512, empat level, JPEG 85. Plan A memakai tile existing yang diambil dari S3, cube 2048 / tiga level. Plan C memuat JPEG upload asli utuh (sekitar 14-20 MiB per file).
- Responsively menggunakan komputer Intel Core Ultra 7 155H dan Intel Arc Graphics. Viewport mobile adalah emulasi, bukan perangkat HP fisik; kemampuan GPU/texture browser HP bisa berbeda.
- DPR komputer yang digunakan adalah 2,25, dikonfirmasi di kedua ukuran preview. Canvas harness setinggi viewport dikurangi 130px untuk kontrol pengujian, sehingga bukan ukuran canvas fullscreen persis seperti public viewer.
- Pada desktop, Plan B meminta tile hingga level 4. Pada mobile dengan HFOV 120, permintaan terutama level 1-2. Karena itu angka mobile tidak berarti detail tertinggi 4K sudah dimuat atau dirender dengan biaya yang sama; multires menyesuaikan kebutuhan piksel tampilan.
- Fixture HTTP lokal pada port 3004 mensimulasikan anggaran unduhan bersama dan latensi di server. Ini bukan throttling CDP atau pengukuran CDN production. File current dan kandidat di disk lokal; waktu DB/API dan cold page load tidak diukur.
- Memakai Pannellum 2.5.7 serta bundle fungsi diveIntoScene dan softCrossfadeScene dari kode aplikasi saat ini. Scene fade, batas pitch, HFOV 120, animasi fokus 320 ms, serta preload enam tile level rendah/gambar utuh mengikuti alur terkait. Scene awal A sudah selesai memuat sebelum timer dimulai; hanya navigasi menuju B yang dihitung.
- Cache cold: URL target baru per kombinasi plan/alur. Cache warm: ulangi alur dengan URL yang sama pada viewer yang sama setelah kembali ke scene/sudut awal. Server memberi header cache immutable seperti proxy aplikasi. Transfer dicatat dari Resource Timing; encodedBodySize hanya dihitung sebagai unduhan jika transferSize > 0.
- Kamera sampai: scene tujuan aktif, renderer siap, yaw dan pitch mencapai target (toleransi 1 derajat). Batas pitch efektif Pannellum diperhitungkan pada viewport sempit; target tidak dipaksa melampaui batas kamera.
- Detail siap: maksimum dari kamera sampai, handler transisi selesai, dan waktu image terakhir selesai; dikonfirmasi tidak ada permintaan gambar tertunda selama 300 ms. Ukuran ini mencakup decode/render dan animasi, bukan hanya waktu HTTP. Ini proksi kesiapan gambar, bukan pembuktian tiap piksel identik dengan original.
- Klik tenant pada scene sama tidak perlu memuat ulang JPEG utuh untuk Plan C karena file sudah dimuat pada tahap persiapan. Biaya awal file besar tersebut tercermin pada uji lintas scene, bukan pada angka klik scene sama. Rotasi kamera bisa meminta tile untuk arah baru; cache hangat tidak menjamin semua arah panorama sudah tersimpan.
- Bekasi Barat hanya diuji untuk navigasi scene. Scene tenant di sana belum memiliki originalPanoramaUrl, sehingga tidak diganti dengan panorama lain atau pinpoint rekaan. Klik tenant memakai unit nyata Loko 2 Go Jatimulya dan Alfamart Cawang.
- Satu pengulangan per kombinasi, dengan tiga pasangan untuk scene dan dua pasangan untuk tenant. Hasil ini cukup untuk perbandingan awal dan perlu pengulangan/perangkat fisik sebelum menetapkan target produksi.

## Batas dan keputusan

Cache mengurangi unduhan ulang, tetapi tidak menghilangkan kerja decode, pembuatan tekstur, pemuatan tile, dan transisi. Jangan menyimpulkan warm cache selalu sama cepat dengan current.

File original dalam uji adalah upload asli lokal; hasil privasi/bake yang ada tidak diterapkan ulang pada file original ini. Penerapan publik harus memproses blur privasi pada resolusi native terlebih dahulu, memakai prefix aset versi baru dan menjaga rollback. Tidak ada file original ini yang dipublikasikan ke production.

Default generator aplikasi tetap profil existing. Opsi cubeResolution 4096 hanya dipakai script percobaan; validator/config produksi belum diganti untuk menerima profil empat level. Ini simulasi, bukan rollout parsial tersembunyi.

Halaman preview dan server simulasi port 3004 dihapus pada 15 November 2026 setelah pengujian selesai. Hasil pengukuran tersimpan dalam laporan ini.
