# Project Presensi Praktikum

Project berkelanjutan sampai pertemuan sebelum UAS. Repository dan fitur lama dipertahankan; setiap pertemuan menambah fitur melalui branch `feature/<nama-fitur>`, bukan branch per orang atau per pertemuan. Scope berikut hanya sprint pertama; kebutuhan pertemuan berikutnya ditambahkan setelah diberikan, bukan diasumsikan sekarang.

## Sprint 1 — Antarmuka Presensi Praktikum

## Tujuan
Aplikasi React Native mendemonstrasikan kegiatan praktikum dari sudut pandang Asisten dan Praktikan. PM hanya menulis dokumen, memeriksa hasil, dan mengelola integrasi; tidak coding.

Target timebox: 10 menit untuk implementasi minimum dan demo, dengan lingkungan Expo sudah bisa dijalankan. Ini target, bukan jaminan selesai. Jika waktu habis, laporkan bagian belum selesai; jangan menyebut fitur yang belum diuji sudah berhasil.

## Batas sprint
- Gunakan project Expo yang tersedia, Expo Router, Flexbox, dan state lokal.
- Tanpa DB, server, login sungguhan, QR, lokasi, ekspor, atau dependency tambahan.
- Pilih peran dan identitas melalui form sederhana.
- Data boleh reset saat aplikasi dimuat ulang.
- Sesuai keputusan PM terbaru, data Asisten dan Praktikan boleh terpisah. Basis identitas/jadwal dummy harus sama; perubahan status/presensi hanya wajib konsisten di dalam modul masing-masing.
- Konsekuensi: rekap Asisten bukan hasil sinkronisasi presensi Praktikan. Tampilkan label “Data simulasi”; jangan mengklaim demo end-to-end tersinkron. Jika dosen mewajibkan konsistensi lintas peran sesuai soal awal, batas ini harus direvisi sebelum coding.

## Halaman dan kebutuhan
| Bagian | Isi dan interaksi | Pemilik |
|---|---|---|
| Beranda | Form pilihan peran dan identitas; tombol lanjut nonaktif sebelum pilihan valid | Moses |
| Jadwal | Daftar nama praktikum, kelas, waktu, status awal; filter sederhana; kondisi hasil kosong | Moses |
| Detail jadwal | Modal detail sesi; tombol menuju modul sesuai peran | Moses |
| Asisten | Pilih sesi; lihat detail; konfirmasi buka/tutup sesi melalui modal; status langsung berubah | Mischa |
| Rekap Asisten | Daftar dummy peserta dan waktu hadir sesuai sesi; kondisi kosong | Mischa |
| Praktikan | Pilih sesi; detail dan status simulasi; tombol presensi hanya ketika dibuka | Andiny |
| Riwayat Praktikan | Waktu presensi berhasil; cegah presensi ganda per identitas dan sesi; daftar milik identitas terpilih saja; kondisi kosong | Andiny |

Rekap dan riwayat boleh berupa bagian di layar masing-masing, tidak wajib route tambahan. Modul Asisten/Praktikan tetap menyediakan pilihan identitas dan sesi sendiri agar dapat diuji tanpa menunggu beranda.

## Basis dummy yang disepakati
Identitas: `as1` = Asisten Rina; `p1` = Andi; `p2` = Budi. Peran: `asisten` dan `praktikan`.

| sessionId | Praktikum | Kelas | Waktu lokal | Status awal |
|---|---|---|---|---|
| s1 | Pemrograman Perangkat Bergerak | SI-5A | 08.00–09.40 | belum_dibuka |
| s2 | Basis Data | SI-5B | 10.00–11.40 | dibuka |
| s3 | Visi Komputer | SI-5A | 13.00–14.40 | ditutup |

- Label status: Belum dibuka, Dibuka, Ditutup.
- Mischa: rekap awal `s1` kosong; `s2` berisi Andi pukul 10.05; `s3` berisi Budi pukul 13.03. Labeli sebagai rekap dummy, jangan tambah peserta otomatis saat membuka sesi.
- Andiny: riwayat awal kosong. Presensi baru menyimpan `userId`, `sessionId`, dan `attendedAt` dari waktu perangkat. Kunci unik logis: pasangan `userId + sessionId`.
- Tiap modul menyimpan salinan dummy sendiri sesuai tabel ini. Duplikasi kecil disengaja untuk sprint pendek tanpa dependensi antarteman. Jangan membuat shared store pada sprint ini.
- Jadwal Moses menampilkan “Status awal simulasi”, bukan status live dari Mischa.
- Andiny menyediakan pilihan status demo (belum dibuka/dibuka/ditutup) berlabel “Kontrol simulasi”, bukan hak Praktikan sungguhan untuk membuka sesi. Mengubah status tidak menghapus riwayat.

## Kriteria selesai
- Moses: form menolak pilihan belum lengkap; jadwal/detail benar; tombol menuju peran yang dipilih membawa identitas dan sesi yang benar.
- Mischa: alur belum_dibuka → dibuka → ditutup; batal modal tidak mengubah status; sesi ditutup tidak dibuka kembali pada sprint ini; rekap cocok dengan sesi.
- Andiny: status bukan dibuka menolak presensi; status dibuka berhasil dan menampilkan waktu; ketukan berulang tidak membuat duplikat; ganti identitas hanya menampilkan riwayat identitas tersebut.
- Semua: Flexbox, konten bisa scroll, safe area, teks terbaca, tombol berlabel jelas, status bukan dibedakan melalui warna saja. Tidak terpotong pada lebar 360 dan 390.
- Form menggunakan pilihan/tombol native yang jelas; modal native cukup. Tidak perlu library form atau bottom sheet.

## Demo minimum PM
1. Pilih Asisten Rina, lihat jadwal/detail s1, buka sesi dan periksa status.
2. Lihat rekap s1 kosong, lalu rekap dummy s2 berisi Andi dan waktunya.
3. Beralih ke Praktikan Andi, pilih s2 terbuka, presensi dan lihat waktu/riwayat.
4. Coba presensi ulang: tidak boleh menambah catatan. Ganti Budi: riwayat Andi tidak muncul.
5. Kembali ke Asisten dan tutup sesi; periksa status pada modul Asisten.
6. Di Praktikan, pilih status demo ditutup; presensi harus ditolak.

Langkah 5–6 menggunakan simulasi terpisah, bukan sinkronisasi lintas peran. Sebutkan batas ini saat presentasi.
