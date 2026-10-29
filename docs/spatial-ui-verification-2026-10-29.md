# Label unit Spatial dan breadcrumb editor

## Perubahan tampilan

Label Spatial memakai dasar putih, border tipis, teks tebal, dan panah diagonal mengikuti referensi pengguna. Unit tersedia memakai teks hijau; status terisi/nonaktif tetap memakai warna teks status yang sesuai. Bahasa status tetap mengikuti aplikasi. Label panjang dibatasi pada lebar viewport, dengan caption lengkap pada tooltip.

Beberapa sisi unit yang sama menampilkan satu label dan mendapat highlight bersama ketika salah satu sisi atau label di-hover. Identitas unit memakai unitId, dengan dukungan kode unit untuk data lama tanpa unitId. Area tanpa tautan tetap terpisah. Label menggunakan geometry yang masih terlihat, sehingga tidak hilang ketika sisi pemilik label awal keluar dari viewport.

Setiap sisi tetap merupakan entity tersendiri untuk pemilihan dan edit vertex. Penggabungan hanya berlaku pada label dan highlight, tanpa perubahan format data, tautan unit, atau pilihan Pin/Spatial.

Kotak duplikat `Sedang diedit` pada sidebar dihapus. Breadcrumb di dekat Kembali kini menampilkan stasiun, level, area, dan scene. Label level/area berasal dari struktur tur yang aktif, dengan prioritas ID sebelum slug. Breadcrumb memperbarui scene saat navigasi dan dapat membungkus ke baris berikutnya.

## Verifikasi

- Production build lolos, termasuk TypeScript.
- `npm run test:spatial` lolos 21 tes, termasuk pengelompokan unit, kode lama, area tanpa tautan, dan konflik identitas.
- `scripts/check-spatial-unit-groups-browser.js` lolos: satu label untuk dua sisi, palet putih/hijau, hover bersama dari sisi mana pun maupun label, keyboard focus, pemilihan sisi terpisah, drag vertex, undo, redo, serta label yang tetap ada saat satu sisi keluar viewport atau menonaktifkan labelnya.
- `scripts/check-spatial-authoring-browser.js` lolos kembali: empat titik tidak berubah saat Selesaikan, termasuk sisi tambahan unit existing; drag/undo, authoring Pin, dan Blur tetap berfungsi.
- Pemeriksaan kamera sebelumnya juga lolos setelah perubahan label: pan/culling, alignment, resize, vertex editing, dan pergantian mode.
- Pemeriksaan breadcrumb pada 1536, 1366, 768, dan 390 px memastikan urutan lengkap, pembaruan saat pindah scene, kotak sidebar sudah hilang, tidak ada overflow horizontal, serta tombol Simpan tetap berada di viewport.
- Lint source selesai tanpa error; pemeriksaan akhir mencatat 9 warning di luar perubahan ini, yaitu 7 warning source yang sudah ada dan 2 warning helper browser lain di `scripts/`.

Screenshot fixture tersimpan lokal dan diabaikan Git pada `output/playwright/spatial-unit-group-labels.png`, `editor-breadcrumb-1536.png`, dan `editor-breadcrumb-390.png`.

Seluruh tes memakai data sintetis dan database PostgreSQL sementara lokal. Skrip pengujian label dan authoring memblokir API write CMS. Data pengguna tidak disimpan, dihapus, atau dipublikasikan. Belum commit, push, atau deploy.
