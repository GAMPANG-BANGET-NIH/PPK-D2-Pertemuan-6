import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getErrorMessage } from '../utils/errors.ts';

test('Firebase errors become safe Indonesian messages', () => {
  assert.equal(getErrorMessage({ code: 'auth/invalid-credential' }), 'Email atau password salah.');
  assert.equal(getErrorMessage({ code: 'auth/too-many-requests' }), 'Terlalu banyak percobaan. Coba lagi nanti.');
  assert.equal(getErrorMessage({ code: 'auth/network-request-failed' }), 'Koneksi bermasalah. Periksa jaringan Anda.');
  assert.equal(getErrorMessage({ code: 'permission-denied' }), 'Anda tidak memiliki izin untuk tindakan ini.');
  assert.equal(getErrorMessage(new Error('private diagnostic')), 'Terjadi kesalahan. Silakan coba lagi.');
  assert.equal(getErrorMessage(null), 'Terjadi kesalahan. Silakan coba lagi.');
});
