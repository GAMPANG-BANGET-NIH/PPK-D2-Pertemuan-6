# Project Presensi Praktikum

Project berkelanjutan sampai pertemuan sebelum UAS. Repository dan fitur lama dipertahankan; setiap pertemuan menambah fitur melalui branch `feature/<nama-fitur>`, bukan branch per orang atau per pertemuan. Dokumen ini berisi **Sprint 1** (antarmuka, data dummy) dan **Sprint 2** (data dinamis dengan Firebase, di bagian paling bawah). Sprint 2 adalah sprint aktif; batas "tanpa DB/login" dan "dummy terpisah" pada Sprint 1 **tidak berlaku lagi** untuk Sprint 2. Kebutuhan pertemuan berikutnya ditambahkan setelah diberikan, bukan diasumsikan sekarang.

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


---

# SPRINT 2 — Data Dinamis dengan Firebase

## Tujuan
Mengembangkan aplikasi Sprint 1 (UI + alur praktikum dengan data dummy lokal) menjadi aplikasi **multi-user** dengan data **permanen dan realtime**. Praktikan dan Asprak login dengan akun masing-masing, mengakses data yang sama, dan melihat informasi/tindakan sesuai peran. Praktikan yang berhalangan dapat mengajukan izin yang diperiksa Asprak dengan bantuan klasifikasi AI.

Teknologi wajib: **Firebase Authentication** (Email/Password), **Cloud Firestore** (data + listener realtime + Security Rules), **Model AI lokal on-device dari `model-edom.zip`** (`sentiment.js` + `model-edom.json`, klasifikasi sentimen alasan izin secara lokal di perangkat).

> Catatan:
> - "firebase notification" pada notulensi = **Firebase Authentication** (sudah dikonfirmasi PM). Push notification **tidak** termasuk scope.
> - Revisi ketentuan asisten praktikum: **tidak ada API AI dari pengajar**. Sebagai gantinya, klasifikasi AI menggunakan bahan dan panduan di **`model-edom.zip`** pada root repository.

## Keputusan PM (final)
| Topik | Keputusan |
|---|---|
| Akun | Asprak dan Praktikan **didaftarkan oleh developer** (seed). Pengguna hanya login/logout. Layar registrasi publik tidak dibuat. |
| Peran | Disimpan di dokumen `users/{uid}.role` (`asprak` / `praktikan`), bukan dipilih pengguna. |
| Plotting kelas | Setiap praktikan sudah di-plot ke **satu kelas** (`users.classId`) lewat seed. Asprak dapat **memindahkan** praktikan ke kelas lain. |
| Kode Sprint 1 | **Jangan hapus/ganti `src/`.** Modul lama dikembangkan/diganti isinya sesuai kepemilikan file (lihat `PEMBAGIAN.md`). |
| SDK | Firebase **JS SDK** (`firebase`), kompatibel Expo Go dan dev build. Bukan `@react-native-firebase`. |
| Konfigurasi & API Key | Variabel Firebase Web Config (`EXPO_PUBLIC_FIREBASE_*`) disimpan di `.env.local` (di-ignore git, dikelola Dewa). **Tidak ada API key AI** karena model AI berjalan lokal di perangkat. |
| Model AI | Menggunakan `sentiment.js` + `model-edom.json` dari `model-edom.zip` (LinearSVC TF-IDF, output sentimen `positif` / `netral` / `negatif` atau `null`). Inferensi murni JavaScript di perangkat, tanpa internet dan tanpa Python runtime. |

## Kebutuhan fungsional (dari notulensi, 8 poin) dan pemetaannya
| # | Kebutuhan | Ringkasan penerimaan | Pemilik |
|---|---|---|---|
| 1 | Autentikasi | Login, logout via Firebase Auth; sesi bertahan setelah app ditutup; UI & aksi sesuai peran; belum login → layar login. | Dewa |
| 2 | Data praktikum | Kelas, jadwal, sesi di Firestore. Asprak CRUD; praktikan hanya melihat jadwal/sesi kelasnya. | Mischa (CRUD), Andiny (tampilan praktikan) |
| 3 | Presensi | Praktikan presensi hanya saat sesi `dibuka`; 1 kali per sesi; tersimpan per identitas+sesi. | Andiny |
| 4 | Sync realtime | Status sesi, presensi, rekap tampil tanpa restart (`onSnapshot`); data tetap ada setelah app dibuka ulang. | Mischa & Andiny |
| 5 | Pengajuan izin | Praktikan isi alasan; tersimpan di Firestore; status dapat dipantau. | Andiny |
| 6 | Integrasi AI | Alasan diklasifikasikan secara lokal oleh model `model-edom.json` (`sentiment.js`) → hasil sentimen ditampilkan sebagai **info pendukung**. AI **tidak** menentukan acc/tolak. | Dewa |
| 7 | Review izin | Asprak lihat daftar izin + alasan + hasil klasifikasi AI, lalu setujui/tolak; tersimpan. | Dewa |
| 8 | Validasi & keamanan | Input tak valid, gagal auth, role-based access, **Firestore Security Rules**, kondisi belum login/offline/model AI tidak mengenali teks (`label: null`). | Dewa (rules, infra), semua (validasi fitur sendiri) |

