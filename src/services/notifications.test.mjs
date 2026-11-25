import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

function loadNotificationsService() {
  const source = readFileSync(new URL('./notifications.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const mod = { exports: {} };
  const fn = new Function('exports', 'require', 'module', outputText);
  fn(mod.exports, (id) => {
    if (id === 'expo-notifications') {
      return {
        PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
        getPermissionsAsync: async () => ({ status: 'granted', canAskAgain: true }),
        requestPermissionsAsync: async () => ({ status: 'granted', canAskAgain: true }),
        getExpoPushTokenAsync: async () => ({ data: 'ExponentPushToken[mock]' }),
      };
    }
    if (id === 'expo-device') {
      return { isDevice: true };
    }
    if (id === 'expo-constants') {
      return { expoConfig: { extra: { eas: { projectId: 'mock-project-id' } } } };
    }
    if (id === 'react-native') {
      return { Platform: { OS: 'android' } };
    }
    if (id === '../lib/firebase') {
      return { db: {} };
    }
    if (id === 'firebase/firestore') {
      return {
        doc: () => ({}),
        setDoc: async () => {},
        deleteDoc: async () => {},
        serverTimestamp: () => new Date(),
      };
    }
    throw new Error(`Unexpected require: ${id}`);
  }, mod);

  return mod.exports;
}

const { formatTargetedNotification } = loadNotificationsService();

test('formatTargetedNotification formats session_opened notification correctly', () => {
  const payload = formatTargetedNotification({
    type: 'session_opened',
    sessionTitle: 'Pemrograman Web Pertemuan 6',
    classId: 'SI-5A',
    labName: 'Lab Komputer 3',
  });

  assert.equal(payload.title, 'Sesi Praktikum Dibuka: Pemrograman Web Pertemuan 6');
  assert.ok(payload.body.includes('SI-5A'));
  assert.ok(payload.body.includes('Lab Komputer 3'));
  assert.equal(payload.data?.type, 'session_opened');
  assert.equal(payload.data?.classId, 'SI-5A');
});

test('formatTargetedNotification formats schedule_changed notification correctly', () => {
  const payload = formatTargetedNotification({
    type: 'schedule_changed',
    course: 'Basis Data Lanjut',
    classId: 'SI-5B',
  });

  assert.equal(payload.title, 'Perubahan Jadwal Praktikum');
  assert.ok(payload.body.includes('Basis Data Lanjut'));
  assert.ok(payload.body.includes('SI-5B'));
  assert.equal(payload.data?.type, 'schedule_changed');
});

test('formatTargetedNotification formats permission_decided approved correctly', () => {
  const payload = formatTargetedNotification({
    type: 'permission_decided',
    sessionTitle: 'Sesi 1 Mobile',
    status: 'disetujui',
  });

  assert.equal(payload.title, 'Pengajuan Izin: Disetujui');
  assert.ok(payload.body.includes('disetujui'));
  assert.ok(payload.body.includes('Sesi 1 Mobile'));
  assert.equal(payload.data?.status, 'disetujui');
});

test('formatTargetedNotification formats permission_decided rejected correctly', () => {
  const payload = formatTargetedNotification({
    type: 'permission_decided',
    sessionTitle: 'Sesi 2 Basis Data',
    status: 'ditolak',
  });

  assert.equal(payload.title, 'Pengajuan Izin: Ditolak');
  assert.ok(payload.body.includes('ditolak'));
  assert.equal(payload.data?.status, 'ditolak');
});
