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

function loadSesi(overrides = {}) {
  const onSnapshotCalls = [];
  const txUpdates = [];

  class FakeTimestamp {
    constructor(date) {
      this._date = date;
    }
    toDate() {
      return this._date;
    }
  }

  const sessionSnapData = overrides.sessionSnapData ?? {
    exists: true,
    data: {
      classId: 'SI-5A',
      scheduleId: 'sch-1',
      title: 'Pemrograman Bergerak',
      date: '2026-11-28',
      startTime: '08:00',
      endTime: '09:40',
      status: 'belum_dibuka',
      labId: 'lab-1',
    },
  };

  const firestoreMock = {
    Timestamp: FakeTimestamp,
    collection: (_db, ...segments) => ({ type: 'collection', path: segments.join('/') }),
    collectionGroup: (_db, name) => ({ type: 'collectionGroup', name }),
    doc: (_db, ...segments) => ({
      type: 'doc',
      path: segments.join('/'),
      id: segments[segments.length - 1],
    }),
    query: (ref, ...constraints) => ({ ref, constraints }),
    where: (field, op, value) => ({ field, op, value }),
    serverTimestamp: () => 'SERVER_TS',
    runTransaction: async (_db, handler) => {
      const tx = {
        get: async (ref) => ({
          id: ref.id,
          exists: () => sessionSnapData.exists,
          data: () => sessionSnapData.data,
        }),
        update: (ref, payload) => {
          txUpdates.push({ path: ref.path, payload });
        },
      };
      return handler(tx);
    },
    onSnapshot: (target, onNext, onErr) => {
      onSnapshotCalls.push({ target, onNext, onErr });
      return () => {};
    },
    ...overrides.firestore,
  };

  const errorsCode = transpileTs(new URL('../utils/errors.ts', import.meta.url));
  const errorsMod = { exports: {} };
  new Function('exports', 'require', 'module', errorsCode)(
    errorsMod.exports,
    () => {
      throw new Error('Unexpected require in errors');
    },
    errorsMod,
  );

  const keterlambatanCode = transpileTs(new URL('./keterlambatan.ts', import.meta.url));
  const keterlambatanMod = { exports: {} };
  new Function('exports', 'require', 'module', keterlambatanCode)(
    keterlambatanMod.exports,
    (id) => {
      if (id === 'firebase/firestore') return firestoreMock;
      if (id === '../lib/firebase') return { db: {} };
      throw new Error(`Unexpected require in keterlambatan: ${id}`);
    },
    keterlambatanMod,
  );

  const authMock =
    overrides.auth !== undefined
      ? overrides.auth
      : { currentUser: { uid: 'uid-rina' } };

  const sesiCode = transpileTs(new URL('./sesi.ts', import.meta.url));
  const sesiMod = { exports: {} };
  new Function('exports', 'require', 'module', sesiCode)(
    sesiMod.exports,
    (id) => {
      if (id === 'firebase/firestore') return firestoreMock;
      if (id === '../lib/firebase') return { db: {}, auth: authMock };
      if (id === '../utils/errors') return errorsMod.exports;
      if (id === './keterlambatan') return keterlambatanMod.exports;
      throw new Error(`Unexpected require in sesi: ${id}`);
    },
    sesiMod,
  );

  return { mod: sesiMod.exports, onSnapshotCalls, txUpdates, FakeTimestamp };
}

test('filterSessionsForAsprak scopes strictly to assigned laboratories when Sprint 4 membership exists', () => {
  const { mod } = loadSesi();

  const allSessions = [
    {
      id: 's1',
      classId: 'SI-5A',
      scheduleId: null,
      title: 'PPK Lab 1',
      date: '2026-11-28',
      startTime: '08:00',
      endTime: '09:40',
      status: 'belum_dibuka',
      openedAt: null,
      closedAt: null,
      labId: 'lab-1',
      createdBy: 'uid-other',
    },
    {
      id: 's2',
      classId: 'SI-5B',
      scheduleId: null,
      title: 'Basis Data Lab 2',
      date: '2026-11-28',
      startTime: '10:00',
      endTime: '11:40',
      status: 'dibuka',
      openedAt: null,
      closedAt: null,
      labId: 'lab-2',
      createdBy: 'uid-other',
    },
  ];

  const assigned = mod.filterSessionsForAsprak({
    asprakUid: 'uid-rina',
    allSessions,
    probes: [
      { labId: 'lab-1', isMember: true, subcollectionReadable: true },
      { labId: 'lab-2', isMember: false, subcollectionReadable: true },
    ],
  });

  assert.equal(assigned.mode, 'assigned_labs');
  assert.deepEqual(assigned.assignedLabIds, ['lab-1']);
  assert.equal(assigned.sessions.length, 1);
  assert.equal(assigned.sessions[0].id, 's1');

  // Rules aktif tetapi Asprak belum ditugaskan ke lab mana pun -> unassigned kosong
  const unassigned = mod.filterSessionsForAsprak({
    asprakUid: 'uid-baru',
    allSessions,
    probes: [
      { labId: 'lab-1', isMember: false, subcollectionReadable: true },
      { labId: 'lab-2', isMember: false, subcollectionReadable: true },
    ],
  });
  assert.equal(unassigned.mode, 'unassigned');
  assert.equal(unassigned.sessions.length, 0);
});

