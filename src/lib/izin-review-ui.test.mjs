import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import { test } from 'node:test';
import React from 'react';
import ts from 'typescript';
import * as policy from './izin-review-policy.ts';

// Hook/native doubles exercise feature handlers; not device or backend evidence.
function screen() {
  const slots = [], effects = [];
  let cursor = 0, pending = [], next, fail, writes = 0, cleaned = false, resolve, reject;
  let online = true;
  const user = { uid: 'as1', name: 'Rina', role: 'asprak' };
  const request = { id: 's1_p1', uid: 'p1', name: 'Andi', classId: 'SI-5A', sessionId: 's1', sessionTitle: 'PPB', reason: 'Sakit demam dan perlu istirahat', status: 'menunggu', aiResult: { status: 'unknown_vocabulary', label: null, model: 'model-edom', experimental: true }, createdAt: new Date(0), decidedAt: null, decidedBy: null };
  const hooks = {
    ...React,
    useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef: initial => { const i = cursor++; return slots[i] ??= { current: initial }; },
    useEffect: (fn, deps) => { const i = cursor++; if (!effects[i] || deps === undefined || deps.some((dep, n) => dep !== effects[i].deps?.[n])) pending.push(() => { effects[i]?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; }); },
    useMemo: fn => fn(), useCallback: fn => fn,
  };
  const filename = new URL('../features/izin-review.tsx', import.meta.url);
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = new Module(filename.pathname);
  module.require = name => {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') { const element = (type, props, key) => React.createElement(type, { ...props, key }); return { jsx: element, jsxs: element }; }
    if (name === 'react-native') return Object.fromEntries(['ActivityIndicator', 'Button', 'Modal', 'ScrollView', 'StyleSheet', 'Text', 'View'].map(key => [key, key === 'StyleSheet' ? { create: value => value } : key]));
    if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView' };
    if (name === '@/components/user-header') return { UserHeader: 'UserHeader' };
    if (name === '@/context/auth-context') return { useAuth: () => ({ user, loading: false }) };
    if (name === '@/hooks/use-network') return { useNetwork: () => ({ isOnline: online }) };
    if (name === '@/lib/izin-review-policy') return policy;
    if (name === '@/utils/errors') return { getErrorMessage: () => 'Gagal menyimpan.' };
    if (name === '@/services/izin-review') return { subscribeAllPermissions: (cb, onError) => { next = cb; fail = onError; return () => { cleaned = true; }; }, decidePermission: () => { writes++; return new Promise((done, failed) => { resolve = done; reject = failed; }); } };
    throw new Error(`Unexpected import ${name}`);
  };
  module._compile(code, filename.pathname);
  const flatten = value => {
    if (value == null || typeof value === 'boolean') return [];
    if (Array.isArray(value)) return value.flatMap(flatten);
    if (!React.isValidElement(value)) return [value];
    if (typeof value.type === 'function') return flatten(value.type(value.props));
    if (value.type === 'Modal' && !value.props.visible) return [];
    return [value, ...flatten(value.props.children)];
  };
  let nodes;
  const render = () => { cursor = 0; nodes = flatten(module.exports.default()); const todo = pending; pending = []; todo.forEach(fn => fn()); return nodes; };
  const button = title => nodes.find(node => node?.props?.title === title);
  return { render, button, emit: rows => next(rows), error: () => fail(new Error('listener failed')), request, offline: () => { online = false; }, text: () => nodes.filter(node => typeof node === 'string').join(' '), writes: () => writes, finish: () => resolve(), reject: () => reject(new Error('write failed')), cleanup: () => { effects.forEach(effect => effect?.cleanup?.()); return cleaned; } };
}

test('review shows loading, empty, full record and AI-null human actions', () => {
  const ui = screen();
  ui.render();
  assert.match(ui.text(), /Memuat/);
  ui.emit([]); ui.render();
  assert.match(ui.text(), /Belum ada|Tidak ada/);
  ui.emit([ui.request]); ui.render();
  for (const text of ['Andi', 'SI-5A', 'PPB', ui.request.reason, 'Klasifikasi tidak tersedia', 'Menunggu']) assert.ok(ui.text().includes(text), text);
  assert.equal(ui.button('Setujui').props.disabled, false);
  assert.equal(ui.button('Tolak').props.disabled, false);
  assert.equal(ui.cleanup(), true);
});

test('confirmation cancel writes nothing and double confirm writes once', async () => {
  const ui = screen(); ui.render(); ui.emit([ui.request]); ui.render();
  ui.button('Setujui').props.onPress(); ui.render();
  ui.button('Batal').props.onPress(); ui.render();
  assert.equal(ui.writes(), 0);
  ui.button('Tolak').props.onPress(); ui.render();
  const confirm = ui.button('Ya, tolak').props.onPress;
  const first = confirm(); const second = confirm(); ui.render();
  assert.equal(ui.writes(), 1);
  assert.equal(ui.button('Ya, tolak').props.disabled, true);
  ui.finish(); await Promise.all([first, second]); ui.render();
  assert.equal(ui.button('Setujui'), undefined);
  assert.equal(ui.button('Tolak'), undefined);
});

test('listener failure shows retry and each filter renders only matching records', () => {
  const ui = screen(); ui.render(); ui.error(); ui.render();
  assert.match(ui.text(), /Gagal/);
  ui.button('Coba lagi').props.onPress(); ui.render();
  assert.match(ui.text(), /Memuat/);
  ui.emit([
    ui.request,
    { ...ui.request, id: 'approved', name: 'Budi', status: 'disetujui', decidedBy: 'as1', decidedAt: new Date(0) },
    { ...ui.request, id: 'rejected', name: 'Citra', status: 'ditolak' },
  ]); ui.render();
  for (const [filter, name] of [['Menunggu', 'Andi'], ['Disetujui', 'Budi'], ['Ditolak', 'Citra']]) {
    ui.button(filter).props.onPress(); ui.render();
    assert.ok(ui.text().includes(name));
    for (const other of ['Andi', 'Budi', 'Citra'].filter(value => value !== name)) assert.ok(!ui.text().includes(other));
  }
  ui.button('Semua').props.onPress(); ui.render();
  for (const name of ['Andi', 'Budi', 'Citra']) assert.ok(ui.text().includes(name));
});

test('realtime final decision and offline change prevent stale confirmation writes', async () => {
  for (const mode of ['final', 'offline']) {
    const ui = screen(); ui.render(); ui.emit([ui.request]); ui.render();
    ui.button('Setujui').props.onPress(); ui.render();
    if (mode === 'final') ui.emit([{ ...ui.request, status: 'ditolak' }]);
    else ui.offline();
    ui.render();
    const confirm = ui.button('Ya, setujui');
    assert.equal(confirm.props.disabled, true);
    await confirm.props.onPress();
    assert.equal(ui.writes(), 0);
  }
});

test('failed transaction keeps pending record and permits explicit retry', async () => {
  const ui = screen(); ui.render(); ui.emit([ui.request]); ui.render();
  ui.button('Setujui').props.onPress(); ui.render();
  const first = ui.button('Ya, setujui').props.onPress();
  ui.reject(); await first; ui.render();
  assert.match(ui.text(), /Gagal/);
  assert.equal(ui.button('Ya, setujui').props.disabled, false);
  assert.equal(ui.button('Setujui').props.disabled, false);
});
