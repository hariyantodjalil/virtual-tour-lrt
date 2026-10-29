# Spatial overlay performance — 28 Oktober 2026

## Metode dan batas pengukuran

Production build lokal, Chromium, viewport 1366×900, panorama sintetis 2048×1024, 50 quad tersebar dalam satu scene. Semua label area tetap aktif. Jalur Pin/Spatial dan data tenant tidak diubah oleh benchmark.

Skrip: `scripts/benchmark-spatial-browser.js`, dijalankan melalui Playwright CLI setelah login ke fixture `127.0.0.1:3100`. GET struktur fixture diintersep untuk 0/50 area; benchmark tidak menyimpan atau memublikasikan geometry ke DB. Fixture DB harus disiapkan memakai `scripts/prepare-spatial-browser.mts` pada PostgreSQL sementara yang diizinkan skrip tersebut.

Enam run bergantian 0/50/0/50/0/50. Setiap run: kamera digerakkan berdasarkan elapsed time selama 7,5 detik, warm-up 1,5 detik dikeluarkan dari statistik RAF. CPU Script/Layout/RecalcStyle diambil melalui Chrome DevTools Protocol untuk interval 7,5 detik penuh. FPS adalah cadence RAF halaman, bukan hitungan frame GPU tersendiri.

Angka tes lama 40–41 FPS memakai 90 frame dengan fixture/gerakan berbeda. Angka itu tidak digunakan sebagai baseline A/B optimasi ini.

## Baseline sebelum optimasi baru

| Area | FPS tiap run | Script ms, median | Style ms, median | Layout ms, median | p95 frame |
|---|---|---:|---:|---:|---:|
| 0 | 60 / 60 / 60 | 286,5 | 106,4 | 116,2 | 16,8 ms |
| 50 | 60 / 59,8 / 60 | 732,0 | 740,9 | 172,5 | 16,8 ms |

Baseline sudah mendekati batas refresh 60 Hz pada fixture ini. Optimasi dinilai dari penurunan kerja CPU/style dan kebenaran interaksi; jangan mengklaim kenaikan 40→60 FPS berdasarkan metode yang berbeda.

## Experiment ledger

| Percobaan | Alasan | Hasil | Keputusan |
|---|---|---|---|
| Batasi HUD yaw/pitch ke 10 Hz | HUD editor memperbarui state React setiap RAF, meskipun angka tidak memerlukan native refresh rate | Layout median 50 area: 172,5 → 98,7 ms (−43%); script 732 → 825,1 ms, tidak membuktikan penurunan JS; FPS 60 / 60 / 57,5 | Dipertahankan untuk penurunan layout yang konsisten; bukan klaim peningkatan FPS |
| Proyeksi kamera via SVG refs saat tidak mengedit vertex | Hindari setState/reconciliation seluruh overlay setiap perubahan yaw/pitch | Median 50 area: script 785,3 ms, style 740,4 ms, layout 99,6 ms; FPS 58 / 56 / 60. Tidak memberi keuntungan konsisten dibanding HUD saja | Dilepas, tambahan kompleksitas tidak sepadan |
| Hentikan RAF overlay kosong | Tidak ada geometri untuk diproyeksikan | Loop proyeksi dan ResizeObserver overlay tidak dipasang saat tidak ada area aktif maupun draft. Browser membuktikan area pertama tetap dapat digambar. Pengukuran script akhir bervariasi; tidak ada klaim persentase pengurangan JS dari perubahan ini | Dipertahankan bersama pembatasan HUD; dua perubahan kecil ini tidak menambah jalur render alternatif |
| Gunakan sudut asli untuk polygon sepenuhnya di dalam frustum | Sisi great-circle menjadi garis lurus pada proyeksi perspektif. Subdivisi menghasilkan titik SVG segaris yang berulang | Tes geometri dan interaksi lolos, tetapi dua batch browser menghasilkan 32,8 / 32,4 / 39,6 dan 29,2 / 35,5 / 35,6 FPS. Beban style 0 area juga naik dibanding sesi awal, sehingga penyebab tidak dapat dipastikan dari angka ini | Dilepas. Tidak ada bukti manfaat pada browser; jalur proyeksi semula dipulihkan |
| Elemen polygon dengan seluruh titik clipping dipertahankan | Trace menunjukkan biaya style SVG tinggi pada elemen path yang diperbarui setiap frame | UpdateLayoutTree pada trace: 1499,0 ke 462,3 ms; biaya per BeginMainFrame 5,32 ke 1,68 ms. Semua tes interaksi lolos | Dipertahankan untuk pengurangan biaya style sekitar 69%; tidak diklaim sebagai pencapaian 60 FPS |

