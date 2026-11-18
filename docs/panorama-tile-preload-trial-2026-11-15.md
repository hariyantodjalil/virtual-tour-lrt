# Uji tile, format, dan preload panorama - 15 November 2026

Hasil simulasi terpisah dari scene aktif. Semua sumber asli, DB, hotspot, objek S3, dan perilaku public viewer tetap. Tidak ada commit/push atau penerapan massal.

## Keputusan awal dari sampel

- Desktop: kandidat source asli + JPEG 85 + tile 1024. Untuk klik tenant lintas scene, detail cold turun dari 3,619 s (tile 512 native) menjadi 1,818 s. Ini masih lebih lama daripada current 1,363 s dan memakai lebih banyak data.
- Mobile portrait yang diuji: source asli + JPEG 85 + tile 512 mempertahankan respons awal yang lebih baik daripada 1024. Tanpa preload lebih dulu, kamera 0,382 s / detail 1,133 s; current 0,310 s / 0,986 s.
- Preload terarah dengan target diketahui 1 s sebelum klik: desktop native 1024 kamera 0,300 s / detail 1,669 s, mobile native 512 kamera 0,242 s / detail 0,976 s. Biaya preload dan lead time tercatat di tabel; bukan jaminan setiap klik di aplikasi mendapatkan hasil ini.
- WebP 92 tidak menjadi pilihan default pada batch ini: kualitas kalibrasi hampir setara JPEG 85, tetapi total empat scene 2,36% lebih besar dan waktu detail tidak lebih baik secara konsisten.
- Profil 6000 tetap pilihan hemat data dengan ketajaman menengah. Dua pyramid native 512/1024 mempertahankan detail tertinggi yang sama dengan konsekuensi storage tambahan jika dipakai bersama.

Rekomendasi ini belum merupakan aturan universal desktop/mobile. Uji ulang viewport lain, zoom, landscape, dan HP fisik melalui jalur DEV/S3 sebelum penerapan massal. Default aplikasi belum berubah.

## Profil yang dibandingkan

| Profil | Sumber | Cube per sisi | Tile | Level | Format |
|---|---|---:|---:|---:|---|
| Current JPEG 72 / tile 512 | Aset current | 2048 | 512 | 3 | JPEG 72 |
| Original JPEG 85 / tile 512 | Original 11904 x 5952 | 4096 | 512 | 4 | JPEG 85 |
| Original JPEG 85 / tile 1024 | Original 11904 x 5952 | 4096 | 1024 | 3 | JPEG 85 |
| Source 6000 JPEG 85 / tile 512 | Original di-resize ke 6000 x 3000 | 2048 | 512 | 3 | JPEG 85 |
| Original WebP 92 / tile 1024 | Original 11904 x 5952 | 4096 | 1024 | 3 | WebP lossy 92 |

Profil 6000 dibuat dari master JPEG asli, bukan dari WebP editor yang sudah dikompresi. Native 512 dan 1024 memakai proyeksi cube 4096 yang sama sehingga resolusi detail tertinggi tetap sama. JPEG juga tetap lossy, bukan lossless.

## 1440 x 900, 20 Mbps / 40 ms

