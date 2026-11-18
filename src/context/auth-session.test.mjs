import assert from 'node:assert/strict';
import { test } from 'node:test';
import { observeAuthSession } from './auth-session.ts';

const profile = { uid: 'andi', name: 'Andi', email: 'andi@praktikum.test', role: 'praktikan', classId: 'SI-5B' };
function harness() {
  let authCallback;
  const profiles = [];
  const states = [];
  const errors = [];
  let authStopped = 0;
  let signedOut = 0;
  const stop = observeAuthSession({
    observeAuth: (callback) => { authCallback = callback; return () => authStopped++; },
    observeProfile: (uid, next, error) => { const listener = { uid, next, error, stopped: 0 }; profiles.push(listener); return () => listener.stopped++; },
    signOut: async () => { signedOut++; },
  }, (state) => states.push(state), (message) => errors.push(message));
  return { auth: (value) => authCallback(value), profiles, states, errors, stop, get authStopped() { return authStopped; }, get signedOut() { return signedOut; } };
}

test('auth observer waits for profile then updates class in realtime', () => {
  const h = harness();
  h.auth({ uid: profile.uid });
  assert.deepEqual(h.states.at(-1), { user: null, loading: true });
  h.profiles[0].next(profile);
  assert.deepEqual(h.states.at(-1), { user: profile, loading: false });
  h.profiles[0].next({ ...profile, classId: 'SI-5A' });
  assert.equal(h.states.at(-1).user.classId, 'SI-5A');
  h.stop();
});

test('logout and disposal detach listeners and ignore stale profile results', () => {
  const h = harness();
  h.auth({ uid: profile.uid });
  h.auth(null);
  h.profiles[0].next(profile);
  assert.deepEqual(h.states.at(-1), { user: null, loading: false });
  assert.equal(h.profiles[0].stopped, 1);
  h.auth({ uid: 'budi' });
  h.stop();
  const count = h.states.length;
  h.profiles[1].next({ ...profile, uid: 'budi' });
  h.auth({ uid: profile.uid });
  assert.equal(h.states.length, count);
  assert.equal(h.profiles[1].stopped, 1);
  assert.equal(h.authStopped, 1);
});

test('switching accounts clears old profile and ignores queued callbacks', () => {
  const h = harness();
  h.auth({ uid: profile.uid });
  h.profiles[0].next(profile);
  h.auth({ uid: 'budi' });
  assert.deepEqual(h.states.at(-1), { user: null, loading: true });
  assert.equal(h.profiles[0].stopped, 1);
  h.profiles[0].next({ ...profile, classId: 'stale' });
  h.profiles[0].error('stale error');
  assert.equal(h.signedOut, 0);
  assert.equal(h.errors.length, 0);
  h.profiles[1].next({ ...profile, uid: 'budi' });
  assert.equal(h.states.at(-1).user.uid, 'budi');
  h.stop();
});

test('synchronous missing profile still cleans up subscription returned after callback', async () => {
  let emitAuth;
  let detached = 0;
  let signedOut = 0;
  const states = [];
  const messages = [];
  const stop = observeAuthSession({
    observeAuth: (next) => { emitAuth = next; return () => {}; },
    observeProfile: (_uid, next) => { next(null); return () => detached++; },
    signOut: async () => { signedOut++; },
  }, (state) => states.push(state), (message) => messages.push(message));
  emitAuth({ uid: 'andi' });
  await Promise.resolve();
  assert.equal(detached, 1);
  assert.equal(signedOut, 1);
  assert.deepEqual(states.at(-1), { user: null, loading: false });
  assert.equal(messages.at(-1), 'Akun belum terdaftar di sistem');
  stop();
});

test('profile error clears identity and failed sign-out never restores protected user', async () => {
  let emitAuth;
  let profileError;
  const states = [];
  const messages = [];
  const stop = observeAuthSession({
    observeAuth: (next) => { emitAuth = next; return () => {}; },
    observeProfile: (_uid, next, onError) => { next(profile); profileError = onError; return () => {}; },
    signOut: async () => { throw new Error('private diagnostic'); },
  }, (state) => states.push(state), (message) => messages.push(message));
  emitAuth({ uid: 'andi' });
  profileError('Anda tidak memiliki izin untuk tindakan ini.');
  await Promise.resolve();
  assert.deepEqual(states.at(-1), { user: null, loading: false });
  assert.match(messages.at(-1), /Gagal keluar/);
  assert.doesNotMatch(messages.at(-1), /private diagnostic/);
  stop();
});

test('forced logout stays loading until persistence removal completes', async () => {
  let emitAuth;
  let emitProfile;
  let finishLogout;
  const states = [];
  const stop = observeAuthSession({
    observeAuth: (next) => { emitAuth = next; return () => {}; },
    observeProfile: (_uid, next) => { emitProfile = next; return () => {}; },
    signOut: () => new Promise((resolve) => { finishLogout = resolve; }),
  }, (state) => states.push(state), () => {});
  emitAuth({ uid: 'andi' });
  emitProfile(null);
  assert.deepEqual(states.at(-1), { user: null, loading: true });
  finishLogout();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(states.at(-1), { user: null, loading: false });
  stop();
});

test('missing profile forces logout and keeps exact Indonesian notice', async () => {
  const h = harness();
  h.auth({ uid: profile.uid });
  h.profiles[0].next(null);
  await Promise.resolve();
  assert.deepEqual(h.states.at(-1), { user: null, loading: false });
  assert.equal(h.signedOut, 1);
  assert.equal(h.errors.at(-1), 'Akun belum terdaftar di sistem');
  assert.equal(h.profiles[0].stopped, 1);
  h.profiles[0].next(profile);
  assert.equal(h.states.at(-1).user, null);
  h.stop();
});