## Dua alur akhir yang harus berjalan (demo)
**Alur 1 — Presensi:** Asprak login → buka sesi → Praktikan login (perangkat/akun lain) → presensi → data masuk Firestore → Asprak melihat rekap **realtime** → Asprak menutup sesi → praktikan melihat sesi tertutup.

**Alur 2 — Izin:** Praktikan login → ajukan izin dengan alasan → model AI lokal (`model-edom`) mengklasifikasi alasan (hasil disimpan bersama pengajuan) → Asprak melihat daftar izin + alasan + hasil AI → Asprak setujui/tolak → Praktikan melihat status baru secara realtime.

Semua perubahan persisten dan konsisten antar peran.

## Model data Firestore (KONTRAK — jangan ubah sepihak)
Nama koleksi dan field di bawah ini adalah kontrak antar-fitur. Perubahan harus lewat PM dan diumumkan ke ketiganya. Semua timestamp memakai `Timestamp` Firestore (`serverTimestamp()` saat tulis).

```
users/{uid}
  name: string
  email: string
  role: "praktikan" | "asprak"
  classId: string | null        // praktikan: wajib; asprak: null
  createdAt: Timestamp

classes/{classId}               // contoh id: "SI-5A"
  name: string                  // "SI-5A"
  createdAt: Timestamp

schedules/{scheduleId}
  classId: string
  course: string                // nama praktikum
  dayOfWeek: number             // 1 (Senin) .. 7 (Minggu)
  startTime: string             // "08:00"
  endTime: string               // "09:40"
  room: string
  createdAt: Timestamp

sessions/{sessionId}
  classId: string
  scheduleId: string | null
  title: string
  date: string                  // "YYYY-MM-DD"
  startTime: string
  endTime: string
  status: "belum_dibuka" | "dibuka" | "ditutup"
  openedAt: Timestamp | null
  closedAt: Timestamp | null
  createdBy: string             // uid asprak
  createdAt: Timestamp

sessions/{sessionId}/attendance/{uid}     // docId = uid praktikan => otomatis 1x per sesi
  uid: string
  name: string
  classId: string
  attendedAt: Timestamp

permissions/{sessionId}_{uid}             // docId gabungan => 1 pengajuan per sesi per praktikan
  uid: string
  name: string
  classId: string
  sessionId: string
  sessionTitle: string
  reason: string
  status: "menunggu" | "disetujui" | "ditolak"
  aiResult: {
    status: "predicted" | "unknown_vocabulary" | "empty_input" | "gagal"
    label: "positif" | "netral" | "negatif" | null   // null jika status bukan "predicted"
    model: string                                     // mis. "model-edom"
    experimental: boolean                             // true (sesuai metadata model-edom)
  }
  decidedBy: string | null      // uid asprak
  decidedAt: Timestamp | null
  createdAt: Timestamp
```

Aturan desain:
- Hindari query `where` + `orderBy` pada field berbeda (butuh composite index). Urutkan di sisi klien.
- Rekap kehadiran sesi = listener `sessions/{id}/attendance` + daftar praktikan kelas (`users where classId == X and role == "praktikan"`) + (opsional) izin disetujui sesi tsb.
- Status "Izin" pada rekap = dokumen `permissions` berstatus `disetujui` untuk sesi itu.

## Data awal (seed) — disiapkan Dewa
Dilakukan oleh developer, bukan lewat UI. Harus bisa dijalankan ulang (idempoten).

| uid/email (contoh) | Nama | Peran | Kelas |
|---|---|---|---|
| rina@praktikum.test | Asisten Rina | asprak | — |
| andi@praktikum.test | Andi | praktikan | SI-5B |
| budi@praktikum.test | Budi | praktikan | SI-5A |
| citra@praktikum.test | Citra | praktikan | SI-5A |
| dina@praktikum.test | Dina | praktikan | SI-5B |

