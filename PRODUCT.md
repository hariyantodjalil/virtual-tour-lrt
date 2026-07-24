# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: calon mitra / brand yang mencari unit komersial di stasiun LRT Jabodebek — mereka perlu memahami lokasi, trafik, dan ketersediaan sebelum datang ke lapangan.

Secondary: publik yang ingin menjelajah stasiun secara virtual; tetap dilayani, tetapi konversi minat sewa tetap prioritas homepage.

## Product Purpose

Memberi akses 24/7 ke eksplorasi ruang komersial 18 stasiun LRT Jabodebek lewat virtual tour 360°, dengan data ketersediaan unit real-time, spesifikasi, dan jalur ajukan minat sewa.

Success: mitra memahami alur “pilih stasiun → lihat ketersediaan → masuk tour → ajukan minat” tanpa bingung, dan berpindah ke aksi (tour atau kontak) dengan percaya diri.

## Positioning

Bukan sekadar galeri foto stasiun: mekanisme uniknya adalah virtual tour 360° yang terhubung langsung ke inventory unit komersial (status TERSEDIA / TERISI / MAINTENANCE) dan alur lead sewa di jaringan LRT Jabodebek.

## Operating Context

- Homepage publik sebagai pintu masuk
- Halaman `/station/[slug]` untuk tour 360° per stasiun
- CMS (`/cms`) untuk tim internal; portal mitra (`/partner`) untuk role MITRA
- Kontak WhatsApp / telepon tim komersial sebagai jalur manusia

## Capabilities and Constraints

- Data stasiun, unit, dan statistik diambil dari database (Prisma); jangan memalsukan angka, testimoni, atau klaim bisnis
- Virtual tour memakai panorama 360° (Pannellum) per stasiun
- Brand LRT Jabodebek wajib: biru `#1B3A6B`, merah `#E31E2D`, nama “LRT Jabodebek” / “Virtual Tour Komersial”
- Homepage harus merunutkan alur: ketersediaan (stasiun & unit) → pilih → tour, bukan langsung “loncat” ke tour tanpa konteks

## Brand Commitments

- Nama produk: Virtual Tour LRT Jabodebek (ruang komersial)
- Warna identitas LRT: navy `#1B3A6B`, signal red `#E31E2D`
- Referensi vibe yang diminta user untuk redesign homepage: futuristik + virtual-tour immersion (contoh: East Midlands Railway Lincoln station tour), tanpa menyalin brand EMR

## Evidence on Hand

- Live DB: daftar stasiun aktif, hitungan unit, status ketersediaan, agregat penumpang/hari
- Halaman tour per stasiun dengan hotspots unit
- Tidak ada testimoni pelanggan atau benchmark okupansi yang boleh diada-adakan di UI

## Product Principles

1. Alur sebelum spektakel — mitra selalu tahu langkah berikutnya (stasiun → ketersediaan → tour).
2. Bukti nyata, bukan klaim — angka dan status dari data; jangan invent.
3. Immersion melayani keputusan sewa — experience 360° memperkuat pemilihan lokasi, bukan mengganti informasi unit.
4. Identitas LRT tetap terbaca — navy/merah dan nama brand tidak boleh hilang di balik estetika futuristik.
5. Dual audience, satu prioritas — publik boleh jelajah; CTA dan hierarchy mengutamakan calon mitra.
