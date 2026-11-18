import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const model = require('../lib/ai/model-edom.json');
const { createSentimentClassifier } = require('../lib/ai/sentiment.js');

function loadClassifyReason() {
  const source = readFileSync(new URL('./ai.ts', import.meta.url), 'utf8');
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
    if (id === '../lib/ai/model-edom.json') return model;
    if (id === '../lib/ai/sentiment') return { createSentimentClassifier };
    return require(id);
  }, mod);
  return mod.exports.classifyReason;
}

const classifyReason = loadClassifyReason();

test('classifyReason predicts sentiment for known Indonesian text', () => {
  const result = classifyReason('Sakit demam dan kurang jelas penjelasannya');
  assert.equal(result.model, 'model-edom');
  assert.equal(result.experimental, true);
  assert.equal(result.status, 'predicted');
  assert.ok(['positif', 'netral', 'negatif'].includes(result.label));
});

test('classifyReason returns unknown_vocabulary with null label (never netral)', () => {
  const result = classifyReason('asdfghjkl qwertzxcvb');
  assert.deepEqual(result, {
    status: 'unknown_vocabulary',
    label: null,
    model: 'model-edom',
    experimental: true,
  });
});

test('classifyReason returns empty_input with null label for blank input', () => {
  const result = classifyReason('   ');
  assert.deepEqual(result, {
    status: 'empty_input',
    label: null,
    model: 'model-edom',
    experimental: true,
  });
});

test('classifyReason never throws even on invalid runtime input', () => {
  // @ts-expect-error verifying runtime resilience
  const result = classifyReason(null);
  assert.deepEqual(result, {
    status: 'gagal',
    label: null,
    model: 'model-edom',
    experimental: true,
  });
});
