/* global __dirname */
/*
 * Run: node --test src/lib/firestore.rules.test.cjs
 * Requires running Firestore emulator, NOT credentials or rules-unit-testing.
 * Only loopback accepted. Clears ONLY demo-prak06-rules/(default) before tests.
 * Backend absent/compile error fails setup; never skips or substitutes a mock.
 * SDK mockUserToken + emulator owner token documented at:
 * https://firebase.google.com/docs/reference/js/firestore#emulatorsettings
 * https://firebase.google.com/docs/rules/unit-tests
 * Emulator rules-loading endpoint matches Firebase rules-unit-testing:
 * https://github.com/firebase/firebase-js-sdk/blob/main/packages/rules-unit-testing/src/impl/rules.ts
 */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { after, before, beforeEach, describe, it } = require('node:test');
const { deleteApp, initializeApp } = require('firebase/app');
const {
  Timestamp, collection, collectionGroup, connectFirestoreEmulator, deleteDoc,
  deleteField, doc, getDocFromServer, getDocsFromServer, getFirestore, query,
  runTransaction, serverTimestamp, setDoc, setLogLevel, terminate, updateDoc,
  where, writeBatch,
} = require('firebase/firestore');

const projectId = 'demo-prak06-rules';
const root = resolve(__dirname, '../..');
const address = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const endpoint = /^(127\.0\.0\.1|localhost):(\d+)$/.exec(address);
assert.ok(endpoint, 'Refusing non-loopback FIRESTORE_EMULATOR_HOST');
const host = endpoint[1];
const port = Number(endpoint[2]);
assert.ok(port > 0 && port <= 65535, 'Invalid emulator port');
const base = `http://${host}:${port}`;
const clients = new Map();
const stamp = Timestamp.fromMillis(1000);
const predicted = { status: 'predicted', label: 'positif', model: 'model-edom', experimental: true };
const unavailable = { ...predicted, status: 'unknown_vocabulary', label: null };

function client(uid) {
  if (!clients.has(uid)) {
    const app = initializeApp({ projectId }, `${projectId}-${uid || 'anonymous'}`);
    const db = getFirestore(app);
    const token = uid === '__seed__' ? 'owner' : {
      sub: uid,
      ...(uid === 'forged-asprak' ? { role: 'asprak', admin: true } : {}),
    };
    connectFirestoreEmulator(db, host, port, uid ? { mockUserToken: token } : {});
    clients.set(uid, { app, db });
  }
  return clients.get(uid).db;
}

async function emulatorRequest(path, method, body) {
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    throw new Error(`Firestore emulator unavailable at ${address}; backend security tests NOT RUN`, { cause: error });
  }
  assert.ok(response.ok, `Emulator ${method} ${path}: ${response.status} ${await response.text()}`);
}

function attendance(overrides = {}) {
  return { uid: 'andi', name: 'Andi', classId: 'SI-5B', attendedAt: serverTimestamp(), ...overrides };
}

function permission(overrides = {}) {
  return {
    uid: 'andi', name: 'Andi', classId: 'SI-5B', sessionId: 'open', sessionTitle: 'Sesi open',
    reason: 'Sakit demam dengan surat dokter', status: 'menunggu', aiResult: predicted,
    decidedBy: null, decidedAt: null, createdAt: serverTimestamp(), ...overrides,
  };
}

function decision(status = 'disetujui', overrides = {}) {
  return { status, decidedBy: 'rina', decidedAt: serverTimestamp(), ...overrides };
}

function deny(operation) {
  // unavailable/invalid-argument/failed-precondition are NOT security denials.
  return assert.rejects(operation, (error) => error.code === 'permission-denied');
}

function session(id, classId = 'SI-5B', status = 'dibuka') {
  return {
    classId, scheduleId: null, title: `Sesi ${id}`, date: '2026-11-17', startTime: '08:00',
    endTime: '09:40', status, openedAt: null, closedAt: null, createdBy: 'rina', createdAt: stamp,
  };
}

function schedule(classId) {
  return { classId, course: 'Praktikum', dayOfWeek: 2, startTime: '08:00', endTime: '09:40', room: 'Lab', createdAt: stamp };
}

