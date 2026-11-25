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

function loadPresensi(overrides = {}) {
  const calls = {
    verifyArgs: [],
    onSnapshotArgs: [],
  };

  const verifyImpl =
    overrides.verifyAndRecordAttendance ??
    (async (_user, _sessionId, _coords) => ({
      success: true,
      distanceMeters: 18,
      message: 'Presensi berbasis lokasi berhasil dicatat.',
    }));

  const attendanceVerificationMock = {
    calculateHaversineDistanceMeters: () => 18,
    validateGeolocation: () => ({
      valid: true,
      distanceMeters: 18,
      reason: 'within_radius',
      message: 'ok',
    }),
    verifyAndRecordAttendance: async (...args) => {
      calls.verifyArgs.push(args);
      return verifyImpl(...args);
    },
  };

  const lokasiCode = transpileTs(new URL('./lokasi.ts', import.meta.url));
  const lokasiMod = { exports: {} };
  new Function('exports', 'require', 'module', lokasiCode)(
    lokasiMod.exports,
    (id) => {
      if (id === 'expo-location') return { Accuracy: { High: 4 } };
      if (id === 'react-native') return { Platform: { OS: 'android' }, Linking: {} };
      if (id === './attendance-verification') return attendanceVerificationMock;
      throw new Error(`Unexpected require in lokasi: ${id}`);
    },
    lokasiMod,
  );

  const errorsCode = transpileTs(new URL('../utils/errors.ts', import.meta.url));
  const errorsMod = { exports: {} };
  new Function('exports', 'require', 'module', errorsCode)(
    errorsMod.exports,
    () => {
      throw new Error('Unexpected require in errors');
    },
    errorsMod,
  );

  const fakeTimestamp = class Timestamp {
    constructor(date) {
      this._date = date;
    }
    toDate() {
      return this._date;
    }
  };

  const firestoreMock = {
    Timestamp: fakeTimestamp,
    collection: (_db, name) => ({ type: 'collection', name }),
    collectionGroup: (_db, name) => ({ type: 'collectionGroup', name }),
    doc: (_db, ...segments) => ({ type: 'doc', path: segments.join('/') }),
    query: (ref, ...constraints) => ({ ref, constraints }),
    where: (field, op, value) => ({ field, op, value }),
    runTransaction: async () => {},
    serverTimestamp: () => new Date(),
    onSnapshot: (target, onNext, onErr) => {
      calls.onSnapshotArgs.push({ target, onNext, onErr });
      return () => {};
    },
    ...overrides.firestore,
  };

  const presensiCode = transpileTs(new URL('./presensi.ts', import.meta.url));
  const presensiMod = { exports: {} };
  new Function('exports', 'require', 'module', presensiCode)(
    presensiMod.exports,
    (id) => {
      if (id === 'firebase/firestore') return firestoreMock;
      if (id === '../lib/firebase') return { db: {} };
      if (id === '../utils/errors') return errorsMod.exports;
      if (id === './attendance-verification') return attendanceVerificationMock;
      if (id === './lokasi') return lokasiMod.exports;
      throw new Error(`Unexpected require in presensi: ${id}`);
    },
    presensiMod,
  );

  return { mod: presensiMod.exports, calls, FakeTimestamp: fakeTimestamp };
}

const praktikanUser = {
  uid: 'u-andi',
  name: 'Andi',
  email: 'andi@praktikum.test',
  role: 'praktikan',
  classId: 'SI-5B',
};

const freshReading = () => ({
  latitude: -6.20005,
  longitude: 106.816666,
  accuracy: 12,
  timestamp: Date.now(),
});

test('markAttendanceWithLocation delegates to verifyAndRecordAttendance on valid input', async () => {
  const { mod, calls } = loadPresensi();
  const res = await mod.markAttendanceWithLocation(praktikanUser, 's2', freshReading(), {
    isOnline: true,
  });

  assert.equal(res.success, true);
  assert.equal(res.distanceMeters, 18);
  assert.equal(calls.verifyArgs.length, 1);
  assert.equal(calls.verifyArgs[0][0].uid, 'u-andi');
  assert.equal(calls.verifyArgs[0][1], 's2');
  assert.equal(calls.verifyArgs[0][2].accuracy, 12);
});

