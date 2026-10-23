# Pembagian Fitur — Project Presensi Praktikum

Baca `PRD.md` dan `../AGENTS.md` sebelum bekerja. PM hanya dokumen, review, dan merge; tidak coding. Semua developer mengerjakan UI + state/logika + validasi + tes, bukan frontend/backend terpisah.

## Branch dan repository
Repository: https://github.com/GAMPANG-BANGET-NIH/PPK-D2-Pertemuan-6

- Integrasi: `dev`; rilis: `main`.
- Fitur jadwal dan akses pengguna — Moses: `feature/jadwal-praktikum`.
- Fitur pengelolaan sesi dan rekap — Mischa: `feature/pengelolaan-sesi`.
- Fitur presensi dan riwayat — Andiny: `feature/presensi-praktikan`.
- Branch berdasarkan fitur, BUKAN orang atau nomor pertemuan. Satu branch untuk satu paket fitur sampai selesai dan di-merge.
- PM mempublikasikan baseline yang sama sebelum sprint. Ketiganya mulai dari commit baseline yang sama, bukan menunggu fitur teman.
- Agent DILARANG menjalankan `git add`, `git commit`, atau `git push`. Developer melakukannya manual setelah memeriksa diff. Tidak force-push, tidak push ke branch teman, tidak push langsung ke `main`/`dev`.
- PR masing-masing menuju `dev`; PM review dan merge satu per satu. Sebelum PR, developer mengambil `origin/dev` terbaru dan mengintegrasikannya di branch sendiri setelah menyimpan perubahan lokal dengan aman.
- Jika konflik muncul: berhenti, laporkan file serta dua perubahan yang bertabrakan. Pemilik file memperbaiki setelah PM menyetujui; dilarang mengambil seluruh versi ours/theirs tanpa review.

## Kelanjutan project sampai sebelum UAS
Project dan repository ini dipakai terus; jangan membuat ulang aplikasi atau branch per pertemuan.

1. Setiap pertemuan, PM menambahkan kebutuhan baru ke PRD tanpa menghapus fitur yang sudah diterima.
2. Pecah kebutuhan menjadi fitur utuh: UI, state/data, validasi, dan tes. Tetapkan penanggung jawab serta file eksklusif untuk setiap fitur; pemilik boleh berganti pada sprint berikutnya, bukan permanen berdasarkan orang/peran pengguna.
3. Buat branch baru dari `origin/dev` terbaru untuk setiap fitur baru, misalnya `feature/filter-riwayat`. Nama contoh bukan komitmen scope. Jangan melanjutkan branch fitur yang sudah di-merge.
4. Jika dua fitur membutuhkan file yang sama, tentukan satu pemilik perubahan bersama dan selesaikan kontraknya sebelum pekerjaan paralel. Jangan menjanjikan paralel untuk tugas yang memang saling bergantung.
5. Developer push hanya ke branch fiturnya. PM review PR menuju `dev`, jalankan regresi fitur lama dan tes fitur baru, lalu merge. Rilis/demo stabil dipromosikan dari `dev` ke `main` oleh PM. Branch fitur yang sudah merged boleh dihapus manual.
6. Batas dummy terpisah berlaku khusus sprint pertama. Saat kebutuhan berikutnya memerlukan data bersama/DB, rencanakan migrasi dan kontrak bersama sebagai pekerjaan tersendiri; jangan terus menggandakan dummy atau membuat DB sebelum diminta.

## Kepemilikan file sprint ini — tidak boleh overlap
Path relatif terhadap root repository `prak06`.

| Orang | File yang boleh dibuat/diubah |
|---|---|
| Moses | `src/app/index.tsx`, `src/app/_layout.tsx`, `src/features/jadwal.tsx` |
| Mischa | `src/app/asisten.tsx`, `src/features/asisten.tsx` |
| Andiny | `src/app/praktikan.tsx`, `src/features/praktikan.tsx` |
| PM | `docs/PRD.md`, `docs/PEMBAGIAN.md` |

