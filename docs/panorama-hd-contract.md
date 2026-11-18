# Kontrak backfill HD dan kualitas otomatis

Backfill HD menambahkan `canvasData.multiResProfilesHd`. Reader kualitas otomatis
memilih HD hanya setelah pengukuran koneksi memenuhi ambang dan profil tersedia.
Pergantian kualitas berlaku saat masuk scene berikutnya.

```ts
canvasData.multiResProfilesHd = {
  version: "jpeg85-v1",
  desktop: { /* PannellumMultiRes, tileResolution 1024, cubeResolution 4096 */ },
  mobile: { /* PannellumMultiRes, tileResolution 512, cubeResolution 4096 */ },
  sourcePanoramaUrl: scene.panoramaUrl,
  privacyVerified: true,
  privacyBlurLastBakedAt: canvasData.privacyBlurLastBakedAt ?? null,
  aiPatchLastBakedAt: canvasData.aiPatchLastBakedAt ?? null,
  // Tambahkan provenance sumber native, dimensi, waktu, dan parameter generator.
};
```

`sourcePanoramaUrl` merekam versi panorama publik saat profil HD dibuat.
Sumber native yang benar-benar dipakai generator dapat dicatat terpisah sebagai
`sourceNativePanoramaUrl`. `privacyVerified` diisi setelah pipeline dan verifikasi
memastikan hasil HD membawa blur privasi serta edit existing yang sesuai.
Gunakan `null` untuk stamp bake yang belum ada.

Reader memeriksa URL panorama publik dan kedua stamp bake terhadap kondisi scene
saat ini. Perubahan versi membuat profil HD perlu dibangun ulang. Bentuk desktop
dan mobile mengikuti validator `PanoramaMultiResProfiles` existing, termasuk
`path`, `extension`, `tileResolution`, `cubeResolution`, dan `maxLevel`.

`multiResProfiles` digunakan sebagai Hemat dan `multiRes` sebagai legacy fallback.
Backfill HD melakukan merge atomik kunci HD ke metadata scene terkini setelah kedua
pyramid lengkap. Guard publikasi perlu mencakup sumber native, panorama publik,
versi bake, mask blur yang dipakai, dan nilai HD sebelumnya. Konflik dicatat untuk
resume agar edit bersamaan tetap konsisten.

Codex mengerjakan reader HD, pengukuran jaringan browser, pemilihan kualitas,
preload, dan registrasi scene Pannellum. DeepSeek mengerjakan pembentukan sumber
native yang aman, generator, upload, backfill, serta verifikasi aset HD.

Auto mulai dengan Hemat. Estimasi memakai transfer tile nyata pada origin aplikasi.
Resource dari cache dikecualikan. Pengukuran yang saling overlap dihitung dalam
rentang waktu gabungan. Mode hemat data dan koneksi 2G/3G memilih Hemat. Ambang
awal HD 12 Mbps desktop dan 6 Mbps mobile, dengan minimal enam sampel dan rentang
dua detik. Ambang turun 4 Mbps desktop dan 2 Mbps mobile. Setelah turun, promosi
ditahan 20 detik. Angka ini adalah parameter awal implementasi untuk diuji melalui
DEV/tunnel dan HP fisik.
