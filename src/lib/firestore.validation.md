# Firestore rules validation

Status: **LOCAL EMULATOR VERIFIED — 134/134 tests PASS, 7 suites, exit 0**. Nothing deployed. Production rules/accounts and device integration remain unverified.

## Latest verified run (supersedes historical blockers below)

- Firebase CLI `13.35.1` obtained through npm exec cache; Firestore emulator `1.19.8` started successfully with Java `17.0.18`, loopback `127.0.0.1:8080`, project `demo-prak06-rules`.
- First real run exposed duplicate Firebase App registries (`0.14.0` versus `0.16.7`): `Service firestore is not available`; 134 failed in setup. This was a dependency failure, not Rules rejection.
- Scoped npm override pins `@firebase/app` within `firebase` to `0.14.0`, matching Firebase `12.0.0`. Reinstalled through Expo; same security suite rerun without weakening assertions: **134 passed, 0 failed, 0 cancelled**.
- Command: `node --test --test-timeout=60000 src/lib/firestore.rules.test.cjs`. Log: `C:/Users/Dewangga Ramadhan H/AppData/Local/hermes/cache/scratch/prak06-rules-after-dedupe.log`.
- All seven A4 groups in table below now PASS locally, including get-before-create permission regression. Older NOT RUN rows below are historical results, not current status.
- `npx tsc --noEmit`: PASS after loading official `expo/types` ambient declarations from Dewa-owned `src/types/expo-env.d.ts`.
- Combined auth/review/route/seed local suite: 43 PASS after dependency correction.
- Full-source ESLint still identifies one pre-existing protected-file issue: `src/hooks/use-color-scheme.web.ts:11`, `react-hooks/set-state-in-effect`. Rule not disabled; protected source not edited.

## Historical initial attempt (retained for provenance)

Files: `firestore.rules`, `firebase.json`, `src/lib/firestore.rules.test.cjs`.

## Actual local execution

- Node `v22.23.2`; Java `17.0.18`.
- Firebase CLI, emulator JAR cache, `@firebase/rules-unit-testing`: absent.
- Loopback emulator `127.0.0.1:8080`: `ECONNREFUSED`.
- `node --check src/lib/firestore.rules.test.cjs`: exit 0.
- ESLint using installed `eslint-config-expo/flat` via `ESLint` API without config writes: suite passes, zero warnings.
- `node --test src/lib/firestore.rules.test.cjs`: exit 1, setup error `Firestore emulator unavailable at 127.0.0.1:8080; backend security tests NOT RUN`. Node reports 128 tests, 7 suites, 0 pass, 128 cancelled. Those cancellations are **not security denials**.
- Test written/run before rules. Initial run failed because rules file absent; no emulator means no behavioral RED/GREEN cycle proved.
- Whole-project `tsc --noEmit`: blocked by missing modules `@/components/offline-banner`, `@/context/auth-context`, `./animated-icon.module.css`, and side-effect import `@/global.css` at that run. Files outside ownership left alone.
- Whole-project Expo lint: failed on missing offline-banner, existing `react-hooks/set-state-in-effect` in `use-color-scheme.web.ts`, and initial test `__dirname` lint issue. Test issue fixed and owned suite relinted clean. Expo auto-created missing `eslint.config.js`; exact generated file removed, no replacement retained. Whole-project lint not rerun through Expo because it recreates out-of-scope config.
- No dependency installs, deploy, remote data writes, staging, commit, or push.

## Required A4 groups

| Group | Executable coverage | Backend result |
|---|---|---|
| 1. Anonymous reads/writes | Get/list/create/update/delete for all contract collections, attendance collection group | NOT RUN |
| 2. Praktikan writes classes/schedules/sessions | Denied creates/updates/deletes; positive asprak CRUD; authenticated class reads; class-scoped reads/queries | NOT RUN |
| 3. Cross-user reads | Other users/permissions denied, own filtered reads allowed; undeclared collection fallback denied | NOT RUN |
| 4. Attendance | Open-session transaction, absent own-doc read, timestamp; unopened/closed/missing/other-class/other-uid/duplicate/update/delete denied; own collection-group history; asprak recap | NOT RUN |
| 5. Permission submission | Exact field shape/docId/owner/class/session, 10/300 boundaries, decision nulls, server timestamp, predicted enums and nonpredicted null label; invalid/self changes denied | NOT RUN |
| 6. Asprak decisions | Pending to approved/rejected, null-label AI allowed; other-field changes, forged decision author/timestamp, repeat decisions denied | NOT RUN |
| 7. User class reassignment | Existing-class move allowed; new class reads effective and own attendance history retained; other-field/role/self/invalid-target edits denied | NOT RUN |

## Run when emulator available

Use disposable local emulator only. Suite rejects non-loopback hosts, uses fixed project `demo-prak06-rules`, loads this rules file through emulator management endpoint, and clears that demo project's default database before each test. Seed uses emulator `owner` token; client assertions use SDK emulator-only mock tokens, never Admin SDK bypass. It does not import app Firebase config or read credentials.

```sh
# Only after Firebase CLI and Java-compatible emulator are already provisioned:
firebase emulators:exec --only firestore --project demo-prak06-rules "node --test --test-timeout=60000 src/lib/firestore.rules.test.cjs"
# Or with already-running loopback emulator:
node --test --test-timeout=60000 src/lib/firestore.rules.test.cjs
```

No installs performed here. Newer emulator versions may need Java 21; installed Java 17 is not proof a future CLI/emulator pair works. Rules compile and query authorization remain unverified until real emulator or Rules Playground run.

## Query contract / security boundary

Read `origin/feature/praktikan-presensi-izin:src/services/presensi.ts` with `git show`. Actual service queries `collectionGroup(db, 'attendance')` with `where('uid', '==', uid)` and transaction-reads absent own attendance before create.

Rules version 2 has recursive **list-only** match for collection group `attendance`, restricted to seeded asprak or seeded praktikan's own `resource.data.uid`. It grants no recursive gets or writes and no access to other collection names. Attendance collection-group name is reserved: collection-group queries necessarily range over every collection named `attendance`, including any future unrelated collection with that same name. Do not reuse it for private unrelated data. Direct attendance gets/writes remain at `sessions/{sessionId}/attendance/{uid}`. Own historic attendance stays readable after class move.

Official references consulted:

- https://firebase.google.com/docs/firestore/security/rules-query
- https://firebase.google.com/docs/firestore/security/rules-fields
- https://firebase.google.com/docs/firestore/security/rules-structure
- https://firebase.google.com/docs/reference/rules/rules.firestore.Request
- https://firebase.google.com/docs/rules/unit-tests
- https://firebase.google.com/docs/emulator-suite/connect_firestore
- https://github.com/firebase/firebase-js-sdk/blob/main/packages/rules-unit-testing/src/impl/rules.ts

Schema validation of AI output does not authenticate client-side inference. Sentiment remains informational, never approval authority.