| Alur | Profil | Kamera cold (s) | Detail cold (s) | Unduh cold (MiB) | Kamera warm (s) | Detail warm (s) | Unduh warm (MiB) | Frame P95 cold (ms) | Frame terlama cold (ms) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Pindah scene | Current JPEG 72 / tile 512 | 0.405 | 1.415 | 0.476 | 0.292 | 1.225 | 0.000 | 16.9 | 133.3 |
| Pindah scene | Original JPEG 85 / tile 512 | 0.475 | 3.568 | 1.741 | 0.329 | 3.260 | 0.000 | 16.9 | 166.6 |
| Pindah scene | Original JPEG 85 / tile 1024 | 0.518 | 1.804 | 2.081 | 0.358 | 1.271 | 0.000 | 16.9 | 149.9 |
| Pindah scene | Source 6000 JPEG 85 / tile 512 | 0.423 | 1.478 | 0.749 | 0.327 | 1.232 | 0.000 | 16.9 | 183.2 |
| Pindah scene | Original WebP 92 / tile 1024 | 0.569 | 1.867 | 2.119 | 0.408 | 1.323 | 0.000 | 17.0 | 183.3 |
| Tenant lintas scene | Current JPEG 72 / tile 512 | 0.221 | 1.363 | 0.545 | 0.151 | 1.232 | 0.000 | 16.9 | 116.8 |
| Tenant lintas scene | Original JPEG 85 / tile 512 | 0.380 | 3.619 | 1.898 | 0.172 | 3.368 | 0.000 | 16.9 | 183.5 |
| Tenant lintas scene | Original JPEG 85 / tile 1024 | 0.411 | 1.818 | 2.409 | 0.196 | 1.269 | 0.000 | 16.9 | 183.5 |
| Tenant lintas scene | Source 6000 JPEG 85 / tile 512 | 0.274 | 1.422 | 0.862 | 0.159 | 1.239 | 0.000 | 16.8 | 132.8 |
| Tenant lintas scene | Original WebP 92 / tile 1024 | 0.397 | 1.831 | 2.460 | 0.255 | 1.339 | 0.000 | 16.9 | 150.0 |
| Tenant scene sama | Current JPEG 72 / tile 512 | 0.329 | 0.971 | 0.393 | 0.327 | 0.327 | 0.046 | 16.9 | 17.6 |
| Tenant scene sama | Original JPEG 85 / tile 512 | 0.327 | 3.536 | 1.623 | 0.321 | 3.023 | 0.003 | 25.1 | 33.5 |
| Tenant scene sama | Original JPEG 85 / tile 1024 | 0.329 | 1.186 | 1.749 | 0.320 | 0.320 | 0.232 | 16.9 | 17.1 |
| Tenant scene sama | Source 6000 JPEG 85 / tile 512 | 0.323 | 0.916 | 0.615 | 0.326 | 0.326 | 0.099 | 16.9 | 19.6 |
| Tenant scene sama | Original WebP 92 / tile 1024 | 0.337 | 1.233 | 1.757 | 0.325 | 0.334 | 0.248 | 16.9 | 17.1 |

## 390 x 844, 5 Mbps / 100 ms

| Alur | Profil | Kamera cold (s) | Detail cold (s) | Unduh cold (MiB) | Kamera warm (s) | Detail warm (s) | Unduh warm (MiB) | Frame P95 cold (ms) | Frame terlama cold (ms) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Pindah scene | Current JPEG 72 / tile 512 | 0.479 | 1.042 | 0.196 | 0.236 | 0.478 | 0.000 | 17.0 | 33.3 |
| Pindah scene | Original JPEG 85 / tile 512 | 0.530 | 1.114 | 0.305 | 0.213 | 0.457 | 0.000 | 17.1 | 33.3 |
| Pindah scene | Original JPEG 85 / tile 1024 | 0.922 | 1.073 | 0.363 | 0.228 | 0.377 | 0.000 | 16.9 | 49.7 |
| Pindah scene | Source 6000 JPEG 85 / tile 512 | 0.545 | 1.119 | 0.302 | 0.212 | 0.450 | 0.000 | 17.0 | 49.9 |
| Pindah scene | Original WebP 92 / tile 1024 | 1.000 | 1.131 | 0.402 | 0.266 | 0.398 | 0.000 | 17.0 | 49.8 |
| Tenant lintas scene | Current JPEG 72 / tile 512 | 0.310 | 0.987 | 0.233 | 0.051 | 0.584 | 0.000 | 17.0 | 49.6 |
| Tenant lintas scene | Original JPEG 85 / tile 512 | 0.382 | 1.133 | 0.366 | 0.089 | 0.617 | 0.000 | 17.0 | 33.3 |
| Tenant lintas scene | Original JPEG 85 / tile 1024 | 0.818 | 1.350 | 0.363 | 0.074 | 0.601 | 0.000 | 17.0 | 33.4 |
| Tenant lintas scene | Source 6000 JPEG 85 / tile 512 | 0.377 | 1.168 | 0.360 | 0.059 | 0.589 | 0.000 | 17.0 | 33.2 |
| Tenant lintas scene | Original WebP 92 / tile 1024 | 0.864 | 1.379 | 0.402 | 0.105 | 0.631 | 0.000 | 17.5 | 33.5 |
| Tenant scene sama | Current JPEG 72 / tile 512 | 0.360 | 0.535 | 0.109 | 0.358 | 0.358 | 0.000 | 17.0 | 39.2 |
| Tenant scene sama | Original JPEG 85 / tile 512 | 0.360 | 0.572 | 0.172 | 0.360 | 0.360 | 0.000 | 17.1 | 39.7 |
| Tenant scene sama | Original JPEG 85 / tile 1024 | 0.359 | 0.414 | 0.087 | 0.358 | 0.358 | 0.000 | 16.9 | 17.0 |
| Tenant scene sama | Source 6000 JPEG 85 / tile 512 | 0.356 | 0.584 | 0.169 | 0.357 | 0.357 | 0.000 | 17.0 | 17.8 |
| Tenant scene sama | Original WebP 92 / tile 1024 | 0.358 | 0.435 | 0.094 | 0.355 | 0.355 | 0.000 | 16.9 | 17.0 |

