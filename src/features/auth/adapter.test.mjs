import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { validateLogin } from './validation.ts';
import { getErrorMessage } from '../../utils/errors.ts';

const requireForUi = createRequire(import.meta.url);
function load(relative, imports, globals = {}) {
  const code = ts.transpileModule(readFileSync(new URL(relative, import.meta.url), 'utf8'), {
    fileName: relative,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(code, { ...globals, module, exports: module.exports, require: (id) => {
    if (!(id in imports)) throw new Error(`Unexpected import: ${id}`);
    return imports[id];
  } });
  return module.exports;
}
function authAdapter() {
  let nextSnapshot;
  let errorSnapshot;
  let nextAuth;
  let signInFailure;
  let signOutFailure;
  let signInArgs;
  let stopped = 0;
  const adapter = load('../../services/auth.ts', {
    'firebase/auth': {
      onAuthStateChanged: (_auth, callback) => { nextAuth = callback; return () => stopped++; },
      signInWithEmailAndPassword: async (...args) => { signInArgs = args; if (signInFailure) throw signInFailure; },
      signOut: async () => { if (signOutFailure) throw signOutFailure; },
    },
    'firebase/firestore': {
      doc: (_db, collection, uid) => ({ collection, uid }),
      onSnapshot: (ref, options, next, error) => {
        assert.equal(ref.collection, 'users');
        assert.equal(ref.uid, 'andi');
        assert.equal(options.includeMetadataChanges, true);
        nextSnapshot = next;
        errorSnapshot = error;
        return () => stopped++;
      },
    },
    '../features/auth/validation': { validateLogin },
    '../lib/firebase': { auth: 'auth-instance', db: 'db-instance' },
    '../utils/errors': { getErrorMessage },
  });
  return { adapter, emitAuth: (user) => nextAuth(user), snapshot: (data, fromCache = false) => nextSnapshot({
    exists: () => data !== null, data: () => data, metadata: { fromCache },
  }), error: (error) => errorSnapshot(error), failSignIn: (error) => { signInFailure = error; },
  failSignOut: (error) => { signOutFailure = error; }, get signInArgs() { return signInArgs; }, get stopped() { return stopped; } };
}
const profile = { name: 'Andi', email: 'andi@praktikum.test', role: 'praktikan', classId: 'SI-5B' };

test('Firebase adapter waits for server before declaring a user document missing', () => {
  const h = authAdapter();
  const profiles = [];
  const stop = h.adapter.observeProfile('andi', (value) => profiles.push(value), assert.fail);
  h.snapshot(null, true);
  assert.equal(profiles.length, 0);
  h.snapshot(null, false);
  assert.deepEqual(profiles, [null]);
  h.snapshot(profile);
  assert.equal(profiles.at(-1).uid, 'andi');
  assert.equal(profiles.at(-1).classId, 'SI-5B');
  h.snapshot({ ...profile, classId: 'SI-5A' });
  assert.equal(profiles.at(-1).classId, 'SI-5A');
  stop();
  assert.equal(h.stopped, 1);
});

test('Firebase adapter rejects invalid profile roles and maps listener errors safely', () => {
  const h = authAdapter();
  const errors = [];
  h.adapter.observeProfile('andi', assert.fail, (message) => errors.push(message));
  for (const patch of [{ role: 'admin' }, { classId: null }, { name: '' }, { email: undefined }, { email: '' }, { email: '   ' }]) h.snapshot({ ...profile, ...patch });
  assert.equal(errors.length, 6);
  h.error({ code: 'permission-denied', message: 'private diagnostic' });
  assert.equal(errors.at(-1), 'Anda tidak memiliki izin untuk tindakan ini.');
});

test('sign-in trims email but preserves password and never leaks Firebase diagnostics', async () => {
  const h = authAdapter();
  await assert.rejects(h.adapter.signIn('', ''), { message: 'Email dan password wajib diisi.' });
  assert.equal(h.signInArgs, undefined);
  await h.adapter.signIn('  andi@praktikum.test ', ' password with spaces ');
  assert.deepEqual(h.signInArgs, ['auth-instance', 'andi@praktikum.test', ' password with spaces ']);
  for (const code of ['auth/invalid-credential', 'auth/too-many-requests', 'auth/network-request-failed']) {
    h.failSignIn({ code, message: 'private diagnostic' });
    await assert.rejects(h.adapter.signIn('andi@praktikum.test', 'password'), { message: getErrorMessage({ code }) });
  }
  h.failSignOut({ code: 'auth/network-request-failed', message: 'private diagnostic' });
  await assert.rejects(h.adapter.signOut(), { message: 'Koneksi bermasalah. Periksa jaringan Anda.' });
});

test('Firebase adapter exposes auth observer cleanup', () => {
  const h = authAdapter();
  const users = [];
  const stop = h.adapter.observeAuth((user) => users.push(user));
  h.emitAuth({ uid: 'andi' });
  h.emitAuth(null);
  assert.deepEqual(users, [{ uid: 'andi' }, null]);
  stop();
  assert.equal(h.stopped, 1);
});

test('Firebase persistence uses AsyncStorage on native and browser storage on web', () => {
  const keys = ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'STORAGE_BUCKET', 'MESSAGING_SENDER_ID', 'APP_ID'];
  const env = Object.fromEntries(keys.map((key) => [`EXPO_PUBLIC_FIREBASE_${key}`, 'unit-test-only']));
  for (const os of ['web', 'android', 'ios']) {
    let nativeStorage;
    let persistence;
    const storage = {};
    const app = {};
    const auth = {};
    const browserPersistence = {};
    const nativePersistence = {};
    const db = {};
    const imports = {
      '@react-native-async-storage/async-storage': storage,
      'firebase/app': { getApps: () => [], initializeApp: () => app },
      'firebase/auth': {
        browserLocalPersistence: browserPersistence,
        getReactNativePersistence: (received) => { nativeStorage = received; return nativePersistence; },
        initializeAuth: (received, options) => { assert.equal(received, app); persistence = options.persistence; return auth; },
      },
      'firebase/firestore': { getFirestore: (received) => { assert.equal(received, app); return db; } },
      'react-native': { Platform: { OS: os } },
    };
    const result = load('../../lib/firebase.ts', imports, { process: { env } });
    assert.equal(result.app, app);
    assert.equal(result.auth, auth);
    assert.equal(result.db, db);
    assert.equal(persistence, os === 'web' ? browserPersistence : nativePersistence);
    assert.equal(nativeStorage, os === 'web' ? undefined : storage);
    imports['firebase/app'] = { getApps: () => [app], getApp: () => app };
    imports['firebase/auth'].initializeAuth = () => { throw { code: 'auth/already-initialized' }; };
    imports['firebase/auth'].getAuth = () => auth;
    assert.equal(load('../../lib/firebase.ts', imports, { process: { env } }).auth, auth);
    imports['firebase/auth'].initializeAuth = () => { throw new Error('unexpected initialization failure'); };
    assert.throws(() => load('../../lib/firebase.ts', imports, { process: { env } }), /unexpected initialization failure/);
  }
});

test('login form renders labeled native controls and disables submit during loading', () => {
  const React = requireForUi('react');
  const { renderToStaticMarkup } = requireForUi('react-dom/server');
  const native = requireForUi('react-native-web');
  for (const loading of [false, true]) {
    const { default: Login } = load('./login.tsx', {
      react: React,
      'react/jsx-runtime': requireForUi('react/jsx-runtime'),
      'react-native': native,
      'react-native-safe-area-context': { SafeAreaView: native.View },
      '@/context/auth-context': { useAuth: () => ({ signIn: async () => {}, loading }), useAuthNotice: () => 'Akun belum terdaftar di sistem' },
      '@/hooks/use-network': { useNetwork: () => ({ isOnline: true }) },
      './validation': { validateLogin },
    });
    const html = renderToStaticMarkup(React.createElement(Login));
    assert.match(html, /aria-label="Email"/);
    assert.match(html, /aria-label="Password"/);
    assert.match(html, /type="password"/);
    assert.match(html, /Akun belum terdaftar di sistem/);
    assert.match(html, loading ? /Memuat/ : /Login/);
    assert.equal(html.includes('aria-disabled="true"'), loading);
    assert.doesNotMatch(html, /Registrasi|Register/);
  }
});

test('network hook blocks disconnected and unreachable states without rejecting web null reachability', () => {
  for (const [isConnected, isInternetReachable, expected] of [[null, null, false], [false, false, false], [true, false, false], [true, true, true], [true, null, true]]) {
    const { useNetwork } = load('../../hooks/use-network.ts', {
      '@react-native-community/netinfo': { useNetInfo: () => ({ isConnected, isInternetReachable }) },
    });
    const React = requireForUi('react');
    const { renderToStaticMarkup } = requireForUi('react-dom/server');
    function NetworkProbe() {
      return React.createElement('span', null, String(useNetwork().isOnline));
    }
    assert.equal(renderToStaticMarkup(React.createElement(NetworkProbe)), `<span>${expected}</span>`);
  }
});

test('offline banner and user header render clear status and logout control', () => {
  const React = requireForUi('react');
  const { renderToStaticMarkup } = requireForUi('react-dom/server');
  const native = requireForUi('react-native-web');
  const imports = { react: React, 'react/jsx-runtime': requireForUi('react/jsx-runtime'), 'react-native': native };
  for (const isOnline of [true, false]) {
    const { OfflineBanner } = load('../../components/offline-banner.tsx', {
      ...imports, '@/hooks/use-network': { useNetwork: () => ({ isOnline }) },
    });
    const html = renderToStaticMarkup(React.createElement(OfflineBanner));
    assert.equal(html.includes('Anda sedang offline'), !isOnline);
  }
  for (const role of ['asprak', 'praktikan']) {
    const { UserHeader } = load('../../components/user-header.tsx', {
      ...imports, '@/context/auth-context': { useAuth: () => ({ user: { ...profile, role }, signOut: async () => {} }) },
    });
    const html = renderToStaticMarkup(React.createElement(UserHeader));
    assert.match(html, /Andi/);
    assert.match(html, role === 'asprak' ? /Asprak/ : /Praktikan/);
    assert.match(html, /Logout/);
  }
});

test('Firebase initialization refuses absent config without constructing fake instances', () => {
  let initialized = 0;
  assert.throws(() => load('../../lib/firebase.ts', {
    '@react-native-async-storage/async-storage': {},
    'firebase/app': { initializeApp: () => initialized++ },
    'firebase/auth': {}, 'firebase/firestore': {}, 'react-native': { Platform: { OS: 'web' } },
  }, { process: { env: {} } }), /Konfigurasi Firebase belum lengkap/);
  assert.equal(initialized, 0);
});