**JANGAN edit file di luar daftar milik sendiri.** Termasuk file orang lain, `package.json`, lockfile, `app.json`, `eas.json`, tema global, komponen bersama, dan `AGENTS.md`. File starter lain dibiarkan; tidak perlu refactor atau menghapusnya. Jika butuh file tambahan, minta PM memperbarui daftar sebelum coding.

Route file cukup menjadi pembungkus modul fitur sendiri. UI, dummy, state, dan helper fitur tetap di file fitur masing-masing. Tidak mengimpor kode milik teman, tidak membuat placeholder di path teman. Komponen native dan dependency yang sudah terpasang cukup.

## Fitur 1 — Jadwal praktikum dan akses pengguna
Penanggung jawab sprint ini: Moses. Branch: `feature/jadwal-praktikum`.

- Ganti beranda starter dengan pilihan peran dan identitas. Identitas praktikan: Andi/Budi; asisten: Rina.
- Kelola state form dan filter jadwal. Tolak lanjut jika identitas/peran belum valid; reset identitas jika peran berubah.
- Tampilkan 3 jadwal PRD; nama, kelas, jam, dan status awal. Filter kosong menampilkan pesan, bukan layar blank.
- Detail sesi melalui modal; tombol lanjut membuka route berdasarkan peran dengan parameter yang disepakati.
- Di `_layout.tsx`, ganti penggunaan AppTabs starter dengan navigator Expo Router yang menemukan route otomatis. Jangan import langsung layar Mischa/Andiny atau mengharuskan file mereka ada untuk render beranda. Pertahankan perilaku splash yang diperlukan.
- Jangan membuat `asisten.tsx`/`praktikan.tsx` sebagai stub. Link boleh ditulis berdasarkan kontrak; pengujian tujuan link dilakukan setelah merge.
- Tes mandiri: pilihan invalid, pergantian peran, filter kosong, detail, batal modal. Tes navigasi lintas fitur setelah integrasi.

Beban: logika lebih ringan, tetapi menanggung navigasi global dan pengecekan integrasi. Tidak diberi fitur tambahan.

## Fitur 2 — Pengelolaan sesi dan rekap
Penanggung jawab sprint ini: Mischa. Branch: `feature/pengelolaan-sesi`.

- Route `/asisten`; form pilihan sesi dan identitas Rina tersedia langsung.
- Tampilkan detail sesi, state status per sesi, dan tombol buka/tutup.
- Modal konfirmasi sebelum perubahan. Batal tidak mengubah data. Status diperbarui di seluruh tampilan modul Asisten.
- Transisi hanya belum_dibuka → dibuka → ditutup. Sesi ditutup tidak dibuka ulang.
- Tampilkan rekap dummy sesuai PRD, nama dan waktu hadir; s1 menampilkan kondisi kosong.
- Simpan state modul selama aplikasi berjalan, tidak hilang hanya karena layar berpindah. Gunakan penyimpanan state React pada batas modul sendiri yang tetap hidup, atau cache in-memory milik sendiri dengan state React sebagai pemicu render. Tidak membutuhkan shared provider dari Moses.
- Tes mandiri: buka, batal tutup, konfirmasi tutup, ganti sesi dan kembali, rekap kosong/terisi. Membuka sesi tidak otomatis mengarang peserta hadir.

## Fitur 3 — Presensi praktikan dan riwayat
Penanggung jawab sprint ini: Andiny. Branch: `feature/presensi-praktikan`.

- Route `/praktikan`; form pilihan Andi/Budi dan sesi tersedia langsung.
- Tampilkan detail/status dan kontrol status demo yang jelas labelnya.
- Presensi hanya diterima ketika sesi dibuka. Validasi ulang di handler, bukan hanya menonaktifkan tombol.
- Cegah duplikat berdasarkan pasangan userId + sessionId, termasuk ketukan cepat; gunakan pembaruan state yang memeriksa data terkini.
- Simpan waktu dari perangkat. Berikan modal/umpan balik berhasil dan daftar riwayat identitas terpilih saja.
- Riwayat kosong memiliki pesan. Mengganti identitas/status atau navigasi keluar-masuk tidak boleh menghapus catatan selama proses aplikasi masih berjalan. Cache/state hanya milik modul sendiri, tidak menunggu provider bersama.
- Tes mandiri: sesi belum dibuka/ditutup ditolak, berhasil saat dibuka, ketukan ganda, beda pengguna, beda sesi, riwayat kosong.