## Uji preload terarah

Baseline memuat enam base faces seperti helper aplikasi. Mode targeted_now memuat base faces yang diperkirakan terlihat pada arah kedatangan, lalu navigasi. Mode targeted_1000 memakai base faces terlihat yang sama dan mendahuluinya dengan preload maksimum dua URL: base face pusat dan tile pada pinpoint/arah kedatangan di level yang dibutuhkan. URL yang sama dideduplikasi. Preload diberi jendela 1000 ms sebelum klik.

Klik tidak sengaja ditunda 1 detik dalam rancangan produk: simulasi mengasumsikan target sudah diketahui lebih dulu, misalnya saat hover/focus item. Pada HP asumsi itu perlu dirancang dan diuji; tidak semua ketukan memberi waktu preload. Unduhan preload tetap dihitung.

### 1440 x 900, 20 Mbps

| Alur | Profil | Mode | Kamera setelah klik (s) | Detail setelah klik (s) | Unduh sebelum klik (MiB) | Unduh setelah klik (MiB) | Total unduh (MiB) |
|---|---|---|---:|---:|---:|---:|---:|
| Pindah scene | Source 6000 JPEG 85 / tile 512 | baseline | 0.456 | 1.492 | 0.000 | 0.749 | 0.749 |
| Pindah scene | Source 6000 JPEG 85 / tile 512 | targeted_now | 0.408 | 1.412 | 0.000 | 0.724 | 0.724 |
| Pindah scene | Source 6000 JPEG 85 / tile 512 | targeted_1000 | 0.385 | 1.347 | 0.051 | 0.673 | 0.724 |
| Pindah scene | Original JPEG 85 / tile 1024 | baseline | 0.578 | 1.896 | 0.000 | 2.081 | 2.081 |
| Pindah scene | Original JPEG 85 / tile 1024 | targeted_now | 0.516 | 1.728 | 0.000 | 2.008 | 2.008 |
| Pindah scene | Original JPEG 85 / tile 1024 | targeted_1000 | 0.434 | 1.619 | 0.141 | 1.868 | 2.008 |
| Tenant lintas scene | Source 6000 JPEG 85 / tile 512 | baseline | 0.251 | 1.393 | 0.000 | 0.862 | 0.862 |
| Tenant lintas scene | Source 6000 JPEG 85 / tile 512 | targeted_now | 0.222 | 1.379 | 0.000 | 0.834 | 0.834 |
| Tenant lintas scene | Source 6000 JPEG 85 / tile 512 | targeted_1000 | 0.201 | 1.343 | 0.060 | 0.774 | 0.834 |
| Tenant lintas scene | Original JPEG 85 / tile 1024 | baseline | 0.413 | 1.871 | 0.000 | 2.409 | 2.409 |
| Tenant lintas scene | Original JPEG 85 / tile 1024 | targeted_now | 0.355 | 1.812 | 0.000 | 2.329 | 2.329 |
| Tenant lintas scene | Original JPEG 85 / tile 1024 | targeted_1000 | 0.300 | 1.669 | 0.167 | 2.162 | 2.329 |

### 390 x 844, 5 Mbps

