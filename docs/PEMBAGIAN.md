# Pembagian Fitur — Project Presensi Praktikum

Baca `PRD.md` dan `../AGENTS.md` sebelum bekerja. **Sprint aktif: Sprint 2 (Firebase) — lihat bagian "SPRINT 2" di paling bawah dokumen ini.** Bagian di atasnya adalah arsip Sprint 1; kepemilikan file dan batas dummy Sprint 1 tidak berlaku untuk Sprint 2. PM hanya dokumen, review, dan merge; tidak coding. Semua developer mengerjakan UI + state/logika + validasi + tes, bukan frontend/backend terpisah.

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


---

# SPRINT 2 — Pembagian Fitur (Firebase) — SPRINT AKTIF

Baca `PRD.md` bagian **SPRINT 2** (model data, security rules, kriteria selesai) dan `../AGENTS.md` sebelum bekerja. Aturan umum Sprint 1 tetap berlaku kecuali disebut lain: agent **DILARANG** `git add/commit/push` (developer melakukannya manual); tidak force-push; PR menuju `dev`; PM review dan merge satu per satu; konflik → berhenti dan laporkan.

Sprint ini ada 3 developer: **Dewa**, **Mischa**, **Andiny**. Moses tidak ditugaskan pada Sprint 2. Kode Sprint 1 milik Moses (`src/features/jadwal.tsx`, `src/app/explore.tsx`) **dibiarkan, tidak dihapus**. Yang perlu diubah (`index.tsx`, `_layout.tsx`) diambil alih Dewa.

## Branch Sprint 2
Dari `origin/dev` terbaru. Satu branch per fitur.

| Fitur | Penanggung jawab | Branch |
|---|---|---|
| A. Fondasi Firebase, Auth, AI Lokal (`model-edom`), Security Rules, Review Izin | **Dewa** | `feature/firebase-auth-ai` |
| B. Pengelolaan praktikum Asprak (CRUD, buka/tutup sesi, rekap realtime, pindah kelas) | **Mischa** | `feature/asprak-praktikum` |
| C. Sisi Praktikan (jadwal/sesi kelasnya, presensi, pengajuan & pantau izin) | **Andiny** | `feature/praktikan-presensi-izin` |

## Urutan kerja (penting: ada satu ketergantungan)
1. **Fase 0 — Fondasi (Dewa, dikerjakan PERTAMA):** `package.json` + dependency, `src/lib/firebase.ts`, ekstrak `sentiment.js` + `model-edom.json` dari `model-edom.zip` ke `src/lib/ai/`, `src/services/ai.ts`, `src/types/index.ts`, `AuthContext`, route guard, login, seed data, `.env.example`. PM merge ke `dev` secepat mungkin; Mischa dan Andiny `merge origin/dev` ke branch masing-masing begitu tersedia. Target: selesai paling awal, sebelum fitur lain butuh menguji dengan Firebase sungguhan.
2. **Fase 1 — Paralel:** Mischa dan Andiny **boleh langsung mulai** menulis UI, hook, dan service berdasarkan kontrak di bawah tanpa menunggu Fase 0 (impor dari path kontrak). Pengujian dengan Firestore sungguhan dan model AI lokal menunggu Fase 0 di-merge. Dewa melanjutkan Rules dan Review Izin.
3. **Fase 2 — Integrasi (PM + semua):** merge satu per satu, jalankan **Demo PM Sprint 2** di `PRD.md`, perbaiki bug lintas fitur oleh pemilik modulnya.

## Kepemilikan file Sprint 2 — tidak boleh overlap
Path relatif root repository. File di luar daftar milik sendiri **tidak boleh disentuh**, termasuk `model-edom.zip`, `src/app/explore.tsx`, `src/features/jadwal.tsx`, `AGENTS.md`, tema global, dan komponen starter.

| Orang | File yang boleh dibuat/diubah |
|---|---|
| **Dewa** | `package.json`, `package-lock.json`, `app.json`, `eas.json` (hanya bila perlu), `.gitignore`, `.env.example`, `.env.local` (lokal, tidak di-commit), `firestore.rules`, `firebase.json`, `scripts/seed.*`, `src/app/_layout.tsx`, `src/app/index.tsx`, `src/app/login.tsx`, `src/app/asisten-izin.tsx`, `src/lib/**`, `src/types/**`, `src/context/**`, `src/utils/errors.ts`, `src/hooks/use-network.ts`, `src/components/offline-banner.tsx`, `src/components/user-header.tsx`, `src/services/auth.ts`, `src/services/ai.ts`, `src/services/izin-review.ts`, `src/features/izin-review.tsx`, `src/features/auth/**` |
| **Mischa** | `src/app/asisten.tsx`, `src/app/kelola.tsx`, `src/app/rekap.tsx`, `src/app/pindah-kelas.tsx`, `src/features/asisten.tsx`, `src/features/asisten-*.tsx`, `src/services/praktikum.ts`, `src/hooks/use-praktikum.ts` |
| **Andiny** | `src/app/praktikan.tsx`, `src/app/izin.tsx`, `src/features/praktikan.tsx`, `src/features/praktikan-*.tsx`, `src/features/izin-praktikan.tsx`, `src/services/presensi.ts`, `src/services/izin.ts`, `src/hooks/use-presensi.ts`, `src/hooks/use-izin.ts` |
| **PM** | `docs/PRD.md`, `docs/PEMBAGIAN.md` |

- **Hanya Dewa** yang boleh menambah/mengubah dependency (`npx expo install ...`). Mischa dan Andiny **jangan** menjalankan install paket. Butuh paket → minta Dewa.
- Butuh file di luar daftar atau perubahan model data → minta PM memperbarui dokumen **sebelum** coding.
- Jangan impor kode dari file *fitur* milik teman (`src/features/*` orang lain). Yang boleh diimpor hanyalah **modul fondasi Dewa** (lib, types, context, utils/errors, hooks/use-network, komponen bersama) dan service sesuai kontrak di bawah.

## Kontrak fondasi (disediakan Dewa; dipakai semua)
Dewa wajib menyediakan persis dengan nama dan bentuk ini:

```ts
// src/lib/firebase.ts
export const app, auth, db;            // auth memakai persistence AsyncStorage; db = Firestore

// src/types/index.ts   (sesuai model data di PRD)
export type Role = 'praktikan' | 'asprak';
export type SessionStatus = 'belum_dibuka' | 'dibuka' | 'ditutup';
export type PermissionStatus = 'menunggu' | 'disetujui' | 'ditolak';
export type AppUser   = { uid: string; name: string; email: string; role: Role; classId: string | null };
export type ClassDoc  = { id: string; name: string };
export type Schedule  = { id: string; classId: string; course: string; dayOfWeek: number; startTime: string; endTime: string; room: string };
export type Session   = { id: string; classId: string; scheduleId: string | null; title: string; date: string; startTime: string; endTime: string; status: SessionStatus; openedAt: Date | null; closedAt: Date | null };
export type Attendance = { uid: string; name: string; classId: string; attendedAt: Date | null };
export type SentimentLabel = 'positif' | 'netral' | 'negatif';
export type AiStatus = 'predicted' | 'unknown_vocabulary' | 'empty_input' | 'gagal';
export type AiResult  = { status: AiStatus; label: SentimentLabel | null; model: string; experimental: boolean };
export type PermissionRequest = { id: string; uid: string; name: string; classId: string; sessionId: string; sessionTitle: string; reason: string; status: PermissionStatus; aiResult: AiResult; decidedBy: string | null; decidedAt: Date | null; createdAt: Date | null };

// src/context/auth-context.tsx
export function AuthProvider(props): JSX.Element;
export function useAuth(): { user: AppUser | null; loading: boolean; signIn(email: string, password: string): Promise<void>; signOut(): Promise<void> };
// signIn melempar Error dengan pesan Bahasa Indonesia yang sudah ramah pengguna.

// src/utils/errors.ts
export function getErrorMessage(e: unknown): string;   // mapping error Firebase -> pesan Indonesia

// src/hooks/use-network.ts
export function useNetwork(): { isOnline: boolean };

// src/components/offline-banner.tsx  -> <OfflineBanner />   (sudah dipasang di _layout, tidak perlu dipasang lagi)
// src/components/user-header.tsx     -> <UserHeader />      (nama, peran, tombol logout; dipasang tiap layar fitur)

// src/services/ai.ts
export function classifyReason(reason: string): AiResult;   // Inferensi lokal sinkron (model-edom.json + sentiment.js). TIDAK PERNAH melempar; error -> { status: 'gagal', label: null, model: 'model-edom', experimental: true }
```
Konversi `Timestamp` → `Date` dilakukan di service masing-masing saat membaca (`.toDate()`), sehingga UI memakai tipe di atas.

