import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

function transpileTs(url) {
  const source = readFileSync(url, 'utf8');
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
}

function loadKeterlambatan(overrides = {}) {
  const onSnapshotCalls = [];

  class FakeTimestamp {
    constructor(date) {
      this._date = date;
    }
    toDate() {
      return this._date;
    }
  }

  const firestoreMock = {
    Timestamp: FakeTimestamp,
    collection: (_db, ...segments) => ({ type: 'collection', path: segments.join('/') }),
    collectionGroup: (_db, name) => ({ type: 'collectionGroup', name }),
    doc: (_db, ...segments) => ({ type: 'doc', path: segments.join('/') }),
    query: (ref, ...constraints) => ({ ref, constraints }),
    where: (field, op, value) => ({ field, op, value }),
    onSnapshot: (target, onNext, onErr) => {
      onSnapshotCalls.push({ target, onNext, onErr });
      return () => {};
    },
    ...overrides.firestore,
  };

  const code = transpileTs(new URL('./keterlambatan.ts', import.meta.url));
  const mod = { exports: {} };
  new Function('exports', 'require', 'module', code)(
    mod.exports,
    (id) => {
      if (id === 'firebase/firestore') return firestoreMock;
      if (id === '../lib/firebase') return { db: {} };
      throw new Error(`Unexpected require in keterlambatan: ${id}`);
    },
    mod,
  );

  return { mod: mod.exports, onSnapshotCalls, FakeTimestamp };
}

test('parseSessionStartTimestamp parses Asia/Jakarta date+time and rejects invalid values', () => {
  const { mod } = loadKeterlambatan();
  const validMs = mod.parseSessionStartTimestamp('2026-11-28', '08:00');
  assert.equal(validMs, Date.parse('2026-11-28T08:00:00+07:00'));

  assert.equal(mod.parseSessionStartTimestamp('2026-02-30', '08:00'), null);
  assert.equal(mod.parseSessionStartTimestamp('2026-11-28', '25:00'), null);
  assert.equal(mod.parseSessionStartTimestamp('', '08:00'), null);
});

test('resolveAttendanceStatus handles before grace, exact grace boundary, and 1 min after grace', () => {
  const { mod } = loadKeterlambatan();
  const baseSession = {
    uid: 'u-andi',
    name: 'Andi',
    classId: 'SI-5B',
    sessionDate: '2026-11-28',
    sessionStartTime: '08:00',
  };

  // 1. Sebelum akhir grace period (08:10, grace 15 menit) -> hadir tepat waktu
  const onTimeBefore = {
    ...baseSession,
    attendedAt: new Date('2026-11-28T08:10:00+07:00'),
  };
  assert.equal(mod.resolveAttendanceStatus(onTimeBefore, false, 15), 'hadir');

  // 2. Tepat di akhir grace period (08:15:00, grace 15 menit) -> hadir tepat waktu
  const exactGraceEnd = {
    ...baseSession,
    attendedAt: new Date('2026-11-28T08:15:00+07:00'),
  };
  assert.equal(mod.resolveAttendanceStatus(exactGraceEnd, false, 15), 'hadir');
  assert.equal(mod.evaluateAttendanceLateness(exactGraceEnd, 15).lateMinutes, 0);

  // 3. Terlambat 1 menit setelah grace period (08:16:00, grace 15 menit) -> terlambat
  const oneMinPastGrace = {
    ...baseSession,
    attendedAt: new Date('2026-11-28T08:16:00+07:00'),
  };
  assert.equal(mod.resolveAttendanceStatus(oneMinPastGrace, false, 15), 'terlambat');
  const evalLate = mod.evaluateAttendanceLateness(oneMinPastGrace, 15);
  assert.equal(evalLate.onTime, false);
  assert.equal(evalLate.lateMinutes, 16);

  // 4. Perubahan konfigurasi grace period dari laboratories mengubah evaluasi
  assert.equal(mod.resolveAttendanceStatus(onTimeBefore, false, 5), 'terlambat');
});

