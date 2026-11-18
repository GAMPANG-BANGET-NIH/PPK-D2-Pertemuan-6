import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateLogin } from './validation.ts';

test('login requires email and password before contacting Firebase', () => {
  assert.equal(validateLogin('', ''), 'Email dan password wajib diisi.');
  assert.equal(validateLogin('   ', 'secret'), 'Email dan password wajib diisi.');
  assert.equal(validateLogin('andi@praktikum.test', ''), 'Email dan password wajib diisi.');
  assert.equal(validateLogin('andi@praktikum.test', '   '), 'Email dan password wajib diisi.');
});

test('login rejects malformed email but accepts surrounding whitespace', () => {
  for (const email of ['andi', 'andi@', '@praktikum.test', 'andi@praktikum', 'an di@praktikum.test']) {
    assert.equal(validateLogin(email, 'secret'), 'Format email tidak valid.');
  }
  assert.equal(validateLogin('  andi@praktikum.test  ', ' password with spaces '), null);
});
