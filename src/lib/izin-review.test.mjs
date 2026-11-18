import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as review from './izin-review-policy.ts';
import { Timestamp } from 'firebase/firestore';

const rawPermission = {
  uid: 'p1', name: 'Andi', classId: 'SI-5B', sessionId: 's2', sessionTitle: 'Basis Data',
  reason: 'Sakit dan perlu istirahat', status: 'menunggu',
  aiResult: { status: 'unknown_vocabulary', label: null, model: 'model-edom', experimental: true },
  createdAt: Timestamp.fromMillis(1000), decidedAt: null, decidedBy: null,
};

test('snapshot conversion preserves all fields and handles null or malformed timestamps safely', () => {
  const result = review.readPermission('s2_p1', rawPermission);
  assert.deepEqual(result, { ...rawPermission, id: 's2_p1', createdAt: new Date(1000) });
  for (const value of [null, undefined, 'bad', {}, new Date(NaN), { toDate: () => { throw new Error('bad'); } }]) {
    assert.equal(review.permissionDate(value), null);
  }
  assert.equal(review.permissionDate(Timestamp.fromMillis(0)).getTime(), 0);
  assert.throws(() => review.readPermission('s2_p1', { ...rawPermission, status: 'invalid' }), /tidak valid/i);
});

test('client sorts newest first without mutation and filters all four states', () => {
  const rows = [
    { ...rawPermission, id: 'null', createdAt: null },
    { ...rawPermission, id: 'old', status: 'ditolak', createdAt: new Date(1) },
    { ...rawPermission, id: 'new', status: 'disetujui', createdAt: new Date(2) },
  ];
  assert.deepEqual(review.sortPermissions(rows).map(row => row.id), ['new', 'old', 'null']);
  assert.equal(rows[0].id, 'null');
  for (const state of ['semua', 'menunggu', 'disetujui', 'ditolak']) {
    assert.equal(review.filterPermissions(rows, state).length, state === 'semua' ? 3 : 1);
  }
  assert.deepEqual(review.filterPermissions([], 'menunggu'), []);
});

test('AI unavailable never becomes neutral and never blocks either human decision', () => {
  for (const status of ['unknown_vocabulary', 'empty_input', 'gagal', 'predicted']) {
    const ai = { ...rawPermission.aiResult, status, label: null };
    assert.equal(review.aiReviewText(ai), 'Klasifikasi tidak tersedia');
    for (const decision of ['disetujui', 'ditolak']) {
      assert.equal(review.permissionDecisionPatch('menunggu', decision, 'as1', {}).status, decision);
    }
  }
  for (const label of ['positif', 'netral', 'negatif']) {
    assert.equal(review.aiReviewText({ ...rawPermission.aiResult, status: 'predicted', label }), `Sentimen AI: ${label} (info pendukung)`);
  }
});

test('pending permission accepts either human decision and changes exactly three fields', () => {
  const timestamp = Object.freeze({ serverTimestamp: true });
  for (const decision of ['disetujui', 'ditolak']) {
    assert.deepEqual(review.permissionDecisionPatch('menunggu', decision, 'as1', timestamp), {
      status: decision,
      decidedBy: 'as1',
      decidedAt: timestamp,
    });
  }
});

test('final, unknown, or missing permission status cannot be decided', () => {
  for (const status of ['disetujui', 'ditolak', 'other', null, undefined]) {
    assert.throws(() => review.permissionDecisionPatch(status, 'ditolak', 'as1', {}), /sudah diputuskan|tidak valid/);
  }
  for (const decision of ['menunggu', '', null, undefined]) {
    assert.throws(() => review.permissionDecisionPatch('menunggu', decision, 'as1', {}), /Keputusan izin tidak valid/);
  }
});

test('write preflight rejects offline, invalid IDs, logout, and actor mismatch without normalizing IDs', () => {
  assert.doesNotThrow(() => review.assertReviewActor('s1_p1', 'as1', 'as1', true));
  assert.throws(() => review.assertReviewActor('s1_p1', 'as1', 'as1', false), /offline/i);
  assert.throws(() => review.assertReviewActor('s1_p1', 'as1', null, true), /login|akun/i);
  assert.throws(() => review.assertReviewActor('s1_p1', 'as1', 'as2', true), /login|akun/i);
  for (const id of ['', ' s1_p1', 's1_p1 ', 'nested/id', '.', '..']) {
    assert.throws(() => review.assertReviewActor(id, 'as1', 'as1', true), /ID/);
  }
  assert.throws(() => review.assertReviewActor('s1_p1', '', '', true), /akun|ID/i);
});