before(async () => {
  const rules = readFileSync(resolve(root, 'firestore.rules'), 'utf8');
  const config = JSON.parse(readFileSync(resolve(root, 'firebase.json'), 'utf8'));
  assert.equal(config.firestore.rules, 'firestore.rules');
  await emulatorRequest(`/emulator/v1/projects/${projectId}:securityRules`, 'PUT', {
    rules: { files: [{ name: 'firestore.rules', content: rules }] },
  });
  // Expected denied writes are asserted below; suppress their SDK log noise only.
  setLogLevel('silent');
}, { timeout: 10000 });

beforeEach(async () => {
  await emulatorRequest(`/emulator/v1/projects/${projectId}/databases/(default)/documents`, 'DELETE');
  const fixtures = {
    'classes/SI-5A': { name: 'SI-5A', createdAt: stamp },
    'classes/SI-5B': { name: 'SI-5B', createdAt: stamp },
    'schedules/a': schedule('SI-5A'),
    'schedules/b': schedule('SI-5B'),
    'sessions/open': session('open'),
    'sessions/unopened': session('unopened', 'SI-5B', 'belum_dibuka'),
    'sessions/closed': session('closed', 'SI-5B', 'ditutup'),
    'sessions/other': session('other', 'SI-5A'),
    'sessions/history': session('history', 'SI-5B', 'ditutup'),
    'sessions/review': session('review', 'SI-5B', 'belum_dibuka'),
    'sessions/history/attendance/andi': attendance({ attendedAt: stamp }),
    'sessions/history/attendance/dina': attendance({ uid: 'dina', name: 'Dina', attendedAt: stamp }),
    'sessions/other/attendance/budi': attendance({ uid: 'budi', name: 'Budi', classId: 'SI-5A', attendedAt: stamp }),
    'permissions/review_andi': permission({ sessionId: 'review', sessionTitle: 'Sesi review', createdAt: stamp }),
    'permissions/other_budi': permission({ uid: 'budi', name: 'Budi', classId: 'SI-5A', sessionId: 'other', sessionTitle: 'Sesi other', createdAt: stamp }),
    'permissions/closed_andi': permission({ sessionId: 'closed', sessionTitle: 'Sesi closed', status: 'disetujui', decidedBy: 'rina', decidedAt: stamp, createdAt: stamp }),
  };
  for (const [uid, name, role, classId] of [
    ['rina', 'Rina', 'asprak', null], ['andi', 'Andi', 'praktikan', 'SI-5B'],
    ['budi', 'Budi', 'praktikan', 'SI-5A'], ['dina', 'Dina', 'praktikan', 'SI-5B'],
  ]) {
    fixtures[`users/${uid}`] = { name, email: `${uid}@praktikum.test`, role, classId, createdAt: stamp };
  }
  const db = client('__seed__');
  const batch = writeBatch(db);
  for (const [path, value] of Object.entries(fixtures)) batch.set(doc(db, path), value);
  await batch.commit();
}, { timeout: 15000 });

after(async () => {
  await Promise.all([...clients.values()].map(async ({ db, app }) => {
    await terminate(db);
    await deleteApp(app);
  }));
});

// Seven groups mirror docs/PEMBAGIAN.md, Dewa A4, verbatim in scope.
describe('1. Tanpa login baca/tulis apa pun', { concurrency: false }, () => {
  for (const path of ['users/andi', 'classes/SI-5B', 'schedules/b', 'sessions/open', 'permissions/review_andi', 'sessions/history/attendance/andi']) {
    it(`denies anonymous get/create/update/delete: ${path}`, async () => {
      const db = client(null);
      await deny(getDocFromServer(doc(db, path)));
      await deny(setDoc(doc(db, `${path}-new`), { uid: 'andi' }));
      await deny(updateDoc(doc(db, path), { uid: 'andi' }));
      await deny(deleteDoc(doc(db, path)));
    });
  }
  it('denies anonymous lists including owner-filtered collectionGroup', async () => {
    const db = client(null);
    for (const path of ['users', 'classes', 'schedules', 'sessions', 'permissions', 'sessions/history/attendance']) {
      await deny(getDocsFromServer(collection(db, path)));
    }
    await deny(getDocsFromServer(query(collectionGroup(db, 'attendance'), where('uid', '==', 'andi'))));
  });
});

