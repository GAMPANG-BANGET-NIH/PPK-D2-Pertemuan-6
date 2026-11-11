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
| A. Fondasi Firebase, Auth, AI, Security Rules, Review Izin | **Dewa** | `feature/firebase-auth-ai` |
| B. Pengelolaan praktikum Asprak (CRUD, buka/tutup sesi, rekap realtime, pindah kelas) | **Mischa** | `feature/asprak-praktikum` |
| C. Sisi Praktikan (jadwal/sesi kelasnya, presensi, pengajuan & pantau izin) | **Andiny** | `feature/praktikan-presensi-izin` |

## Urutan kerja (penting: ada satu ketergantungan)
1. **Fase 0 — Fondasi (Dewa, dikerjakan PERTAMA):** `package.json` + dependency, `src/lib/firebase.ts`, `src/types/index.ts`, `AuthContext`, route guard, login, seed data, `.env.example`. PM merge ke `dev` secepat mungkin; Mischa dan Andiny `merge origin/dev` ke branch masing-masing begitu tersedia. Target: selesai paling awal, sebelum fitur lain butuh menguji dengan Firebase sungguhan.
2. **Fase 1 — Paralel:** Mischa dan Andiny **boleh langsung mulai** menulis UI, hook, dan service berdasarkan kontrak di bawah tanpa menunggu Fase 0 (impor dari path kontrak). Pengujian dengan Firestore sungguhan menunggu Fase 0 di-merge. Dewa melanjutkan AI, Rules, Review Izin.
3. **Fase 2 — Integrasi (PM + semua):** merge satu per satu, jalankan **Demo PM Sprint 2** di `PRD.md`, perbaiki bug lintas fitur oleh pemilik modulnya.

## Kepemilikan file Sprint 2 — tidak boleh overlap
Path relatif root repository. File di luar daftar milik sendiri **tidak boleh disentuh**, termasuk `src/app/explore.tsx`, `src/features/jadwal.tsx`, `AGENTS.md`, tema global, dan komponen starter.

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
export type AiResult  = { status: 'ok' | 'gagal' | 'timeout'; category: string | null; model: string | null };
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
export function classifyReason(reason: string): Promise<AiResult>;   // TIDAK PERNAH melempar; timeout 10 dtk -> {status:'timeout'}, error -> {status:'gagal'}
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

**A2. Integrasi AI (#6)**
- Dewa menerima API dari pengajar dan **mengelola API key** (`EXPO_PUBLIC_AI_API_URL`, `EXPO_PUBLIC_AI_API_KEY` di `.env.local`; tidak pernah di-commit, tidak di-log, tidak ditulis di dokumen/PR).
- `src/services/ai.ts` → `classifyReason(reason)`: kirim alasan ke API, petakan respons ke `AiResult` (`category`, `model`). Timeout 10 dtk (`AbortController`). **Tidak pernah melempar**; kegagalan → `status 'gagal'`, timeout → `'timeout'`, respons tak valid → `'gagal'`.
- Dokumentasikan format request/response API di komentar header file (agar teman bisa memahami) dan umumkan ke PM bila daftar kategori diketahui.
- Catat batasan: hasil AI hanya informasi pendukung dan tidak mengubah `status` izin.

**A3. Review izin Asprak (#7)**
- `src/services/izin-review.ts` + `src/features/izin-review.tsx` + `src/app/asisten-izin.tsx` (rute khusus Asprak).
- Daftar izin realtime: nama, kelas, sesi, alasan, **kategori AI** (atau "Klasifikasi tidak tersedia"), status, waktu. Filter status (Semua/Menunggu/Disetujui/Ditolak), kondisi kosong/loading/error.
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

**Tes mandiri Dewa:** login benar/salah/kosong; tutup-buka app tetap login; logout; user tanpa dokumen `users`; rute dijaga per peran; AI normal, API mati, timeout, respons rusak; review izin setujui/tolak; seed dijalankan dua kali tanpa duplikat.

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
  2. panggil `classifyReason(reason)` milik Dewa (tidak pernah melempar);
  3. tulis **satu dokumen** `permissions/{sessionId}_{uid}` berisi `status:'menunggu'`, `aiResult` hasil AI, `decidedBy/decidedAt: null`, `createdAt: serverTimestamp()`. Jika dokumen sudah ada, tolak dengan pesan "Anda sudah mengajukan izin untuk sesi ini".
  - Pengajuan **tidak boleh bergantung pada AI**: bila AI gagal/timeout, pengajuan tetap disimpan.
- `/izin` (`src/features/izin-praktikan.tsx`): form pilih sesi (atau dari `sessionId`), isi alasan dengan penghitung karakter, tombol kirim (nonaktif saat memproses; tampilkan "Mengklasifikasi…" lalu hasil). Bagian **Riwayat pengajuan** realtime: sesi, alasan, status (Menunggu/Disetujui/Ditolak), kategori AI sebagai info pendukung (atau "Klasifikasi tidak tersedia"), waktu. Status berubah otomatis saat Asprak memutuskan.
- Tes mandiri: presensi saat dibuka berhasil; belum dibuka/ditutup ditolak; ketukan ganda dan presensi kedua tidak membuat duplikat; sesi kelas lain tidak tampil; status sesi berubah realtime dari perangkat Asprak; izin dengan AI normal, AI mati, timeout; alasan kosong/terlalu pendek/terlalu panjang; izin ganda untuk sesi sama ditolak; status izin berubah realtime setelah diputuskan; offline menolak aksi; tutup-buka app data tetap.

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
