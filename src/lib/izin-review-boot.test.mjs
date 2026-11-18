import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getApps } from 'firebase/app';
import ts from 'typescript';

const sourceRoot = new URL('../', import.meta.url);
const configurationMessage = 'Konfigurasi Firebase belum lengkap. Isi .env.local lalu mulai ulang aplikasi.';
for (const key of Object.keys(process.env)) {
  if (key.startsWith('EXPO_PUBLIC_FIREBASE_')) delete process.env[key];
}

// Real route/service/Firebase modules. Only transpilation and Metro web resolution;
// no Firebase, auth, service, hook, or native module doubles.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'react-native') specifier = 'react-native-web';
    if (specifier.startsWith('@/') || (specifier.startsWith('.') && context.parentURL?.startsWith(sourceRoot.href))) {
      const path = specifier.startsWith('@/')
        ? resolve(fileURLToPath(sourceRoot), specifier.slice(2))
        : resolve(dirname(fileURLToPath(context.parentURL)), specifier);
      const filename = [path, `${path}.ts`, `${path}.tsx`, resolve(path, 'index.ts')].find(candidate => existsSync(candidate) && /\.[cm]?[jt]sx?$/.test(candidate));
      if (filename) return { url: pathToFileURL(filename).href, shortCircuit: true };
    }
    const result = nextResolve(specifier, context);
    if (result.url.startsWith('file:') && result.url.endsWith('.js')) {
      const web = result.url.replace(/\.js$/, '.web.js');
      if (existsSync(fileURLToPath(web))) return { ...result, url: web };
    }
    return result;
  },
  load(url, context, nextLoad) {
    if (!url.startsWith(sourceRoot.href) || !/\.tsx?$/.test(url)) return nextLoad(url, context);
    const { outputText } = ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    });
    return { format: 'module', source: outputText, shortCircuit: true };
  },
});

test('review service imports without Firebase config and reports config only when used', async () => {
  let service;
  await assert.doesNotReject(async () => { service = await import('../services/izin-review.ts'); });
  assert.equal(typeof service.subscribeAllPermissions, 'function');
  assert.equal(getApps().length, 0);
  const errors = [];
  let stop;
  await new Promise(resolve => {
    stop = service.subscribeAllPermissions(() => assert.fail('No Firebase config must not emit rows'), error => { errors.push(error); resolve(); });
    assert.equal(typeof stop, 'function', 'Subscription must return cleanup synchronously');
  });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].message, configurationMessage);
  stop();
  await assert.rejects(service.decidePermission('s1_p1', 'disetujui', 'as1'), { message: configurationMessage });
  assert.equal(getApps().length, 0);
});

test('cleanup suppresses a real missing-config import rejection', async () => {
  const { subscribeAllPermissions } = await import('../services/izin-review.ts');
  const callbacks = [];
  const stop = subscribeAllPermissions(value => callbacks.push(value), error => callbacks.push(error));
  stop();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(callbacks, []);
});

test('review route imports without Firebase config before AuthProvider mounts', async () => {
  let route;
  await assert.doesNotReject(async () => { route = await import('../app/asisten-izin.tsx'); });
  assert.equal(typeof route.default, 'function');
  assert.equal(getApps().length, 0);
});

test('real Firebase initializer still rejects missing config rather than using placeholders', async () => {
  await assert.rejects(import('./firebase.ts'), { message: configurationMessage });
  assert.equal(getApps().length, 0);
});