| Alur | Profil | Mode | Kamera setelah klik (s) | Detail setelah klik (s) | Unduh sebelum klik (MiB) | Unduh setelah klik (MiB) | Total unduh (MiB) |
|---|---|---|---:|---:|---:|---:|---:|
| Pindah scene | Source 6000 JPEG 85 / tile 512 | baseline | 0.552 | 1.195 | 0.000 | 0.302 | 0.302 |
| Pindah scene | Source 6000 JPEG 85 / tile 512 | targeted_now | 0.492 | 1.062 | 0.000 | 0.276 | 0.276 |
| Pindah scene | Source 6000 JPEG 85 / tile 512 | targeted_1000 | 0.520 | 1.128 | 0.048 | 0.228 | 0.276 |
| Pindah scene | Original JPEG 85 / tile 1024 | baseline | 0.961 | 1.099 | 0.000 | 0.363 | 0.363 |
| Pindah scene | Original JPEG 85 / tile 1024 | targeted_now | 0.813 | 0.951 | 0.000 | 0.290 | 0.290 |
| Pindah scene | Original JPEG 85 / tile 1024 | targeted_1000 | 0.686 | 0.845 | 0.074 | 0.216 | 0.290 |
| Pindah scene | Original JPEG 85 / tile 512 | baseline | 0.527 | 1.107 | 0.000 | 0.305 | 0.305 |
| Pindah scene | Original JPEG 85 / tile 512 | targeted_now | 0.491 | 1.067 | 0.000 | 0.280 | 0.280 |
| Pindah scene | Original JPEG 85 / tile 512 | targeted_1000 | 0.443 | 1.006 | 0.049 | 0.231 | 0.280 |
| Tenant lintas scene | Source 6000 JPEG 85 / tile 512 | baseline | 0.400 | 1.159 | 0.000 | 0.360 | 0.360 |
| Tenant lintas scene | Source 6000 JPEG 85 / tile 512 | targeted_now | 0.288 | 1.087 | 0.000 | 0.332 | 0.332 |
| Tenant lintas scene | Source 6000 JPEG 85 / tile 512 | targeted_1000 | 0.231 | 0.977 | 0.058 | 0.274 | 0.332 |
| Tenant lintas scene | Original JPEG 85 / tile 1024 | baseline | 0.773 | 1.301 | 0.000 | 0.363 | 0.363 |
| Tenant lintas scene | Original JPEG 85 / tile 1024 | targeted_now | 0.522 | 1.034 | 0.000 | 0.282 | 0.282 |
| Tenant lintas scene | Original JPEG 85 / tile 1024 | targeted_1000 | 0.376 | 0.902 | 0.087 | 0.195 | 0.282 |
| Tenant lintas scene | Original JPEG 85 / tile 512 | baseline | 0.397 | 1.153 | 0.000 | 0.366 | 0.366 |
| Tenant lintas scene | Original JPEG 85 / tile 512 | targeted_now | 0.305 | 1.101 | 0.000 | 0.337 | 0.337 |
| Tenant lintas scene | Original JPEG 85 / tile 512 | targeted_1000 | 0.241 | 0.976 | 0.059 | 0.278 | 0.337 |

Unduh sebelum/sesudah klik dikelompokkan menurut waktu mulai request di Resource Timing. Request preload yang belum selesai ketika klik tetap dicatat sebagai preload. Waktu detail setelah klik dapat lebih singkat karena sebagian pekerjaan sudah berlangsung sebelum klik; lead 1000 ms bukan penghematan total waktu dari munculnya intent.

## Kalibrasi kualitas WebP

Tiga crop 1024px berisi tulisan dan objek tenant diproyeksikan langsung dari original ke cube 4096. Referensi adalah RGB tanpa kompresi hasil proyeksi yang sama. Metrik adalah rata-rata SSIM luminance per blok 8 x 8; tidak mengukur seluruh aspek persepsi atau perbedaan chroma.

- JPEG 85 target SSIM: 0.993340.
- WebP terpilih: 92, memakai effort 4; kandidat 80/85/88/90/92/94. Toleransi pemilihan maksimum 0,0005 di bawah rerata SSIM JPEG.
- SSIM WebP terpilih: 0.993307.
- Tiga crop JPEG: 227233 byte; WebP: 219618 byte. Penghematan crop 3.35%. Ini tidak mewakili seluruh panorama.

