# Line stasiun

Kartu pilihan stasiun membaca `Station.line` dari DB. Komponen hanya menambahkan awalan `Line`; tidak menentukan lintas berdasarkan nama, slug, atau urutan stasiun.

| Stasiun | Nilai `line` |
| --- | --- |
| Dukuh Atas–Cawang | `Bekasi & Harjamukti` |
| Halim, Jatibening Baru, Cikunir 1, Cikunir 2, Bekasi Barat, Jatimulya | `Bekasi` |
| TMII, Kampung Rambutan, Ciracas, Harjamukti | `Harjamukti` |

Label Harjamukti memakai nama tujuan sesuai permintaan produk. KAI menyebut lintas ini Cibubur (Dukuh Atas–Harjamukti), sedangkan lintas Bekasi melayani Dukuh Atas–Jatimulya. Referensi: [keterangan resmi KAI](https://www.kai.id/publikasi/siaran-pers/tiga-tahun-operasional-lrt-jabodebek-layani-759-juta-pelanggan-dan-perkuat-mobilitas-perkotaan).

Pada 30 Oktober 2026, nilai 18 stasiun di DB lokal diperbarui dari `Jabodebek` dengan persetujuan pengguna. Seed memakai nilai yang sama. Ini perubahan data lokal, bukan migrasi Prisma; commit atau deploy kode saja tidak memperbarui nilai DB DEV/PROD. Field dapat diedit melalui CMS Stasiun → Lintas / Line.

Header tur pada layar di bawah 768 px menampilkan stasiun aktif pada tombol pemilih, lalu area dan checkpoint pada breadcrumb ringkas. Breadcrumb lengkap tetap tersedia secara semantik; pada tablet dan desktop tampil di kanan atas.
