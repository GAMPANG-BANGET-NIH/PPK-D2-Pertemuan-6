import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

function loadAttendanceVerification() {
  const source = readFileSync(new URL('./attendance-verification.ts', import.meta.url), 'utf8');
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
    if (id === '../lib/firebase') {
      return { db: {} };
    }
    if (id === 'firebase/firestore') {
      return {
        doc: () => ({}),
        runTransaction: async () => {},
        serverTimestamp: () => new Date(),
      };
    }
    throw new Error(`Unexpected require: ${id}`);
  }, mod);

  return mod.exports;
}

const { calculateHaversineDistanceMeters, validateGeolocation } = loadAttendanceVerification();

test('calculateHaversineDistanceMeters returns 0 for identical coordinates', () => {
  const d = calculateHaversineDistanceMeters(-6.200000, 106.816666, -6.200000, 106.816666);
  assert.equal(d, 0);
});

test('calculateHaversineDistanceMeters accurately calculates short distance', () => {
  // ~111 meters per 0.001 degree of latitude
  const d = calculateHaversineDistanceMeters(-6.200000, 106.816666, -6.200500, 106.816666);
  assert.ok(d > 50 && d < 65, `Expected distance ~55m, got ${d}`);
});

test('validateGeolocation passes when within lab radius and accuracy is high', () => {
  const result = validateGeolocation({
    userLat: -6.200100,
    userLon: 106.816666,
    userAccuracy: 15, // 15m is good
    labLat: -6.200000,
    labLon: 106.816666,
    labRadiusMeters: 50, // 50m radius
  });

  assert.equal(result.valid, true);
  assert.equal(result.reason, 'within_radius');
  assert.ok(result.distanceMeters <= 50);
});

test('validateGeolocation fails when outside lab radius', () => {
  const result = validateGeolocation({
    userLat: -6.202000, // ~220m away
    userLon: 106.816666,
    userAccuracy: 10,
    labLat: -6.200000,
    labLon: 106.816666,
    labRadiusMeters: 50,
  });

  assert.equal(result.valid, false);
  assert.equal(result.reason, 'outside_radius');
  assert.ok(result.distanceMeters > 50);
  assert.match(result.message, /di luar area laboratorium/i);
});

test('validateGeolocation rejects when GPS accuracy is too low', () => {
  const result = validateGeolocation({
    userLat: -6.200010,
    userLon: 106.816666,
    userAccuracy: 85, // 85m is too poor (> 50m threshold)
    labLat: -6.200000,
    labLon: 106.816666,
    labRadiusMeters: 50,
    maxAccuracyThresholdMeters: 50,
  });

  assert.equal(result.valid, false);
  assert.equal(result.reason, 'accuracy_too_low');
  assert.match(result.message, /terlalu rendah/i);
});
