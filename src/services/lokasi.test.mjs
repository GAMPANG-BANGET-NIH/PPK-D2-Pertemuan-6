import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

function transpileTs(url) {
  const source = readFileSync(url, 'utf8');
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
}

function loadAttendanceVerification() {
  const code = transpileTs(new URL('./attendance-verification.ts', import.meta.url));
  const mod = { exports: {} };
  const fn = new Function('exports', 'require', 'module', code);
  fn(
    mod.exports,
    (id) => {
      if (id === '../lib/firebase') return { db: {} };
      if (id === 'firebase/firestore') {
        return {
          doc: () => ({}),
          runTransaction: async () => {},
          serverTimestamp: () => new Date(),
        };
      }
      throw new Error(`Unexpected require in attendance-verification: ${id}`);
    },
    mod,
  );
  return mod.exports;
}

function loadLokasi(overrides = {}) {
  const attendanceVerification = loadAttendanceVerification();
  const mockLocation = {
    Accuracy: { High: 4, Balanced: 3 },
    hasServicesEnabledAsync: async () => true,
    getForegroundPermissionsAsync: async () => ({ status: 'granted', canAskAgain: true }),
    requestForegroundPermissionsAsync: async () => ({ status: 'granted', canAskAgain: true }),
    getCurrentPositionAsync: async () => ({
      coords: {
        latitude: -6.20005,
        longitude: 106.816666,
        accuracy: 12,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    }),
    watchPositionAsync: async (_opts, cb) => {
      cb({
        coords: {
          latitude: -6.20005,
          longitude: 106.816666,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      });
      return { remove: () => {} };
    },
    ...overrides.location,
  };

  const mockRN = {
    Platform: { OS: overrides.platformOS ?? 'android' },
    Linking: { openSettings: overrides.openSettings ?? (async () => {}) },
  };

  const code = transpileTs(new URL('./lokasi.ts', import.meta.url));
  const mod = { exports: {} };
  const fn = new Function('exports', 'require', 'module', code);
  fn(
    mod.exports,
    (id) => {
      if (id === 'expo-location') return mockLocation;
      if (id === 'react-native') return mockRN;
      if (id === './attendance-verification') return attendanceVerification;
      throw new Error(`Unexpected require in lokasi: ${id}`);
    },
    mod,
  );
  return mod.exports;
}

test('toLocationReading accepts valid coordinates and rejects missing accuracy', () => {
  const { toLocationReading, LocationServiceError } = loadLokasi();
  const now = Date.now();

  const valid = toLocationReading({
    coords: {
      latitude: -6.2,
      longitude: 106.816666,
      accuracy: 14,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: now,
    mocked: false,
  });

  assert.equal(valid.latitude, -6.2);
  assert.equal(valid.accuracy, 14);
  assert.equal(valid.mocked, false);

  assert.throws(
    () =>
      toLocationReading({
        coords: {
          latitude: -6.2,
          longitude: 106.816666,
          accuracy: null,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: now,
      }),
    (err) => err instanceof LocationServiceError && err.code === 'accuracy_unavailable',
  );
});

test('validateLocationReading rejects stale and low-accuracy readings', () => {
  const { validateLocationReading } = loadLokasi();
  const now = 1_700_000_000_000;

  const ok = validateLocationReading(
    { latitude: -6.2, longitude: 106.816666, accuracy: 250, timestamp: now - 5_000 },
    { nowMs: now },
  );
  assert.equal(ok.valid, true);
  assert.equal(ok.reason, 'ok');

  const stale = validateLocationReading(
    { latitude: -6.2, longitude: 106.816666, accuracy: 15, timestamp: now - 120_000 },
    { nowMs: now },
  );
  assert.equal(stale.valid, false);
  assert.equal(stale.reason, 'stale');

  const poor = validateLocationReading(
    { latitude: -6.2, longitude: 106.816666, accuracy: 550, timestamp: now - 2_000 },
    { nowMs: now },
  );
  assert.equal(poor.valid, false);
  assert.equal(poor.reason, 'accuracy_too_low');
});

test('evaluateLabProximity handles eligible, outside_radius, accuracy_too_low, and inactive lab', () => {
  const { evaluateLabProximity } = loadLokasi();
  const now = 1_700_000_000_000;
  const activeLab = {
    latitude: -6.2,
    longitude: 106.816666,
    radiusMeters: 50,
    active: true,
  };

  const inside = evaluateLabProximity(
    { latitude: -6.2001, longitude: 106.816666, accuracy: 300, timestamp: now - 1_000 },
    activeLab,
    { nowMs: now },
  );
  assert.equal(inside.eligible, true);
  assert.equal(inside.reason, 'eligible');
  assert.equal(inside.withinRadius, true);

  const outside = evaluateLabProximity(
    { latitude: -6.202, longitude: 106.816666, accuracy: 12, timestamp: now - 1_000 },
    activeLab,
    { nowMs: now },
  );
  assert.equal(outside.eligible, false);
  assert.equal(outside.reason, 'outside_radius');
  assert.ok(outside.overflowMeters > 100);

  const lowAcc = evaluateLabProximity(
    { latitude: -6.20005, longitude: 106.816666, accuracy: 550, timestamp: now - 1_000 },
    activeLab,
    { nowMs: now },
  );
  assert.equal(lowAcc.eligible, false);
  assert.equal(lowAcc.reason, 'accuracy_too_low');

  const inactive = evaluateLabProximity(
    { latitude: -6.20005, longitude: 106.816666, accuracy: 10, timestamp: now - 1_000 },
    { ...activeLab, active: false },
    { nowMs: now },
  );
  assert.equal(inactive.eligible, false);
  assert.equal(inactive.reason, 'lab_inactive');
});

test('getCurrentLocation rejects when GPS disabled, permission denied/blocked, or timed out', async () => {
  const gpsOff = loadLokasi({
    location: { hasServicesEnabledAsync: async () => false },
  });
  await assert.rejects(
    () => gpsOff.getCurrentLocation(),
    (err) => err.code === 'gps_disabled',
  );

  const denied = loadLokasi({
    location: {
      getForegroundPermissionsAsync: async () => ({ status: 'denied', canAskAgain: true }),
      requestForegroundPermissionsAsync: async () => ({ status: 'denied', canAskAgain: true }),
    },
  });
  await assert.rejects(
    () => denied.getCurrentLocation(),
    (err) => err.code === 'permission_denied' && err.canAskAgain === true,
  );

  const blocked = loadLokasi({
    location: {
      getForegroundPermissionsAsync: async () => ({ status: 'denied', canAskAgain: false }),
      requestForegroundPermissionsAsync: async () => ({ status: 'denied', canAskAgain: false }),
    },
  });
  await assert.rejects(
    () => blocked.getCurrentLocation(),
    (err) => err.code === 'permission_blocked' && err.canAskAgain === false,
  );

  const timedOut = loadLokasi({
    location: {
      getCurrentPositionAsync: () => new Promise(() => {}),
    },
  });
  await assert.rejects(
    () => timedOut.getCurrentLocation({ timeoutMs: 30 }),
    (err) => err.code === 'timeout',
  );
});

test('watchUserLocation skips starting watch when unsubscribed before permissions resolve', async () => {
  let watchCalled = false;
  const { watchUserLocation } = loadLokasi({
    location: {
      watchPositionAsync: async () => {
        watchCalled = true;
        return { remove: () => {} };
      },
    },
  });

  const unsubscribe = watchUserLocation(() => {}, () => {});
  unsubscribe();

  await new Promise((r) => setTimeout(r, 20));
  assert.equal(watchCalled, false);
});

test('watchUserLocation removes subscription if unsubscribed while watchPositionAsync is pending', async () => {
  let removed = false;
  let resolveWatch;
  let markStarted;
  const watchStarted = new Promise((resolve) => {
    markStarted = resolve;
  });
  const pendingWatch = new Promise((resolve) => {
    resolveWatch = resolve;
  });

  const { watchUserLocation } = loadLokasi({
    location: {
      watchPositionAsync: () => {
        markStarted();
        return pendingWatch;
      },
    },
  });

  const received = [];
  const errors = [];
  const unsubscribe = watchUserLocation(
    (r) => received.push(r),
    (e) => errors.push(e),
  );

  await watchStarted;
  unsubscribe();
  resolveWatch({
    remove: () => {
      removed = true;
    },
  });

  await new Promise((r) => setTimeout(r, 20));
  assert.equal(removed, true);
  assert.equal(received.length, 0);
  assert.equal(errors.length, 0);
});

test('formatDistanceMeters and formatCoordinates format values cleanly', () => {
  const { formatDistanceMeters, formatCoordinates } = loadLokasi();
  assert.equal(formatDistanceMeters(24.6), '25 m');
  assert.equal(formatDistanceMeters(1350), '1,35 km');
  assert.equal(formatCoordinates(-6.2, 106.816666), '-6.200000, 106.816666');
});