## Kontrak agar bisa mulai bersamaan
- Navigasi Moses menuju `/asisten` atau `/praktikan` dengan query `userId` dan `sessionId`; role sudah ditentukan route.
- Nilai valid: asisten `as1`, praktikan `p1`/`p2`, sesi `s1`/`s2`/`s3`.
- Modul menerima parameter hanya sebagai pilihan awal; validasi nilainya. Nilai tidak ada/tidak valid memakai pilihan awal: Asisten `as1/s1`, Praktikan `p1/s2`. Form selalu tersedia untuk mengganti pilihan.
- Jangan mengirim status/presensi melalui parameter; masing-masing modul mengelola data sendiri.
- Dummy mengikuti tabel PRD, bukan file shared yang harus dibuat teman terlebih dahulu.
- Modul bisa diuji melalui route langsung `/asisten` atau `/praktikan` pada web Expo yang sudah berjalan. Pengujian navigasi final dan perangkat dilakukan setelah merge; tidak menghalangi implementasi paralel.
- UI sederhana: Flexbox, safe area, scroll, padding konsisten 16, tombol mudah ditekan dan berlabel. Pakai style lokal; tidak mengubah tema global. Tidak perlu desain dekoratif.

## Urutan target 10 menit
Prasyarat sebelum timer: baseline tersedia, dependency terpasang, Expo bisa berjalan, dokumen disepakati. Jika belum, setup dicatat terpisah dan bukan dianggap selesai dalam 10 menit.

1. Menit 0–1: ketiganya cek branch, daftar file, kontrak parameter dan dummy. PM cek tidak ada tugas tumpang tindih.
2. Menit 1–6: Moses, Mischa, Andiny implementasi bersamaan. Tidak menunggu hasil teman; tidak ada API/DB/shared store yang harus ditunggu.
3. Menit 6–8: tes fitur sendiri dan serahkan bukti. Developer melakukan staging/commit/push manual hanya file miliknya.
4. Menit 8–10: PM review dan merge PR; jalankan demo PRD bersama. Moses menangani masalah navigasi, Mischa/Andiny menangani masalah modulnya. Jika belum lulus, catat belum selesai; jangan menutupi dengan klaim berhasil.

Integrasi dan tes lintas layar tetap butuh semua hasil tersedia. Yang dibuat tanpa saling menunggu adalah implementasi dan tes mandiri, bukan pengujian hasil akhir.

## Bukti selesai dan pemeriksaan PM
- Tiap developer menyerahkan daftar file berubah, fitur selesai, hasil tes manual, dan kekurangan nyata.
- Jalankan `npx tsc --noEmit` dan `npm run lint` sesuai AGENTS.md. Jika lint meminta memasang paket/membuat konfigurasi di luar kepemilikan, berhenti dan laporkan blocker; jangan ubah dependency sendiri.
- Periksa lebar 360/390, modal bisa ditutup, konten scroll, tombol tidak tertutup keyboard/safe area.
- PM cek diff PR hanya memuat file milik pembuat PR, tidak membawa perubahan konfigurasi lokal atau dokumen PM.
- Setelah merge, cek route dan skenario PRD. Konflik semantik tetap mungkin walau file tidak overlap; hasil integrasi wajib diuji.

## Catatan baseline lokal
Saat planning dibuat, working tree sudah memiliki perubahan `app.json`, `eas.json`, `package.json`, dan `package-lock.json`. Itu perubahan sebelumnya, bukan hasil planning ini. PM meninjau sendiri sebelum staging; jangan otomatis ikutkan ke commit dokumen.
