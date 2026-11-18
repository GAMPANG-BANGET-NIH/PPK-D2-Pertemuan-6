import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redirectFor } from './route-policy.ts';

test('guest cannot enter any protected route', () => {
  for (const path of ['/', '/asisten', '/praktikan', '/explore', '/izin']) {
    assert.equal(redirectFor(null, path), '/login');
  }
  assert.equal(redirectFor(null, '/login'), null);
});
test('role controls routes, never route parameters', () => {
  for (const path of ['/asisten', '/kelola', '/rekap', '/pindah-kelas', '/asisten-izin']) {
    assert.equal(redirectFor('asprak', path), null);
    assert.equal(redirectFor('praktikan', path), '/praktikan');
  }
  for (const path of ['/praktikan', '/izin']) {
    assert.equal(redirectFor('praktikan', path), null);
    assert.equal(redirectFor('asprak', path), '/asisten');
  }
  for (const path of ['/', '/login', '/explore', '/unknown']) {
    assert.equal(redirectFor('asprak', path), '/asisten');
    assert.equal(redirectFor('praktikan', path), '/praktikan');
  }
});