Kelas: `SI-5A`, `SI-5B`. Sesi awal (dari Sprint 1): `s1` Pemrograman Perangkat Bergerak / SI-5A / 08.00–09.40 / `belum_dibuka`; `s2` Basis Data / SI-5B / 10.00–11.40 / `belum_dibuka`; `s3` Visi Komputer / SI-5A / 13.00–14.40 / `ditutup`. Jadwal awal sesuai tiga sesi tersebut. Password akun dibagikan Dewa secara pribadi, **tidak ditulis di repository**.

## Kebutuhan teknis lintas fitur
- **Konfigurasi**: variabel `EXPO_PUBLIC_FIREBASE_API_KEY`, `..._AUTH_DOMAIN`, `..._PROJECT_ID`, `..._STORAGE_BUCKET`, `..._MESSAGING_SENDER_ID`, `..._APP_ID` di `.env.local`. Sediakan `.env.example` (tanpa nilai rahasia). Setelah mengubah env, restart Expo. **Tidak ada variabel env untuk AI.**
- **Auth persistence**: login bertahan setelah app ditutup (`getReactNativePersistence` + AsyncStorage, dipasang lewat `npx expo install`).
- **Offline**: Firestore JS SDK di React Native **tidak punya cache persisten di disk**. Data tetap permanen di server; saat offline aplikasi menampilkan banner dan data terakhir yang ada di memori, serta **menolak aksi tulis dengan pesan jelas** (jangan mengira tulis offline akan tersinkron setelah app ditutup).
- **State**: `AuthContext` global; tiap fitur memakai hook dengan `onSnapshot` dan **wajib unsubscribe** saat unmount/logout.
- **Setiap layar data** menangani 4 kondisi: loading, error, kosong, dan terisi.
- **Validasi**: email/password tidak kosong; alasan izin minimal 10 karakter dan maksimal 300; input CRUD (nama, tanggal `YYYY-MM-DD`, jam `HH:MM`, jam selesai > mulai) divalidasi sebelum tulis. Pesan error dalam Bahasa Indonesia, tidak menampilkan error mentah Firebase.
- **AI (Model Lokal `model-edom.zip`)**:
  - Ekstrak `sentiment.js` dan `model-edom.json` dari `model-edom.zip` ke kode aplikasi (tanpa Python/`requirements.txt` di aplikasi).
  - Inferensi berjalan **sinkron dan lokal (on-device)**, tanpa panggilan jaringan dan tanpa timeout.
  - Jika alasan kosong (`empty_input`), tidak ada kata yang dikenali kosakata model (`unknown_vocabulary`), atau error internal (`gagal`), `aiResult.label` bernilai `null`. **Jangan menganggap `label: null` sebagai sentimen `netral`.** UI menampilkan "Klasifikasi tidak tersedia" / "Belum dapat dianalisis (bukan netral)".
  - Pengajuan izin **tetap tersimpan** ke Firestore meskipun `label: null` atau model error; tombol setujui/tolak Asprak **tidak pernah bergantung pada hasil AI**.
  - UI Asprak menampilkan hasil AI secara eksplisit sebagai **info pendukung (model sentimen EDOM — bukan penentu keputusan)**.
- **Dokumentasi Expo**: sebelum memakai API Expo/Firebase, baca dokumentasi sesuai versi (project memakai Expo SDK 57; lihat `AGENTS.md`). Jangan mengandalkan memori.

## Security Rules (spesifikasi untuk `firestore.rules`, dikerjakan Dewa)
Semua akses butuh `request.auth != null`. Fungsi bantu: `role()` membaca `users/{uid}.role`; `isAsprak()`, `isPraktikan()`.

| Koleksi | Baca | Tulis |
|---|---|---|
| `users` | Pemilik dokumen; asprak boleh baca semua | Create/delete: dilarang dari klien (seed via Admin). Update: **hanya asprak**, **hanya field `classId`**, dan hanya pada dokumen berperan praktikan. |
| `classes` | Semua yang login | Hanya asprak (CRUD). |
| `schedules` | Asprak; praktikan hanya `classId` miliknya | Hanya asprak (CRUD). |
| `sessions` | Asprak; praktikan hanya `classId` miliknya | Hanya asprak (CRUD). |
| `sessions/{id}/attendance/{uid}` | Asprak; praktikan hanya dokumen `uid` sendiri | **Create** hanya jika: `uid == request.auth.uid`, role praktikan, `users.classId == session.classId`, `session.status == "dibuka"`, dokumen belum ada. **Update/delete: dilarang.** Asprak tidak membuat/mengubah presensi. |
| `permissions` | Asprak semua; praktikan hanya miliknya (`uid` sama) | **Create** praktikan: `uid` sendiri, docId `{sessionId}_{uid}`, `status == "menunggu"`, sesi milik kelasnya & belum `ditutup`, `reason` 10–300 karakter, `decidedBy/decidedAt` null. Praktikan tidak boleh update/delete. **Update** asprak: hanya field `status` (→ `disetujui`/`ditolak`), `decidedBy` (= uid sendiri), `decidedAt`; field lain tidak boleh berubah; hanya dari `menunggu`. |