describe('2. Praktikan menulis classes/schedules/sessions', { concurrency: false }, () => {
  for (const [name, id, data] of [
    ['classes', 'SI-5B', { name: 'Baru', createdAt: stamp }],
    ['schedules', 'b', schedule('SI-5B')],
    ['sessions', 'open', session('new')],
  ]) {
    it(`denies praktikan CRUD writes to ${name}`, async () => {
      const db = client('andi');
      await deny(setDoc(doc(db, name, 'new'), data));
      await deny(updateDoc(doc(db, name, id), data));
      await deny(deleteDoc(doc(db, name, id)));
    });
    it(`allows asprak CRUD in ${name}`, async () => {
      const db = client('rina');
      const ref = doc(db, name, 'new');
      await setDoc(ref, data);
      assert.ok((await getDocFromServer(ref)).exists());
      await updateDoc(ref, data);
      await deleteDoc(ref);
      assert.equal((await getDocFromServer(ref)).exists(), false);
    });
  }
  it('allows authenticated class reads, even without seeded profile', async () => {
    for (const uid of ['andi', 'rina', 'unseeded']) {
      assert.equal((await getDocsFromServer(collection(client(uid), 'classes'))).size, 2);
    }
  });
  for (const [name, ownId, otherId] of [['schedules', 'b', 'a'], ['sessions', 'open', 'other']]) {
    it(`enforces class-scoped ${name} reads and queries`, async () => {
      const db = client('andi');
      await getDocFromServer(doc(db, name, ownId));
      await deny(getDocFromServer(doc(db, name, otherId)));
      assert.ok((await getDocsFromServer(query(collection(db, name), where('classId', '==', 'SI-5B')))).size > 0);
      await deny(getDocsFromServer(query(collection(db, name), where('classId', '==', 'SI-5A'))));
      await deny(getDocsFromServer(collection(db, name)));
      assert.ok((await getDocsFromServer(collection(client('rina'), name))).size > 0);
    });
  }
  it('ignores forged role/admin token claims and denies unseeded writes', async () => {
    for (const uid of ['unseeded', 'forged-asprak']) {
      await deny(setDoc(doc(client(uid), 'classes/new'), { name: 'New', createdAt: stamp }));
      await deny(getDocFromServer(doc(client(uid), 'sessions/open')));
    }
  });
});

