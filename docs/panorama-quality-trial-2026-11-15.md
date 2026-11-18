# Uji kualitas panorama ? 15 November 2026

Hasil: sumber penuh dengan JPEG 85 layak untuk tahap penerapan berikutnya. Ini bukan gambar lossless; detail mendekati sumber yang diproyeksikan ke kubus, dengan ukuran transfer lebih besar dari tile existing. Belum ada perubahan DB atau objek S3 scene aktif.

## Metode

- Tiga scene: Jatimulya check-point-2-concourse-unpaid; Cawang check-point-2-concourse-unpaid; Bekasi Barat check-point-1-peron-1. Semua panorama sumber 6000 ? 3000; sumber adalah panorama yang juga dipakai editor, termasuk hasil bake privasi, bukan master sebelum blur.
- Existing: tile aktual yang diunduh dari path scene saat ini. Kandidat: sumber penuh 6000px, cubemap tetap 2048px, tile tetap 512px, tiga level; JPEG 85 dan 90. Pembanding: gambar utuh seperti editor.
- MCP Responsively, desktop 1440 ? 900 dan viewport mobile 390 ? 844. Browser dan GPU komputer yang sama, bukan HP fisik.
- Cold cache setiap permintaan (Cache-Control: no-store). Server fixture lokal mensimulasikan anggaran transfer bersama 20 Mbps / latensi respons 40 ms. Tiga pengulangan per kombinasi: 72 kasus. Tambahan mobile 5 Mbps / 100 ms, satu pengulangan existing, JPEG 85, dan gambar utuh: 9 kasus. Ini simulasi di server, bukan CDP throttling atau pengukuran jaringan production.
- Yaw/pitch sama per scene, HFOV 80. Pannellum 2.5.7 sama dengan app; harness terpisah tanpa overlay/hotspot, sehingga tidak membuktikan FPS app atau kecepatan CDN production.
- Waktu selesai: renderer siap, seluruh permintaan gambar selesai, tidak ada aktivitas baru selama 500 ms; waktu tunggu 500 ms dikurangi dari hasil. Waktu tile pertama di JSON bukan waktu seluruh viewport tajam.
- 81/81 kasus tanpa image error, pending request tersisa, atau timeout.

## Waktu sampai tile/gambar selesai memuat

Median pada 20 Mbps. Angka dalam detik.

| Viewport | Scene | Existing | Sumber penuh JPEG 85 | JPEG 90 | Gambar utuh editor |
|---|---|---:|---:|---:|---:|
| Desktop | jatimulya | 1.006 | 1.003 | 1.002 | 2.358 |
| Desktop | cawang | 0.804 | 0.846 | 0.862 | 2.143 |
| Desktop | bekasi-barat | 0.837 | 0.864 | 0.880 | 0.768 |
| Mobile | jatimulya | 1.210 | 1.199 | 1.203 | 2.230 |
| Mobile | cawang | 1.101 | 1.150 | 1.150 | 1.952 |
| Mobile | bekasi-barat | 1.118 | 1.129 | 1.134 | 0.720 |

Mobile 5 Mbps / 100 ms, satu pengulangan:

| Scene | Existing | JPEG 85 | Gambar utuh |
|---|---:|---:|---:|
| jatimulya | 2.436 | 2.558 | 7.463 |
| cawang | 2.133 | 2.283 | 6.589 |
| bekasi-barat | 2.315 | 2.570 | 1.532 |

## Transfer pada viewport desktop

| Scene | Existing | JPEG 85 | JPEG 90 | Gambar utuh |
|---|---:|---:|---:|---:|
| jatimulya | 470 KiB | 760 KiB | 1013 KiB | 4283 KiB |
| cawang | 350 KiB | 552 KiB | 738 KiB | 3751 KiB |
| bekasi-barat | 566 KiB | 858 KiB | 1114 KiB | 686 KiB |

JPEG 85 membutuhkan sekitar 52?62% lebih banyak transfer untuk viewport desktop ini. JPEG 90 menambah sekitar 30?34% lagi terhadap JPEG 85. Anggaran jaringan lambat harus tetap diperhitungkan.

## Detail dan batas hasil

PSNR untuk 16 tile level tertinggi sisi depan dibanding referensi sumber penuh JPEG 100: existing 37,5?39,47 dB; kandidat JPEG 85 44,87?47,02 dB. Ini metrik terhadap proyeksi referensi, bukan klaim identik dengan gambar kamera atau penilaian semua arah. Pembandingan crop Jatimulya menunjukkan JPEG 85 mempertahankan detail tulisan/tepi lebih baik daripada existing dan mendekati referensi.

Bekasi Barat yang dipilih memiliki gambar utuh hanya 686 KiB. Pada sampel ini gambar utuh lebih hemat dan lebih cepat selesai daripada tile. Jangan memaksakan satu profil untuk semua panorama tanpa mengecek ukuran sumber.

## Status implementasi

`buildPanoramaTiles` menerima opsi sourceWidth dan jpegQuality. Default aplikasi tetap profil existing; hanya harness memakai opsi sumber penuh dan JPEG 85/90. Hasil simulasi dan tile trial berada di folder ignored `.playwright-mcp/panorama-quality/`. Tidak ada commit, push, perubahan DB, atau unggahan S3 untuk uji ini.

Halaman preview dan server simulasi port 3003 dihapus pada 15 November 2026 setelah pengujian selesai.

Untuk penerapan massal: buat aset baru dengan prefix versi, gunakan panorama yang sudah dibake, simpan backup canvasData, verifikasi kelengkapan tile, kemudian ubah hanya referensi multires secara bertahap. Pertahankan referensi lama untuk rollback; jangan menimpa prefix tile existing yang mungkin dipakai production.