Pada percobaan pertama, layout 0 area juga turun 116,2 → 19,0 ms. Angka HUD dibatasi 10 Hz; panorama dan proyeksi tetap mengikuti refresh kamera. Fluktuasi script/FPS dicatat apa adanya, sehingga penurunan layout tidak disalahartikan sebagai peningkatan FPS yang pasti.

Pin dan Spatial tetap memakai master unit yang sama. Seluruh perubahan tetap lokal sampai review/commit/deploy terpisah. Hasil fixture bukan jaminan performa panorama asli pada seluruh perangkat.

## Verifikasi putaran awal, 29 Oktober 2026

Build putaran awal memulihkan jalur proyeksi semula. Perubahan aplikasi yang dipertahankan saat itu hanya pembatasan HUD 10 Hz dan penghentian RAF overlay kosong. Kamera panorama dan proyeksi area tetap mengikuti RAF; label area tetap tersedia.

`npm run build` dan 18 tes `npm run test:spatial` lolos. Lint seluruh repo selesai tanpa error, dengan 7 warning source yang sudah ada dan 9 warning dari helper lokal di folder output pada saat pemeriksaan. Lint khusus skrip benchmark dan pemeriksaan browser juga lolos.

`scripts/check-spatial-camera-browser.js` lolos melalui Playwright langsung pada Chrome headless, memakai modul Playwright yang sudah tersedia di cache npm. Playwright CLI sempat mengembalikan kontrol saat dialog beforeunload muncul, sehingga runner langsung digunakan untuk memperoleh hasil lengkap. Skrip memeriksa:

- Pan 0/30/180/-179/0 derajat, culling, dan alignment dalam 3 CSS px.
- Resize viewport 1366 ke 768 lalu kembali, dengan viewBox mengikuti container.
- Pemilihan lewat keyboard, drag satu vertex lalu satu undo, penyisipan dan penghapusan vertex.
- Perpindahan mode edit/pan dan ketersediaan kedua tombol Unit Pin/Spatial.
- Gambar empat sudut dari scene tanpa Spatial Area, lalu buang edit sementara melalui dialog CMS. Fixture tetap memiliki Unit Pin; koordinat tes menghindari hit target Pin itu.

Benchmark akhir, Chrome headless melalui Playwright langsung, memakai pola gerak, durasi, viewport, dan fixture yang sama:

| Area | FPS tiap run | Script ms, median | Style ms, median | Layout ms, median | p95 frame tiap run |
|---|---|---:|---:|---:|---|
| 0 | 60 / 59,8 / 60 | 287,3 | 252,2 | 47,8 | 16,8 / 16,9 / 16,8 ms |
| 50 | 35,8 / 36,5 / 36,7 | 1289,5 | 1115,7 | 128,0 | 33,5 / 49,8 / 33,5 ms |

Target 50 area pada 60 FPS **belum terverifikasi**. Angka ini tidak dipakai untuk mengklaim peningkatan FPS terhadap baseline sesi awal. Runner/sesi browser berubah dan beban style kondisi 0 area juga berubah; penyebab perbedaan belum terisolasi. Pembatalan percobaan penyederhanaan polygon tidak mengembalikan FPS ke 60 pada lingkungan terakhir, sehingga penurunan FPS tidak dapat dibuktikan berasal dari percobaan tersebut.

Probe tambahan hanya mengubah respons GET fixture: dua pasang run 50 area dengan label tampil/tersembunyi menghasilkan 37,0/53,1 dan 50,6/51,9 FPS. Hasil ini belum cukup konsisten untuk menyimpulkan label sebagai penyebab utama. Tidak ada penghilangan label atau penurunan kualitas yang diterapkan ke aplikasi.

Langkah performa berikutnya membutuhkan rekaman Performance trace pada perangkat target dengan renderer GPU, mode daya, resolusi, versi browser, dan panorama asli dicatat. Pisahkan biaya React/JS, style/layout, dan paint/compositing sebelum mengganti renderer. Jalankan baseline dan kandidat secara bergantian dalam lingkungan yang sama.

