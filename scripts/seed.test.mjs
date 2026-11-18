import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedMissing } from './seed.mjs';

test('rerun preserves existing records and creates no duplicates', async () => {
  const users = new Map();
  const docs = new Map();
  const store = {
    async ensureAccount(account) {
      if (!users.has(account.email)) users.set(account.email, { uid: `uid-${users.size}` });
      return users.get(account.email).uid;
    },
    async createIfMissing(path, data) { if (!docs.has(path)) docs.set(path, data); },
  };
  const data = { accounts: [{email:'rina@praktikum.test',name:'Asisten Rina',role:'asprak',classId:null}], classes:[{id:'SI-5A',name:'SI-5A'}], schedules:[], sessions:[] };
  await seedMissing(data, store);
  docs.get('classes/SI-5A').name = 'Keep live value';
  await seedMissing(data, store);
  assert.equal(users.size, 1);
  assert.equal(docs.size, 2);
  assert.equal(docs.get('classes/SI-5A').name, 'Keep live value');
  assert.equal(docs.get('users/uid-0').role, 'asprak');
});