test('resolveAttendanceStatus respects backend onTime/lateMinutes and treats approved izin as excused', () => {
  const { mod } = loadKeterlambatan();

  // Backend mengisi onTime: false, lateMinutes: 9
  const backendLate = {
    uid: 'u-budi',
    name: 'Budi',
    classId: 'SI-5A',
    attendedAt: new Date('2026-11-28T08:09:00+07:00'),
    onTime: false,
    lateMinutes: 9,
  };
  assert.equal(mod.resolveAttendanceStatus(backendLate, false, 20), 'terlambat');
  assert.equal(mod.evaluateAttendanceLateness(backendLate, 20).lateMinutes, 9);

  // Tanpa presensi + izin disetujui -> izin (excused, BUKAN hadir)
  assert.equal(
    mod.resolveAttendanceStatus(null, [{ uid: 'u-citra', status: 'disetujui' }], 15),
    'izin',
  );

  // Presensi terlambat lalu izin disetujui -> tetap izin (excused, bebas denda, tidak jadi hadir)
  assert.equal(
    mod.resolveAttendanceStatus(backendLate, new Set(['u-budi']), 15),
    'izin',
  );

  // Izin masih menunggu & belum presensi -> belum_hadir
  assert.equal(
    mod.resolveAttendanceStatus(null, [{ uid: 'u-dina', status: 'menunggu' }], 15),
    'belum_hadir',
  );
});

test('buildSessionRecap keeps terlambat status even after fine is paid', () => {
  const { mod } = loadKeterlambatan();

  const { rows, summary } = mod.buildSessionRecap({
    roster: [
      { uid: 'u-1', name: 'Andi', classId: 'SI-5A' },
      { uid: 'u-2', name: 'Budi', classId: 'SI-5A' },
      { uid: 'u-3', name: 'Citra', classId: 'SI-5A' },
      { uid: 'u-4', name: 'Dina', classId: 'SI-5A' },
    ],
    attendanceList: [
      {
        uid: 'u-1',
        name: 'Andi',
        classId: 'SI-5A',
        attendedAt: new Date('2026-11-28T08:05:00+07:00'),
        onTime: true,
        lateMinutes: 0,
      },
      {
        uid: 'u-2',
        name: 'Budi',
        classId: 'SI-5A',
        attendedAt: new Date('2026-11-28T08:22:00+07:00'),
        onTime: false,
        lateMinutes: 22,
      },
    ],
    approvedPermissions: [
      {
        uid: 'u-3',
        name: 'Citra',
        classId: 'SI-5A',
        reason: 'Sakit demam dan surat dokter',
        status: 'disetujui',
      },
    ],
    fines: [
      {
        id: 'fine-budi',
        uid: 'u-2',
        name: 'Budi',
        sessionId: 's1',
        sessionTitle: 'Pemrograman Bergerak',
        attendancePath: 'sessions/s1/attendance/u-2',
        amount: 15000,
        status: 'paid',
        canceledReason: null,
        createdAt: new Date('2026-11-28T08:22:05+07:00'),
        updatedAt: new Date('2026-11-28T09:00:00+07:00'),
      },
    ],
    session: { date: '2026-11-28', startTime: '08:00' },
    gracePeriodMinutes: 10,
  });

  assert.deepEqual(summary, {
    hadir: 1,
    terlambat: 1,
    izin: 1,
    belumHadir: 1,
    total: 4,
  });

  const budiRow = rows.find((r) => r.uid === 'u-2');
  assert.ok(budiRow);
  assert.equal(budiRow.status, 'terlambat');
  assert.equal(budiRow.lateMinutes, 22);
  assert.equal(budiRow.fine?.status, 'paid');

  const citraRow = rows.find((r) => r.uid === 'u-3');
  assert.ok(citraRow);
  assert.equal(citraRow.status, 'izin');
  assert.equal(citraRow.attendedAt, null);
});

test('subscribeMyFinesSummary degrades gracefully when collection fines returns permission-denied', () => {
  const { mod, onSnapshotCalls } = loadKeterlambatan();
  let received = null;
  let meta = null;
  let errorCalled = false;

  mod.subscribeMyFinesSummary(
    'u-andi',
    (items, nextMeta) => {
      received = items;
      meta = nextMeta;
    },
    () => {
      errorCalled = true;
    },
  );

  assert.equal(onSnapshotCalls.length, 1);
  const permDenied = new Error('Missing or insufficient permissions');
  permDenied.code = 'permission-denied';
  onSnapshotCalls[0].onErr(permDenied);

  assert.deepEqual(received, []);
  assert.deepEqual(meta, { rulesReady: false });
  assert.equal(errorCalled, false);
});