describe('3. Praktikan A membaca users B / permissions orang lain', { concurrency: false }, () => {
  it('allows own profile, denies peer profile and peer list', async () => {
    const db = client('andi');
    await getDocFromServer(doc(db, 'users/andi'));
    await deny(getDocFromServer(doc(db, 'users/dina')));
    await deny(getDocFromServer(doc(db, 'users/budi')));
    await deny(getDocsFromServer(query(collection(db, 'users'), where('classId', '==', 'SI-5B'))));
    assert.equal((await getDocsFromServer(collection(client('rina'), 'users'))).size, 4);
  });
  it('allows get of absent own permission before submission', async () => {
    for (const id of ['open_andi', 'session_with_underscores_andi']) {
      assert.equal((await getDocFromServer(doc(client('andi'), 'permissions', id))).exists(), false);
    }
  });
  it('denies absent other-owner and malformed permission IDs', async () => {
    for (const id of ['open_dina', 'open_budi', '_andi', 'andi', 'openandi', 'open_xandi', 'open_andi_more']) {
      await deny(getDocFromServer(doc(client('andi'), 'permissions', id)));
    }
  });
  it('denies permission gets/lists without a seeded allowed role', async () => {
    await setDoc(doc(client('__seed__'), 'users/guest'), { name: 'Guest', role: 'guest', classId: 'SI-5B' });
    for (const uid of [null, 'unseeded', 'forged-asprak', 'guest']) {
      const db = client(uid);
      await deny(getDocFromServer(doc(db, 'permissions', `open_${uid || 'andi'}`)));
      await deny(getDocsFromServer(query(collection(db, 'permissions'), where('uid', '==', uid || 'andi'))));
    }
  });
  it('does not grant existing other-owner permission by matching ID suffix', async () => {
    await setDoc(doc(client('__seed__'), 'permissions/collision_andi'), permission({ uid: 'budi', name: 'Budi', createdAt: stamp }));
    await deny(getDocFromServer(doc(client('andi'), 'permissions/collision_andi')));
  });
  it('matches absent permission UID suffix literally, including underscores and regex characters', async () => {
    const uid = 'andi_+[x].';
    await setDoc(doc(client('__seed__'), 'users', uid), { name: 'Andi', role: 'praktikan', classId: 'SI-5B' });
    const db = client(uid);
    assert.equal((await getDocFromServer(doc(db, 'permissions', `open_${uid}`))).exists(), false);
    await deny(getDocFromServer(doc(db, 'permissions/open_andi__xZ')));
  });
  it('allows own permissions and uid-filtered query only', async () => {
    const db = client('andi');
    await getDocFromServer(doc(db, 'permissions/review_andi'));
    await deny(getDocFromServer(doc(db, 'permissions/other_budi')));
    const own = await getDocsFromServer(query(collection(db, 'permissions'), where('uid', '==', 'andi')));
    assert.deepEqual(own.docs.map((entry) => entry.id).sort(), ['closed_andi', 'review_andi']);
    await deny(getDocsFromServer(collection(db, 'permissions')));
    await deny(getDocsFromServer(query(collection(db, 'permissions'), where('uid', '==', 'budi'))));
    assert.equal((await getDocsFromServer(collection(client('rina'), 'permissions'))).size, 3);
  });
  it('does not let attendance collectionGroup rule grant other collections', async () => {
    const seed = client('__seed__');
    for (const path of ['private/matching', 'users/andi/private/matching', 'sessions/open/notes/matching']) {
      await setDoc(doc(seed, path), { uid: 'andi', classId: 'SI-5B' });
      for (const uid of ['andi', 'rina']) {
        const db = client(uid);
        await deny(getDocFromServer(doc(db, path)));
        await deny(getDocsFromServer(collection(db, path.substring(0, path.lastIndexOf('/')))));
        await deny(setDoc(doc(db, path), { uid: 'andi' }));
      }
    }
  });
});

describe('4. Presensi: status/kelas/uid/duplikat/immutability; sah dibuka ok', { concurrency: false }, () => {
  it('allows real transaction with absent own attendance read and server timestamp', async () => {
    const db = client('andi');
    const ref = doc(db, 'sessions/open/attendance/andi');
    await runTransaction(db, async (transaction) => {
      assert.equal((await transaction.get(doc(db, 'sessions/open'))).data().status, 'dibuka');
      assert.equal((await transaction.get(ref)).exists(), false);
      transaction.set(ref, attendance());
    });
    assert.ok((await getDocFromServer(ref)).data().attendedAt instanceof Timestamp);
    await deny(setDoc(ref, attendance()));
  });
  for (const id of ['unopened', 'closed', 'other', 'missing']) {
    it(`denies attendance in ${id} session`, async () => {
      await deny(setDoc(doc(client('andi'), `sessions/${id}/attendance/andi`), attendance()));
    });
  }
  it('denies another doc uid and another payload uid', async () => {
    const db = client('andi');
    await deny(setDoc(doc(db, 'sessions/open/attendance/dina'), attendance({ uid: 'dina' })));
    await deny(setDoc(doc(db, 'sessions/open/attendance/andi'), attendance({ uid: 'dina' })));
  });
  for (const [label, overrides] of [
    ['wrong class', { classId: 'SI-5A' }], ['spoofed name', { name: 'Dina' }],
    ['old timestamp', { attendedAt: stamp }], ['future timestamp', { attendedAt: Timestamp.fromMillis(253402300000000) }],
    ['null timestamp', { attendedAt: null }], ['extra field', { status: 'hadir' }],
  ]) {
    it(`denies attendance with ${label}`, async () => {
      await deny(setDoc(doc(client('andi'), 'sessions/open/attendance/andi'), attendance(overrides)));
    });
  }
  it('denies attendance missing required field', async () => {
    const value = attendance();
    delete value.name;
    await deny(setDoc(doc(client('andi'), 'sessions/open/attendance/andi'), value));
  });
  it('denies asprak attendance creation', async () => {
    await deny(setDoc(doc(client('rina'), 'sessions/open/attendance/rina'), attendance({ uid: 'rina', name: 'Rina' })));
  });
  for (const uid of ['andi', 'rina']) {
    it(`denies attendance update/delete by ${uid}`, async () => {
      const ref = doc(client(uid), 'sessions/history/attendance/andi');
      await deny(updateDoc(ref, { attendedAt: serverTimestamp() }));
      await deny(deleteDoc(ref));
    });
  }
  it('allows own history get/group query and asprak recap; denies other/unfiltered queries', async () => {
    const db = client('andi');
    await getDocFromServer(doc(db, 'sessions/history/attendance/andi'));
    await deny(getDocFromServer(doc(db, 'sessions/history/attendance/dina')));
    const own = await getDocsFromServer(query(collectionGroup(db, 'attendance'), where('uid', '==', 'andi')));
    assert.deepEqual(own.docs.map((entry) => entry.ref.path), ['sessions/history/attendance/andi']);
    await deny(getDocsFromServer(collectionGroup(db, 'attendance')));
    await deny(getDocsFromServer(query(collectionGroup(db, 'attendance'), where('uid', '==', 'dina'))));
    assert.equal((await getDocsFromServer(collection(client('rina'), 'sessions/history/attendance'))).size, 2);
    assert.equal((await getDocsFromServer(collectionGroup(client('rina'), 'attendance'))).size, 3);
  });
  it('recursive collectionGroup match grants neither get nor writes at unrelated attendance paths', async () => {
    const path = 'private/example/attendance/andi';
    await setDoc(doc(client('__seed__'), path), attendance({ attendedAt: stamp }));
    for (const uid of ['andi', 'rina']) {
      const ref = doc(client(uid), path);
      await deny(getDocFromServer(ref));
      await deny(setDoc(ref, attendance()));
      await deny(deleteDoc(ref));
    }
  });
});

