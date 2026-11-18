# Riset optimasi virtual tour - 15 November 2026

Kesimpulan: pertahankan master asli dan multiresolution, lalu optimalkan pemilihan level, jumlah tile, scheduling decode/render, serta cache. Menurunkan seluruh sumber ke 6000px merupakan kandidat praktis, bukan satu-satunya solusi.

## Temuan dari sumber primer

| Sumber | Praktik yang didokumentasikan | Implikasi untuk aplikasi |
|---|---|---|
| [Pannellum overview](https://pannellum.org/documentation/overview/) | Panorama besar dilayani sebagai image pyramid multiresolution. | Hindari JPEG 11904px utuh sebagai default navigasi. |
| [Renderer Pannellum 2.5.7](https://github.com/mpetroff/pannellum/blob/2.5.7/src/js/libpannellum.js) | Satu tile baru dijadwalkan per frame; pemuatan gambar memakai pool empat loader. Ukuran drawing buffer memakai DPR; pemilihan level bergantung pada drawing buffer dan HFOV. Tekstur lama dibersihkan pada inisialisasi renderer. | Banyak tile dapat memperlambat penajaman walaupun HTTP cache hangat. Ini penjelasan yang konsisten dengan simulasi, belum bukti profiling bahwa seluruh jeda berasal dari scheduler. |
| [krpano tools](https://krpano.com/docu/tools/config/#tilesize) | Merekomendasikan tile 512px sebagai kompromi biaya upload tekstur dan draw call. | Ukuran current masuk akal; jangan menggantinya tanpa pengukuran. |
| [Pano2VR 8](https://ggnome.com/doc/pano2vr/8_0/workspace/output/web-props/) | Default output tile 1024px; tersedia 512px dan 2048px. Mendukung JPEG/WebP dan pengaturan switch bias. | 1024px layak menjadi pembanding pada renderer kita; jumlah file berkurang tetapi biaya per tile naik. |
| [krpano network](https://krpano.com/docu/xml/#network) dan [display](https://krpano.com/docu/xml/#display.loadwhilemoving) | Mengatur download paralel, request/decode per frame, dan penjadwalan tile saat bergerak. | Bedakan kelancaran navigasi dari waktu penajaman detail. Menambah paralelisme tanpa batas dapat menurunkan respons. |
| [Marzipano TextureStore](https://www.marzipano.net/reference/TextureStore.html) dan [contoh scene](https://www.marzipano.net/docs.html) | Cache tekstur terlihat dan LRU untuk tile sebelumnya; preview level dapat dipertahankan. | HTTP cache dan cache tekstur GPU perlu dianalisis terpisah. |
| [3DVista](https://www.3dvista.com/en/kb/faqs/publishing-sharing/what-is-the-optimum-file-size-for-a-virtual-tour/) | Pengaturan ukuran, kualitas, versi mobile, dan preload dapat disesuaikan. | Satu profil untuk seluruh perangkat bukan satu-satunya pendekatan. |
| [MDN HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching) | Aset immutable perlu URL yang berubah saat kontennya berubah. | Pertahankan cache browser dan prefix versi; verifikasi cache bersama/CDN production secara terpisah. |

## Rekomendasi eksperimen berikutnya

Ini rancangan uji kita, bukan jaminan kecepatan atau konfigurasi vendor yang bisa langsung dipindahkan ke Pannellum.

1. Bandingkan sumber asli + JPEG 85 dengan tile 512px versus 1024px. Kontrol cubemap, viewport, DPR, arah pandang, HFOV, dan jaringan agar tetap sama. Ukur kamera sampai, detail terlihat, jumlah request, download, frame terlama, dan memori.
2. Tetap sertakan profil sumber 6000px + JPEG 85 sebagai baseline seimbang dari simulasi sebelumnya.
3. Setelah itu uji prioritas tile pada arah kedatangan/pinpoint tenant dan preload terbatas untuk kandidat scene berikutnya. Jangan preload semua scene atau semua level.
4. Ukur kebutuhan level pada DPR tinggi; batas resolusi harus adaptif dan diperiksa ketajamannya, bukan diturunkan secara global.
5. Verifikasi cache/CDN serta uji melalui DEV dengan jalur S3/proxy production dan HP fisik.

JPEG 85 adalah kandidat berdasarkan eksperimen lokal kita, bukan standar optimal universal. Kontrol scheduling krpano dan TextureStore Marzipano bukan API Pannellum 2.5.7; adaptasinya memerlukan implementasi atau perubahan renderer tersendiri. Tidak ada perpindahan engine atau perubahan perilaku aplikasi dalam riset ini.