Tidak ada penyimpanan/publikasi area lewat skrip benchmark dan pemeriksaan interaksi. Semua pengujian menggunakan DB sementara lokal, tanpa perubahan DB aplikasi/produksi. Belum commit, push, atau deploy.

## Profiling lanjutan, 29 Oktober 2026

Rekaman baru memakai Chrome 155.0.8059.85 headless, Windows, Intel Arc melalui ANGLE Direct3D11, DPR 1, viewport 1366x900, dan power plan Windows Balanced. Renderer teridentifikasi sebagai GPU Intel, bukan software renderer. Tidak ada perubahan pengaturan daya/GPU yang dilakukan.

Trace dan CPU profile disimpan lokal pada `output/playwright/spatial-pan.trace.json`, `spatial-pan.cpuprofile`, dan `spatial-pan.metadata.json`. Buka trace melalui DevTools Performance, Load profile. Artefak ini diabaikan Git. Rekaman hanya memakai fixture sintetis lokal.

Dalam interval pan 7556,7 ms, event main thread mencatat:

| Event | Durasi kumulatif | Jumlah |
|---|---:|---:|
| FunctionCall | 1867,7 ms | 1753 |
| UpdateLayoutTree | 1499,0 ms | 831 |
| Layerize | 709,7 ms | 281 |
| Paint | 643,4 ms | 899 |
| PrePaint | 416,5 ms | 554 |
| Layout | 177,2 ms | 274 |

Durasi event dapat saling meliputi; tabel bukan pembagian waktu yang dapat dijumlahkan. CPU profile juga menunjukkan biaya native `setAttribute` sekitar 277,9 ms dan `getBoundingClientRect` 32,9 ms. Rekaman berprofil menghasilkan 37,8 FPS, tetapi overhead profiler membuatnya tidak dipakai sebagai baseline FPS kandidat.

Baseline tanpa profiler, production build dan fixture yang sama:

| Area | FPS tiap run | Script ms, median | Style ms, median | Layout ms, median |
|---|---|---:|---:|---:|
| 0 | 58,2 / 60 / 60 | 257,7 | 246,0 | 45,0 |
| 50 | 36,1 / 37,1 / 34,7 | 1262,4 | 1035,6 | 143,1 |

Hipotesis yang diuji: area hasil clipping hanya memiliki sisi lurus. Ganti elemen SVG `path` dengan `polygon` memakai urutan titik dan pembulatan koordinat yang sama. Tujuannya mengurangi biaya pembaruan geometri/style SVG, tanpa mengganti proyeksi, mengurangi titik, menghapus label, atau menurunkan refresh rate kamera. Hit target, outline, fill, dan glow tetap memiliki atribut visual/interaksi yang sama. Draft yang belum selesai tetap memakai path.

Kandidat dipertahankan karena pengurangan biaya style yang besar dan pemeriksaan interaksi tetap lolos. Ini berbeda dari percobaan penyederhanaan sudut sebelumnya: seluruh titik hasil clipping tetap dirender, hanya jenis elemen SVG yang berubah.

Rekaman kandidat disimpan di `output/playwright/spatial-pan-after.trace.json`, `spatial-pan-after.cpuprofile`, dan `spatial-pan-after.metadata.json`. Metadata memastikan elemen area yang diukur adalah `polygon` dan browser/GPU tetap sama.

| Metrik trace | Sebelum, path | Sesudah, polygon |
|---|---:|---:|
| Interval pan | 7556,7 ms | 7765,2 ms |
| BeginMainFrame, jumlah | 282 | 276 |
| UpdateLayoutTree, total | 1499,0 ms | 462,3 ms |
| UpdateLayoutTree per BeginMainFrame | 5,32 ms | 1,68 ms |
| BeginMainFrame, total durasi | 4006,8 ms | 2594,3 ms |
| FunctionCall, total | 1867,7 ms | 1472,5 ms |
| Layout, total | 177,2 ms | 170,7 ms |
| Paint, total | 643,4 ms | 592,0 ms |
| RAF FPS dengan profiler | 37,8 | 36,7 |

Pengurangan style per frame sekitar 68,5%, dengan jumlah frame hampir sama. Pengurangan biaya ini tidak diartikan sebagai peningkatan FPS: FPS berprofil tetap berada pada rentang yang sama. Area, label, warna, outline, glow, dan target klik tetap tersedia.