describe('5. Izin praktikan: status/sesi/alasan/update sendiri', { concurrency: false }, () => {
  it('allows own permission transaction get then create with server timestamp', async () => {
    const db = client('andi');
    const ref = doc(db, 'permissions/open_andi');
    await runTransaction(db, async (transaction) => {
      assert.equal((await transaction.get(doc(db, 'sessions/open'))).data().status, 'dibuka');
      assert.equal((await transaction.get(ref)).exists(), false);
      transaction.set(ref, permission());
    });
    const value = (await getDocFromServer(ref)).data();
    assert.equal(value.uid, 'andi');
    assert.equal(value.status, 'menunggu');
    assert.ok(value.createdAt instanceof Timestamp);
    await deny(setDoc(ref, permission()));
  });
  for (const label of ['positif', 'netral', 'negatif']) {
    it(`allows pending permission with predicted ${label}`, async () => {
      const ref = doc(client('andi'), 'permissions/open_andi');
      await setDoc(ref, permission({ aiResult: { ...predicted, label } }));
      const value = (await getDocFromServer(ref)).data();
      assert.equal(value.status, 'menunggu');
      assert.ok(value.createdAt instanceof Timestamp);
      await deny(setDoc(ref, permission()));
    });
  }
  for (const status of ['unknown_vocabulary', 'empty_input', 'gagal']) {
    it(`allows ${status} AI with null label without blocking submission`, async () => {
      await setDoc(doc(client('andi'), 'permissions/open_andi'), permission({ aiResult: { ...unavailable, status } }));
    });
    it(`denies ${status} AI with non-null label`, async () => {
      await deny(setDoc(doc(client('andi'), 'permissions/open_andi'), permission({ aiResult: { ...predicted, status } })));
    });
  }
  for (const length of [10, 300]) {
    it(`allows inclusive reason boundary ${length}`, async () => {
      await setDoc(doc(client('andi'), 'permissions/open_andi'), permission({ reason: 'x'.repeat(length) }));
    });
  }
  it('allows permission before session opens', async () => {
    await setDoc(doc(client('andi'), 'permissions/unopened_andi'), permission({ sessionId: 'unopened', sessionTitle: 'Sesi unopened' }));
  });
  for (const [label, overrides, id = 'open_andi'] of [
    ['preapproved', { status: 'disetujui' }], ['prerejected', { status: 'ditolak' }],
    ['closed session', { sessionId: 'closed' }, 'closed_andi_new'],
    ['other class session', { sessionId: 'other', classId: 'SI-5A' }, 'other_andi'],
    ['missing session', { sessionId: 'missing' }, 'missing_andi'],
    ['short reason', { reason: 'x'.repeat(9) }], ['long reason', { reason: 'x'.repeat(301) }],
    ['non-string reason', { reason: 1234567890 }], ['wrong uid', { uid: 'dina' }],
    ['wrong docId', {}, 'arbitrary'], ['wrong class', { classId: 'SI-5A' }],
    ['spoofed name', { name: 'Dina' }], ['missing decision null', { decidedBy: 'rina' }],
    ['decision timestamp', { decidedAt: stamp }], ['client createdAt', { createdAt: stamp }],
    ['extra field', { admin: true }], ['null AI map', { aiResult: null }],
    ['predicted null label', { aiResult: { ...predicted, label: null } }],
    ['invalid label', { aiResult: { ...predicted, label: 'valid' } }],
    ['invalid AI status', { aiResult: { ...unavailable, status: 'accepted' } }],
    ['extra AI field', { aiResult: { ...predicted, approved: true } }],
    ['wrong model', { aiResult: { ...predicted, model: 'approval-ai' } }],
    ['nonexperimental model', { aiResult: { ...predicted, experimental: false } }],
  ]) {
    it(`denies permission with ${label}`, async () => {
      await deny(setDoc(doc(client('andi'), 'permissions', id), permission(overrides)));
    });
  }
  it('denies closed-session permission at correct fresh docId', async () => {
    await deleteDoc(doc(client('__seed__'), 'permissions/closed_andi'));
    await deny(setDoc(doc(client('andi'), 'permissions/closed_andi'), permission({ sessionId: 'closed', sessionTitle: 'Sesi closed' })));
  });
  for (const field of Object.keys(permission())) {
    it(`requires permission field ${field}`, async () => {
      const value = permission();
      delete value[field];
      await deny(setDoc(doc(client('andi'), 'permissions/open_andi'), value));
    });
  }
  for (const field of Object.keys(predicted)) {
    it(`requires AI field ${field}`, async () => {
      const aiResult = { ...predicted };
      delete aiResult[field];
      await deny(setDoc(doc(client('andi'), 'permissions/open_andi'), permission({ aiResult })));
    });
  }
  it('denies own permission update/delete and asprak create/delete', async () => {
    const own = doc(client('andi'), 'permissions/review_andi');
    await deny(updateDoc(own, { reason: 'Perubahan alasan sendiri' }));
    await deny(deleteDoc(own));
    await deny(setDoc(doc(client('rina'), 'permissions/open_rina'), permission({ uid: 'rina' })));
    await deny(deleteDoc(doc(client('rina'), 'permissions/review_andi')));
  });
});

