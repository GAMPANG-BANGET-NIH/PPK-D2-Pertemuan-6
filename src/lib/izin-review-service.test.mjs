import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';
import * as policy from './izin-review-policy.ts';

// SDK doubles exercise real service orchestration, not a Firebase backend.
function loadService() {
  const auth = { currentUser: { uid: 'as1' } };
  const state = { online: true, status: 'menunggu', role: 'asprak', writes: [], unsubscribed: false };
  const sentinel = { serverTimestamp: true };
  const transaction = {
    get: async ref => ({ exists: () => state.exists !== false, data: () => ref.path.startsWith('users/') ? { role: state.role } : { status: state.status } }),
    update: (ref, patch) => state.writes.push({ ref, patch }),
  };
  const firestore = {
    collection: (_db, path) => ({ path }), doc: (_db, ...path) => ({ path: path.join('/') }),
    serverTimestamp: () => sentinel,
    runTransaction: async (_db, callback) => { state.transactions = (state.transactions ?? 0) + 1; return callback(transaction); },
    onSnapshot: (ref, next, onError) => {
      if (state.listenerError) throw state.listenerError;
      Object.assign(state, { ref, next, onError });
      state.onSubscribe?.();
      return () => { state.unsubscribed = true; state.cleanups = (state.cleanups ?? 0) + 1; };
    },
  };
  const filename = new URL('../services/izin-review.ts', import.meta.url);
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const module = new Module(filename.pathname);
  module.require = name => {
    if (name === 'firebase/firestore') return firestore;
    if (name === '@react-native-community/netinfo') return { fetch: async () => ({ isConnected: state.online, isInternetReachable: state.online }) };
    if (name === '@/lib/firebase') {
      if (state.firebaseError) throw state.firebaseError;
      return { auth, db: {} };
    }
    if (name === '@/lib/izin-review-policy') return policy;
    throw new Error(`Unexpected import ${name}`);
  };
  module._compile(source, filename.pathname);
  return { service: module.exports, auth, state, sentinel };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

test('subscriber reads permissions, forwards errors, returns unsubscribe', async () => {
  const { service, state } = loadService();
  const errors = [];
  let rows;
  let emissions = 0;
  const stop = service.subscribeAllPermissions(value => { rows = value; emissions++; }, error => errors.push(error));
  assert.equal(typeof stop, 'function');
  await flush();
  assert.equal(state.ref.path, 'permissions');
  state.next({ docs: [] });
  assert.deepEqual(rows, []);
  const error = new Error('listener failed');
  state.onError(error);
  assert.equal(errors[0], error);
  stop();
  assert.equal(state.unsubscribed, true);
  state.next({ docs: [] });
  state.onError(new Error('late listener error'));
  assert.equal(emissions, 1);
  assert.equal(errors.length, 1);
  stop();
  assert.equal(state.cleanups, 1);
});

test('cleanup before Firebase loads prevents listener registration and callbacks', async () => {
  const { service, state } = loadService();
  const stop = service.subscribeAllPermissions(() => assert.fail('late rows'), () => assert.fail('late error'));
  stop();
  await flush();
  assert.equal(state.ref, undefined);
  assert.equal(state.cleanups, undefined);
});

test('Firebase import and listener setup errors report once and permit a fresh subscription', async () => {
  for (const failure of ['firebaseError', 'listenerError']) {
    const { service, state } = loadService();
    const errors = [];
    const error = new Error(failure);
    state[failure] = error;
    const stop = service.subscribeAllPermissions(() => assert.fail('unexpected rows'), value => errors.push(value));
    await flush();
    assert.deepEqual(errors, [error]);
    stop();
    delete state[failure];
    const retry = service.subscribeAllPermissions(() => {}, value => errors.push(value));
    await flush();
    assert.equal(state.ref.path, 'permissions');
    retry();
    assert.equal(state.cleanups, 1);
  }
});

test('cancelled failed import stays silent and synchronous registration cleanup never leaks', async () => {
  const cancelled = loadService();
  cancelled.state.firebaseError = new Error('missing config');
  const stop = cancelled.service.subscribeAllPermissions(() => assert.fail('late rows'), () => assert.fail('late error'));
  stop();
  await flush();
  assert.equal(cancelled.state.ref, undefined);

  const { service, state } = loadService();
  const cleanup = service.subscribeAllPermissions(() => {}, () => assert.fail('unexpected error'));
  state.onSubscribe = cleanup;
  await flush();
  assert.equal(state.cleanups, 1);
  cleanup();
  assert.equal(state.cleanups, 1);
});

test('service transaction checks actor role and pending status then writes only decision fields', async () => {
  const { service, state, sentinel } = loadService();
  await service.decidePermission('s1_p1', 'disetujui', 'as1');
  assert.equal(state.transactions, 1);
  assert.deepEqual(state.writes, [{ ref: { path: 'permissions/s1_p1' }, patch: { status: 'disetujui', decidedBy: 'as1', decidedAt: sentinel } }]);
});

test('service rejects offline, wrong actor, wrong role, missing and final permission without writes', async () => {
  for (const scenario of ['offline', 'actor', 'role', 'missing', 'final']) {
    const { service, auth, state } = loadService();
    if (scenario === 'offline') state.online = false;
    if (scenario === 'actor') auth.currentUser = { uid: 'as2' };
    if (scenario === 'role') state.role = 'praktikan';
    if (scenario === 'missing') state.exists = false;
    if (scenario === 'final') state.status = 'disetujui';
    await assert.rejects(service.decidePermission('s1_p1', 'ditolak', 'as1'));
    assert.equal(state.writes.length, 0, scenario);
  }
});