test('markAttendanceWithLocation rejects offline, wrong role, poor accuracy, and stale reading before backend call', async () => {
  const { mod, calls } = loadPresensi();

  await assert.rejects(
    () => mod.markAttendanceWithLocation(praktikanUser, 's2', freshReading(), { isOnline: false }),
    /offline/i,
  );

  await assert.rejects(
    () =>
      mod.markAttendanceWithLocation(
        { ...praktikanUser, role: 'asprak', classId: null },
        's2',
        freshReading(),
        { isOnline: true },
      ),
    /Hanya praktikan/i,
  );

  await assert.rejects(
    () =>
      mod.markAttendanceWithLocation(
        praktikanUser,
        's2',
        { ...freshReading(), accuracy: 550 },
        { isOnline: true },
      ),
    /Akurasi GPS/i,
  );

  await assert.rejects(
    () =>
      mod.markAttendanceWithLocation(
        praktikanUser,
        's2',
        { ...freshReading(), timestamp: Date.now() - 120_000 },
        { isOnline: true },
      ),
    /lebih dari/i,
  );

  assert.equal(calls.verifyArgs.length, 0);
});

test('markAttendanceWithLocation maps Firestore permission-denied and preserves domain rejection errors', async () => {
  const denied = loadPresensi({
    verifyAndRecordAttendance: async () => {
      const err = new Error('Missing or insufficient permissions');
      err.code = 'permission-denied';
      throw err;
    },
  });
  await assert.rejects(
    () => denied.mod.markAttendanceWithLocation(praktikanUser, 's2', freshReading()),
    /Presensi ditolak sistem/i,
  );

  const outside = loadPresensi({
    verifyAndRecordAttendance: async () => {
      throw new Error('Anda berada di luar area laboratorium (120m dari lab, batas maksimal 50m).');
    },
  });
  await assert.rejects(
    () => outside.mod.markAttendanceWithLocation(praktikanUser, 's2', freshReading()),
    /di luar area laboratorium/i,
  );
});

test('subscribeMySessions and subscribeMyAttendance preserve Sprint 3 labId and geolocation metadata', () => {
  const { mod, calls, FakeTimestamp } = loadPresensi();
  let sessions = [];
  let attendance = [];

  mod.subscribeMySessions(
    'SI-5B',
    (items) => {
      sessions = items;
    },
    () => {},
  );
  mod.subscribeMyAttendance(
    'u-andi',
    (items) => {
      attendance = items;
    },
    () => {},
  );

  const now = new Date('2026-11-25T09:00:00Z');
  calls.onSnapshotArgs[0].onNext({
    docs: [
      {
        id: 's2',
        data: () => ({
          classId: 'SI-5B',
          scheduleId: 'sch2',
          title: 'Basis Data',
          date: '2026-11-25',
          startTime: '10:00',
          endTime: '11:40',
          status: 'dibuka',
          labId: 'lab-1',
          openedAt: new FakeTimestamp(now),
          closedAt: null,
        }),
      },
    ],
  });

  calls.onSnapshotArgs[1].onNext({
    docs: [
      {
        ref: { parent: { parent: { id: 's2' } } },
        data: () => ({
          uid: 'u-andi',
          name: 'Andi',
          classId: 'SI-5B',
          attendedAt: new FakeTimestamp(now),
          verificationMethod: 'geolocation',
          distanceMeters: 22,
          validatedAt: new FakeTimestamp(now),
        }),
      },
    ],
  });

  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].labId, 'lab-1');
  assert.equal(attendance.length, 1);
  assert.equal(attendance[0].sessionId, 's2');
  assert.equal(attendance[0].verificationMethod, 'geolocation');
  assert.equal(attendance[0].distanceMeters, 22);
});