test('openSession and closeSession enforce belum_dibuka -> dibuka -> ditutup transitions', async () => {
  // 1. belum_dibuka -> dibuka berhasil
  const openOk = loadSesi({
    sessionSnapData: {
      exists: true,
      data: {
        classId: 'SI-5A',
        title: 'Sesi 1',
        date: '2026-11-28',
        startTime: '08:00',
        endTime: '09:40',
        status: 'belum_dibuka',
      },
    },
  });
  await openOk.mod.openSession('s1');
  assert.equal(openOk.txUpdates.length, 1);
  assert.deepEqual(openOk.txUpdates[0], {
    path: 'sessions/s1',
    payload: { status: 'dibuka', openedAt: 'SERVER_TS' },
  });

  // 2. dibuka -> ditutup berhasil
  const closeOk = loadSesi({
    sessionSnapData: {
      exists: true,
      data: {
        classId: 'SI-5A',
        title: 'Sesi 1',
        date: '2026-11-28',
        startTime: '08:00',
        endTime: '09:40',
        status: 'dibuka',
      },
    },
  });
  await closeOk.mod.closeSession('s1');
  assert.equal(closeOk.txUpdates.length, 1);
  assert.deepEqual(closeOk.txUpdates[0], {
    path: 'sessions/s1',
    payload: { status: 'ditutup', closedAt: 'SERVER_TS' },
  });

  // 3. Sesi ditutup tidak boleh dibuka ulang
  const reopenClosed = loadSesi({
    sessionSnapData: {
      exists: true,
      data: {
        classId: 'SI-5A',
        title: 'Sesi 1',
        date: '2026-11-28',
        startTime: '08:00',
        endTime: '09:40',
        status: 'ditutup',
      },
    },
  });
  await assert.rejects(
    () => reopenClosed.mod.openSession('s1'),
    /ditutup secara permanen/i,
  );
  assert.equal(reopenClosed.txUpdates.length, 0);

  // 4. Tanpa autentikasi ditolak
  const unauth = loadSesi({ auth: { currentUser: null } });
  await assert.rejects(() => unauth.mod.openSession('s1'), /login/i);
});

test('subscribeSessionAttendance maps onTime and lateMinutes from Firestore documents', () => {
  const { mod, onSnapshotCalls, FakeTimestamp } = loadSesi();
  let rows = [];

  mod.subscribeSessionAttendance(
    's1',
    (items) => {
      rows = items;
    },
    () => {},
  );

  const attendedAt = new Date('2026-11-28T08:20:00+07:00');
  onSnapshotCalls[0].onNext({
    docs: [
      {
        id: 'u-budi',
        data: () => ({
          uid: 'u-budi',
          name: 'Budi',
          classId: 'SI-5A',
          attendedAt: new FakeTimestamp(attendedAt),
          onTime: false,
          lateMinutes: 20,
          verificationMethod: 'geolocation',
          distanceMeters: 14,
        }),
      },
    ],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].uid, 'u-budi');
  assert.equal(rows[0].onTime, false);
  assert.equal(rows[0].lateMinutes, 20);
  assert.equal(rows[0].distanceMeters, 14);
});

test('subscribeSessionRoster prioritizes laboratories/{labId}/praktikan over class fallback', () => {
  const { mod, onSnapshotCalls } = loadSesi();
  let latestRoster = [];
  let latestSource = null;

  mod.subscribeSessionRoster(
    { classId: 'SI-5A', labId: 'lab-1' },
    (roster, source) => {
      latestRoster = roster;
      latestSource = source;
    },
    () => {},
  );

  // Listener 0: laboratories/lab-1/praktikan, Listener 1: users where classId == SI-5A
  assert.equal(onSnapshotCalls.length, 2);

  // Saat subkoleksi lab belum ada (kosong), gunakan class_users
  onSnapshotCalls[0].onNext({ docs: [] });
  onSnapshotCalls[1].onNext({
    docs: [
      { id: 'u-1', data: () => ({ name: 'Andi', classId: 'SI-5A' }) },
      { id: 'u-2', data: () => ({ name: 'Budi', classId: 'SI-5A' }) },
    ],
  });
  assert.equal(latestSource, 'class_users');
  assert.equal(latestRoster.length, 2);

  // Begitu Aslab mendistribusikan anggota ke subkoleksi lab, rekap langsung mengikuti lab_members
  onSnapshotCalls[0].onNext({
    docs: [{ id: 'u-1', data: () => ({ uid: 'u-1', name: 'Andi', classId: 'SI-5A' }) }],
  });
  assert.equal(latestSource, 'lab_members');
  assert.equal(latestRoster.length, 1);
  assert.equal(latestRoster[0].uid, 'u-1');
});