describe('6. Asprak: immutable reason/AI, final sekali; setujui/tolak pending ok', { concurrency: false }, () => {
  for (const status of ['disetujui', 'ditolak']) {
    it(`allows ${status} from pending and locks final decision`, async () => {
      const ref = doc(client('rina'), 'permissions/review_andi');
      await updateDoc(ref, decision(status));
      const result = (await getDocFromServer(ref)).data();
      assert.equal(result.status, status);
      assert.equal(result.decidedBy, 'rina');
      assert.ok(result.decidedAt instanceof Timestamp);
      await deny(updateDoc(ref, decision(status === 'disetujui' ? 'ditolak' : 'disetujui')));
    });
  }
  for (const status of ['unknown_vocabulary', 'empty_input', 'gagal']) {
    it(`allows decision when AI ${status} has null label`, async () => {
      await updateDoc(doc(client('__seed__'), 'permissions/review_andi'), { aiResult: { ...unavailable, status } });
      await updateDoc(doc(client('rina'), 'permissions/review_andi'), decision());
    });
  }
  for (const [field, value] of Object.entries({
    reason: 'Alasan diubah oleh asprak', aiResult: unavailable, uid: 'budi', name: 'Budi', classId: 'SI-5A',
    sessionId: 'other', sessionTitle: 'Judul palsu', createdAt: serverTimestamp(), extra: true,
  })) {
    it(`denies asprak decision changing ${field}`, async () => {
      await deny(updateDoc(doc(client('rina'), 'permissions/review_andi'), { ...decision(), [field]: value }));
    });
  }
  it('denies removing immutable fields during decision', async () => {
    await deny(updateDoc(doc(client('rina'), 'permissions/review_andi'), { ...decision(), reason: deleteField() }));
  });
  for (const [label, update] of [
    ['missing decidedBy', { status: 'disetujui', decidedAt: serverTimestamp() }],
    ['missing decidedAt', { status: 'disetujui', decidedBy: 'rina' }],
    ['forged decidedBy', decision('disetujui', { decidedBy: 'another-asprak' })],
    ['client timestamp', decision('disetujui', { decidedAt: stamp })],
    ['null timestamp', decision('disetujui', { decidedAt: null })],
    ['still pending', decision('menunggu')], ['invalid status', decision('approved')],
  ]) {
    it(`denies decision with ${label}`, async () => {
      await deny(updateDoc(doc(client('rina'), 'permissions/review_andi'), update));
    });
  }
  it('denies praktikan approval even with correctly shaped decision', async () => {
    await deny(updateDoc(doc(client('andi'), 'permissions/review_andi'), decision('disetujui', { decidedBy: 'andi' })));
  });
});