**Rute dan penjagaan (Dewa menerapkan di `_layout.tsx`):**
- Belum login → semua rute dialihkan ke `/login`. Setelah login: `asprak` → `/asisten`, `praktikan` → `/praktikan`. `/` (index) hanya mengalihkan berdasarkan status/peran.
- Rute khusus Asprak: `/asisten`, `/kelola`, `/rekap`, `/pindah-kelas`, `/asisten-izin`.
- Rute khusus Praktikan: `/praktikan`, `/izin`.
- Peran salah membuka rute lawan → dialihkan ke beranda perannya.
- Saat logout, semua listener Firestore harus berhenti (tiap hook membersihkan listener saat unmount; layar dilepas saat user null).

## Kontrak service antar-fitur (nama fungsi dan rute tetap)
Mischa (`src/services/praktikum.ts`) — semua listener mengembalikan fungsi `unsubscribe`:
```ts
subscribeClasses(cb, onError): Unsubscribe
subscribeSchedules(classId | null, cb, onError): Unsubscribe        // null = semua (asprak)
subscribeSessions(classId | null, cb, onError): Unsubscribe         // null = semua (asprak)
subscribePraktikanByClass(classId | null, cb, onError): Unsubscribe // asprak saja
subscribeAttendance(sessionId, cb, onError): Unsubscribe            // asprak saja
subscribeApprovedPermissionsBySession(sessionId, cb, onError): Unsubscribe // untuk menandai "Izin" di rekap
createClass / updateClass / deleteClass
createSchedule / updateSchedule / deleteSchedule
createSession / updateSession / deleteSession
openSession(id) / closeSession(id)
movePraktikanToClass(uid, newClassId)
```
Andiny memakai `subscribeSessions` / `subscribeSchedules` milik Mischa? **Tidak.** Agar tidak saling menunggu, Andiny menulis query praktikannya sendiri di `src/services/presensi.ts` (`subscribeMySessions(classId, ...)`, `subscribeMySchedules(classId, ...)`). Duplikasi query kecil disengaja.

Andiny: `src/services/presensi.ts` → `subscribeMySessions`, `subscribeMySchedules`, `subscribeMyAttendance(uid, ...)`, `markAttendance(user, session)`. `src/services/izin.ts` → `submitPermission(user, session, reason)`, `subscribeMyPermissions(uid, ...)`.

Dewa: `src/services/izin-review.ts` → `subscribeAllPermissions(cb, onError)`, `decidePermission(id, decision: 'disetujui'|'ditolak', asprakUid)`.

Tautan navigasi antar-fitur yang sudah disepakati:
- Mischa `/asisten` menyediakan tombol menuju `/kelola`, `/pindah-kelas`, `/asisten-izin` (Dewa), dan tiap sesi menuju `/rekap?sessionId=<id>`.
- Andiny `/praktikan` menyediakan tombol menuju `/izin` (opsional `?sessionId=<id>`).
- Rute yang belum ada saat pengembangan paralel boleh ditautkan lebih dulu; PM menguji tautan setelah semua merge.

---

## Fitur A — Fondasi, Auth, AI, Rules, Review Izin (Dewa)
Branch: `feature/firebase-auth-ai`. Kebutuhan PRD: #1, #6, #7, #8 + infrastruktur untuk #2–#5.

**A0. Setup (kerjakan dan serahkan lebih dulu — Fase 0)**
- Buat/hubungkan Firebase project; aktifkan **Authentication → Email/Password** dan **Cloud Firestore**; daftarkan Web App dan ambil config.
- Baca docs Expo SDK 57 + docs Firebase JS SDK untuk React Native. Pasang paket dengan `npx expo install` (minimal `firebase`, `@react-native-async-storage/async-storage`, `@react-native-community/netinfo`); `firebase-admin` hanya sebagai devDependency untuk seed. Jalankan `npx expo-doctor`.
- `.env.local` (tidak di-commit; sudah masuk `.gitignore` lewat pola `.env*.local`) dan `.env.example` berisi nama variabel PRD tanpa nilai. Bagikan nilai asli ke Mischa dan Andiny lewat kanal pribadi (bukan repo, bukan chat grup publik).
- `src/lib/firebase.ts`: init app, `initializeAuth` + persistence AsyncStorage (hindari init ganda), `getFirestore`.
- `src/types/index.ts`, `src/utils/errors.ts`, `src/hooks/use-network.ts`, `OfflineBanner`, `UserHeader`.
- **Seed** (`scripts/seed.*`, memakai Admin SDK dengan service account yang di-ignore git): membuat akun Auth + dokumen `users`, `classes`, `schedules`, `sessions` sesuai tabel seed PRD. Idempoten. Tulis cara pakai di `scripts/README` atau komentar header.
- Serahkan Fase 0 ke PM untuk merge cepat.