Batch kandidat tanpa profiler menghasilkan:

| Area | FPS tiap run | Script ms, median | Style ms, median | Layout ms, median |
|---|---|---:|---:|---:|
| 0 | 30 / 29,9 / 30 | 164,7 | 142,8 | 43,6 |
| 50 | 29,8 / 29,8 / 29,9 | 1137,5 | 413,4 | 160,0 |

**Batas pengukuran:** batch ini juga membatasi kondisi 0 area pada sekitar 30 FPS, berbeda dari baseline kosong sekitar 60 FPS. Saat diperiksa, Windows melaporkan perangkat sedang memakai baterai tanpa charger, sisa 9%, kemudian 8%. Pengaturan daya perangkat tidak diubah. Status Energy Saver browser tidak diperiksa secara langsung, sehingga baterai rendah merupakan kemungkinan penyebab, bukan penyebab yang sudah dibuktikan. Chrome mendokumentasikan bahwa [Energy Saver dapat menurunkan refresh rate dan cadence requestAnimationFrame](https://developer.chrome.com/blog/memory-and-energy-saver-mode).

Target 50 area pada 60 FPS tetap belum terverifikasi. Ulangi A/B dalam kondisi charger terpasang, mode daya yang dicatat, dan baseline 0 area yang stabil mendekati 60 FPS. Jangan membandingkan FPS antar-batch dengan cadence kosong yang berbeda.

Validasi kandidat: production build lolos, 18 tes spatial lolos, dan seluruh pemeriksaan pada `scripts/check-spatial-camera-browser.js` lolos melalui Playwright langsung. Pemeriksaan finite geometry dan alignment menerima atribut `points` maupun `d`, tanpa melonggarkan toleransi 3 CSS px. Lint seluruh source selesai tanpa error, dengan 7 warning yang sudah ada. Folder artefak `output/playwright/**` kini dikecualikan dari lint, sama seperti pengecualiannya di Git; skrip verifikasi yang berada di `scripts/` tetap dilint.

Perubahan tetap lokal dan belum commit/push/deploy. Tidak ada penyimpanan atau publikasi geometry melalui pengujian, dan seluruh DB pengujian merupakan fixture sementara lokal.

## Pengukuran ulang setelah charger tersambung

Setelah pengguna mengonfirmasi charger terpasang, Windows melaporkan `PowerLineStatus: Online` dan baterai sekitar 53%. Power plan tetap Balanced. Pengujian memakai production build polygon yang sama, tanpa perubahan kode tambahan, serta database fixture sementara yang dibuat ulang. Browser baru memakai konfigurasi Chrome headless dan viewport yang sama; profiler tidak diaktifkan.

| Area | FPS tiap run | Median FPS | Script ms, median | Style ms, median | Layout ms, median | p95 frame tiap run |
|---|---|---:|---:|---:|---:|---|
| 0 | 60 / 59,7 / 60 | 60,0 | 223,3 | 223,4 | 36,8 | 16,8 / 17,1 / 16,8 ms |
| 50 | 46,8 / 47,6 / 39,1 | 46,8 | 1310,6 | 491,6 | 164,5 | 33,4 / 33,4 / 33,5 ms |

Kondisi kosong kembali mendekati 60 FPS, sehingga batas sekitar 30 FPS pada batch sebelumnya sudah tidak terlihat. Namun 50 area masih menghasilkan sekitar 39–48 FPS, dengan p95 interval frame sekitar 33,4 ms. **Target 50 area pada 60 FPS belum tercapai**, bahkan setelah kondisi daya diperbaiki. Perbedaan FPS terhadap sesi tanpa charger tidak diklaim sebagai hasil perubahan kode.

Pengurangan biaya style sekitar 69% yang tercatat pada trace sebelumnya tetap merupakan hasil yang terukur. Beban render/komposisi dan pembaruan overlay masih perlu dianalisis lebih lanjut pada daya AC yang stabil untuk mencapai target FPS. Hasil fixture sintetis ini belum mewakili seluruh panorama asli atau perangkat pengunjung.

Hasil mentah disimpan lokal pada `output/playwright/spatial-charging-benchmark.json`, diabaikan Git. Skrip hanya mengintersep GET struktur fixture dan tidak menyimpan atau memublikasikan area. Belum ada commit atau deploy.