| Profil | Total empat scene (MiB) | Tile per scene |
|---|---:|---:|
| Current JPEG 72 / tile 512 | 3.807 | 126 |
| Original JPEG 85 / tile 512 | 18.347 | 510 |
| Original JPEG 85 / tile 1024 | 17.434 | 126 |
| Source 6000 JPEG 85 / tile 512 | 6.193 | 126 |
| Original WebP 92 / tile 1024 | 17.845 | 126 |

Untuk keseluruhan empat scene, WebP 92 lebih besar 2.36% dibanding JPEG 85 / tile 1024. Jadi keuntungan format bergantung konten dan target kualitas; tidak otomatis sama dengan persentase studi umum.

Crop perbandingan ada di file ignored .playwright-mcp/panorama-quality/tile-format-detail.png; current dan profil 6000 diperbesar dari crop angular yang sama untuk membandingkan detail pada skala tampilan yang setara.

## Metode dan batas

- Dua pasangan scene nyata: Jatimulya check-point-1-concourse-unpaid -> check-point-2-concourse-unpaid (Loko 2 Go), dan Cawang check-point-2-concourse-unpaid -> check-point-1-concourse-unpaid (Alfamart). Empat scene seluruhnya memiliki file upload asli 11904 x 5952.
- MCP Responsively, Intel Core Ultra 7 155H / Intel Arc Graphics, DPR 2,25. Mobile adalah emulasi di komputer yang sama, bukan pengukuran HP fisik. Canvas harness setinggi viewport dikurangi 130px.
- Pannellum 2.5.7 dan fungsi transisi aplikasi yang sama; HFOV 120, animasi fokus 320 ms, batas pitch +/-58 derajat. Pada mobile pitch efektif bisa terjepit ke 0 akibat FOV vertikal; yang dicatat adalah waktu sampai batas kamera yang diperbolehkan. Zoom tidak diubah saat fokus tenant.
- Source scene sudah siap sebelum timer klik. Fixture HTTP localhost:3005 mensimulasikan anggaran transfer bersama 20 Mbps / 40 ms dan 5 Mbps / 100 ms. Tidak mengukur latensi S3/CDN production, API, atau cold page load. Tidak ada build, pembuatan tile, atau benchmark viewport lain berjalan bersamaan dengan pengukuran.
- Harness tidak menyertakan overlay spatial, panel React, atau form pengajuan lengkap. Ini uji pemuatan panorama dan fungsi navigasi yang dipakai aplikasi, bukan pembuktian FPS seluruh public viewer.
- Cold memakai URL target baru per profil/alur. Warm mengulang URL yang sama setelah kembali ke posisi awal. Cache-Control immutable meniru proxy aplikasi. Transfer dihitung dari encodedBodySize ketika transferSize > 0; cache browser tidak disamakan dengan tekstur GPU.
- Detail siap adalah maksimum waktu kamera sampai, handler transisi selesai, dan image terakhir selesai, setelah dikonfirmasi tidak ada pending image selama 300 ms. Ini proksi kesiapan, bukan pengujian setiap piksel visual. Frame gap berasal dari requestAnimationFrame, bukan pengukuran GPU penuh; P95 dekat 16,7 ms tidak membuktikan 60 FPS tanpa jeda.
- Satu pengulangan per kombinasi dan dua pasangan, jadi median adalah rerata dua sampel. Perbedaan kecil puluhan ms belum cukup menjadi klaim umum; kasus pengukuran berikutnya perlu pengulangan, tablet/landscape, dan HP fisik pada DEV.
- Preload visible faces menggunakan sampling frustum lokal; belum menjadi fitur app. Scope dibatasi pada satu target dan maksimum dua URL sebelum klik, bukan semua unit atau scene.
- Original yang dipakai trial belum di-bake ulang untuk privasi. Penerapan publik wajib mempertahankan blur privasi di resolusi native dan prefix versi aset baru, bukan menayangkan ulang original privat.
- Default aplikasi tetap generator lama (JPEG 72, sumber 4096, tile 512, cube 2048). Opsi format/tile baru hanya dipakai script. Type/config/validator produksi masih profil jpg/512/2048 dan perlu integrasi tersendiri jika kandidat dipilih.

## Status

180 kasus selesai, 0 error/timeout. npm run lint dan npm run build lolos (warning lama tetap ada).

Halaman preview dan server simulasi port 3005 dihapus pada 15 November 2026 setelah pengujian selesai. Hasil pengukuran tersimpan dalam laporan ini.