**A1. Autentikasi (#1)**
- `AuthProvider`: dengar `onAuthStateChanged`, baca `users/{uid}`, sediakan `useAuth`. Bila akun Auth ada tetapi dokumen `users` tidak ada → logout paksa dan tampilkan pesan "Akun belum terdaftar di sistem".
- `src/app/login.tsx` + `src/features/auth/*`: form email/password, validasi (kosong, format email), tombol nonaktif saat memuat, pesan gagal jelas (kredensial salah, terlalu banyak percobaan, jaringan). Tidak ada tombol registrasi.
- `_layout.tsx`: provider, splash/loading selama status auth belum diketahui, penjagaan rute sesuai kontrak.
- `src/app/index.tsx`: hanya pengalih. Logout melalui `UserHeader`.
- Sesi login bertahan setelah app ditutup.

**A2. Integrasi AI Lokal (`model-edom.zip`) (#6)**
- **Tidak ada API AI eksternal dan tidak ada API key AI** (revisi asisten praktikum). Dewa hanya mengelola config Firebase di `.env.local` (`EXPO_PUBLIC_FIREBASE_*`; tidak pernah di-commit, tidak di-log, tidak ditulis di dokumen/PR).
- Ekstrak `sentiment.js` dan `model-edom.json` dari `model-edom.zip` ke `src/lib/ai/` (jangan hapus `model-edom.zip` di root; `requirements.txt` tidak diperlukan di React Native). Tambahkan deklarasi tipe `src/lib/ai/sentiment.d.ts` jika diperlukan agar `npx tsc --noEmit` dan `npx expo lint` lulus.
- `src/services/ai.ts` → `classifyReason(reason)`: inisialisasi `createSentimentClassifier(model)` sekali di level modul, jalankan prediksi secara sinkron & lokal, lalu kembalikan `AiResult` (`status`: `'predicted' | 'unknown_vocabulary' | 'empty_input' | 'gagal'`, `label`: `'positif' | 'netral' | 'negatif' | null`, `model: 'model-edom'`, `experimental: true`). Bungkus dengan `try/catch` agar **tidak pernah melempar** (`status: 'gagal'`, `label: null` jika error).
- **Aturan penting sesuai `README.md` dalam `model-edom.zip`:** bila `label === null` (`unknown_vocabulary` / `empty_input`), **jangan pernah mengubahnya menjadi `'netral'`**.
- Catat batasan di komentar/UI: model berbasis data EDOM hanya sebagai info pendukung dan tidak mengubah `status` izin.

**A3. Review izin Asprak (#7)**
- `src/services/izin-review.ts` + `src/features/izin-review.tsx` + `src/app/asisten-izin.tsx` (rute khusus Asprak).
- Daftar izin realtime: nama, kelas, sesi, alasan, **hasil sentimen AI** (tampilkan `Sentimen AI: <label> (info pendukung)` bila `status === 'predicted'` dan `label != null`; atau `"Klasifikasi tidak tersedia"` bila `label == null` — jangan tampilkan `"netral"` untuk `label == null`), status, waktu. Filter status (Semua/Menunggu/Disetujui/Ditolak), kondisi kosong/loading/error.
- Tombol Setujui/Tolak dengan modal konfirmasi; **selalu aktif untuk status `menunggu`** apa pun hasil AI. Setelah diputuskan, tombol hilang dan status terkunci (sesuai rules).
- `decidePermission` mengisi `status`, `decidedBy`, `decidedAt` saja.

**A4. Security Rules (#8)**
- `firestore.rules` sesuai tabel di `PRD.md`; deploy via Firebase Console atau `firebase deploy --only firestore:rules`.
- Kasus uji wajib (Rules Playground/Emulator), semuanya harus **ditolak** kecuali ditandai ok:
  1. Tanpa login baca/tulis apa pun.
  2. Praktikan menulis `classes`/`schedules`/`sessions`.
  3. Praktikan A membaca `users` praktikan B; baca `permissions` milik orang lain.
  4. Presensi: sesi `belum_dibuka`/`ditutup`; kelas berbeda; `uid` milik orang lain; presensi kedua; update/delete presensi. (Presensi sah saat sesi `dibuka` = ok.)
  5. Praktikan membuat izin dengan `status = "disetujui"`; sesi `ditutup`; alasan < 10 karakter; mengubah izin sendiri.
  6. Asprak mengubah `reason`/`aiResult` pada izin; memutuskan izin yang sudah diputuskan. (Setujui/tolak izin `menunggu` = ok.)
  7. Asprak mengubah field selain `classId` pada `users`; praktikan mengubah `classId` sendiri. (Asprak memindahkan `classId` praktikan = ok.)
- Simpan ringkasan hasil uji (tabel lulus/gagal) untuk PM.

**Tes mandiri Dewa:** login benar/salah/kosong; tutup-buka app tetap login; logout; user tanpa dokumen `users`; rute dijaga per peran; model AI lokal mengklasifikasi teks normal (`positif`/`netral`/`negatif`), mengembalikan `label: null` untuk `unknown_vocabulary` (tidak dianggap `netral`) dan `empty_input`, berjalan tanpa internet; review izin setujui/tolak tetap aktif saat `label: null`; seed dijalankan dua kali tanpa duplikat.

---

## Fitur B — Pengelolaan Praktikum Asprak (Mischa)
Branch: `feature/asprak-praktikum`. Melanjutkan modul Asisten Sprint 1 (`/asisten`) tetapi data kini dari Firestore. Kebutuhan PRD: #2 (CRUD), #4 (rekap realtime), plus alur 1 sisi Asprak.

- `src/services/praktikum.ts` sesuai kontrak (listener realtime + CRUD + `openSession`/`closeSession` + `movePraktikanToClass`). `openSession` mengisi `status:'dibuka'` + `openedAt`; `closeSession` mengisi `status:'ditutup'` + `closedAt`. Transisi hanya `belum_dibuka → dibuka → ditutup` (tetap dari Sprint 1; sesi ditutup tidak dibuka ulang). Gunakan `serverTimestamp()`.
- `/asisten` (`src/features/asisten.tsx`): daftar sesi realtime dengan filter kelas/status (lanjutan Sprint 1), detail sesi, tombol buka/tutup dengan **modal konfirmasi** (batal tidak mengubah data), tautan ke Rekap, Kelola, Pindah Kelas, Review Izin. `UserHeader` di atas.
- `/kelola`: CRUD **kelas, jadwal, sesi** (boleh pakai segmen/tab dalam satu layar). Validasi: nama tidak kosong dan unik, format tanggal `YYYY-MM-DD`, jam `HH:MM`, jam selesai > mulai, kelas dipilih dari yang ada. Hapus memakai konfirmasi. **Larang** hapus kelas yang masih punya praktikan/sesi/jadwal, dan sesi yang sudah punya presensi (tampilkan alasan jelas).
- `/rekap?sessionId=`: listener `attendance` sesi + daftar praktikan kelas tsb + izin disetujui. Tampilkan per praktikan: **Hadir (+waktu)**, **Izin**, atau **Belum hadir**, serta ringkasan jumlah. Berubah realtime tanpa refresh. Kondisi kosong/loading/error.
- `/pindah-kelas`: daftar praktikan (nama, kelas saat ini); pilih kelas tujuan; konfirmasi; tulis `users/{uid}.classId`. Tolak bila kelas tujuan sama/tidak ada. Praktikan yang dipindah langsung melihat jadwal/sesi kelas barunya (realtime) tanpa pekerjaan tambahan di sisi Andiny.
- Setiap aksi tulis: nonaktifkan tombol saat proses (cegah klik ganda), tangani error lewat `getErrorMessage`, tampilkan pesan gagal jika offline (`useNetwork`).
- Semua listener di-`unsubscribe` saat unmount.
- Tes mandiri: buat/ubah/hapus tiap entitas; validasi tolak input salah; buka → tutup sesi; batal modal; rekap berubah saat praktikan presensi (uji bersama Andiny setelah Fase 0); pindah kelas; hapus kelas berisi data ditolak; offline menolak tulis; tutup-buka app data tetap.

---

## Fitur C — Sisi Praktikan (Andiny)
Branch: `feature/praktikan-presensi-izin`. Melanjutkan modul Praktikan Sprint 1 (`/praktikan`) dengan data Firestore. Kebutuhan PRD: #2 (lihat), #3, #4, #5, plus alur 1 dan 2 sisi Praktikan.

- `src/services/presensi.ts`: `subscribeMySessions(classId)`, `subscribeMySchedules(classId)`, `subscribeMyAttendance(uid)`, `markAttendance(user, session)`.
  - `markAttendance` menulis `sessions/{sessionId}/attendance/{uid}` dengan `setDoc` dan **memeriksa ulang** (membaca sesi dan dokumen presensi, atau memakai transaksi) bahwa status masih `dibuka` dan presensi belum ada. Penolakan oleh rules juga harus dipetakan ke pesan ramah ("Sesi sudah ditutup" / "Anda sudah presensi").
- `/praktikan` (`src/features/praktikan.tsx`): `UserHeader`; nama + kelas pengguna; daftar **jadwal** dan **sesi kelasnya saja** (realtime; berubah otomatis bila Asprak memindahkan kelas atau mengubah status). Setiap sesi menampilkan status (teks, bukan warna saja) dan: tombol **Presensi** aktif hanya saat `dibuka` dan belum presensi; label "Sudah presensi (jam)" bila sudah; tombol **Ajukan Izin** menuju `/izin?sessionId=`.
  - Hapus kontrol status demo dan pilihan identitas Sprint 1 (tidak relevan lagi); identitas dari `useAuth`.
  - Riwayat presensi milik pengguna (realtime), kondisi kosong/loading/error.
  - Cegah klik ganda (state `submitting`), tolak saat offline dengan pesan.
- `src/services/izin.ts`: `submitPermission(user, session, reason)`:
  1. validasi `reason` (10–300 karakter, trim) dan bahwa sesi belum `ditutup` dan milik kelasnya;
  2. panggil `classifyReason(reason)` milik Dewa (sinkron & lokal, tidak pernah melempar);
  3. tulis **satu dokumen** `permissions/{sessionId}_{uid}` berisi `status:'menunggu'`, `aiResult` hasil AI, `decidedBy/decidedAt: null`, `createdAt: serverTimestamp()`. Jika dokumen sudah ada, tolak dengan pesan "Anda sudah mengajukan izin untuk sesi ini".
  - Pengajuan **tidak boleh bergantung pada AI**: bila `aiResult.label === null` (`unknown_vocabulary` / error), pengajuan tetap disimpan dan **tidak** dianggap `'netral'`.
- `/izin` (`src/features/izin-praktikan.tsx`): form pilih sesi (atau dari `sessionId`), isi alasan dengan penghitung karakter, tombol kirim (nonaktif saat memproses). Bagian **Riwayat pengajuan** realtime: sesi, alasan, status (Menunggu/Disetujui/Ditolak), hasil sentimen AI sebagai info pendukung (atau "Klasifikasi tidak tersedia" jika `label == null`), waktu. Status berubah otomatis saat Asprak memutuskan.
- Tes mandiri: presensi saat dibuka berhasil; belum dibuka/ditutup ditolak; ketukan ganda dan presensi kedua tidak membuat duplikat; sesi kelas lain tidak tampil; status sesi berubah realtime dari perangkat Asprak; izin dengan teks terbaca model (`predicted`) maupun teks tidak dikenal kosakata model (`unknown_vocabulary` / `label: null`) tetap tersimpan; alasan kosong/terlalu pendek/terlalu panjang ditolak; izin ganda untuk sesi sama ditolak; status izin berubah realtime setelah diputuskan; offline menolak aksi; tutup-buka app data tetap.

---

## Aturan kerja untuk agent AI tiap developer
- Baca `PRD.md` (Sprint 2), bagian ini, dan `AGENTS.md`. Cek versi `expo` di `package.json` (SDK 57) dan baca docs yang sesuai sebelum menyentuh API Expo/Firebase; jangan mengandalkan memori.
- Edit **hanya file milik sendiri**. Jangan `npm install`/`expo install` (hanya Dewa). Jangan `git add/commit/push`.
- Jangan mengarang nama koleksi/field di luar model data PRD. Jika model kurang, minta PM.
- Jangan menaruh API key, service account, atau password di file yang masuk git, log, komentar, atau pesan commit.
- Selalu unsubscribe listener, tangani loading/error/kosong, dan gunakan pesan error Bahasa Indonesia lewat `getErrorMessage`.
- Sebelum menyerahkan: jalankan `npx tsc --noEmit` dan `npx expo lint`. Jika gagal karena file milik orang lain/konfigurasi, laporkan sebagai blocker; jangan memperbaikinya sendiri.

## Bukti selesai dan pemeriksaan PM (Sprint 2)
- Tiap developer menyerahkan: daftar file berubah, fitur selesai, hasil tes mandiri (tabel lulus/gagal), kekurangan nyata. Dewa menambah tabel hasil uji Security Rules. Jangan klaim berhasil untuk yang belum diuji.
- PM memeriksa diff PR hanya berisi file milik pembuat PR dan tidak berisi `.env*`, service account, atau key.
- Urutan merge ke `dev`: **Dewa (Fase 0 dulu) → Mischa → Andiny → Dewa (sisa fitur)** atau mengikuti kesiapan, dengan Fase 0 selalu pertama. Setelah tiap merge: `npx tsc --noEmit`, `npx expo lint`, lalu jalankan Demo PM Sprint 2 di `PRD.md` dengan dua perangkat/akun.
- Periksa lebar 360/390, modal bisa ditutup, konten scroll, tombol tidak tertutup keyboard/safe area.
- Rilis/demo stabil dipromosikan `dev → main` oleh PM.





# Pembagian Fitur — Project Presensi Praktikum
## SPRINT 3 — Geolocation, Maps & Push Notification

**Status:** Draft untuk disepakati tim dan PM  
**Dokumen:** `docs/PEMBAGIAN.md` — bagian Sprint 3

> **Petunjuk integrasi:** Tambahkan bagian Sprint 3 ke dokumen yang sudah ada; jangan menghapus pembagian Sprint 1–2. Nama branch dan kepemilikan file berikut adalah usulan yang harus dikonfirmasi terhadap struktur repository.

## Sebelum mulai

Baca `docs/PRD.md` dan `docs/PEMBAGIAN.md` (bagian Sprint 3). Pastikan autentikasi, data kelas/jadwal/sesi, izin, dan presensi Sprint 2 yang menjadi dependensi dapat diuji. Sprint 3 melanjutkan aplikasi yang ada, bukan membangunnya ulang.

## 1. DEWA — SRS-06, SRS-07

**Branch:** `feature/push-notification`

- Integrasikan push notification melalui stack yang kompatibel dengan Expo/build proyek (FCM atau mekanisme yang sesuai).
- Kelola izin notifikasi dan token per UID/perangkat, termasuk refresh dan logout.
- Implementasikan pengiriman notifikasi tertarget untuk sesi dibuka, jadwal berubah, serta izin disetujui/ditolak.
- Tempatkan pengiriman pada backend tepercaya; jangan menaruh kredensial pengiriman di aplikasi.
- Tangani token invalid, event ganda, kegagalan pengiriman, serta foreground/background/kondisi aplikasi tertutup pada platform yang didukung.
- Koordinasikan dengan Moses rancangan validasi presensi di backend (status sesi, role/keanggotaan, radius, duplikasi, aturan Firestore).
- Menjadi koordinator instalasi/perubahan dependency, konfigurasi Firebase, dan perubahan Security Rules.

**Output:** mekanisme push tertarget, kontrak token/event, pengujian penerima, dukungan validasi presensi tepercaya, dan dokumentasi konfigurasi.

## 2. MISCHA — SRS-03, SRS-05

**Branch:** `feature/laboratorium-aktivitas`

- Implementasikan pengelolaan data laboratorium oleh asprak (nama, koordinat, radius, status aktif).
- Simpan data lab di Firestore dengan validasi input dan pembatasan akses.
- Hubungkan lab dengan jadwal dan sesi yang sudah ada, tanpa membuat sumber data ganda.
- Sediakan informasi aktivitas praktikum yang sedang berlangsung dan berikutnya: mata praktikum, kelas, waktu, status.
- Pastikan pembaruan jadwal/sesi tercermin realtime; bersihkan listener saat tidak digunakan.
- Sepakati kontrak data dengan Moses agar marker/detail lab dapat digunakan di Maps.

**Output:** data lab yang dapat dikelola asprak, hubungan lab–sesi, dan data aktivitas realtime yang dapat dikonsumsi halaman Maps.

## 3. MOSES — SRS-01, SRS-02, SRS-04

**Branch:** `feature/presensi-lokasi-maps`

- Buat halaman presensi praktikan khusus, terpisah dari detail sesi.
- Tampilkan informasi sesi, status, tombol presensi, dan pesan hasil tindakan.
- Ambil lokasi perangkat setelah izin diberikan; tangani GPS mati, izin ditolak, timeout, dan akurasi buruk.
- Hitung jarak pengguna–lab dari data Firestore dan tampilkan hasilnya di UI.
- Integrasikan aksi presensi dengan mekanisme backend tepercaya yang disepakati Dewa; jangan mengandalkan validasi UI saja.
- Pastikan sesi aktif, praktikan berhak, berada dalam radius, dan belum presensi; tampilkan pesan penolakan yang jelas.
- Buat Maps interaktif dengan marker lab dari Firestore dan posisi pengguna yang diperbarui saat layar aktif.
- Marker lab dapat dipilih untuk melihat detail lab serta aktivitas yang disediakan Mischa.
- **Opsional yang direkomendasikan:** visualisasi radius dengan `Circle`; tidak wajib membuat rute/Polyline/Google Routes API.
- Hentikan pemantauan lokasi dan listener saat layar tidak aktif.

**Output:** halaman presensi GPS, integrasi penyimpanan presensi yang tervalidasi, Maps, dan pengujian kondisi gagal.

## 4. PM — ANDINY

**Peran:** koordinasi dan verifikasi, bukan penanggung jawab implementasi UI developer.

- Finalisasi PRD, SRS, kontrak antarmodul, dan pembagian file.
- Konfirmasi status Firebase Sprint 2, skema Firestore, serta kesiapan lingkungan pengujian.
- Pantau dependensi Dewa–Mischa–Moses dan selesaikan konflik ownership.
- Review PR, hasil TypeScript/lint, pengujian, dan bukti demo.
- Pastikan tiga alur demo end-to-end berhasil sebelum pengumpulan.

## Branch Sprint 3

Repository: `https://github.com/GAMPANG-BANGET-NIH/PPK-D2-Pertemuan-6`  
Integrasi: `dev`; rilis/demo stabil: `main` (verifikasi branch `dev` sebelum mulai). Branch dibuat dari `origin/dev` terbaru, bukan meneruskan branch Sprint 2 yang sudah di-merge.

| Fitur | Penanggung jawab | Branch |
|---|---|---|
| A. Push notification, izin perangkat, keamanan integrasi | Dewa | `feature/push-notification` |
| B. CRUD laboratorium, aktivitas lab realtime | Mischa | `feature/laboratorium-aktivitas` |
| C. Presensi GPS, halaman presensi, Maps | Moses | `feature/presensi-lokasi-maps` |
| Dokumentasi, review dan merge | Andiny (PM) | Dokumen melalui alur PM |

## Kepemilikan file Sprint 3 — rancangan eksklusif untuk disahkan PM

Daftar ini mengikuti pola file Sprint 2, tetapi **merupakan usulan** sampai struktur repository dan dependensi diperiksa. Jangan mengedit file bersama hanya karena tercantum dalam kontrak.

| Orang | File yang boleh dibuat/diubah setelah disahkan |
|---|---|
| Dewa | `package.json`, lockfile, `app.json`, `eas.json`, `firebase.json`, `firestore.rules`, `src/lib/notifications.ts`, `src/services/notifications.ts`, `src/hooks/use-notifications.ts`, `src/types/notifications.ts`, `functions/**` (jika memakai Cloud Functions), `src/lib/firebase.ts` bila perlu |
| Mischa | `src/app/laboratorium.tsx`, `src/features/laboratorium.tsx`, `src/features/aktivitas-lab.tsx`, `src/services/laboratorium.ts`, `src/hooks/use-laboratorium.ts`, `src/services/praktikum.ts` (hanya penambahan relasi lab, koordinasi dengan PM) |
| Moses | `src/app/presensi-lokasi.tsx`, `src/app/maps.tsx`, `src/features/presensi-lokasi.tsx`, `src/features/maps.tsx`, `src/services/presensi.ts`, `src/services/lokasi.ts`, `src/hooks/use-lokasi.ts`, `src/app/praktikan.tsx` dan `src/features/praktikan.tsx` (penyesuaian navigasi presensi, dialihkan dari Andiny) |
| PM | `docs/PRD.md`, `docs/PEMBAGIAN.md` |

**File bersama yang perlu penanggung jawab tunggal sebelum implementasi:** `src/app/_layout.tsx` (Dewa untuk route guard/navigasi), `src/types/index.ts` (Dewa setelah menerima kontrak Mischa–Moses), `firestore.rules` (Dewa), serta perubahan service Sprint 2 yang dipakai lebih dari satu fitur. Setiap penambahan file atau perubahan ownership memerlukan persetujuan PM.

## Kontrak antarmodul — sepakati sebelum coding

```ts
// Mischa: src/services/laboratorium.ts (usulan signature)
subscribeLaboratories(onData, onError): Unsubscribe
subscribeLabActivity(labId, onData, onError): Unsubscribe
createLaboratory(input) / updateLaboratory(id, input) / deactivateLaboratory(id)

// Moses: src/services/lokasi.ts dan src/services/presensi.ts
getCurrentLocation(): Promise<LocationReading>
watchUserLocation(onData, onError): Unsubscribe
markAttendanceWithLocation(sessionId, reading): Promise<AttendanceResult>
// Fungsi terakhir memanggil endpoint tepercaya; tidak setDoc langsung.

// Dewa: kontrak push dan endpoint presensi disahkan bersama Moses
registerPushToken(uid, token, deviceId): Promise<void>
unregisterPushToken(uid, deviceId): Promise<void>
// Pengiriman push terjadi di backend, bukan fungsi klien bebas sendPush(uid).
```

Nama/signature ini belum menjadi API yang sudah ada. Dewa, Mischa, dan Moses wajib menyetujui bentuk final sebelum membuat impor lintas modul.

## 5. Matriks kepemilikan modul

| Modul / area | Pemilik utama | Koordinasi wajib |
|---|---|---|
| Push, token, izin notifikasi, event delivery | Dewa | Mischa (event sesi/jadwal/izin) |
| Firebase config, dependency, security rules | Dewa | Semua developer |
| Endpoint/aturan presensi tepercaya | Dewa (keamanan) + Moses (integrasi presensi) | PM untuk kontrak |
| CRUD lab dan hubungan lab–jadwal/sesi | Mischa | Moses |
| Aktivitas lab realtime | Mischa | Moses |
| Halaman presensi, geolocation, Maps | Moses | Mischa + Dewa |
| PRD, pembagian, integrasi/demo | Andiny (PM) | Semua developer |

**Kepemilikan file:** daftar path spesifik harus dibuat berdasarkan struktur repo aktual sebelum coding. Hindari menebak path. Perubahan file bersama, termasuk navigasi, tipe data, aturan Firestore, dan konfigurasi, harus diumumkan serta disetujui pemilik modul/PM. Modul presensi Sprint 2 yang sebelumnya dikerjakan Andiny dialihkan kepemilikannya kepada Moses untuk Sprint 3.

## 6. Urutan pengerjaan dan dependensi

**Tahap 0 — Audit fondasi Sprint 2**
- Pastikan konfigurasi Firebase grup tersedia pada environment lokal (jangan commit `.env.local`).
- Verifikasi login, role, sesi, izin, dan rekap yang akan dipakai Sprint 3.
- Pastikan status modul AI/fitur Sprint 2 tidak diam-diam digantikan stub sementara.

**Tahap 1 — Sepakati kontrak bersama**
- Mischa + Moses: struktur `laboratories`, `labId`, field radius, status sesi, serta data aktivitas.
- Dewa + Moses: endpoint presensi, payload lokasi, akurasi, pemeriksaan server, idempotensi, dan pembatasan direct write.
- Dewa + Mischa: peristiwa yang memicu notifikasi, target penerima, serta mekanisme pencegahan event ganda.
- PM: catat keputusan dalam PRD sebelum integrasi.

**Tahap 2 — Implementasi paralel**
- Mischa membangun data lab dan aktivitas realtime.
- Moses membangun halaman presensi dan Maps dengan kontrak yang disepakati; integrasikan data nyata saat siap.
- Dewa menyiapkan infrastruktur push dan validasi keamanan presensi.

**Tahap 3 — Integrasi dan pengujian**
- Hubungkan lab → Maps → sesi → presensi → rekap.
- Hubungkan perubahan sesi/jadwal/izin → event backend → penerima notifikasi.
- Uji kondisi gagal dan perbaiki konflik integrasi.

## 7. Aturan kerja dan Git

- Kerjakan hanya modul/file yang telah disepakati; koordinasikan perubahan lintas modul.
- Jangan install/ubah dependency sendiri; ajukan ke Dewa.
- Jangan commit `.env.local`, service account, token rahasia, atau kredensial.
- Agent dilarang menjalankan `git add`, `git commit`, atau `git push`; developer melakukan manual.
- Gunakan branch fitur masing-masing.
- **Target PR: `dev` jika branch integrasi `dev` memang digunakan tim.** Jika repo hanya menggunakan `main`, PM harus menetapkan satu alur resmi sebelum PR pertama; jangan mengasumsikan `dev` sudah ada.
- Sebelum PR: jalankan `npx tsc --noEmit` dan `npx expo lint`. Jika lint belum dikonfigurasi, laporkan blocker dan selesaikan konfigurasi bersama Dewa; jangan mengklaim lint lulus.
- Bersihkan listener realtime dan subscription lokasi/notifikasi saat tidak digunakan.
- Setiap PR menyertakan ringkasan perubahan, file yang diubah, cara menguji, hasil tes, dan screenshot/video jika relevan.
- PM melakukan review dan persetujuan integrasi; tidak boleh merge fitur yang belum diuji tanpa mencatat risikonya.

## Bukti selesai dan pemeriksaan PM

Setiap developer menyerahkan: (1) daftar file berubah, (2) ringkasan fitur selesai, (3) tabel uji manual lulus/gagal beserta bukti, (4) blocker/risiko, (5) hasil `npx tsc --noEmit` dan `npx expo lint`. Jika lint meminta setup, hanya Dewa mengubah konfigurasi setelah disepakati. PM memeriksa diff dan menjalankan tiga demo bersama.

**Pengujian lintas modul wajib:** Mischa mengubah radius/lab → Moses melihat perubahan di Maps; Dewa memverifikasi endpoint presensi menolak percobaan bypass; Mischa membuka sesi → Moses presensi → rekap realtime; Dewa memverifikasi hanya kelas/pemohon terkait menerima notifikasi.

## 8. Checklist pengujian per developer

### Dewa
- [ ] Token terikat ke akun/perangkat yang benar dan ditangani saat refresh/logout.
- [ ] Notifikasi sesi, jadwal, izin diterima pengguna terkait, bukan pengguna lain.
- [ ] Kegagalan token/pengiriman dan izin notifikasi ditolak ditangani.
- [ ] Tidak ada secret pengiriman di aplikasi klien.
- [ ] Validasi presensi di jalur tepercaya dan direct write tidak dapat melewatinya.

### Mischa
- [ ] CRUD lab dan radius tersimpan, validasi input berjalan.
- [ ] Pengguna tak berwenang tidak dapat mengubah lab.
- [ ] Jadwal/sesi terhubung dengan lab yang tepat.
- [ ] Aktivitas berlangsung/berikutnya tampil dan berubah realtime.

### Moses
- [ ] Halaman presensi terpisah dan menampilkan status sesi.
- [ ] Dalam radius + sesi terbuka berhasil; luar radius/sesi tertutup/duplikat ditolak.
- [ ] Izin lokasi ditolak, GPS mati, akurasi buruk, dan offline ditangani.
- [ ] Marker lab, posisi pengguna, detail lab, dan aktivitas tampil di Maps.
- [ ] Listener/subscription dibersihkan.

## 9. Target demo Sprint 3

1. **Presensi GPS:** Asprak membuka sesi → praktikan presensi berdasarkan radius → backend memvalidasi → rekap asprak realtime; tunjukkan contoh penolakan.
2. **Maps + aktivitas:** Peta menunjukkan lokasi pengguna dan marker lab → pilih marker → aktivitas lab tampil → perubahan data terlihat realtime.
3. **Push tertarget:** Perubahan sesi/jadwal/keputusan izin → push diterima perangkat terkait; pengguna lain tidak menerima notifikasi yang tidak relevan.

## 10. Definition of Done tim

- [ ] SRS-01 s.d. SRS-07 memenuhi kriteria wajib pada PRD.
- [ ] Tiga demo berhasil pada perangkat/build yang mendukung.
- [ ] Security Rules dan jalur validasi presensi diuji.
- [ ] TypeScript dan lint lolos, atau blocker terdokumentasi dan diselesaikan sebelum pengumpulan.
- [ ] Tidak ada credential/secret dalam Git.
- [ ] PR direview dan diintegrasikan sesuai alur branch resmi.
- [ ] PM menyetujui hasil akhir dan dokumentasi demo.

---

# Pembagian Fitur — Project Presensi Praktikum
## SPRINT 4 — Manajemen Lab Aslab, Denda & Payment Gateway — SPRINT AKTIF

**Status:** Draft untuk disepakati tim dan PM
**Dokumen:** `docs/PEMBAGIAN.md` — bagian Sprint 4
**Prasyarat:** Baca `PRD.md` bagian **SPRINT 4** (SRS-08 s.d. SRS-13, model data, rules, demo) dan `AGENTS.md`. Pastikan fitur Sprint 1–3 yang menjadi dependensi dapat diuji.

> **Petunjuk integrasi:** Bagian Sprint 3 tidak dihapus; arsipnya tetap di atas. Perubahan kepemilikan dibawah ini disahkan PM (Mischa) sebelum coding.

## Struktur tim Sprint 4

| Orang | Peran Sprint 4 | Catatan kontinuitas |
|---|---|---|
| **Mischa** | **PM** (dokumen, review, merge; tidak coding) | Sebelumnya developer Asprak/aktivitas lab (Sprint 2–3). Kepemilikan modul lab dialihkan ke Andiny, modul sesi/presensi lanjut ke Moses, payment & notifikasi lanjut ke Dewa. |
| **Dewa** | Developer | Sprint 2: fondasi Firebase, auth, AI lokal, security rules, review izin. Sprint 3: push notification + backend tepercaya. → Cocok untuk **denda (backend), Midtrans, notifikasi pembayaran, rules.** |
| **Andiny** | Developer | Sprint 2: sisi praktikan (presensi, izin, riwayat, CRUD view). Sprint 3: PM. → Cocok untuk **manajemen lab oleh aslab (bulk insert, distribusi, konfigurasi) dan dashboard.** |
| **Moses** | Developer | Sprint 2: jadwal & navigasi. Sprint 3: presensi GPS, halaman presensi, maps. → Cocok untuk **pengelolaan sesi asprak dan perhitungan keterlambatan** (melanjutkan modul presensi-nya sendiri). |

Pembagian di atas membuat setiap developer mendapat **dua kelompok kebutuhan** dari enam kebutuhan Sprint 4, dengan bobot yang setara, dan setiap kelompok menyambung dengan pekerjaan developer yang sama pada sprint sebelumnya.

## Branch Sprint 4

Repository: `https://github.com/GAMPANG-BANGET-NIH/PPK-D2-Pertemuan-6`
Integrasi: `dev`; rilis/demo stabil: `main`. Branch dibuat dari `origin/dev` terbaru, bukan meneruskan branch Sprint 3 yang sudah di-merge. Agent DILARANG `git add/commit/push`; developer melakukan manual. PR menuju `dev`; PM review dan merge satu per satu.

| Fitur | Penanggung jawab | Branch |
|---|---|---|
| A. Denda (backend), Payment Gateway Midtrans, notifikasi & riwayat pembayaran | Dewa | `feature/denda-payment-gateway` |
| B. Manajemen laboratorium oleh Aslab (bulk/single insert, distribusi, konfigurasi) + Dashboard keberlangsungan lab | Andiny | `feature/aslab-laboratorium-dashboard` |
| C. Pengelolaan sesi oleh Asprak + perhitungan keterlambatan (grace period, status kehadiran, excused absence) | Moses | `feature/asprak-sesi-keterlambatan` |
| Dokumentasi, review dan merge | Mischa (PM) | Dokumen melalui alur PM |

## Urutan kerja (ada satu ketergantungan awal)

1. **Fase 0 — Fondasi (Dewa, dikerjakan PERTAMA):** tambahkan role `aslab` ke `Role` di `src/types/index.ts`, route guard `_layout.tsx` (rute aslab), seed akun aslab, perluasan `firestore.rules` (aslab + fines/payments backend-only), dan skeleton Cloud Functions (endpoint pembuatan transaksi + webhook Midtrans + trigger tagihan denda) dengan kontrak di bawah. PM merge ke `dev` secepatnya; Andiny dan Moses `merge origin/dev` ke branch masing-masing begitu tersedia.
2. **Fase 1 — Paralel:** Andiny dan Moses **boleh langsung mulai** menulis UI, hook, dan service berdasarkan kontrak (impor dari path kontrak). Pengujian dengan rules baru dan Midtrans sandbox menunggu Fase 0 di-merge. Dewa melanjutkan fitur payment dan notifikasi.
3. **Fase 2 — Integrasi (PM + semua):** merge satu per satu, jalankan Demo A/B/C di PRD Sprint 4, perbaiki bug lintas fitur oleh pemilik modulnya.

## Kepemilikan file Sprint 4 — tidak boleh overlap

Path relatif root repository. File di luar daftar milik sendiri **tidak boleh disentuh**. Perubahan file bersama wajib izin PM.

| Orang | File yang boleh dibuat/diubah |
|---|---|
| **Dewa** | `package.json`, lockfile, `functions/**`, `firestore.rules`, `firebase.json`, `.env.example` (variabel Midtrans tanpa nilai), `.env.local` (lokal, tidak di-commit), `scripts/seed.*` (tambah akun aslab), `src/types/index.ts` (role aslab, tipe fines/payments), `src/app/_layout.tsx` (route guard aslab + praktikan tagihan), `src/app/tagihan.tsx`, `src/app/riwayat-pembayaran.tsx`, `src/features/tagihan.tsx`, `src/features/riwayat-pembayaran.tsx`, `src/services/pembayaran.ts`, `src/hooks/use-pembayaran.ts`, `src/lib/notifications.ts` / `src/services/notifications.ts` (penambahan event denda/pembayaran), `src/lib/firebase.ts` bila perlu |
| **Andiny** | `src/app/aslab.tsx`, `src/app/aslab-lab.tsx`, `src/app/aslab-bulk.tsx`, `src/app/aslab-dashboard.tsx`, `src/features/aslab-*.tsx`, `src/services/aslab.ts`, `src/services/bulk-insert.ts`, `src/hooks/use-aslab.ts`, `src/hooks/use-dashboard.ts`, `src/utils/template.ts` (pembuat file template unduhan), `src/services/laboratorium.ts` (diambil alih dari Mischa Sprint 3, penyesuaian sesuai kontrak baru — disahkan PM) |
| **Moses** | `src/app/asprak-sesi.tsx` (atau penggantian isi `src/app/asisten.tsx`/`src/app/rekap.tsx` milik jalur asprak — disahkan PM sebelum edit), `src/features/asprak-sesi.tsx`, `src/features/rekap-kehadiran.tsx`, `src/services/sesi.ts`, `src/services/keterlambatan.ts`, `src/hooks/use-sesi.ts`, `src/hooks/use-keterlambatan.ts`, penyesuaian navigasi `src/app/praktikan.tsx` (tampilan status kehadiran/izin, dialihkan dari Andiny) |
| **PM (Mischa)** | `docs/PRD.md`, `docs/PEMBAGIAN.md` |

- **Hanya Dewa** yang boleh menambah/mengubah dependency dan konfigurasi Cloud Functions/Firebase. Butuh paket → minta Dewa.
- Butuh file di luar daftar atau perubahan model data → minta PM memperbarui dokumen **sebelum** coding.
- Jangan impor kode *fitur* milik teman; yang boleh diimpor hanya modul fondasi/kontrak yang disepakati di bawah.

## Kontrak antarmodul — sepakati sebelum coding

```ts
// Dewa: src/types/index.ts (perluasan)
export type Role = 'praktikan' | 'asprak' | 'aslab';
export type FineStatus = 'pending' | 'paid' | 'failed' | 'dibatalkan';
export type PaymentStatus = 'pending' | 'success' | 'failed';
export type Fine = { id, uid, name, sessionId, sessionTitle, amount, status: FineStatus, canceledReason, createdAt };
export type Payment = { id, fineId, uid, orderId, amount, status: PaymentStatus, paymentType, transactionTime, createdAt };

// Dewa: Cloud Functions (backend tepercaya) — kontrak trigger & endpoint
// onCreate sessions/{id}/attendance/{uid} where onTime == false -> buat fines/{id} idempoten (1 tagihan per presensi terlambat)
// onUpdate permissions -> disetujui: batalkan fines pending milik pemohon utk sesi tsb (status 'dibatalkan', canceledReason)
// callable createPayment(fineId) -> { token, redirectUrl }   (Midtrans Snap, sandbox, server key hanya di functions)
// webhook notification Midtrans -> verifikasi signature -> update payments + fines (idempoten per orderId)
// event notifikasi: fine.created, payment.success, payment.failed -> kirim ke pemilik tagihan via infrastruktur push Sprint 3

// Dewa: src/services/pembayaran.ts (klien)
subscribeMyFines(uid, cb, onError): Unsubscribe
subscribeMyPayments(uid, cb, onError): Unsubscribe
createPayment(fineId): Promise<{ token: string; redirectUrl: string }>   // memanggil callable, TIDAK menulis payments langsung

// Andiny: src/services/aslab.ts
subscribeLaboratories(cb, onError): Unsubscribe                      // lanjutan kontrak Sprint 3, filter milik aslab
subscribeLabMembers(labId, role: 'praktikan' | 'asprak', cb, onError): Unsubscribe
createLaboratory(input) / updateLaboratory(id, input) / deactivateLaboratory(id)
bulkCreateLaboratories(rows): Promise<BulkResult>                    // commit hanya row yang di-accept
bulkAddMembers(labId, role, rows): Promise<BulkResult>
movePraktikanToLab(uid, fromLabId, toLabId): Promise<void>
setPresensiConfig(labId, { latitude, longitude, radiusMeters, gracePeriodMinutes, lateFineAmount }): Promise<void>

// Andiny: src/services/bulk-insert.ts + src/utils/template.ts
parseInsertFile(uri, kind: 'laboratories' | 'praktikan' | 'asprak'): ParsedRow[]
buildTemplateFile(kind): Uri                                        // 3 template terpisah, dapat diunduh/dibagikan

// Andiny: src/services/dashboard.ts (agregat dari data Firestore, bukan sumber baru)
subscribeDashboardStats(filter: 'hari' | 'minggu' | 'bulan', cb, onError): Unsubscribe

// Moses: src/services/sesi.ts
subscribeAsprakSessions(asprakUid, cb, onError): Unsubscribe         // sesi pada lab/kelas tanggung jawab asprak
subscribeSessionAttendance(sessionId, cb, onError): Unsubscribe      // lanjutan rekap, dengan onTime/lateMinutes
openSession(id) / closeSession(id)

// Moses: src/services/keterlambatan.ts (logika tampilan; penulisan field tetap backend)
resolveAttendanceStatus(attendance, permissionsApproved, gracePeriodMinutes): 'hadir' | 'terlambat' | 'izin' | 'belum_hadir'
```

Signatures ini adalah usulan; Dewa, Andiny, dan Moses wajib menyetujui bentuk final sebelum impor lintas modul dibuat. Perubahan kontrak lewat PM.

## Fitur A — Denda, Payment Gateway Midtrans, Notifikasi & Riwayat Pembayaran (Dewa)
Branch: `feature/denda-payment-gateway`. Kebutuhan PRD: SRS-11 (backend tagihan & rules), SRS-12, SRS-13.

**A0. Fase 0 (serahkan lebih dulu):**
- Perluas `Role` menjadi `'praktikan' | 'asprak' | 'aslab'`; perbarui route guard (`/aslab*` khusus aslab; peran salah dialihkan ke beranda perannya); seed akun aslab contoh (idempoten); perbarui `firestore.rules` sesuai tabel PRD Sprint 4; skeleton `functions/` berisi kontrak trigger/endpoint di atas (boleh stub yang aman, tanpa secret).
- Tambahkan variabel Midtrans ke `.env` lingkungan functions (sandbox client key/server key) — **tidak pernah** di klien, git, log, atau dokumen. `.env.example` hanya nama variabel.

**A1. Penerbitan tagihan denda (backend, SRS-11):**
- Trigger pada presensi terlambat (`onTime == false`) yang valid: buat **satu** dokumen `fines` (idempoten; cek tagihan untuk pasangan uid+sesi+attendancePath). Nominal dari `laboratories.lateFineAmount` saat itu.
- Saat izin praktikan disetujui: batalkan tagihan `pending` milik pemohon untuk sesi tersebut (`status: 'dibatalkan'`, `canceledReason`), tanpa mengubah `attendance`.
- Pembayaran tidak pernah mengubah dokumen `attendance`.

**A2. Midtrans Sandbox (SRS-12):**
- Callable `createPayment(fineId)`: validasi pemilik tagihan, buat order unik, panggil Midtrans Snap (sandbox), simpan `payments {status:'pending'}`, kembalikan token/redirect URL ke klien.
- Webhook/notification handler: verifikasi signature, update `payments` dan `fines` secara idempoten; webhook tanpa signature valid ditolak; status final **hanya** dari backend.
- Layar `/tagihan`: daftar tagihan milik praktikan (realtime), rincian nominal, tombol bayar (nonaktif saat proses), arahkan ke halaman/metode pembayaran, tampilkan status pending/success/failed.
- Idempotensi: satu tagihan tidak bisa menghasilkan dua order aktif; retry webhook tidak menduplikasi update.

**A3. Notifikasi & riwayat pembayaran (SRS-13):**
- Tambahkan event `fine.created`, `payment.success`, `payment.failed` ke backend pengiriman push Sprint 3; penerima = pemilik tagihan (bukan pilihan klien); tangani token invalid dan pengiriman ganda.
- Layar `/riwayat-pembayaran`: sesi, tanggal tagihan, nominal, waktu transaksi, status; realtime dan persisten (tersedia setelah app ditutup-dibuka); kondisi loading/error/kosong.

**A4. Security Rules Sprint 4:**
- Terapkan tabel rules PRD Sprint 4 (`laboratories` hanya aslab; subkoleksi anggota hanya aslab; `fines`/`payments` hanya backend; `role` tidak dapat diubah klien).
- Kasus uji wajib (playground/emulator), semuanya ditolak kecuali ditandai ok:
  1. Tanpa login: baca/tulis apa pun.
  2. Asprak/praktikan menulis `laboratories` atau subkoleksi anggota. (Aslab menulis = ok.)
  3. Asprak mengubah `users.classId` praktikan (kini dilarang); siapa pun mengubah `role` sendiri.
  4. Klien membuat/mengubah/menghapus `fines` atau `payments` langsung.
  5. Praktikan membaca `fines`/`payments` milik orang lain. (Pemilik membaca miliknya = ok.)
  6. Asprak lab membaca `fines` labnya untuk rekap = ok; aslab membaca agregat = ok.
  7. Praktikan/aslab membuka/menutup sesi; asprak menulis konfigurasi lab. (Asprak membuka sesi tanggung jawabnya = ok.)
- Simpan ringkasan hasil uji (tabel lulus/gagal) untuk PM.

**Tes mandiri Dewa:** tagihan hanya satu per kejadian terlambat; izin disetujui membatalkan tagihan pending; pembayaran sandbox sukses mengubah `fines.status='paid'` via webhook; webhook palsu ditolak; tidak ada secret di klien/git; notifikasi sampai ke pemilik tagihan saja; riwayat pembayaran bertahan setelah app ditutup-dibuka; role aslab dijaga per rute.

## Fitur B — Manajemen Laboratorium Aslab + Dashboard (Andiny)
Branch: `feature/aslab-laboratorium-dashboard`. Kebutuhan PRD: SRS-08, SRS-09. Melanjutkan data lab Sprint 3 (yang kini dikelola aslab, bukan asprak).

- `/aslab` (`src/features/aslab-*.tsx`): beranda aslab dengan `UserHeader`; daftar laboratorium milik aslab (per mata kuliah), tautan ke pengelolaan lab, bulk insert, dan dashboard. Kondisi kosong/loading/error di semua layar.
- Pengelolaan lab: tambah/lihat/ubah/nonaktifkan lab (nama, koordinat, radius, status aktif); validasi koordinat/radius sesuai PRD; set **cakupan lokasi presensi** dan **batasan keterlambatan** (grace period) serta nominal denda per lab.
- **Tiga bulk insert terpisah** (laboratorium per mata kuliah; praktikan ke lab; asprak ke lab), masing-masing dengan **single insert** tersendiri; **3 file template unduhan terpisah** via `src/utils/template.ts`.
- Layar review bulk (`/aslab-bulk`): setiap row file menjadi item dalam **scroll view** yang dapat diatur fleksibel: accept/deny per row, update, isi data yang masih kosong; hanya row yang di-accept yang di-commit; hasil per row dilaporkan (berhasil/gagal + alasan).
- Pindah praktikan antar lab (`movePraktikanToLab`): konfirmasi, tolak lab tujuan sama/tidak ada; perpindahan terlihat realtime di sisi terkait. **Tidak ada** perpindahan jadwal praktikum.
- `/aslab-dashboard` (`src/services/dashboard.ts` + `src/hooks/use-dashboard.ts`): jumlah lab & praktikan; status kegiatan tiap lab; lokasi & waktu pelaksanaan; jadwal berlangsung/berikutnya; riwayat kegiatan; riwayat keuangan denda (agregat). **Filter hari/minggu/bulan**. Semua dari Firestore (`schedules`, `sessions`, `attendance`, `fines`, `payments`) — tanpa sumber data baru. Realtime, listener di-`unsubscribe` saat unmount.
- Setiap aksi tulis: tombol nonaktif saat proses, `getErrorMessage`, tolak saat offline (`useNetwork`), modal konfirmasi untuk aksi destruktif/pindah.
- Tes mandiri: single & bulk insert (row valid/invalid/deny/perbaikan); template unduhan benar untuk 3 jenis; pindah praktikan; set radius/grace/nominal; dashboard angka sesuai data uji dan berubah realtime; filter hari/minggu/bulan; asprak/praktikan tidak bisa mengubah lab (ditolak rules); offline menolak tulis; tutup-buka app data tetap; lebar 360/390.

## Fitur C — Pengelolaan Sesi Asprak + Keterlambatan (Moses)
Branch: `feature/asprak-sesi-keterlambatan`. Kebutuhan PRD: SRS-10, SRS-11 (logika status & UI). Melanjutkan modul presensi/maps Moses Sprint 3.

- `/asprak-sesi` (`src/features/asprak-sesi.tsx`): daftar kelas, jadwal, dan sesi pada lab/kelas tanggung jawab asprak (realtime, dari Firestore). Tombol buka sesi (saat praktikum dimulai) dan tutup sesi (setelah selesai) dengan modal konfirmasi; transisi `belum_dibuka → dibuka → ditutup`; batal modal tidak mengubah data; perubahan status tersinkron realtime ke praktikan (termasuk notifikasi Sprint 3).
- Pantau & kelola presensi: rekap realtime per sesi via `subscribeSessionAttendance` + daftar anggota lab + izin disetujui; status per praktikan: **Hadir (tepat waktu) / Terlambat (+menit) / Izin (excused) / Belum hadir** — teks, bukan warna saja; ringkasan jumlah. Field `onTime`/`lateMinutes` dibaca dari dokumen presensi (diisi backend), asprak tidak mengubahnya.
- `src/services/keterlambatan.ts`: `resolveAttendanceStatus` memakai grace period dari `laboratories` (bukan hard-coded); **izin disetujui = Izin (excused)**, tetap tidak hadir, bebas denda, dan tidak pernah diubah menjadi hadir.
- Asprak **tidak memiliki** aksi konfigurasi lab atau distribusi praktikan/asprak di modul ini (tidak ada tombol; ditolak rules).
- Penyesuaian `src/app/praktikan.tsx` (dialihkan dari Andiny, disahkan PM): label status presensi "Hadir"/"Terlambat x menit" dan tautan ke `/tagihan` bila ada tagihan.
- Setiap listener di-`unsubscribe` saat unmount; tombol nonaktif saat proses; error via `getErrorMessage`; offline menolak aksi tulis.
- Tes mandiri: buka → presensi praktikan → rekap berubah realtime → tutup sesi; tepat waktu vs terlambat (di/paska grace period); izin disetujui tampil "Izin" dan tidak dihitung terlambat; sesi ditutup tidak dibuka ulang; asprak menolak ditulis ke lab/distribusi (rules); lebar 360/390.

## Aturan kerja (mewarisi Sprint 2–3)

- Edit **hanya file milik sendiri**. Jangan `npm install`/`expo install` (hanya Dewa). Agent DILARANG `git add/commit/push`; developer manual setelah memeriksa diff. Tidak force-push, tidak push ke branch teman, tidak push langsung ke `main`/`dev`.
- Jangan mengarang nama koleksi/field di luar model data PRD Sprint 4; jika kurang, minta PM.
- Jangan menaruh server key Midtrans, service account, atau secret apa pun di file yang masuk git, log, komentar, atau pesan commit.
- Selalu unsubscribe listener; tangani loading/error/kosong; pesan error Bahasa Indonesia lewat `getErrorMessage`.
- Sebelum PR: jalankan `npx tsc --noEmit` dan `npx expo lint`; jika gagal karena file/konfigurasi milik orang lain, laporkan blocker, jangan diperbaiki sendiri.
- Konflik → berhenti, laporkan file dan dua perubahan yang bertabrakan; pemilik file memperbaiki setelah PM menyetujui.

## Bukti selesai dan pemeriksaan PM (Sprint 4)

- Tiap developer menyerahkan: daftar file berubah, fitur selesai, tabel hasil tes mandiri (lulus/gagal), kekurangan nyata. Dewa menambah tabel hasil uji Security Rules. Jangan klaim berhasil untuk yang belum diuji.
- PM (Mischa) memeriksa diff PR hanya berisi file milik pembuat PR, tanpa `.env*`, service account, atau server key.
- Urutan merge ke `dev`: **Dewa (Fase 0 dulu) → Andiny → Moses → Dewa (sisa fitur)** atau mengikuti kesiapan, dengan Fase 0 selalu pertama. Setelah tiap merge: `npx tsc --noEmit`, `npx expo lint`, lalu jalankan demo PRD terkait.
- Pengujian lintas modul wajib: Andiny set grace period/nominal → Moses melihat status keterlambatan sesuai konfigurasi; Moses presensi terlambat → Dewa memverifikasi tepat satu tagihan terbit; Dewa webhook sukses → tagihan `paid` terlihat di layar Moses (kehadiran tidak berubah) dan riwayat pembayaran praktikan; Andiny mengubah anggota lab → sesi/rekap Moses mengikuti.
- Periksa lebar 360/390, modal bisa ditutup, konten scroll, tombol tidak tertutup keyboard/safe area.
- Rilis/demo stabil dipromosikan `dev → main` oleh PM.

## Checklist pengujian per developer

### Dewa
- [ ] Role `aslab` didukung di tipe, route guard, seed, dan rules.
- [ ] Tagihan denda tepat satu per kejadian terlambat; izin disetujui membatalkan tagihan pending.
- [ ] Midtrans sandbox: transaksi via backend, webhook terverifikasi memperbarui status, webhook palsu ditolak, idempoten.
- [ ] Tidak ada secret di klien/git; alur client–server–gateway terpenuhi.
- [ ] Notifikasi tagihan/sukses/gagal hanya ke pemilik tagihan; riwayat pembayaran persisten.

### Andiny
- [ ] Single & bulk insert terpisah untuk 3 jenis data; 3 template unduhan benar.
- [ ] Review bulk: scroll view, accept/deny/update/isi kosong per row; hanya row accepted ter-commit.
- [ ] Pindah praktikan antar lab berjalan realtime; tidak ada perpindahan jadwal.
- [ ] Radius, grace period, dan nominal denda dapat diatur dan tersimpan.
- [ ] Dashboard lengkap dengan filter hari/minggu/bulan dari data Firestore.

### Moses
- [ ] Daftar kelas/jadwal/sesi tanggung jawab asprak tampil realtime.
- [ ] Buka/tutup sesi tersinkron realtime ke praktikan; transisi dan modal konfirmasi benar.
- [ ] Rekap membedakan Hadir/Terlambat/Izin/Belum hadir sesuai grace period dari `laboratories`.
- [ ] Izin disetujui tetap "Izin (excused)" dan tidak diubah menjadi hadir.
- [ ] Asprak tidak dapat mengubah lab/distribusi; listener dibersihkan.