describe('7. Users: asprak hanya classId praktikan; pindah kelas ok', { concurrency: false }, () => {
  it('allows asprak move to existing class, immediately changes class-scoped reads, preserves own history', async () => {
    const rina = client('rina');
    const andi = client('andi');
    await updateDoc(doc(rina, 'users/andi'), { classId: 'SI-5A' });
    assert.equal((await getDocFromServer(doc(rina, 'users/andi'))).data().classId, 'SI-5A');
    await deny(getDocFromServer(doc(andi, 'sessions/open')));
    await getDocFromServer(doc(andi, 'sessions/other'));
    await deny(getDocsFromServer(query(collection(andi, 'sessions'), where('classId', '==', 'SI-5B'))));
    assert.equal((await getDocsFromServer(query(collection(andi, 'sessions'), where('classId', '==', 'SI-5A')))).size, 1);
    assert.equal((await getDocsFromServer(query(collectionGroup(andi, 'attendance'), where('uid', '==', 'andi')))).size, 1);
    await deny(setDoc(doc(andi, 'sessions/open/attendance/andi'), attendance()));
    await setDoc(doc(andi, 'sessions/other/attendance/andi'), attendance({ classId: 'SI-5A' }));
  });
  for (const [field, value] of Object.entries({ name: 'Changed', email: 'changed@praktikum.test', role: 'asprak', createdAt: serverTimestamp(), extra: true })) {
    it(`denies asprak user update changing ${field}`, async () => {
      await deny(updateDoc(doc(client('rina'), 'users/andi'), { classId: 'SI-5A', [field]: value }));
    });
  }
  for (const classId of ['missing', '', null, 123]) {
    it(`denies invalid destination class ${JSON.stringify(classId)}`, async () => {
      await deny(updateDoc(doc(client('rina'), 'users/andi'), { classId }));
    });
  }
  it('denies asprak classId update targeting asprak', async () => {
    await deny(updateDoc(doc(client('rina'), 'users/rina'), { classId: 'SI-5A' }));
  });
  it('denies praktikan self class/role changes', async () => {
    await deny(updateDoc(doc(client('andi'), 'users/andi'), { classId: 'SI-5A' }));
    await deny(updateDoc(doc(client('andi'), 'users/andi'), { role: 'asprak' }));
  });
  for (const uid of ['andi', 'rina', 'forged-asprak']) {
    it(`denies client user create/delete by ${uid}`, async () => {
      const db = client(uid);
      await deny(setDoc(doc(db, 'users/new'), { name: 'New', role: 'asprak', classId: null }));
      await deny(deleteDoc(doc(db, 'users/andi')));
    });
  }
});