Rules diuji dengan Rules Playground atau Firebase Emulator. Kasus uji wajib ada di bagian Dewa pada `PEMBAGIAN.md`.

## Kriteria selesai Sprint 2
- Dua alur di atas berjalan end-to-end dengan akun asli di dua perangkat/emulator (atau satu perangkat + web).
- Tutup dan buka ulang app: login dan data tetap ada.
- Praktikan **tidak bisa** presensi dua kali, presensi saat sesi tidak `dibuka`, presensi di kelas lain, atau membaca data praktikan lain (ditolak oleh rules, bukan hanya UI).
- Asprak dapat CRUD kelas/jadwal/sesi dan memindahkan praktikan antar kelas; praktikan hanya melihat jadwal/sesi kelasnya setelah dipindah (tanpa restart).
- Izin tersimpan dengan hasil AI (`model-edom`); teks yang tidak terbaca model (`label: null`) tidak memblokir pengajuan maupun persetujuan; keputusan Asprak muncul realtime di praktikan.
- Belum login → hanya layar login; gagal login menampilkan pesan jelas.
- `npx tsc --noEmit` dan `npx expo lint` lulus.
- UI: Flexbox, safe area, konten scroll, tombol berlabel, status tidak dibedakan hanya lewat warna, tidak terpotong pada lebar 360 dan 390.

## Demo PM Sprint 2
1. Login sebagai Rina (asprak). Buat/ubah satu sesi di Kelola. Buka sesi `s2` (SI-5B).
2. Login sebagai Andi (SI-5B) di perangkat lain: sesi `s2` tampil `Dibuka`, presensi berhasil. Presensi ulang ditolak. Budi (SI-5A) tidak melihat `s2`.
3. Di perangkat Rina, rekap `s2` menampilkan Andi **tanpa refresh**. Tutup sesi; Andi melihat status Ditutup.
4. Pindahkan Dina dari SI-5B ke SI-5A di perangkat Rina; Dina melihat daftar sesi berubah.
5. Login sebagai Citra, ajukan izin untuk `s1` dengan alasan "Sakit demam dan kurang jelas penjelasannya, ada surat dokter" (atau teks lain yang masuk kosakata model). Lihat hasil sentimen AI (`positif`/`netral`/`negatif`) muncul pada pengajuannya.
6. Rina membuka daftar izin, melihat alasan + label sentimen AI (info pendukung), memilih Setujui. Citra melihat status "Disetujui" realtime. Rekap `s1` menandai Citra "Izin".
7. Uji kondisi khusus:
   - Ajukan izin dengan kata yang tidak dikenal kosakata model (mis. `"asdfghjkl qwertzxcvb"`): pengajuan tetap tersimpan dengan `label: null` dan tampil "Klasifikasi tidak tersedia" (bukan "netral"), serta tetap dapat diputuskan Asprak.
   - Matikan koneksi internet: banner offline tampil dan aksi tulis ditolak dengan pesan jelas.
8. Logout lalu buka ulang app: kembali ke layar login; login ulang, data tetap ada.

## Risiko dan asumsi
- **Registrasi**: notulensi menyebut registrasi; keputusan PM adalah akun didaftarkan developer (seed). Jika dosen mewajibkan layar registrasi, tambahkan sebagai fitur terpisah (tidak diasumsikan sekarang).
- **Domain model `model-edom.json`**: sesuai `README.md` di `model-edom.zip`, model dilatih dari komentar evaluasi perkuliahan (EDOM) bukan alasan izin praktikum, dan kelas `netral` lebih lemah. Alasan izin yang singkat/spesifik bisa menghasilkan `unknown_vocabulary` (`label: null`). Karena itu hasil AI hanya sebagai info pendukung, bukan penentu keputusan.
- **File `model-edom.zip`**: arsip asli tetap disimpan di root repository sebagai referensi; aplikasi memakai salinan `sentiment.js` dan `model-edom.json` di `src/lib/ai/`.
- **Plotting kelas** diasumsikan satu kelas per praktikan. Jika ternyata satu praktikan harus di banyak kelas, ubah `classId` menjadi `classIds: string[]` lewat PM sebelum fitur praktikan/pindah kelas dikerjakan.
